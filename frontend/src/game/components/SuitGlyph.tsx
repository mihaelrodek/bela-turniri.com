import type { Suit } from "@bela/protocol"
import { SuitIcon } from "./PlayingCard"

/* ──────────────────────────────────────────────────────────────────────────
   SuitGlyph — one suit mark, at whatever size the caller needs (scoreboard
   trump square, bidding buttons, seat chips, deal summary, and the blok's
   round lists). Thin alias over `SuitIcon` so the table code never depends on
   which of the four decks the player has picked — `SuitIcon` reads the
   preference and `DeckSuitIcon` owns the drawing, including `klasicne`'s own
   printed suit marks (2026-09-20).
   ────────────────────────────────────────────────────────────────────── */

export default function SuitGlyph({ suit, size = 22 }: { suit: Suit; size?: number | string }) {
    return <SuitIcon suit={suit} size={size} />
}
