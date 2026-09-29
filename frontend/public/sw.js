/*
 * Service worker — exists primarily so Chrome / Edge / Samsung Internet fire
 * the `beforeinstallprompt` event (no SW → the browser refuses the install
 * prompt even with a perfect manifest), and to give the installed PWA a useful
 * offline story for a tournament organiser in a hall with flaky Wi-Fi:
 *
 *   - SPA navigations: network-first, fall back to the cached app shell so a
 *     cold launch offline still boots index.html instead of the browser's
 *     "no internet" page, and to a tiny inline offline page as a last resort.
 *   - The BUILD OUTPUT the shell needs to execute (/assets/*): precached from
 *     `/precache-manifest.json` and then served cache-first. See PRECACHE
 *     below — this is what makes an offline cold start reach /blok.
 *   - API reads (GET /api/*): network-first, fall back to the LAST cached
 *     snapshot. Online it's always fresh (and the snapshot is refreshed); the
 *     cache is served ONLY when the network is unreachable. That lets the round
 *     view and the standings open — and survive a reload — with no signal.
 *     Network-first is the key: there's no stale-JSON surprise while connected.
 *     ONE exception (2026-09-13): the public tournaments list, its count and a
 *     tournament's summary are stale-while-revalidate — the snapshot is served
 *     at once, the network copy replaces it in the background and the page is
 *     told (`bela:api-refreshed`, handled in PushBootstrap) to refetch. Those
 *     three change slowly and are the first paint of the app; the round view's
 *     sub-resources stay network-first.
 *   - Writes (POST/PUT/PATCH/DELETE): never touched — straight to the network.
 *   - Cross-origin: never touched.
 *
 * /assets/* USED TO BE PASSED THROUGH, and that is the change that made the
 * offline scorepad possible. The old reasoning — "Vite hashes every asset and
 * Caddy serves them `immutable`, so the browser's own HTTP cache already does
 * the right thing" — holds for a RETURN visit and only for files the browser
 * happens to still be holding. It says nothing about a chunk this device has
 * never fetched, which is exactly the case the scorepad has to survive: /blok
 * is a lazily-imported route, so a player who installed the app and never
 * opened the blok while online has no HTTP-cache entry for it and no way to
 * get one on a bus. Cache-first over a content-hashed file name is safe by
 * construction (the name changes when the bytes do), and the reason the old
 * comment gave for staying out — a failed fetch resolving to `undefined` and
 * crashing the worker with "Failed to convert value to 'Response'" — is
 * handled the way every other handler here handles it: `assetCacheFirst`
 * always resolves to a real Response.
 *
 * Per-user endpoints are excluded from the API cache entirely (see
 * NEVER_CACHE_API below): the snapshot would otherwise survive a sign-out and
 * be served to the next person on the device. The same goes for ANY request
 * that carries an `Authorization` header — the response is by definition the
 * signed-in variant, and several endpoints return organiser-only fields to the
 * owner and a trimmed body to everyone else on the very same URL.
 *
 * DECK_CACHE (2026-09-20): bela online's card decks (`frontend/src/game/cards`)
 * are hashed Vite assets under /assets/, exactly like the shell's own chunks,
 * but they must NOT ride in the always-precached SHELL tier of
 * `/precache-manifest.json` — a visitor who only ever opens the tournament
 * pages would otherwise download megabytes of card art they never look at.
 * (Since 2026-09-29 every deck also rides in the optional `game` tier — see
 * PRECACHE TIERS — which only players ask for; a file already held there is
 * not stored a second time here.) So deck images get their OWN cache, filled only on
 * request (see the `bela:cache-deck` message handler below, called from
 * `src/game/cards/deckOffline.ts` once a player has actually chosen a deck),
 * kept in a cache separate from CACHE so `refreshPrecache`'s prune (which
 * only ever walks CACHE) and a future shell cache-name bump never touch it.
 * `assetCacheFirst` checks it as a second cache, after the shell's — same
 * "hashed name IS the version" safety property as the rest of /assets/*.
 * HONEST SCOPE: the game itself needs a live WebSocket, so caching the deck
 * does not make a hand playable offline. What it buys is (a) a flaky
 * connection or reconnect never shows a blank card, because the art was
 * already local, and (b) a repeat visit never re-downloads the same deck.
 *
 * The game's recorded sound samples (`src/game/util/sounds.ts`, added
 * alongside this note) ride the exact same mechanism under a pseudo deck
 * name, `"sounds"` — same reasoning (a tournament-only visitor should not
 * fetch game audio either) and the same DECK_CACHE, so they get no dedicated
 * cache or message type of their own, just one more `.wav` entry in
 * DECK_ASSET_EXT_RE below and a call to `cacheDeckOffline("sounds", …)`.
 */

