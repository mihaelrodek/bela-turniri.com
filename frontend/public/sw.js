/*
 * Service worker — exists primarily so Chrome / Edge / Samsung Internet fire
 * the `beforeinstallprompt` event (no SW → the browser refuses the install
 * prompt even with a perfect manifest), and to give the installed PWA a useful
 * offline story for a tournament organiser in a hall with flaky Wi-Fi:
 *
 *   - SPA navigations: network-first, fall back to the cached app shell so a
 *     cold launch offline still boots index.html instead of the browser's
 *     "no internet" page, and to a tiny inline offline page as a last resort.
 *   - API reads (GET /api/*): network-first, fall back to the LAST cached
 *     snapshot. Online it's always fresh (and the snapshot is refreshed); the
 *     cache is served ONLY when the network is unreachable. That lets the round
 *     view and the standings open — and survive a reload — with no signal.
 *     Network-first is the key: there's no stale-JSON surprise while connected.
 *   - Writes (POST/PUT/PATCH/DELETE): never touched — straight to the network.
 *   - /assets/* and cross-origin: never touched. Vite hashes every asset and
 *     Caddy serves them `immutable`, so the browser's own HTTP cache already
 *     does the right thing — and staying out avoids the class of bug where a
 *     failed fetch + cache miss resolved to `undefined` and crashed the worker
 *     with "Failed to convert value to 'Response'".
 *
 * Per-user endpoints are excluded from the API cache entirely (see
 * NEVER_CACHE_API below): the snapshot would otherwise survive a sign-out and
 * be served to the next person on the device. The same goes for ANY request
 * that carries an `Authorization` header — the response is by definition the
 * signed-in variant, and several endpoints return organiser-only fields to the
 * owner and a trimmed body to everyone else on the very same URL.
 */

const CACHE = "bela-shell-v2";
const API_CACHE = "bela-api-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest"];
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

self.addEventListener("install", (event) => {
    // Pre-cache the SPA shell so a cold offline launch from the home-screen
    // icon shows index.html instead of the browser's "no internet" page.
    event.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
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

self.addEventListener("fetch", (event) => {
    const req = event.request;
    // Only intercept GETs — POST/PUT/PATCH/DELETE go straight to the network.
    if (req.method !== "GET") return;

    const url = new URL(req.url);
    // Leave cross-origin (Firebase, MinIO posters, map tiles) to the browser.
    if (url.origin !== self.location.origin) return;
    // Hashed build output is already immutable in the HTTP cache — hands off.
    if (url.pathname.startsWith("/assets/")) return;

    // API reads: network-first with a last-snapshot fallback (see file header).
    if (url.pathname.startsWith("/api/")) {
        event.respondWith(apiNetworkFirst(req, url));
        return;
    }

    // Everything else the SW owns is a top-level SPA navigation.
    if (req.mode !== "navigate") return;
    event.respondWith(navigationNetworkFirst(req));
});

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
