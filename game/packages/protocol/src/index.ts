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
    TrickReview,
} from "@bela/engine"

export type {
    Card,
    GameEvent,
    PlayerView,
    Seat,
    Suit,
    TargetScore,
    TrickReview,
    WonTrick,
} from "@bela/engine"

export const PROTOCOL_VERSION = 1

export const REACTIONS = ["😢", "🔥", "😡", "🎉", "🙃", "😜"] as const
export type Reaction = (typeof REACTIONS)[number]

/** "Gledanje štihova", in the order the create dialog offers it. The values
 *  and their meaning are the engine's (`TrickReview`); the list is repeated
 *  here so nothing has to import the engine's RUNTIME just to render three
 *  chips. */
export const TRICK_REVIEWS: readonly TrickReview[] = ["off", "leaderPair", "all"]
export const DEFAULT_TRICK_REVIEW: TrickReview = "off"

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
    /** Vrijeme za jedan potez prije nego bot odigra umjesto igrača. 20 s:
     *  30 s je za stolom bilo predugo — tri odsutna poteza zaustave partiju
     *  na pola minute po potezu. */
    turnTimeoutMs: 20_000,
    /** Seat hold after an explicit `room.leave` or a dropped socket, README §3
     *  "Timeri". Two minutes: long enough to walk back in from the lobby or
     *  survive a tunnel, short enough that a table is never stuck on a ghost. */
    reconnectGraceMs: 120_000,
    /** A short human-like pause between bot bids and card plays. */
    botThinkMinMs: 900,
    botThinkMaxMs: 1700,
} as const

/* ───────────────────────── shared models ───────────────────────── */

export interface UserInfo {
    guest?: boolean
    uid: string
    name: string
    avatarUrl: string | null
}

export type RoomStatus = "LOBBY" | "PLAYING" | "FINISHED"

export interface SeatInfo {
    seat: Seat
    /** null = empty seat */
    occupant:
        | {
              kind: "PLAYER"
              user: UserInfo
              ready: boolean
              connected: boolean
              /** While `connected` is false: epoch ms when the seat hold expires
               *  and a bot takes over for good. Absent/null = no hold running. */
              holdUntil?: number | null
          }
        | { kind: "BOT"; name: string }
        | null
}

/**
 * One seat as the LOBBY LIST sees it (README §3 "Lobby").
 *
 * `lobby.rooms` goes to EVERY subscriber, including people who are not in the
 * room and never will be, so this carries a display name and nothing else: no
 * uid, no avatar URL, no ready flag. `SeatInfo` (inside `RoomState`) is the
 * richer, members-only view.
 */
export type RoomOccupant =
    | { kind: "PLAYER"; name: string; connected: boolean }
    | { kind: "BOT"; name: string }
    | null

export interface RoomSummary {
    id: string
    /** Auto-generated "dvije-riječi" name (server), e.g. "medeni-fakultet". */
    name: string
    /** 4-digit join code for members of a private room; redacted elsewhere. */
    code: string
    status: RoomStatus
    targetScore: TargetScore
    private: boolean
    /** Whether people without a seat may join once the game is in progress. */
    allowSpectators: boolean
    seatsTaken: number
    /** Seats occupied by humans (bots not counted). */
    humans: number
    /** Who is at the table, in seat order — names only (see `RoomOccupant`). */
    occupants: [RoomOccupant, RoomOccupant, RoomOccupant, RoomOccupant]
    /**
     * The server's own answer to "could a newcomer enter this room at all?" —
     * false when there is no free seat and spectating is off. The lobby refuses
     * such a row up front instead of letting the join fail with `ROOM_FULL`;
     * because the flag is the SAME predicate the server enforces on join
     * (`Room.canAdmitNewcomer`), the two can never disagree. It says nothing
     * about the private-room code, which is checked separately.
     */
    joinable: boolean
    createdAt: number
}