const CACHE = "bela-shell-v4";
const API_CACHE = "bela-api-v1";
const DECK_CACHE = "bela-decks-v1";
// OpenFreeMap basemap (style JSON, TileJSON, sprites, glyphs, vector tiles).
const MAP_CACHE = "bela-map-v1";
const MAP_HOST = "tiles.openfreemap.org";
const MAP_CACHE_LIMIT = 1500;
// Posters and avatars (/api/resources/<id>/image[?w=]). A resource id's bytes
// never change (the backend sends `immutable`), so cache-first is exact.
const IMG_CACHE = "bela-img-v1";
const IMG_CACHE_LIMIT = 300;
const IMG_PATH = /^\/api\/resources\/\d+\/image$/;
// Public files do not get Vite hashes, so list the decorative background and
// both products' visible marks explicitly. They must paint from Cache Storage
// on a cold PWA launch even when the connection is weak or absent.
const STATIC_ASSETS = [
    "/bg-cards-faded.png",
    "/bela-turniri-symbol-light.svg",
    "/bela-turniri-symbol-dark.svg",
    "/bela-turniri-symbol.png",
    "/games/symbol.svg",
    "/games/symbol.png",
];
/* SEVERAL DOMAINS, ONE WORKER (2026-09-20). The same bundle is served on
 * bela-turniri.com and on the games domains (bela.games, belot.games), and
 * those two groups have DIFFERENT HTML shells:
 * `/index.html` and `/index.games.html`, built from one another (see the
 * `bela-games-shell` plugin in vite.config.ts). A service worker's storage is
 * per-origin, so each host caches its own shell — but only if the worker asks
 * for it by a name that resolves correctly on BOTH hosts.
 *
 * `"/"` is that name: it is the SPA entry on every domain and Caddy answers
 * it with that domain's shell. So the worker fetches and caches the shell as
 * `"/"` and never as `"/index.html"` — the literal file name would be right
 * on the full site and wrong here if the edge ever stopped rewriting it.
 * `"/index.html"` is still WRITTEN as an alias in refreshPrecache (an older
 * install may have cached it, and the navigation fallback still looks there
 * second), just never fetched. Same story for `/manifest.webmanifest`, which
 * Caddy rewrites to `/manifest.games.webmanifest` on bela.games. */
const SHELL = ["/", "/manifest.webmanifest", ...STATIC_ASSETS];

/* ─────────────────────────────── PRECACHE ───────────────────────────────
 * `/precache-manifest.json` is written at build time by the
 * `bela-precache-manifest` plugin in vite.config.ts (read its header for what
 * goes in and why). It names the app shell's own chunks plus everything the
 * /blok route chunk statically needs, with the hashed file names only Rollup
 * can know — and, as an optional tier, the online game (see PRECACHE TIERS
 * below).
 *
 * WHY THE WORKER FETCHES A LIST INSTEAD OF CARRYING ONE
 * ────────────────────────────────────────────────────
 * A browser re-installs a service worker only when sw.js's BYTES change. This
 * file is `public/sw.js`, copied verbatim, so it is byte-identical across
 * deploys — meaning `install` runs once, ever, on a given device. A file list
 * baked in here would therefore freeze at whatever build first installed and
 * would name assets that no longer exist a week later. Fetching the manifest
 * instead lets every page load re-check the CURRENT build (the app asks for it
 * — see the `message` handler and src/components/SwUpdateToast.tsx) without an
 * install, and without sw.js having to change.
 *
 * THE SHELL AND ITS ASSETS ARE REPLACED TOGETHER, IN THAT ORDER
 * ────────────────────────────────────────────────────────────
 * `refreshPrecache` adds the new build's assets FIRST, then re-stores
 * index.html, then deletes assets no build in the manifest claims. Any other
 * order can leave a cached index.html pointing at chunks that were already
 * pruned — an offline cold start that boots the shell and then dies on its
 * own <script>, which is worse than not caching at all.
 * ────────────────────────────────────────────────────────────────────── */
const PRECACHE_MANIFEST = "/precache-manifest.json";
/** Cache key (never a real URL) holding the build the precache last completed
 *  for. Lets the every-page-load check stop after ~300 bytes when nothing has
 *  been deployed since — which is almost always. */
const BUILD_STAMP = "/__precache-build";
// Cap the runtime API cache so a long-running install can't grow it unbounded.
const API_CACHE_LIMIT = 80;
// Never persist an offline snapshot of these — they're per-user, per-device or
// auth-varying (the same URL answers differently for the owner and a guest).
const NEVER_CACHE_API = [
    "/api/user/",
    "/api/admin/",
    "/api/push/",
    "/api/pair-requests",
    "/api/public/users/",
    // The .ics subscription feed: bytes for a calendar client, never a
    // snapshot the SPA reads back, and big enough to matter in an 80-entry
    // cache (CalendarFeedController).
    "/api/calendar/",
];
// Same idea, but for paths that need a pattern rather than a prefix.
const NEVER_CACHE_API_PATTERNS = [
    /^\/api\/tournaments\/[^/]+\/pairs/,
    // Rendered images, not JSON: an anonymous GET /api/* like any other, so
    // without this the QR code and the 1200x630 Open Graph card land in the
    // API snapshot cache and evict the round/standings JSON that offline mode
    // actually depends on. Both are already ETag'd and served from the
    // browser's own HTTP cache.
    /^\/api\/tournaments\/[^/]+\/qr\.png/,
    /^\/api\/tournaments\/[^/]+\/share-image\.png/,
    // Waiter ("konobar") bills. These carry no `Authorization` header — the
    // credential is `X-Waiter-Token` — so the auth check above does not catch
    // them, yet the body is exactly the kind of per-credential data that check
    // exists to keep out of the snapshot: one tournament's drink bills, who
    // owes what, and what has been settled. Without this line the list and
    // every opened bill survive "Izlaz" (and a regenerated code) in
    // Cache Storage, readable by whoever holds the device next.
    /^\/api\/tournaments\/[^/]+\/waiter\//,
];

