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
 */

const CACHE = "bela-shell-v3";
const API_CACHE = "bela-api-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest"];

/* ─────────────────────────────── PRECACHE ───────────────────────────────
 * `/precache-manifest.json` is written at build time by the
 * `bela-precache-manifest` plugin in vite.config.ts (read its header for what
 * goes in and why). It names the app shell's own chunks plus everything the
 * /blok route chunk statically needs, with the hashed file names only Rollup
 * can know.
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

/** One precache pass at a time: install and a page's message can arrive in the
 *  same tick, and two passes would race the prune against the add. */
let precaching = null;

/**
 * Bring the shell cache in line with the CURRENT build.
 *
 * Best-effort throughout: every failure leaves the cache exactly as it was,
 * which is the whole safety property here — a half-applied precache is a shell
 * that boots into a missing chunk. Offline it fails at the first fetch and
 * changes nothing.
 */
async function refreshPrecache() {
    if (precaching) return precaching;
    precaching = (async () => {
        try {
            // `no-store`: the point is to learn what is deployed RIGHT NOW, and
            // a manifest served from the HTTP cache would answer with the build
            // whose assets we already have.
            const resp = await fetch(PRECACHE_MANIFEST, { cache: "no-store" });
            if (!resp || !resp.ok) return;
            const body = await resp.json();
            const listed = body && Array.isArray(body.files) ? body.files : null;
            if (!listed || listed.length === 0) return;

            // Only same-origin build output, and never a path that could walk
            // out of it: this list is fetched, so it is treated as input.
            const wanted = new Set();
            for (const file of listed) {
                if (typeof file !== "string") continue;
                if (!file.startsWith("/assets/") || file.includes("..")) continue;
                wanted.add(file);
            }
            if (wanted.size === 0) return;

            const cache = await caches.open(CACHE);
            const held = await cache.keys();
            const have = new Set(held.map((req) => new URL(req.url).pathname));

            /* Nothing deployed since the last completed pass AND everything it
               wrote is still here: stop, having spent one small request. This
               runs on every page load, so the common case has to be cheap —
               without it each load would also re-fetch index.html and walk the
               cache. Both halves of the test matter: the stamp alone would
               skip a pass after the browser evicted part of the cache under
               storage pressure, and the completeness check alone would miss a
               deploy that changed only index.html. */
            const stamp = String(body.build ?? "");
            let stamped = false;
            try {
                const heldStamp = await cache.match(BUILD_STAMP);
                stamped = heldStamp ? (await heldStamp.text()) === stamp : false;
            } catch (_) {
                stamped = false;
            }
            let complete = true;
            for (const path of wanted) {
                if (!have.has(path)) complete = false;
            }
            if (stamped && complete) return;

            // 1. Add what is missing. One at a time rather than `addAll`, which
            //    is all-or-nothing: a single 404 (a deploy landing mid-pass)
            //    would throw away the dozen files that did arrive.
            for (const path of wanted) {
                if (have.has(path)) continue;
                try {
                    await cache.add(path);
                } catch (_) {
                    /* keep going — a partial precache still helps */
                }
            }

            // 2. Only now the shell, so index.html is never newer than the
            //    chunks it names.
            try {
                const shell = await fetch("/index.html", { cache: "no-store" });
                if (shell && shell.status === 200 && shell.type === "basic") {
                    await cache.put("/index.html", shell.clone());
                    await cache.put("/", shell);
                }
            } catch (_) {
                /* the previously cached shell stays — see the header */
            }

            // 3. Prune the build output no longer claimed. Everything else in
            //    this cache (the shell, the build stamp) is left alone — the
            //    filter is `/assets/`, and only this pass ever writes there.
            for (const req of held) {
                const path = new URL(req.url).pathname;
                if (!path.startsWith("/assets/")) continue;
                if (wanted.has(path)) continue;
                await cache.delete(req);
            }

            // 4. Last, so a pass that died halfway is not recorded as done and
            //    the next load picks up where it left off.
            await cache.put(BUILD_STAMP, new Response(stamp));
        } catch (_) {
            /* offline, unparseable manifest, storage refusing to open */
        } finally {
            precaching = null;
        }
    })();
    return precaching;
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
            await refreshPrecache();
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
    // versions); keep the shell AND the runtime API-snapshot cache.
    const keep = new Set([CACHE, API_CACHE]);
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
   worker whose own bytes never change. Anything else posted here is ignored;
   the message channel is otherwise unused. */
self.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.type !== "bela:precache") return;
    event.waitUntil(refreshPrecache());
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    // Only intercept GETs — POST/PUT/PATCH/DELETE go straight to the network.
    if (req.method !== "GET") return;

    const url = new URL(req.url);
    // Leave cross-origin (Firebase, MinIO posters, map tiles) to the browser.
    if (url.origin !== self.location.origin) return;
    // Hashed, immutable build output: whatever is precached IS the right
    // answer, and offline it is the only one (see the file header).
    if (url.pathname.startsWith("/assets/")) {
        event.respondWith(assetCacheFirst(req));
        return;
    }

    // API reads: network-first with a last-snapshot fallback (see file header).
    if (url.pathname.startsWith("/api/")) {
        event.respondWith(apiNetworkFirst(req, url));
        return;
    }

    // Everything else the SW owns is a top-level SPA navigation.
    if (req.mode !== "navigate") return;
    event.respondWith(navigationNetworkFirst(req));
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
        return await fetch(req);
    } catch (_) {
        return new Response("", { status: 503, statusText: "Offline" });
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

// SPA navigation: network-first, fall back to the cached shell, and as a last
// resort a tiny offline page.
async function navigationNetworkFirst(req) {
    try {
        return await fetch(req);
    } catch (_) {
        const shell =
            (await caches.match("/index.html")) || (await caches.match("/"));
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

self.addEventListener("push", (event) => {
    if (!event.data) return;
    let data = {};
    try {
        data = event.data.json();
    } catch {
        // Backend always sends JSON, but fall back to plain text just in
        // case a debug curl came through.
        data = { title: "Bela turniri", body: event.data.text() };
    }
    const title = data.title || "Bela turniri";
    const options = {
        body: data.body || "",
        icon: data.icon || "/bela-turniri-symbol.png",
        badge: "/bela-turniri-symbol.png",
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
