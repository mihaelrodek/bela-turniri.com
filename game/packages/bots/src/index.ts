/* ──────────────────────────────────────────────────────────────────────────
   @bela/bots — computer players over the engine's redacted PlayerView.

   CONTRACT (game/README.md §5). A bot sees exactly what a human in that seat
   would see (`PlayerView`) plus the legal options the engine computed; it
   never gets the full GameState. Every decision is a pure function of
   (view, legal, rng) so games stay reproducible for a given seed.
   ────────────────────────────────────────────────────────────────────── */

import type { Card, LegalBids, PlayerView, Suit } from "@bela/engine"
import type { BotLevel } from "@bela/protocol"

export type { BotLevel } from "@bela/protocol"

export type BidChoice = Suit | "PASS"

export interface Bot {
    readonly level: BotLevel
    /** Called only when `view.turn === view.seat` and `view.phase === "BIDDING"`. */
    chooseBid(view: PlayerView, legal: LegalBids, rng: () => number): BidChoice
    /** Called only when it is this seat's turn to play; `legal` is non-empty. */
    chooseCard(view: PlayerView, legal: Card[], rng: () => number): Card
}

export { createBot } from "./createBot"
export { randomBot } from "./randomBot"
export { heuristicBot } from "./heuristicBot"
export { suitStrength } from "./evaluate"