/* ──────────────────────────── PRECACHE TIERS ────────────────────────────
 * (2026-09-29) The manifest is split so a tournament-only visitor no longer
 * downloads the online game's 4 MB of card art after every deploy:
 *
 *   { "build": "...", "files": [shell…], "tiers": { "game": [...] } }
 *
 * `files` is the SHELL tier, always precached — same key as before, so a
 * worker that predates tiers reads the shell and ignores the rest. Every
 * `tiers.<name>` list is OPTIONAL and fetched only when a page asks for it in
 * its `bela:precache` message (`{ type, tiers: ["game"] }`, sent by
 * src/pwa/precacheTiers.ts). A manifest with no `tiers` (an older build) is
 * simply all-shell.
 *
 * Per-tier bookkeeping lives in CACHE under keys that are never real URLs:
 *   • BUILD_STAMP (shell) and BUILD_STAMP + "/<tier>" — the build each tier
 *     last COMPLETED for. The shell keeps the old key, so an install that
 *     predates tiers still skips the pass when nothing was deployed.
 *   • HELD_TIERS — every optional tier this device has ever been asked for.
 *     Written BEFORE a tier's first download, so a pass that died halfway
 *     still protects what it fetched.
 *
 * PRUNING keeps the shell plus every HELD tier's files that the CURRENT
 * manifest still lists — not just the tiers this page load asked for. A
 * player who opens a tournament link (no game request: data saver, or the
 * kill switch was off) must not lose the card art the lobby cached an hour
 * ago. A file that no tier of the current manifest names is pruned as before.
 * A held tier is only REFRESHED (new files downloaded) when a page asks for
 * it; otherwise its stale files are pruned and its fresh ones kept, and the
 * next request under this build finds the tier's stamp stale and fills it in.
 * ────────────────────────────────────────────────────────────────────── */
const SHELL_TIER = "shell";
const HELD_TIERS = "/__precache-tiers";
const TIER_NAME_RE = /^[a-z]{1,24}$/;
const TIERS_LIMIT = 8;

/** Only same-origin build output, and never a path that could walk out of
 *  it: the manifest is fetched, so it is treated as input. */
function sanitizeManifestList(list) {
    const out = new Set();
    if (!Array.isArray(list)) return out;
    for (const file of list) {
        if (typeof file !== "string") continue;
        if (!file.startsWith("/assets/") || file.includes("..")) continue;
        out.add(file);
    }
    return out;
}

/** Manifest body → Map(tier → Set(path)). Always has SHELL_TIER when valid. */
function parseManifestTiers(body) {
    const tiers = new Map();
    if (!body || typeof body !== "object") return tiers;
    const shell = sanitizeManifestList(body.files);
    if (shell.size === 0) return tiers;
    tiers.set(SHELL_TIER, shell);
    const optional = body.tiers && typeof body.tiers === "object" ? body.tiers : {};
    for (const name of Object.keys(optional).slice(0, TIERS_LIMIT)) {
        if (name === SHELL_TIER || !TIER_NAME_RE.test(name)) continue;
        const files = sanitizeManifestList(optional[name]);
        if (files.size > 0) tiers.set(name, files);
    }
    return tiers;
}

/** The optional-tier names from a page message: untrusted, so validated. */
function sanitizeTierRequest(list) {
    const out = [];
    if (!Array.isArray(list)) return out;
    for (const name of list.slice(0, TIERS_LIMIT)) {
        if (typeof name !== "string" || name === SHELL_TIER || !TIER_NAME_RE.test(name)) continue;
        if (!out.includes(name)) out.push(name);
    }
    return out;
}

function stampKey(tier) {
    return tier === SHELL_TIER ? BUILD_STAMP : `${BUILD_STAMP}/${tier}`;
}

async function readStamp(cache, tier) {
    try {
        const hit = await cache.match(stampKey(tier));
        return hit ? await hit.text() : null;
    } catch (_) {
        return null;
    }
}

/**
 * The optional tiers this device holds. HELD_TIERS is the record; for an
 * install from BEFORE tiers existed there is none, and the one signal that
 * the player already used the game is a deck index in DECK_CACHE (written
 * only once a deck was chosen at a table) — that keeps their card art through
 * the first shell-only pass instead of pruning it and fetching it again.
 */
async function readHeldTiers(cache) {
    const held = new Set();
    try {
        const hit = await cache.match(HELD_TIERS);
        if (hit) {
            const parsed = await hit.json();
            if (Array.isArray(parsed)) {
                for (const name of sanitizeTierRequest(parsed)) held.add(name);
            }
            return held;
        }
    } catch (_) {
        /* unreadable — fall through to the legacy signal */
    }
    try {
        const decks = await caches.open(DECK_CACHE);
        const keys = await decks.keys();
        if (keys.some((req) => new URL(req.url).pathname.startsWith(DECK_INDEX_PREFIX))) {
            held.add("game");
        }
    } catch (_) {
        /* storage unavailable — nothing held */
    }
    return held;
}

/** One precache pass at a time: install and a page's message can arrive in the
 *  same tick, and two passes would race the prune against the add. A request
 *  that arrives DURING a pass is not dropped (it may ask for a tier the
 *  running pass does not fetch): requests are merged into one follow-up pass,
 *  which is cheap when there is nothing left to do (see the stamp check). */
let precaching = null;
let queuedPass = null;

function refreshPrecache(tiers) {
    const requested = sanitizeTierRequest(tiers);
    if (!precaching) {
        precaching = runPrecache(requested).finally(() => {
            precaching = null;
        });
        return precaching;
    }
    if (!queuedPass) {
        const pass = { tiers: new Set() };
        pass.promise = precaching.then(() => {
            queuedPass = null;
            return refreshPrecache([...pass.tiers]);
        });
        queuedPass = pass;
    }
    for (const name of requested) queuedPass.tiers.add(name);
    return queuedPass.promise;
}

/**
 * Bring the shell cache in line with the CURRENT build, for the shell and for
 * every optional tier in `requested`.
 *
 * Best-effort throughout: every failure leaves the cache exactly as it was,
 * which is the whole safety property here — a half-applied precache is a shell
 * that boots into a missing chunk. Offline it fails at the first fetch and
 * changes nothing.
 */
