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
    GameEndRule,
    PlayerView,
    Seat,
    Suit,
    TargetScore,
    TrickReview,
} from "@bela/engine"

export type {
    Card,
    GameEvent,
    GameEndRule,
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
/**
 * The pickable avatar faces, MIRRORED from
 * `frontend/src/components/avatars/avatarArt.ts` (which owns the drawings).
 *
 * **APPEND-ONLY.** Never reorder, rename or remove an entry. Two things read
 * this list positionally: a guest with no pick is given a face by hashing
 * their uid into an index (`avatarPresetForUid` in the server), so a
 * reordered list re-faces every guest at once; and a stored `avatarPreset`
 * that is no longer in the list silently degrades to initials.
 *
 * It lives in the protocol rather than in the server because THREE parties
 * need the same 16 names: the server (validating `profile.setAvatar` and the
 * guest's `hello`), the browser mock server, and the client. The art itself
 * stays on the frontend — this is only the vocabulary.
 */
export const AVATAR_PRESETS = [
    "kralj", "baba", "decko", "dida", "baka", "gazda", "konobar", "cura",
    "momak", "kibic", "gospon", "sudac", "teta", "profa", "mornar", "seka",
] as const
export type AvatarPreset = (typeof AVATAR_PRESETS)[number]

export const TRICK_REVIEWS: readonly TrickReview[] = ["off", "leaderPair", "all"]
export const DEFAULT_TRICK_REVIEW: TrickReview = "off"
export const GAME_END_RULES: readonly GameEndRule[] = ["prolaz", "dosta"]
export const DEFAULT_GAME_END_RULE: GameEndRule = "prolaz"

export const LIMITS = {
    roomNameMax: 40,
    /**
     * The longest a player's display name may be — 16 characters
     * (2026-09-09, user request), punctuation and spaces included.
     *
     * It is a table constraint rather than a form one: four names have to fit
     * around a drawn table on a phone, and a name that arrives from a Firebase
     * token or an old guest record has to obey it just as a typed one does.
     * Enforced on the server (`connection.ts`), mirrored by `maxLength` on the
     * inputs so the cap is visible while typing rather than after sending.
     */
    playerNameMax: 16,
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
    /**
     * Picked face (`AVATAR_PRESETS`), or null when the player has none.
     *
     * It sits NEXT TO `avatarUrl`, not instead of it: an uploaded photo is
     * still the truest picture of a person and keeps winning. The preset is
     * what everyone else gets — the whole point of the set is that a seat is
     * never a grey circle with two letters in it, and a guest with no account
     * always has one (the server assigns one from their uid).
     */
    avatarPreset?: string | null
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
    gameEndRule: GameEndRule
    /** Whether declaration scoring is disabled for this room. */
    noDeclarations: boolean
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
    /** The in-game name may only be changed once a week; `nextChangeAt` on the
     *  `profile.name` reply says when. */
    | "NAME_RATE_LIMITED"

/* ───────────────────────── client → server ───────────────────────── */

export type ClientMessage =
    /**
     * `guest.avatarPreset` is the face the guest picked on the identity screen
     * before they had an account to hang it on — it travels with the greeting
     * because there is nowhere else to put it: a guest has no profile row, and
     * the browser's `bela.guest` record is the only place it is stored. Absent
     * or unrecognised, the server assigns one from the guest's uid, so a seat
     * is never faceless (README §3 "Auth").
     */
    | { t: "hello"; v: number; token?: string; devName?: string; guest?: { name: string; secret: string; avatarPreset?: string } }
    | { t: "ping" }
    | { t: "lobby.subscribe" }
    | { t: "lobby.unsubscribe" }
    /** `name` optional — the server generates a two-word Croatian name when absent/blank. */
    | { t: "room.create"; name?: string; targetScore: TargetScore; gameEndRule?: GameEndRule; private: boolean; allowSpectators?: boolean; noDeclarations?: boolean; allowBela?: boolean; trickReview?: TrickReview }
    | { t: "room.setPrivate"; private: boolean }
    /**
     * Change the room's own settings while it is still in the LOBBY — host
     * only, refused once a game is running (2026-09-09, user request: the
     * settings sheet shows "postavke ove igre" first, and they must be
     * editable until the deal starts).
     *
     * Every field is OPTIONAL and absent means "leave it alone", so the client
     * can send one switch without restating the other five. `private` is
     * deliberately NOT here: it already has `room.setPrivate` and its own
     * control on the room screen, and two ways to write one flag is how the
     * two get out of step.
     */
    | {
        t: "room.setOptions"
        targetScore?: TargetScore
        gameEndRule?: GameEndRule
        allowSpectators?: boolean
        noDeclarations?: boolean
        allowBela?: boolean
        trickReview?: TrickReview
    }
    /**
     * Set this player's IN-GAME name ("ime za igru") — 2026-09-09, user
     * request. Separate from the account's display name, and the only way any
     * player changes what is written above their seat.
     *
     * It goes over this socket rather than to the app's REST API because a
     * GUEST has no account and no bearer token: their identity exists only
     * here, as the uid the server derives from the secret their browser keeps.
     * One path for both kinds of player is also the only way the once-a-week
     * limit can mean anything — see `NAME_RATE_LIMITED`.
     */
    | { t: "profile.setName"; name: string }
    /**
     * Pick the face this player wears at the table. `preset` must be one of
     * `AVATAR_PRESETS`; anything else is `BAD_REQUEST` rather than silently
     * ignored, so a client cannot think it changed a face that never changed.
     *
     * Same reason as `profile.setName` for riding this socket: a guest has no
     * bearer token and no account, and their face has to reach the seats they
     * are sitting on right now.
     */
    | { t: "profile.setAvatar"; preset: string }
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
    /**
     * The player's in-game name after a `profile.setName`, and when it may
     * next be changed (epoch ms). Sent to the one connection that asked; the
     * new name reaches everybody else through the room state, because that is
     * where a seat's name is read from.
     */
    | { t: "profile.name"; name: string; nextChangeAt: number }
    /**
     * The player's face after a `profile.setAvatar`, confirmed to the one
     * connection that asked; everybody else sees it through the room state,
     * exactly as with a rename.
     *
     * A SEPARATE frame rather than a field on `profile.name`: that message
     * exists to carry the once-a-week name clock (`nextChangeAt`), the avatar
     * has no such rule, and reusing it would force a made-up timestamp that
     * the client's reducer reads as "the name just changed". One message, one
     * meaning.
     */
    | { t: "profile.avatar"; preset: string }
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
    "room.joinByCode", "chat.react", "room.setPrivate", "room.setOptions",
    "profile.setName", "profile.setAvatar",
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

export function isAvatarPreset(x: unknown): x is AvatarPreset {
    return typeof x === "string" && (AVATAR_PRESETS as readonly string[]).includes(x)
}

export function isTrickReview(x: unknown): x is TrickReview {
    return typeof x === "string" && (TRICK_REVIEWS as readonly string[]).includes(x)
}
