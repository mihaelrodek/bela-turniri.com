import type { ClientMessage, ClientMessageType, ErrorCode, GameEvent, ServerMessage } from "@bela/protocol"

/* ──────────────────────────────────────────────────────────────────────────
   Types shared by the game UI's own plumbing (the socket hook, the in-browser
   mock server, the event queue). Everything that travels over the wire lives
   in `@bela/protocol` — nothing here duplicates it.
   ────────────────────────────────────────────────────────────────────── */

/** What `useGameSocket` talks to. A real WebSocket in production, the
 *  in-browser fake in `mock/mockGameServer.ts` when `/igra?mock=1` is used in
 *  dev — the hook cannot tell the difference. */
export interface GameTransport {
    send: (msg: ClientMessage) => void
    close: () => void
}

export interface GameTransportHandlers {
    onOpen: () => void
    onMessage: (msg: ServerMessage) => void
    onClose: () => void
}

export type GameTransportFactory = (handlers: GameTransportHandlers) => GameTransport

export type GameConnectionStatus = "connecting" | "open" | "closed"

/** The last `error` frame, kept so a page can surface it and then dismiss it. */
export interface GameError {
    code: ErrorCode
    message: string
    /** Which client message the server was rejecting, when it says. */
    ref?: ClientMessageType
}

/** A `GameEvent` with a monotonic id, so the animation queue can tell two
 *  identical events (the same card played in two deals) apart and never
 *  replays one it has already shown. */
export interface QueuedGameEvent {
    id: number
    event: GameEvent
}