async function runPrecache(requested) {
    try {
        // `no-store`: the point is to learn what is deployed RIGHT NOW, and
        // a manifest served from the HTTP cache would answer with the build
        // whose assets we already have.
        const resp = await fetch(PRECACHE_MANIFEST, { cache: "no-store" });
        if (!resp || !resp.ok) return;
        const body = await resp.json();
        const manifest = parseManifestTiers(body);
        if (!manifest.has(SHELL_TIER)) return;

        const cache = await caches.open(CACHE);
        // Asked-for tiers the current build actually has, shell first.
        const fetching = [SHELL_TIER, ...requested.filter((t) => manifest.has(t))];

        const heldKeys = await cache.keys();
        const have = new Set(heldKeys.map((req) => new URL(req.url).pathname));

        /* Nothing deployed since the last completed pass AND everything it
           wrote is still here: stop, having spent one small request. This
           runs on every page load, so the common case has to be cheap —
           without it each load would also re-fetch index.html and walk the
           cache. Both halves of the test matter: the stamp alone would
           skip a pass after the browser evicted part of the cache under
           storage pressure, and the completeness check alone would miss a
           deploy that changed only index.html. Checked PER TIER: a device
           that cached the shell for this build and now asks for the game
           tier for the first time has a current shell stamp but no game
           stamp, so the pass runs and fetches only the game's files. */
        const stamp = String(body.build ?? "");
        let upToDate = true;
        for (const t of fetching) {
            if ((await readStamp(cache, t)) !== stamp) upToDate = false;
            for (const path of manifest.get(t)) if (!have.has(path)) upToDate = false;
        }
        if (upToDate) return;

        // Tiers whose still-listed files survive the prune (see the header),
        // recorded before the first download of a newly asked-for tier.
        const held = await readHeldTiers(cache);
        const keeping = new Set(fetching);
        for (const t of held) if (manifest.has(t)) keeping.add(t);
        const heldBefore = held.size;
        for (const t of fetching) if (t !== SHELL_TIER) held.add(t);
        if (held.size !== heldBefore) {
            await cache.put(HELD_TIERS, new Response(JSON.stringify([...held])));
        }

        // 1. Add what is missing. One at a time rather than `addAll`, which
        //    is all-or-nothing: a single 404 (a deploy landing mid-pass)
        //    would throw away the dozen files that did arrive.
        const addMissing = async (tier) => {
            for (const path of manifest.get(tier)) {
                if (have.has(path)) continue;
                try {
                    await cache.add(path);
                    have.add(path);
                } catch (_) {
                    /* keep going — a partial precache still helps */
                }
            }
        };
        await addMissing(SHELL_TIER);

        // 2. Only now the shell, so it is never newer than the chunks it
        //    names — and BEFORE the optional tiers, so a slow 4 MB game
        //    download never delays the offline blok getting the new build.
        //    Fetched as "/" so each domain caches ITS OWN shell — see the
        //    SHELL comment at the top of this file. The "/index.html" copy
        //    is an alias for the navigation fallback, not a second fetch.
        try {
            const shell = await fetch("/", { cache: "no-store" });
            if (shell && shell.status === 200 && shell.type === "basic") {
                await cache.put("/index.html", shell.clone());
                await cache.put("/", shell);
            }
        } catch (_) {
            /* the previously cached shell stays — see the header */
        }

        for (const t of fetching) if (t !== SHELL_TIER) await addMissing(t);

        // 3. Prune the build output no longer claimed by the shell or a held
        //    tier. Everything else in this cache (the shell, the stamps, the
        //    held-tier record) is left alone — the filter is `/assets/`, and
        //    only this pass ever writes there.
        const wanted = new Set();
        for (const t of keeping) for (const path of manifest.get(t)) wanted.add(path);
        for (const req of heldKeys) {
            const path = new URL(req.url).pathname;
            if (!path.startsWith("/assets/")) continue;
            if (wanted.has(path)) continue;
            await cache.delete(req);
        }

        // 4. Last, so a pass that died halfway is not recorded as done and
        //    the next load picks up where it left off. Only the tiers this
        //    pass actually fetched are stamped.
        for (const t of fetching) await cache.put(stampKey(t), new Response(stamp));
    } catch (_) {
        /* offline, unparseable manifest, storage refusing to open */
    }
}

