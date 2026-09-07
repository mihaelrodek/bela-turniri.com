/* ──────────────────────────────────────────────────────────────────────────
   `lako` — uniform random legal play. Only calls trump when forced (mus);
   otherwise always passes (game/README.md §5).
   ────────────────────────────────────────────────────────────────────── */

import type { Card, LegalBids, PlayerView } from "@bela/engine"
import type { BidChoice, Bot } from "./index"
import { bestSuit } from "./evaluate"

function pick<T>(items: readonly T[], rng: () => number): T {
    const idx = Math.floor(rng() * items.length)
    const clamped = Math.min(Math.max(idx, 0), items.length - 1)
    return items[clamped] as T
}

function chooseBid(view: PlayerView, legal: LegalBids, _rng: () => number): BidChoice {
    if (legal.canPass) return "PASS"
    return bestSuit(view.hand, legal.suits)
}

function chooseCard(_view: PlayerView, legal: Card[], rng: () => number): Card {
    return pick(legal, rng)
}

export const randomBot: Bot = {
    level: "lako",
    chooseBid,
    chooseCard,
}
