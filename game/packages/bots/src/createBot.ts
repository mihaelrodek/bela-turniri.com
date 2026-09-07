/* ──────────────────────────────────────────────────────────────────────────
   createBot(level) — the factory the server (and tests) use to get a Bot for
   a level (game/README.md §5). BotLevel comes from `@bela/protocol`.
   ────────────────────────────────────────────────────────────────────── */

import type { BotLevel } from "@bela/protocol"
import type { Bot } from "./index"
import { randomBot } from "./randomBot"
import { heuristicBot } from "./heuristicBot"
import { hardBot } from "./hardBot"

export function createBot(level: BotLevel): Bot {
    switch (level) {
        case "lako":
            return randomBot
        case "srednje":
            return heuristicBot
        case "tesko":
            return hardBot
        default: {
            const exhaustive: never = level
            throw new Error(`Nepoznata razina bota: ${String(exhaustive)}`)
        }
    }
}