self.addEventListener("install", (event) => {
    // Pre-cache the SPA shell so a cold offline launch from the home-screen
    // icon shows index.html instead of the browser's "no internet" page, and
    // the build output it needs to execute — without which the shell boots
    // into a blank page on a device that has never opened the route.
    event.waitUntil(
        (async () => {
            try {
                const cache = await caches.open(CACHE);
                await cache.addAll(SHELL);
            } catch (_) {
                /* private mode, storage blocked, one of them 404 */
            }
            // Shell only: an install is not a page asking for a tier. Tiers
            // this device already holds survive it (see PRECACHE TIERS).
            await refreshPrecache([]);
        })()
    );
    // Skip waiting so a fresh deploy activates on the next page load instead
    // of waiting for every tab to close.
    //
    // DECISION: this stays unconditional rather than switching to the
    // "waiting" SW + postMessage({type: "SKIP_WAITING"}) pattern. Bela ships
    // small, frequent deploys; an organiser mid-tournament with a tab that
    // never closes shouldn't run a build from before a bug fix for hours.
    // The cost — an open tab's already-loaded JS not knowing a new worker
    // took over underneath it — is covered on the client side instead:
    // src/components/SwUpdateToast.tsx watches for an "installed" worker
    // while a controller already exists (= an update, not the first install)
    // and shows a persistent "new version" toast with a reload action, so a
    // tab can't end up silently stuck on stale code without the user being
    // told.
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    // Wipe any caches that aren't in the current whitelist (older shell
    // versions); keep the shell, the runtime API-snapshot cache, AND the
    // deck cache — bumping CACHE (a shell version change) must not throw
    // away card art a player already has offline.
    const keep = new Set([CACHE, API_CACHE, DECK_CACHE, MAP_CACHE, IMG_CACHE]);
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

/* The app asking the worker to re-check the deployed build — see
   src/components/SwUpdateToast.tsx, which sends this on every page load once
   the worker is active. That is what keeps the precache tracking deploys on a
   worker whose own bytes never change. `bela:cache-deck` is the other message
   this channel understands (see `cacheDeckOffline` and its header for the
   full design) — sent by `src/game/cards/deckOffline.ts` once a player has
   picked a deck, never on every page load. Anything else posted here is
   ignored. */
self.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.type === "bela:precache") {
        // `tiers` is optional (a page from before tiers sends none) and
        // untrusted; refreshPrecache validates it.
        event.waitUntil(refreshPrecache(data.tiers));
        return;
    }
    if (data.type === "bela:cache-deck") {
        event.waitUntil(handleCacheDeckMessage(data));
        return;
    }
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    // Only intercept GETs — POST/PUT/PATCH/DELETE go straight to the network.
    if (req.method !== "GET") return;

    const url = new URL(req.url);
    // The one cross-origin host we DO cache: the vector basemap, so /karta
    // paints from disk on every visit after the first (see mapCache below).
    if (url.hostname === MAP_HOST) {
        event.respondWith(mapCache(req, url, event));
        return;
    }
    // Leave the rest of cross-origin (Firebase, MinIO posters) to the browser.
    if (url.origin !== self.location.origin) return;
    // Hashed, immutable build output: whatever is precached IS the right
    // answer, and offline it is the only one (see the file header).
    if (url.pathname.startsWith("/assets/") || STATIC_ASSETS.includes(url.pathname)) {
        event.respondWith(assetCacheFirst(req));
        return;
    }

    // API reads: network-first with a last-snapshot fallback (see file header).
    // Exception: /api/tournaments* lists use stale-while-revalidate for perceived
    // speed (return cached list immediately, refresh in background).
    // Uploaded images first: they are /api/* by path but not API data. Left to
    // apiNetworkFirst they waited on the backend (which itself fetches from
    // object storage) on every refresh, and filled the 80-entry JSON snapshot
    // cache with image bytes.
    if (IMG_PATH.test(url.pathname)) {
        event.respondWith(imageCacheFirst(req, event));
        return;
    }

    if (url.pathname.startsWith("/api/")) {
        // Exactly the public list, its count and one tournament's summary
        // (`/api/tournaments`, `/api/tournaments/count`, `/api/tournaments/<id>`);
        // never the sub-resources (pairs, rounds, matches, standings), which
        // the round view relies on being fresh while connected.
        const isTournamentsList = /^\/api\/tournaments(\/count|\/[^/]+)?$/.test(url.pathname)
            && !/^\/api\/tournaments\/(mine|multipart)$/.test(url.pathname);
        if (isTournamentsList) {
            event.respondWith(apiStaleWhileRevalidate(req, url));
        } else {
            event.respondWith(apiNetworkFirst(req, url));
        }
        return;
    }

    // Everything else the SW owns is a top-level SPA navigation.
    if (req.mode !== "navigate") return;
    event.respondWith(navigationNetworkFirst(req, event));
});

/**
 * Cache-first for /assets/*, the hashed build output.
 *
 * Safe by construction: Vite puts a content hash in every one of these names,
 * so a cached response can never be a STALE version of the file being asked
 * for — a changed file is a changed name and therefore a cache miss. A hit is
 * the same bytes the network would send, minus the round trip.
 *
 * A miss falls through to the network, and a miss with no network resolves to
 * a real 503 rather than `undefined`: the app's own chunk-load path turns that
 * into the offline screen (src/utils/lazyWithReload.ts).
 *
 * It deliberately does NOT write to the cache on a miss. What belongs here is
 * decided by the manifest, in one pass, so the prune step can tell "this build
 * needs it" from "some route happened to be visited once" — a runtime
 * write-through would fill the shell cache with every chunk of the app and
 * make the pruning meaningless.
 *
 * The one exception is DECK_CACHE, checked second: card art is also a hashed
 * /assets/* file but is filled explicitly via `bela:cache-deck` (see that
 * handler's header) rather than the build-wide manifest, precisely so a
 * tournament-only visitor never pays for it. This is still read-only here —
 * a miss on both caches falls through to the network exactly as before, and
 * still never write-through-caches an arbitrary asset.
 */
async function assetCacheFirst(req) {
    try {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
    } catch (_) {
        /* storage unavailable — go to the network like any normal request */
    }
    try {
        const deckCache = await caches.open(DECK_CACHE);
        const deckHit = await deckCache.match(req);
        if (deckHit) return deckHit;
    } catch (_) {
        /* storage unavailable */
    }
    try {
        return await fetch(req);
    } catch (_) {
        return new Response("", { status: 503, statusText: "Offline" });
    }
}

/* ──────────────────────────────────────────────────────────────────────
 *  DECK CACHE — on-demand offline caching for bela online's card art
 * ────────────────────────────────────────────────────────────────────── */