export interface RoomState extends RoomSummary {
    /** Members-only: the lobby summary carries no uid at all. */
    hostUid: string
    noDeclarations: boolean
    allowBela: boolean
    /** Who may review completed tricks (README §1.8). Chosen when the room is
     *  created, applies to the whole room, and is shown to everyone in it —
     *  so it belongs on the room, not on a per-player preference. */
    trickReview: TrickReview
    seats: [SeatInfo, SeatInfo, SeatInfo, SeatInfo]
    /** Users in the room but not seated (spectators / waiting). */
    spectators: UserInfo[]
    turnTimeoutMs: number
}

/**
 * A seat somewhere that still belongs to this connection's user, whether they
 * are sitting at that table right now or the room is only holding it for them.
 * Carried by `game.active` (README §3 "Aktivno sjedalo") so the lobby — and the
 * app-wide "active room" widget — can offer a way back in without the client
 * having to remember which room it was.
 */
export interface ActiveSeatInfo {
    roomId: string
    roomName: string
    /** Join code when the room is private (you are a member); "" for public rooms. */
    code: string
    status: RoomStatus
    targetScore: TargetScore
    seat: Seat
    /** True while you are attached to that room with a live connection. */
    present: boolean
    /** Epoch ms when the hold expires and a bot takes the seat for good; null while present. */
    holdUntil: number | null
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
    | "ROOM_CODE_REQUIRED"
    | "SPECTATORS_DISABLED"
    | "SEAT_TAKEN"
    | "NOT_HOST"
    | "NOT_IN_ROOM"
    | "NOT_YOUR_TURN"
    | "ILLEGAL_MOVE"
    | "RATE_LIMITED"
    | "BAD_REQUEST"
    | "ALREADY_STARTED"
    | "NOT_ENOUGH_PLAYERS"
    /** You already hold a seat in another room. One game at a time: go back to
     *  it, or leave it, before opening or joining another (README §3.2). */
    | "ALREADY_IN_GAME"

/* ───────────────────────── client → server ───────────────────────── */

export type ClientMessage =
    | { t: "hello"; v: number; token?: string; devName?: string; guest?: { name: string; secret: string } }
    | { t: "ping" }
    | { t: "lobby.subscribe" }
    | { t: "lobby.unsubscribe" }
    /** `name` optional — the server generates a two-word Croatian name when absent/blank. */
    | { t: "room.create"; name?: string; targetScore: TargetScore; private: boolean; allowSpectators?: boolean; noDeclarations?: boolean; allowBela?: boolean; trickReview?: TrickReview }
    | { t: "room.setPrivate"; private: boolean }
    | { t: "room.join"; roomId: string }
    | { t: "room.joinByCode"; code: string }
    | { t: "room.leave" }
    | { t: "room.sit"; seat: Seat }
    | { t: "room.stand" }
    | { t: "room.addBot"; seat: Seat }
    | { t: "room.removeBot"; seat: Seat }
    | { t: "room.ready"; ready: boolean }
    | { t: "room.start" }
    | { t: "game.bid"; trump: Suit }
    | { t: "game.pass" }
    /**
     * `bela` is the player's answer to "Zovi belu?" (README §1.4, §3), asked
     * by the CLIENT before the move is sent — there is no separate round trip
     * and no phase the server waits on. Omit it (or send `true`) to announce;
     * send `false` to decline for the whole deal.
     *
     * The client is not the authority: the engine derives the bela from the
     * hand and the flag can only suppress it, so a `false` with nothing to
     * decline — and a `true` from a seat that does not hold K+Q of trump —
     * changes nothing at all.
     */
    | { t: "game.play"; card: Card; bela?: boolean }
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
    /** Which room (if any) still holds a seat for this user, and for how long.
     *  Sent right after `hello.ok`, on every `lobby.rooms` fan-out, and after
     *  a join/leave. `seat: null` means "you hold no seat anywhere". */
    | { t: "game.active"; seat: ActiveSeatInfo | null }
    | {
          t: "game.state"
          declarationsPending?: boolean
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
    "room.joinByCode", "chat.react", "room.setPrivate",
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

export function isTrickReview(x: unknown): x is TrickReview {
    return typeof x === "string" && (TRICK_REVIEWS as readonly string[]).includes(x)
}
