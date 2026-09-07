/* ──────────────────────────────────────────────────────────────────────────
   One error type for everything a client can trigger. It always carries a
   protocol `ErrorCode` and a Croatian message; `ws.ts` turns it into an
   `error` frame and the connection stays open.
   ────────────────────────────────────────────────────────────────────── */

import type { ErrorCode } from "@bela/protocol"

/** Default Croatian text per code — used when a call site has nothing better to say. */
export const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
    UNAUTHENTICATED: "Niste prijavljeni.",
    ROOM_NOT_FOUND: "Soba ne postoji.",
    ROOM_FULL: "Soba je puna.",
    SEAT_TAKEN: "Sjedalo je zauzeto.",
    NOT_HOST: "Samo domaćin može to učiniti.",
    NOT_IN_ROOM: "Niste u sobi.",
    NOT_YOUR_TURN: "Niste na potezu.",
    ILLEGAL_MOVE: "Nedopušten potez.",
    RATE_LIMITED: "Prebrzo šaljete poruke.",
    BAD_REQUEST: "Neispravan zahtjev.",
    ALREADY_STARTED: "Igra je već započela.",
    NOT_ENOUGH_PLAYERS: "Nema dovoljno igrača.",
}

export class ProtocolError extends Error {
    readonly code: ErrorCode

    constructor(code: ErrorCode, message?: string) {
        super(message ?? DEFAULT_MESSAGES[code])
        this.code = code
        this.name = "ProtocolError"
    }
}

export function isProtocolError(e: unknown): e is ProtocolError {
    return e instanceof ProtocolError
}

/** Engine error codes → protocol error codes (README §3). */
export function codeFromEngine(code: string): ErrorCode {
    switch (code) {
        case "NOT_YOUR_TURN":
            return "NOT_YOUR_TURN"
        case "ILLEGAL_MOVE":
            return "ILLEGAL_MOVE"
        default:
            return "BAD_REQUEST"
    }
}