// A deck is 32 faces + a back + up to four suit icons (37 files today), so 80
// leaves headroom without accepting an unbounded list.
const DECK_URLS_LIMIT = 80;
const DECK_NAME_RE = /^[a-z]{1,24}$/;
// Image extensions for a real deck, plus `.wav` for the pseudo "sounds" deck
// (`frontend/src/game/util/sounds.ts`'s recorded card-place/shuffle samples,
// cached through this exact mechanism — see the DECK_CACHE header above).
const DECK_ASSET_EXT_RE = /\.(webp|png|jpe?g|svg|wav)$/i;
// A synthetic (never-fetched) request path per deck, used as a cache key to
// remember which /assets/* files that deck's LAST successful pass put in
// DECK_CACHE — see `cacheDeckOffline` for why this is needed to prune stale
// hashes across a deploy without ever touching another deck's entries.
const DECK_INDEX_PREFIX = "/__deck-index__/";

/**
 * Validate and normalise the `urls` from a `bela:cache-deck` message down to
 * root-relative, same-origin `/assets/*` paths with an image extension.
 * Anything else (cross-origin, non-/assets/, wrong extension, not a string)
 * is silently dropped — this is untrusted input from a page context, even
 * though today only `deckOffline.ts` sends it.
 */
function sanitizeDeckUrls(urls) {
    const out = [];
    for (const raw of urls) {
        if (typeof raw !== "string") continue;
        let parsed;
        try {
            parsed = new URL(raw, self.location.origin);
        } catch (_) {
            continue;
        }
        if (parsed.origin !== self.location.origin) continue;
        if (!parsed.pathname.startsWith("/assets/")) continue;
        if (!DECK_ASSET_EXT_RE.test(parsed.pathname)) continue;
        out.push(parsed.pathname);
    }
    // De-dupe, then enforce the cap — after sanitising, so a malformed entry
    // never eats a slot that a valid one needed.
    return Array.from(new Set(out)).slice(0, DECK_URLS_LIMIT);
}

/** Entry point from the `message` listener: validates the envelope itself
 *  (`deck`, `urls` shape) before handing sanitised URLs to `cacheDeckOffline`. */
async function handleCacheDeckMessage(data) {
    if (typeof data.deck !== "string" || !DECK_NAME_RE.test(data.deck)) return;
    if (!Array.isArray(data.urls) || data.urls.length === 0) return;
    if (data.urls.length > DECK_URLS_LIMIT) return;
    const wanted = sanitizeDeckUrls(data.urls);
    if (wanted.length === 0) return;
    await cacheDeckOffline(data.deck, wanted);
}

/**
 * Fill DECK_CACHE with `wanted` (already sanitised, deduped, capped) for
 * `deck`, then reconcile that deck's index.
 *
 * Best-effort per file: a failed fetch (offline, one bad file) just leaves
 * whatever was already cached in place — see the file header, this mirrors
 * `refreshPrecache`'s "a half-applied pass changes nothing it doesn't have
 * to" property.
 *
 * The index (see DECK_INDEX_PREFIX) only gets reconciled — and old hashes
 * from a previous deploy only get pruned — once EVERY wanted URL is actually
 * sitting in the cache. A partial pass must never delete art this session
 * already has offline; stale entries simply wait for a pass that fully
 * succeeds (typically the next time the player is online with this deck
 * selected).
 */
async function cacheDeckOffline(deck, wanted) {
    let cache;
    try {
        cache = await caches.open(DECK_CACHE);
    } catch (_) {
        return; // storage unavailable — nothing to do
    }

    // The `game` precache tier may already hold these exact hashed files in
    // CACHE; `assetCacheFirst` reads CACHE first, so a second copy here would
    // only double the storage. Such a file counts as held for this deck.
    // Should the tier's copy be pruned later (new build, new hash), the page
    // sends the new URLs and this pass fetches them into DECK_CACHE.
    let shellCache = null;
    try {
        shellCache = await caches.open(CACHE);
    } catch (_) {
        /* no shell cache — everything goes to DECK_CACHE as before */
    }
    const heldElsewhere = async (path) => {
        try {
            return shellCache ? !!(await shellCache.match(path)) : false;
        } catch (_) {
            return false;
        }
    };

    for (const path of wanted) {
        try {
            const already = await cache.match(path);
            if (already) continue;
            if (await heldElsewhere(path)) continue;
            const resp = await fetch(path);
            if (resp && resp.ok && resp.type === "basic") {
                await cache.put(path, resp.clone());
            }
        } catch (_) {
            /* offline or one bad file — keep going, see the header */
        }
    }

    let complete = true;
    for (const path of wanted) {
        try {
            if (!(await cache.match(path)) && !(await heldElsewhere(path))) {
                complete = false;
                break;
            }
        } catch (_) {
            complete = false;
            break;
        }
    }
    if (!complete) return;

    try {
        const indexReq = new Request(DECK_INDEX_PREFIX + deck);
        let previous = [];
        try {
            const indexHit = await cache.match(indexReq);
            if (indexHit) {
                const parsed = await indexHit.json();
                if (Array.isArray(parsed)) previous = parsed;
            }
        } catch (_) {
            /* unreadable or missing index — treat as "nothing recorded yet" */
        }
        await cache.put(indexReq, new Response(JSON.stringify(wanted)));
        for (const oldPath of previous) {
            // Only this deck's own previous list is ever consulted, so this
            // can never delete another deck's entries.
            if (typeof oldPath === "string" && !wanted.includes(oldPath)) {
                await cache.delete(oldPath);
            }
        }
    } catch (_) {
        /* index bookkeeping failed — the images themselves are still cached,
           just without the stale-hash prune this time */
    }
}

