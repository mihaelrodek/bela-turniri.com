/* ──────────────────────────────────────────────────────────────────────────
   Adapter between the room/game plumbing and `@bela/bots`.

   The RNG handed to a bot is plain `Math.random`: reproducibility is a
   property of the engine (seeded deal), not of the server's bot scheduling.
   ────────────────────────────────────────────────────────────────────── */

import { createBot } from "@bela/bots"
import type { Bot } from "@bela/bots"
import type { Card, LegalBids, PlayerView, Suit } from "@bela/engine"
import { AVATAR_PRESETS } from "@bela/protocol"
import type { AvatarPreset } from "@bela/protocol"

export type { Bot } from "@bela/bots"

/** Display names used by the bot roster. A bot gets one at add-time. */
export const BOT_NAMES: readonly string[] = [
    "Bot Ivo", "Bot Ana", "Bot Mate", "Bot Jana", "Bot Luka", "Bot Ema",
    "Bot Filip", "Bot Petra", "Bot Tin", "Bot Nina", "Bot Karlo", "Bot Sara",
    "Bot Toni", "Bot Dora", "Bot Marko", "Bot Lea", "Bot Ivan", "Bot Mia",
    "Bot Marin", "Bot Klara", "Bot Stjepan", "Bot Lucija", "Bot Josip", "Bot Tea",
]

export function botName(usedNames: readonly string[] = []): string {
    const available = BOT_NAMES.filter((name) => !usedNames.includes(name))
    const pool = available.length > 0 ? available : BOT_NAMES
    return pool[Math.floor(Math.random() * pool.length)] ?? "Bot Ivo"
}

export function botAvatar(): AvatarPreset {
    return AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)] ?? AVATAR_PRESETS[0]
}

export function makeBot(): Bot {
    return createBot()
}

export const serverRng = (): number => Math.random()

export function chooseBid(bot: Bot, view: PlayerView, legal: LegalBids): Suit | "PASS" {
    return bot.chooseBid(view, legal, serverRng)
}

export function chooseCard(bot: Bot, view: PlayerView, legal: Card[]): Card {
    return bot.chooseCard(view, legal, serverRng)
}

/** Uniform think delay in `[min, max]` so bots feel human (README §4). */
export function thinkDelay(minMs: number, maxMs: number): number {
    if (maxMs <= minMs) return Math.max(0, minMs)
    return minMs + Math.floor(Math.random() * (maxMs - minMs + 1))
}
