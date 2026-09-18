import type { Reaction } from "@bela/protocol"

/** Stable copy keys for the five quick table reactions. The wire carries the
 * compact emoji id; each client turns it into text in its own language. */
export const REACTION_TEXT_KEYS: Record<Reaction, string> = {
    "👏": "game.table.reaction.nicePlay",
    "🍀": "game.table.reaction.lucky",
    "😱": "game.table.reaction.mistake",
    "⏰": "game.table.reaction.hurry",
    "🤝": "game.table.reaction.goodGame",
}