// Network-first for GET /api/*: serve fresh when online (and refresh the
// snapshot), fall back to the last cached snapshot offline. respondWith ALWAYS
// resolves to a real Response — never undefined — so offline never crashes the
// worker.
async function apiNetworkFirst(req, url) {
    // An Authorization header means this is the signed-in variant of the
    // response — never write it to a cache the next person on the device (or
    // this same person after a sign-out) can read back.
    const authenticated = !!req.headers.get("authorization");
    const cacheable =
        !authenticated
        && !NEVER_CACHE_API.some((p) => url.pathname.startsWith(p))
        && !NEVER_CACHE_API_PATTERNS.some((re) => re.test(url.pathname));
    let cache = null;
    if (cacheable) {
        try { cache = await caches.open(API_CACHE); } catch (_) { /* private mode */ }
    }
    try {
        const resp = await fetch(req);
        // Cache only clean, complete, same-origin 200s — never errors, 206
        // partials or opaque responses (those would poison the snapshot).
        if (cache && resp && resp.status === 200 && resp.type === "basic") {
            const copy = resp.clone();
            cache.put(req, copy)
                .then(() => trimCache(cache, API_CACHE_LIMIT))
                .catch(() => {});
        }
        return resp;
    } catch (_) {
        if (cache) {
            const hit = await cache.match(req);
            if (hit) return hit;
        }
        // No snapshot — reply in a shape axios rejects (503) so the app shows
        // its own error/empty state instead of rendering bad data.
        return new Response(
            JSON.stringify({ offline: true }),
            {
                status: 503,
                headers: { "Content-Type": "application/json; charset=utf-8" },
            }
        );
    }
}

// Stale-while-revalidate for /api/tournaments* lists: return cached snapshot
// immediately, then fetch fresh data in the background and notify clients to
// invalidate via postMessage. Guarantees perceived speed for list pages.
async function apiStaleWhileRevalidate(req, url) {
    const authenticated = !!req.headers.get("authorization");
    const cacheable =
        !authenticated
        && !NEVER_CACHE_API.some((p) => url.pathname.startsWith(p))
        && !NEVER_CACHE_API_PATTERNS.some((re) => re.test(url.pathname));
    let cache = null;
    if (cacheable) {
        try { cache = await caches.open(API_CACHE); } catch (_) { /* private mode */ }
    }

    // Return cached response immediately if available
    if (cache) {
        try {
            const cached = await cache.match(req);
            if (cached) {
                // Refresh in background without blocking
                fetch(req).then((resp) => {
                    if (cache && resp && resp.status === 200 && resp.type === "basic") {
                        const copy = resp.clone();
                        cache.put(req, copy)
                            .then(() => {
                                // Notify all clients to invalidate the list query
                                self.clients.matchAll().then((clients) => {
                                    clients.forEach((client) => {
                                        client.postMessage({
                                            type: "bela:api-refreshed",
                                            url: req.url,
                                        });
                                    });
                                });
                                trimCache(cache, API_CACHE_LIMIT);
                            })
                            .catch(() => {});
                    }
                }).catch(() => {});
                return cached;
            }
        } catch (_) {}
    }

    // No cached response — fall back to network-first behavior
    try {
        const resp = await fetch(req);
        if (cache && resp && resp.status === 200 && resp.type === "basic") {
            const copy = resp.clone();
            cache.put(req, copy)
                .then(() => trimCache(cache, API_CACHE_LIMIT))
                .catch(() => {});
        }
        return resp;
    } catch (_) {
        return new Response(
            JSON.stringify({ offline: true }),
            {
                status: 503,
                headers: { "Content-Type": "application/json; charset=utf-8" },
            }
        );
    }
}

// SPA navigation: network-first with optional preload support, fall back to
// the cached shell, and as a last resort a tiny offline page.
async function navigationNetworkFirst(req, event) {
    try {
        // Use preloadResponse if the browser preloaded this navigation fetch
        let resp;
        if (event && event.preloadResponse) {
            resp = await event.preloadResponse;
            if (resp && resp.status === 200) return resp;
        }
        // Preload didn't complete or wasn't available — fetch normally
        return await fetch(req);
    } catch (_) {
        // "/" first: it is the entry this worker actually caches, and on
        // bela.games it is the only one guaranteed to hold that domain's own
        // shell (see the SHELL comment at the top). "/index.html" stays as a
        // fallback for installs that predate that change.
        const shell =
            (await caches.match("/")) || (await caches.match("/index.html"));
        if (shell) return shell;
        return new Response(
            "<!doctype html><meta charset='utf-8'><title>Nema veze</title>" +
                "<body style='font-family:sans-serif;padding:2rem'>" +
                "<p>Trenutno nema veze sa serverom. Pokušaj ponovno za koji trenutak.</p>",
            {
                status: 503,
                headers: { "Content-Type": "text/html; charset=utf-8" },
            }
        );
    }
}

// Cache-first for uploaded images. A miss goes to the network and is stored;
// offline with no copy the <img> simply fails, which the cards already handle.
async function imageCacheFirst(req, event) {
    let cache = null;
    try { cache = await caches.open(IMG_CACHE); } catch (_) { /* private mode */ }
    if (cache) {
        try {
            const hit = await cache.match(req, { ignoreVary: true });
            if (hit) return hit;
        } catch (_) { /* fall through to the network */ }
    }
    const resp = await fetch(req);
    if (cache && resp && resp.status === 200 && resp.type === "basic") {
        const copy = resp.clone();
        event.waitUntil(
            cache.put(req, copy).then(() => trimCache(cache, IMG_CACHE_LIMIT)).catch(() => {})
        );
    }
    return resp;
}

/* OpenFreeMap basemap.

   Vector tiles live under a dated planet path (/planet/20260913_164504_pt/
   z/x/y.pbf), so a given tile URL never changes content: cache-first, no
   revalidation. When OpenFreeMap publishes a new planet, the TileJSON points
   at a new path and old tiles simply age out through the size cap.

   Everything else on the host (style JSON, /planet TileJSON, sprites,
   glyph PBFs) is small and CAN change: stale-while-revalidate — answer from
   cache at once, refresh in the background.

   Only 200 CORS responses are stored (MapLibre fetches with CORS and
   OpenFreeMap sends ACAO *), so an opaque or error body never gets pinned. */
