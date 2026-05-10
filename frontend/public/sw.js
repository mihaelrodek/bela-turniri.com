/*
 * Minimal service worker — exists primarily so Chrome / Edge / Samsung Internet
 * fire the `beforeinstallprompt` event. Without an SW the browser refuses to
 * surface the install prompt at all, even with a perfect manifest.
 *
 * It also gives us a network-first fetch handler that:
 *   - Lets every request go to the network normally (no caching surprises).
 *   - Falls back to the cached app shell when the network is unreachable, so
 *     a tournament organizer at a venue with flaky Wi-Fi can still open the
 *     installed app and see *something* (just the SPA shell — API data still
 *     needs the network).
 *
 * Keeping the worker tiny is deliberate: a richer cache strategy is easy to
 * shoot yourself in the foot with (stale React bundle, stale API JSON).
 * Revisit when there's a concrete offline use case.
 */

const CACHE = "bela-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
    // Pre-cache the SPA shell so a cold offline launch from the home-screen
    // icon shows index.html instead of the browser's "no internet" page.
    event.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
    );
    // Skip waiting so a fresh deploy activates on the next page load instead
    // of waiting for every tab to close.
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    // Wipe any older shell caches.
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    // Only intercept GETs — POST/PUT/PATCH/DELETE go straight to the network.
    if (req.method !== "GET") return;

    // Don't touch API or auth traffic — those must always be live, and Cache
    // Storage on cross-origin (Firebase) URLs would just confuse things.
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith("/api/")) return;

    // SPA navigations: try network first, fall back to cached index.html so an
    // offline app launch still boots the React shell.
    if (req.mode === "navigate") {
        event.respondWith(
            fetch(req).catch(() => caches.match("/index.html"))
        );
        return;
    }

    // Static assets: stale-while-revalidate. Serve from cache if we have it,
    // refresh in the background. Vite cache-busts every JS/CSS asset with a
    // hash, so old bundles never overwrite new ones.
    event.respondWith(
        caches.match(req).then((cached) => {
            const network = fetch(req)
                .then((resp) => {
                    if (resp && resp.status === 200 && resp.type === "basic") {
                        const clone = resp.clone();
                        caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
                    }
                    return resp;
                })
                .catch(() => cached);
            return cached || network;
        })
    );
});
