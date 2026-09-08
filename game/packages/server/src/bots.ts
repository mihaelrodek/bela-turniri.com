/* ──────────────────────────────────────────────────────────────────────────
   Adapter between the room/game plumbing and `@bela/bots`.

   The RNG handed to a bot is plain `Math.random`: reproducibility is a
   property of the engine (seeded deal), not of the server's bot scheduling.
   ────────────────────────────────────────────────────────────────────── */

import { createBot } from "@bela/bots"
import type { Bot } from "@bela/bots"
import type { Seat } from "@bela/protocol"
import type { Card, LegalBids, PlayerView, Suit } from "@bela/engine"

export type { Bot } from "@bela/bots"

/** Seat 0..3 bot display names (README §4 / room UI). */
export const BOT_NAMES: readonly string[] = ["Bot Ivo", "Bot Ana", "Bot Mate", "Bot Jana"]

export function botName(seat: Seat): string {
    return BOT_NAMES[seat] ?? `Bot ${seat + 1}`
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
