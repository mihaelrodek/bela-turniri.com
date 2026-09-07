/* ──────────────────────────────────────────────────────────────────────────
   @bela/protocol — wire messages between the game client and @bela/server.

   THIS FILE IS THE CONTRACT (see game/README.md §3). JSON text frames, each
   `{ t: "<type>", ...payload }`. The server never sends another seat's cards:
   game state travels only as `PlayerView` (engine `viewFor`).

   No `enum` / namespaces — the frontend compiles this with `erasableSyntaxOnly`.
   ────────────────────────────────────────────────────────────────────── */

import type {
    Card,
    GameEvent,
    PlayerView,
    Seat,
    Suit,
    TargetScore,
} from "@bela/engine"

export type {
    Card,
    GameEvent,
    PlayerView,
    Seat,
    Suit,
    TargetScore,
} from "@bela/engine"

export const PROTOCOL_VERSION = 1

export type BotLevel = "lako" | "srednje" | "tesko"
export const BOT_LEVELS: readonly BotLevel[] = ["lako", "srednje", "tesko"]

export const REACTIONS = ["😢", "🔥", "😡", "🎉", "🙃", "😜"] as const
export type Reaction = (typeof REACTIONS)[number]

export const LIMITS = {
    roomNameMax: 40,
    chatMax: 300,
    /** Minimum gap between two reactions from the same user. */
    reactionCooldownMs: 3000,
    /** Client messages per second per connection before RATE_LIMITED. */
    messagesPerSecond: 10,
    chatPerSecond: 1,
} as const

export const DEFAULTS = {
    targetScore: 1001 as TargetScore,
    turnTimeoutMs: 30_000,
    reconnectGraceMs: 90_000,
    botThinkMinMs: 600,
    botThinkMaxMs: 1400,
} as const

/* ───────────────────────── shared models ───────────────────────── */

export interface UserInfo {
    uid: string
    name: string
    avatarUrl: string | null
}

export type RoomStatus = "LOBBY" | "PLAYING" | "FINISHED"

export interface SeatInfo {
    seat: Seat
    /** null = empty seat */
    occupant:
        | { kind: "PLAYER"; user: UserInfo; ready: boolean; connected: boolean }
        | { kind: "BOT"; level: BotLevel; name: string }
        | null
}

export interface RoomSummary {
    id: string
    /** Auto-generated "dvije-riječi" name (server), e.g. "medeni-fakultet". */
    name: string
    /** 4-digit join code, shown in the room and accepted by `room.joinByCode`. */
    code: string
    hostUid: string
    status: RoomStatus
    targetScore: TargetScore
    private: boolean
    seatsTaken: number
    /** Seats occupied by humans (bots not counted). */
    humans: number
    createdAt: number
}

export interface RoomState extends RoomSummary {
    seats: [SeatInfo, SeatInfo, SeatInfo, SeatInfo]
    /** Users in the room but not seated (spectators / waiting). */
    spectators: UserInfo[]
    turnTimeoutMs: number
}

export interface ChatMessage {
    id: string
    from: UserInfo
    text: string
    at: number
}

export type ErrorCode =
    | "UNAUTHENTICATED"
    | "ROOM_NOT_FOUND"
    | "ROOM_FULL"
    | "SEAT_TAKEN"
    | "NOT_HOST"
    | "NOT_IN_ROOM"
    | "NOT_YOUR_TURN"
    | "ILLEGAL_MOVE"
    | "RATE_LIMITED"
    | "BAD_REQUEST"
    | "ALREADY_STARTED"
    | "NOT_ENOUGH_PLAYERS"

/* ───────────────────────── client → server ───────────────────────── */

export type ClientMessage =
    | { t: "hello"; v: number; token?: string; devName?: string }
    | { t: "ping" }
    | { t: "lobby.subscribe" }
    | { t: "lobby.unsubscribe" }
    /** `name` optional — the server generates a two-word Croatian name when absent/blank. */
    | { t: "room.create"; name?: string; targetScore: TargetScore; private: boolean }
    | { t: "room.join"; roomId: string }
    | { t: "room.joinByCode"; code: string }
    | { t: "room.leave" }
    | { t: "room.sit"; seat: Seat }
    | { t: "room.stand" }
    | { t: "room.addBot"; seat: Seat; level: BotLevel }
    | { t: "room.removeBot"; seat: Seat }
    | { t: "room.ready"; ready: boolean }
    | { t: "room.start" }
    | { t: "game.bid"; trump: Suit }
    | { t: "game.pass" }
    | { t: "game.play"; card: Card }
    | { t: "game.nextDeal" }
    | { t: "chat.send"; text: string }
    | { t: "chat.react"; reaction: Reaction }

export type ClientMessageType = ClientMessage["t"]

/* ───────────────────────── server → client ───────────────────────── */

export type ServerMessage =
    | { t: "hello.ok"; user: UserInfo; v: number }
    | { t: "pong" }
    | { t: "error"; code: ErrorCode; message: string; ref?: ClientMessageType }
    | { t: "lobby.rooms"; rooms: RoomSummary[] }
    | { t: "room.joined"; room: RoomState; yourSeat: Seat | null }
    | { t: "room.state"; room: RoomState; yourSeat: Seat | null }
    | { t: "room.left" }
    | {
          t: "game.state"
          view: PlayerView
          /** Epoch ms when the current turn times out, or null. */
          turnDeadline: number | null
          /** True when the last action was made by the bot on behalf of a (timed-out / disconnected) human. */
          autoPlayed: boolean
      }
    | { t: "game.events"; events: GameEvent[] }
    | { t: "chat.msg"; msg: ChatMessage }
    /** Emoji reaction shown next to the sender's seat/avatar for ~2 s. */
    | { t: "chat.reaction"; from: UserInfo; seat: Seat | null; reaction: Reaction; at: number }

export type ServerMessageType = ServerMessage["t"]

/* ───────────────────────── tiny runtime guards ───────────────────────── */

const CLIENT_TYPES: ReadonlySet<string> = new Set<ClientMessageType>([
    "hello", "ping", "lobby.subscribe", "lobby.unsubscribe",
    "room.create", "room.join", "room.leave", "room.sit", "room.stand",
    "room.addBot", "room.removeBot", "room.ready", "room.start",
    "game.bid", "game.pass", "game.play", "game.nextDeal", "chat.send",
    "room.joinByCode", "chat.react",
])

/** Structural check that a parsed JSON value is *shaped* like a ClientMessage (type field only). */
export function isClientMessage(x: unknown): x is ClientMessage {
    return typeof x === "object" && x !== null && typeof (x as { t?: unknown }).t === "string"
        && CLIENT_TYPES.has((x as { t: string }).t)
}

export function isSeat(x: unknown): x is Seat {
    return x === 0 || x === 1 || x === 2 || x === 3
}

export function isTargetScore(x: unknown): x is TargetScore {
    return x === 501 || x === 701 || x === 1001
}

export function isReaction(x: unknown): x is Reaction {
    return typeof x === "string" && (REACTIONS as readonly string[]).includes(x)
}

export function isBotLevel(x: unknown): x is BotLevel {
    return typeof x === "string" && (BOT_LEVELS as readonly string[]).includes(x)
}
