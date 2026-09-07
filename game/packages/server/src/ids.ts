/* Short random ids, all derived from `crypto.randomUUID()`. */

import { randomUUID } from "node:crypto"

export function uuid(): string {
    return randomUUID()
}

/** `len` hex chars from a fresh v4 UUID (≤ 32). */
export function shortId(len = 8): string {
    const hex = randomUUID().replace(/-/g, "")
    return hex.slice(0, Math.max(1, Math.min(len, hex.length)))
}

export function newRoomId(): string {
    return shortId(8)
}

export function newConnId(): string {
    return shortId(8)
}

export function newChatId(): string {
    return shortId(12)
}

/** Game seed — the engine derives its PRNG from any string. */
export function newSeed(): string {
    return randomUUID()
}

/** A 4-digit join code, leading zeros allowed (e.g. "0042"). Uniqueness is the caller's job. */
export function newRoomCode(): string {
    return String(Math.floor(Math.random() * 10_000)).padStart(4, "0")
}
