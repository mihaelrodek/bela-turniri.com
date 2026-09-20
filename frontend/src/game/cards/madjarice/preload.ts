import { deckHasImages, type DeckStyle } from "../../util/cards"
import { cacheDeckOffline } from "../deckOffline"
import { allDeckImages } from "./imageAssets"

/* ──────────────────────────────────────────────────────────────────────────
   Which deck images this browser has already decoded, and a way to warm a
   whole pack (32 faces + the back + the deck's suit icons) up front.

   `MadjaricaCard` shows its artwork only once the image is decoded, because
   an image that is still being fetched would otherwise paint as a hole where
   the vector face was. That swap is right the FIRST time a face is seen and
   wrong every time afterwards: the same file, already in memory, replacing
   its own SVG again looks like the card flickering.

   So decoded sources are remembered for the lifetime of the document (module
   scope, not React state — a card mounts and unmounts constantly and must not
   forget) and a face that is in this set renders at full opacity on its very
   first paint. The set is keyed by URL, so it spans decks for free.
   ────────────────────────────────────────────────────────────────────── */

const decoded = new Set<string>()

export function isFaceDecoded(src: string): boolean {
    return decoded.has(src)
}

export function markFaceDecoded(src: string): void {
    decoded.add(src)
}

/** Warmed decks, so the work happens once PER DECK — switching the setting
 *  must warm the new pack, not be swallowed by a single global guard. */
const started = new Set<DeckStyle>()

/**
 * Fetch and decode one whole deck, off the critical path.
 *
 * Called from the LOBBY as well as the table (2026-09-20, user request), and
 * only for a deck that HAS images (`klasicne`, `moderne` — the vector and
 * French decks are drawn, so there is nothing to warm): by the time a player
 * has created or joined a room the pack is already warm, so the first deal
 * never waits. ~37 WebP files, ~2 MB, fetched at idle and then served from
 * the HTTP cache (hashed, immutable build output) on every later visit.
 *
 * It buys the thing the per-card swap cannot: an OPPONENT's first card, which
 * this client has never requested before, lands as the artwork instead of as
 * the SVG fallback that is replaced a moment later. The back is included, so
 * `CardBack` can use `BACK.webp` from the very first face-down card, and so
 * are the suit icons, so the scoreboard's trump never blinks either.
 *
 * Idempotent per deck — a second call for the same deck is a no-op.
 */
export function preloadDeck(deck: DeckStyle): void {
    if (typeof window === "undefined") return
    if (!deckHasImages(deck) || started.has(deck)) return
    started.add(deck)

    const urls = allDeckImages(deck)
    if (urls.length === 0) {
        // The folder is not there (or not finished). Nothing to warm, and the
        // vector fallback is already correct — do not mark this as a failure.
        return
    }

    const warm = (): void => {
        for (const src of urls) {
            if (decoded.has(src)) continue
            const img = new Image()
            img.decoding = "async"
            // Marked only once the bytes are actually decodable, so a failed
            // or aborted fetch never claims a face is ready.
            img.onload = () => {
                const done = (): void => markFaceDecoded(src)
                if (typeof img.decode === "function") img.decode().then(done, done)
                else done()
            }
            img.src = src
        }
    }

    const idle = (window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    }).requestIdleCallback
    if (idle) idle(warm, { timeout: 2000 })
    else window.setTimeout(warm, 300)

    // …and, separately from this document's memory, ask the service worker to
    // keep the pack so an installed PWA opened offline can still deal it.
    // Fire-and-forget and a no-op where there is no worker; `deckOffline.ts`
    // is owned by the service-worker side.
    cacheDeckOffline(deck, urls)
}
