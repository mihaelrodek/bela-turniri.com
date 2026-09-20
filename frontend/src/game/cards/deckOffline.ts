import { isNative } from "../../platform"

/* ──────────────────────────────────────────────────────────────────────────
   deckOffline — ask the service worker to keep the chosen deck's images.

   `public/sw.js` holds a dedicated `bela-decks-v1` cache, filled ONLY by the
   message sent here (`{ type: "bela:cache-deck", deck, urls }`) and consulted
   for every `/assets/*` GET. It is separate from the shell cache so the
   precache pruning never touches it, and the card images stay out of the
   app-wide precache manifest — somebody reading a tournament page must not
   download a deck of cards.

   What this honestly buys: the game itself still needs its WebSocket, so
   nobody plays offline. But a flaky connection or a reconnect never deals
   blank cards, and a repeat visit never downloads the deck again.

   Fire-and-forget: never throws, returns nothing, and the deck renders
   exactly the same whether or not a worker is there. A no-op in dev (the
   worker only registers in PROD — see `components/SwUpdateToast.tsx`) and in
   the native shells. If no worker is active yet (very first visit) the
   message is simply not sent; the next page load sends it, which is why the
   de-duplication below is per page session and not persisted.
   ────────────────────────────────────────────────────────────────────── */

/** deck + a cheap fingerprint of its URL list, already posted this session. */
const posted = new Set<string>()

function fingerprint(urls: string[]): string {
    let hash = 0
    for (const url of urls) {
        for (let i = 0; i < url.length; i++) hash = (hash * 31 + url.charCodeAt(i)) | 0
    }
    return `${urls.length}:${hash}`
}

export function cacheDeckOffline(deck: string, urls: string[]): void {
    if (!import.meta.env.PROD || isNative) return
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
    if (urls.length === 0) return
    const key = `${deck}|${fingerprint(urls)}`
    if (posted.has(key)) return

    navigator.serviceWorker.ready
        .then((registration) => {
            const worker = registration.active
            if (!worker) return
            worker.postMessage({ type: "bela:cache-deck", deck, urls })
            posted.add(key)
        })
        .catch(() => {
            /* no worker ever became active — nothing to cache into */
        })
}
