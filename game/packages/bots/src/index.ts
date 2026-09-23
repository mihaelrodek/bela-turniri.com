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

/**
 * WHICH BOT PLAYED THIS GAME.
 *
 * Stamped into every recorded replay (`game_replays.bot_version`, README §8.8)
 * so a measurement taken next month can say WHICH bot it is measuring. Without
 * it a replay archive is one undifferentiated pile and "did the change help?"
 * is unanswerable.
 *
 * BUMP IT — an ISO date, the day of the change — in the SAME commit as any
 * change to `heuristicBot.ts`, `evaluate.ts` or a BOT.md rule that alters a
 * decision. A tweak that provably cannot change a move (a comment, a rename,
 * a test) does not need a bump. Bumping too often costs nothing; not bumping
 * silently merges two different bots into one bucket.
 */
export const BOT_VERSION = "2026-09-23"

/** The single bot. Stateless and pure, so every seat can share one instance;
 *  the factory exists only so callers never hard-code which module it is. */
export function createBot(): Bot {
    return heuristicBot
}

export { heuristicBot } from "./heuristicBot"
export { suitStrength } from "./evaluate"
