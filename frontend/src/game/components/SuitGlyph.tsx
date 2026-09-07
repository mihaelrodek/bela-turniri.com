import type { Suit } from "@bela/protocol"
import { SuitIcon } from "./PlayingCard"

/* ──────────────────────────────────────────────────────────────────────────
   SuitGlyph — one suit mark, at whatever size the caller needs (scoreboard
   trump square, bidding buttons, seat chips, deal summary). Thin alias over
   `SuitIcon` so the table code never depends on which deck (mađarice /
   francuske) the player has picked — PlayingCard owns that decision.
   ────────────────────────────────────────────────────────────────────── */

export default function SuitGlyph({ suit, size = 22 }: { suit: Suit; size?: number | string }) {
    return <SuitIcon suit={suit} size={size} />
}
