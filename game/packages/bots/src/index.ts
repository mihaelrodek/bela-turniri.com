/* ──────────────────────────────────────────────────────────────────────────
   @bela/bots — the computer player over the engine's redacted PlayerView.

   CONTRACT (game/README.md §5). There is exactly ONE bot; difficulty levels
   were removed on 2026-09-08. A bot sees exactly what a human in that seat
   would see (`PlayerView`) plus the legal options the engine computed; it
   never gets the full GameState. Every decision is a pure function of
   (view, legal, rng) so games stay reproducible for a given seed.
   ────────────────────────────────────────────────────────────────────── */

import type { Card, LegalBids, PlayerView, Suit } from "@bela/engine"
import { heuristicBot } from "./heuristicBot"

export type BidChoice = Suit | "PASS"

export interface Bot {
    /** Called only when `view.turn === view.seat` and `view.phase === "BIDDING"`. */
    chooseBid(view: PlayerView, legal: LegalBids, rng: () => number): BidChoice
    /** Called only when it is this seat's turn to play; `legal` is non-empty. */
    chooseCard(view: PlayerView, legal: Card[], rng: () => number): Card
}

/** The single bot. Stateless and pure, so every seat can share one instance;
 *  the factory exists only so callers never hard-code which module it is. */
export function createBot(): Bot {
    return heuristicBot
}

export { heuristicBot } from "./heuristicBot"
export { suitStrength } from "./evaluate"