async function mapCache(req, url, event) {
    let cache = null;
    try { cache = await caches.open(MAP_CACHE); } catch (_) { /* private mode */ }
    if (!cache) return fetch(req);

    const store = (resp) => {
        if (resp && resp.status === 200 && (resp.type === "cors" || resp.type === "basic")) {
            const copy = resp.clone();
            event.waitUntil(
                cache.put(req, copy).then(() => trimCache(cache, MAP_CACHE_LIMIT)).catch(() => {})
            );
        }
        return resp;
    };

    let cached = null;
    try { cached = await cache.match(req); } catch (_) { /* ignore */ }

    const immutable = /^\/planet\/[^/]+\/\d+\/\d+\/\d+\.pbf$/.test(url.pathname);
    if (cached && immutable) return cached;

    if (cached) {
        event.waitUntil(fetch(req).then(store).catch(() => {}));
        return cached;
    }
    return fetch(req).then(store);
}

// Keep the runtime API cache bounded. Cache.keys() preserves insertion order,
// so the oldest snapshots are at the front — evict from there when over the cap.
async function trimCache(cache, limit) {
    try {
        const keys = await cache.keys();
        const over = keys.length - limit;
        for (let i = 0; i < over; i++) await cache.delete(keys[i]);
    } catch (_) {
        /* best-effort — a full cache just stops growing */
    }
}

// ─────────────────────────────────────────────────────────────────────
//  Web Push: receive + click handling
// ─────────────────────────────────────────────────────────────────────
// `push` fires whenever the browser's push service delivers a message
// signed with our VAPID key. The payload is JSON written by the backend
// (PushService.PushPayload): { title, body, url?, icon?, tag? }.
//
// `notificationclick` fires when the user taps the notification. We focus
// an existing open tab on the target URL if one exists, otherwise we open
// a new tab. This is the standard PWA re-engagement pattern.

// The games domains have their own name and logo (public/games/). A worker's
// origin decides which product a push belongs to, so the default title and
// icon are picked from the host it runs on.
const GAMES_HOST = /(^|\.)(bela|belot)\.games$/.test(self.location.hostname);
const BRAND_NAME = GAMES_HOST ? "Bela Online" : "Bela turniri";
const BRAND_ICON = GAMES_HOST ? "/games/symbol.png" : "/bela-turniri-symbol.png";

self.addEventListener("push", (event) => {
    if (!event.data) return;
    let data = {};
    try {
        data = event.data.json();
    } catch {
        // Backend always sends JSON, but fall back to plain text just in
        // case a debug curl came through.
        data = { title: BRAND_NAME, body: event.data.text() };
    }
    const title = data.title || BRAND_NAME;
    const options = {
        body: data.body || "",
        icon: data.icon || BRAND_ICON,
        badge: BRAND_ICON,
        // `tag` groups notifications so a new one with the same tag replaces
        // the previous (avoids stacking 5 "approved" toasts if the organizer
        // batch-approves a queue). Most flows leave it undefined.
        tag: data.tag,
        data: { url: data.url || "/" },
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || "/";
    // Resolve to an absolute URL — clients.navigate and url comparison
    // both want the full form.
    //
    // Origin guard: the push payload's `url` is server-controlled today, but a
    // compromised backend OR an unsigned push (some browsers don't validate
    // VAPID strictly) could attempt a `javascript:` URI or a cross-origin URL
    // to hijack the SW. Reject anything that doesn't resolve to OUR origin
    // before any client.navigate / openWindow / postMessage call below.
    let targetAbs;
    try {
        const resolved = new URL(targetUrl, self.location.origin);
        if (resolved.origin !== self.location.origin) {
            targetAbs = self.location.origin + "/";
        } else {
            targetAbs = resolved.href;
        }
    } catch (_) {
        targetAbs = self.location.origin + "/";
    }

    event.waitUntil((async () => {
        const all = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
        });

        for (const client of all) {
            if (!client.url) continue;
            let clientUrl;
            try {
                clientUrl = new URL(client.url);
            } catch (_) {
                continue;
            }
            if (clientUrl.origin !== self.location.origin) continue;

            // Bring the existing PWA window to focus regardless of path.
            try { await client.focus(); } catch (_) {}

            // Already at the target URL — nothing more to do.
            if (client.url === targetAbs) return;

            // Same path, just different query (e.g. /tournaments/X →
            // /tournaments/X?bill=42): let the SPA handle it via
            // react-router so we keep app state. PushBootstrap listens
            // for "bela:navigate" and calls navigate(url) on receipt.
            if (clientUrl.pathname === new URL(targetAbs).pathname) {
                client.postMessage({ type: "bela:navigate", url: targetUrl });
                return;
            }

            // Different path. On iOS cold-start the window is freshly
            // launched at start_url and React isn't mounted yet, so a
            // postMessage would race with the listener wiring. Use
            // client.navigate(targetAbs) instead — that forces the URL
            // to update before React mounts, so our useState initializer
            // sees the deep-link params on first render. Falls back to
            // postMessage if navigate() isn't supported.
            if ("navigate" in client) {
                try {
                    await client.navigate(targetAbs);
                    return;
                } catch (_) {
                    // Fall through to postMessage.
                }
            }
            client.postMessage({ type: "bela:navigate", url: targetUrl });
            return;
        }

        // No existing window — open one at the target URL. iOS PWAs
        // honour this on a notificationclick gesture.
        await self.clients.openWindow(targetUrl);
    })());
});
