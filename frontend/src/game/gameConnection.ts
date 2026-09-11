import { DEFAULTS, PROTOCOL_VERSION } from "@bela/protocol"
import type {
    ActiveSeatInfo,
    ChatMessage,
    ClientMessage,
    PlayerView,
    Reaction,
    RoomState,
    RoomSummary,
    Seat,
    ServerMessage,
    UserInfo,
} from "@bela/protocol"
import { wsOrigin } from "../platform"
import { readStickyRoomId, writeStickyRoomId } from "./activeRoomKey"
import { readGuest } from "./hooks/guestIdentity"
import type {
    GameConnectionStatus,
    GameError,
    GameTransport,
    GameTransportHandlers,
    QueuedGameEvent,
} from "./types"

/* ──────────────────────────────────────────────────────────────────────────
   gameConnection — the ONE game socket, hoisted out of React.

   WHY A MODULE SINGLETON (and not an app-level provider):

   Room membership has to outlive the `/igra/*` pages. The user can leave the
   table, keep their seat, and wander off to /turniri — and the app-wide
   "active room" widget still has to show that room and let them walk back in.
   With the socket owned by `useGameSocket` inside a page, unmounting the page
   killed the connection, the server saw a disconnect, and the seat started
   burning its hold for no reason.

   A provider mounted in `main.tsx` would also survive, but it would open a
   WebSocket for EVERY visitor of the site — including everyone who never
   touches the game — and it would drag the game chunk into the app's critical
   bundle. This module instead:

     • is imported only from `src/game/**`, so it stays inside the game chunk;
     • opens nothing until something ACTIVELY retains it (a game page, or the
       widget when a sticky room membership exists);
     • closes itself again `IDLE_CLOSE_MS` after the last active retainer goes.

   React reads it through `useSyncExternalStore` in `hooks/useGameSocket.ts`,
   so there is exactly one state, one reconnect ladder and one outbox no
   matter how many components are looking.

   Public URL is /ws/game; the Vite dev proxy and Caddy both forward it to the
   Node game server on 8285. The origin in front of that path comes from
   ../platform: the current page on the web, the real host in a native shell.
   ────────────────────────────────────────────────────────────────────── */

/** 1 s, 2 s, 4 s, 8 s, then a 15 s ceiling — README §3's reconnect budget. */
const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 15_000
/** ±30 % so a server restart doesn't bring every table back in one thundering herd. */
const RECONNECT_JITTER = 0.3
/** Application-level keepalive; the server heartbeats at 25 s (README §4). */
const PING_MS = 20_000
/** Grace before an unretained socket is dropped — one page swap must not close it. */
const IDLE_CLOSE_MS = 3_000

/** Ring buffers — a long game must not grow unbounded React state. */
const MAX_EVENTS = 200
const MAX_CHAT = 100
/** Reactions are on screen for ~2 s; a handful is all the table can ever show. */
const MAX_REACTIONS = 12

/** One `chat.reaction` frame, with a local id so the bubble that renders it
 *  can be keyed and expired independently of the frames around it. */
export interface SeatReaction {
    id: number
    from: UserInfo
    /** null when a spectator reacted — there is no seat to float it over. */
    seat: Seat | null
    reaction: Reaction
    /** Server timestamp; the bubble lives ~2 s from here. */
    at: number
}

export interface GameSocketState {
    status: GameConnectionStatus
    me: UserInfo | null
    rooms: RoomSummary[]
    room: RoomState | null
    yourSeat: Seat | null
    view: PlayerView | null
    turnDeadline: number | null
    declarationsPending: boolean
    autoPlayed: boolean
    events: QueuedGameEvent[]
    chat: ChatMessage[]
    reactions: SeatReaction[]
    error: GameError | null
    /** Server's answer to "do I hold a seat anywhere?" (`game.active`). */
    activeSeat: ActiveSeatInfo | null
    /**
     * The in-game name as the SERVER last confirmed it, and the instant it may
     * next be changed — both from `profile.name`, both null until the player
     * actually changes it in this session.
     *
     * `me.name` is not the same thing: it is whatever the seat is wearing,
     * which may be the account name or the guest's typed one. This pair exists
     * so the settings sheet can say "spremljeno" and, on a refusal, "tek
     * <datum>" without inventing either.
     */
    gameName: string | null
    gameNameNextChangeAt: number | null
    /**
     * Epoch ms our seat stops being held while the socket is DOWN, or null.
     *
     * Derived, not received: the hold starts precisely because the server can
     * no longer talk to us, so nothing can tell us its deadline. We take the
     * moment the socket closed plus the documented `reconnectGraceMs` — the
     * same number the server used — which is what `ReconnectBanner` counts
     * down. It is cleared the instant we are greeted again.
     */
    holdUntil: number | null
    /** Room we keep membership in while away from the game pages; null = none. */
    stickyRoomId: string | null
    /** The user hid the floating widget for this room; membership is untouched. */
    widgetDismissed: boolean
    /** Monotonic id source for `events`. */
    seq: number
    /** Monotonic id source for `reactions`. */
    reactionSeq: number
}

const initialState: GameSocketState = {
    status: "closed",
    me: null,
    rooms: [],
    room: null,
    yourSeat: null,
    view: null,
    turnDeadline: null,
    declarationsPending: false,
    autoPlayed: false,
    events: [],
    chat: [],
    reactions: [],
    error: null,
    activeSeat: null,
    gameName: null,
    gameNameNextChangeAt: null,
    holdUntil: null,
    stickyRoomId: typeof window === "undefined" ? null : readStickyRoomId(),
    widgetDismissed: false,
    seq: 0,
    reactionSeq: 0,
}

let state: GameSocketState = initialState
const listeners = new Set<() => void>()

function emit(): void {
    for (const listener of listeners) listener()
}

function set(next: GameSocketState): void {
    if (next === state) return
    state = next
    emit()
}

export function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

export function getSnapshot(): GameSocketState {
    return state
}

/* ───────────────────────── sticky membership ───────────────────────── */

function setSticky(roomId: string | null): void {
    if (state.stickyRoomId === roomId) return
    writeStickyRoomId(roomId)
    set({ ...state, stickyRoomId: roomId, ...(roomId === null ? { widgetDismissed: false } : {}) })
    sync()
}

/** Hide the floating widget without giving up the seat. */
export function dismissWidget(): void {
    if (state.widgetDismissed) return
    set({ ...state, widgetDismissed: true })
}

/**
 * "Izađi iz sobe": while present in a running game this starts the two-minute
 * hold. Calling it once more from an already-held state abandons the seat;
 * that second action is intentionally not offered in the playing-game lobby.
 */
export function leaveRoom(): void {
    if (state.room || state.stickyRoomId || state.activeSeat) send({ t: "room.leave" })
    setSticky(null)
}

/* ───────────────────────── frame handling ───────────────────────── */

function applyMessage(prev: GameSocketState, msg: ServerMessage): GameSocketState {
    switch (msg.t) {
        case "hello.ok":
            // We are back on speaking terms; whatever hold the outage started
            // is either cancelled (room.join follows) or none of our business.
            return { ...prev, me: msg.user, error: null, holdUntil: null }
        case "pong":
            return prev
        case "error":
            return {
                ...prev,
                error: { code: msg.code, message: msg.message, ref: msg.ref },
                // A direct link can outlive its room. Do not keep rendering a
                // cached table while the room page handles the terminal error
                // and returns to the lobby.
                ...(msg.code === "ROOM_NOT_FOUND"
                    ? { room: null, yourSeat: null, view: null, turnDeadline: null }
                    : {}),
            }
        case "lobby.rooms":
            return { ...prev, rooms: msg.rooms }
        case "game.active":
            return { ...prev, activeSeat: msg.seat }
        case "profile.name":
            // Rename ourselves on the spot. The room broadcasts its own copies
            // of the seats (`renameOccupant` on the server), so the table
            // catches up on the next `room.state`; `me` is the one thing no
            // other frame is going to correct.
            return {
                ...prev,
                gameName: msg.name,
                gameNameNextChangeAt: msg.nextChangeAt > 0 ? msg.nextChangeAt : null,
                me: prev.me ? { ...prev.me, name: msg.name } : prev.me,
                error: null,
            }
        case "profile.avatar":
            // Same shape as the rename above: the table catches up through the
            // room's own `room.state`, and `me` is the one copy no other frame
            // will correct.
            return {
                ...prev,
                me: prev.me ? { ...prev.me, avatarPreset: msg.preset } : prev.me,
                error: null,
            }
        case "room.joined":
        case "room.state":
            return {
                ...prev,
                room: msg.room,
                yourSeat: msg.yourSeat,
                // A rematch must not replay the previous game's final animations.
                ...(prev.room?.status === "LOBBY" && msg.room.status === "PLAYING" ? { events: [] } : {}),
            }
        case "room.left":
            // Keep the chat log: the user may be bouncing between the room and
            // the lobby, and losing it on every hop is worse than showing a
            // stale line or two.
            return { ...prev, room: null, yourSeat: null, view: null, turnDeadline: null }
        case "game.state":
            return {
                ...prev,
                view: msg.view,
                turnDeadline: msg.turnDeadline,
                autoPlayed: msg.autoPlayed,
                declarationsPending: msg.declarationsPending === true,
            }
        case "game.events": {
            if (msg.events.length === 0) return prev
            const queued = msg.events.map((event, i) => ({ id: prev.seq + i, event }))
            const events = [...prev.events, ...queued]
            return {
                ...prev,
                seq: prev.seq + msg.events.length,
                events: events.length > MAX_EVENTS ? events.slice(-MAX_EVENTS) : events,
            }
        }
        case "chat.msg": {
            const chat = [...prev.chat, msg.msg]
            return { ...prev, chat: chat.length > MAX_CHAT ? chat.slice(-MAX_CHAT) : chat }
        }
        case "chat.reaction": {
            // Append rather than replace-by-seat: two reactions from the same
            // seat in quick succession are two bubbles, and the id is what lets
            // the second one restart the timer.
            const next = [
                ...prev.reactions,
                { id: prev.reactionSeq, from: msg.from, seat: msg.seat, reaction: msg.reaction, at: msg.at },
            ]
            return {
                ...prev,
                reactionSeq: prev.reactionSeq + 1,
                reactions: next.length > MAX_REACTIONS ? next.slice(-MAX_REACTIONS) : next,
            }
        }
    }
    return prev
}

/** Membership bookkeeping that has to happen after the state has settled. */
function reconcileSticky(msg: ServerMessage): void {
    if (msg.t === "room.joined" || msg.t === "room.state") {
        // Only a SEAT is worth keeping around for. A spectator drive-by must
        // not pin an open socket to the whole app. The in-browser mock has no
        // server behind it, so a widget outliving `/igra?mock=1` would only
        // flail at a real /ws/game that isn't there.
        if (msg.yourSeat !== null && !connectedMock) setSticky(msg.room.id)
        else if (state.stickyRoomId === msg.room.id) setSticky(null)
        return
    }
    if (msg.t === "room.left") {
        setSticky(null)
        return
    }
    if (msg.t === "error" && msg.code === "ROOM_NOT_FOUND") {
        // The room we were holding on to is gone — stop trying to walk into it.
        setSticky(null)
    }
}

/* ───────────────────────── retainers ───────────────────────── */

export interface Retainer {
    /** Room this consumer wants to be joined to. */
    roomId?: string
    /** Subscribe to `lobby.rooms` (the lobby page does; a table does not). */
    lobby?: boolean
    /** Dev-only: talk to `mock/mockGameServer.ts` instead of the network. */
    mock?: boolean
    /** false = observe the store only; never opens a socket by itself. */
    active: boolean
}

const retainers = new Set<Retainer>()

export function retain(r: Retainer): () => void {
    retainers.add(r)
    sync()
    return () => {
        retainers.delete(r)
        sync()
    }
}

/** Re-read a retainer that changed in place (options are mutated, not swapped). */
export function refresh(): void {
    sync()
}

interface Desired {
    active: boolean
    roomId: string | undefined
    lobby: boolean
    mock: boolean
}

function desired(): Desired {
    let active = false
    let roomId: string | undefined
    let lobby = false
    let mock = false
    for (const r of retainers) {
        if (!r.active) continue
        active = true
        if (r.roomId !== undefined && roomId === undefined) roomId = r.roomId
        if (r.lobby) lobby = true
        if (r.mock) mock = true
    }
    return { active, roomId, lobby, mock }
}

/* ───────────────────────── auth ───────────────────────── */

type TokenSource = () => Promise<string | undefined>

let authUid: string | null = null
let getToken: TokenSource = async () => undefined

/** The hook pushes the signed-in identity down; a change rebuilds the socket. */
export function setAuth(uid: string | null, source: TokenSource): void {
    getToken = source
    if (authUid === uid) return
    authUid = uid
    if (transport) teardown()
    sync()
}

/* ───────────────────────── the connection ───────────────────────── */

let transport: GameTransport | null = null
let helloOk = false
let outbox: ClientMessage[] = []
let joinedRoomId: string | undefined
let lobbySubscribed = false
let connectedUid: string | null = null
let connectedMock = false
let attempt = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let pingTimer: ReturnType<typeof setInterval> | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null

function setStatus(status: GameConnectionStatus): void {
    if (state.status === status) return
    set({ ...state, status })
}

function clearReconnect(): void {
    if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
    }
}

function teardown(): void {
    clearReconnect()
    if (pingTimer !== null) {
        clearInterval(pingTimer)
        pingTimer = null
    }
    helloOk = false
    joinedRoomId = undefined
    lobbySubscribed = false
    const t = transport
    transport = null
    t?.close()
    setStatus("closed")
}

function scheduleReconnect(): void {
    if (reconnectTimer !== null) return
    if (!desired().active) return
    const base = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** Math.min(attempt, 4))
    const delay = Math.round(base * (1 + (Math.random() * 2 - 1) * RECONNECT_JITTER))
    attempt += 1
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        void connect()
    }, delay)
}

function socketUrl(): string {
    return `${wsOrigin}/ws/game`
}

/** The production transport: a plain WebSocket that parses frames for us. */
function createWebSocketTransport(handlers: GameTransportHandlers): GameTransport {
    const socket = new WebSocket(socketUrl())
    socket.onopen = () => handlers.onOpen()
    socket.onmessage = (ev) => {
        try {
            handlers.onMessage(JSON.parse(String(ev.data)) as ServerMessage)
        } catch {
            /* a malformed frame is dropped — never blank the table over one */
        }
    }
    socket.onclose = () => handlers.onClose()
    socket.onerror = () => {
        // Let onclose drive the reconnect: a socket that errors always closes,
        // and handling both would double-schedule the retry.
        try {
            socket.close()
        } catch {
            /* noop */
        }
    }
    return {
        send: (msg) => {
            if (socket.readyState !== WebSocket.OPEN) return
            socket.send(JSON.stringify(msg))
        },
        close: () => {
            try {
                socket.close()
            } catch {
                /* noop */
            }
        },
    }
}

/** `hello` carries a fresh Firebase ID token; the server verifies it against
 *  securetoken.google.com (README §3). A token we cannot mint is sent as
 *  `undefined` rather than not sent at all, so a dev server running with
 *  GAME_DEV_ALLOW_ANON still greets us. */
async function greet(mine: GameTransport): Promise<void> {
    let token: string | undefined
    try {
        token = await getToken()
    } catch {
        token = undefined
    }
    if (transport !== mine) return
    const guest = authUid ? null : readGuest()
    // The stored record calls the face `avatar`; the wire calls it
    // `avatarPreset`. Mapped here rather than renamed on either side: the
    // storage key is the browser's own and the frame is the protocol's, and
    // the guest object is spread onto the wire so an unmapped extra field
    // would just travel as noise.
    mine.send({
        t: "hello",
        v: PROTOCOL_VERSION,
        token,
        ...(guest
            ? { guest: { name: guest.name, secret: guest.secret, ...(guest.avatar ? { avatarPreset: guest.avatar } : {}) } }
            : {}),
    })
}

/** Everything that must happen (again) after every successful greet. */
function afterHello(): void {
    helloOk = true
    attempt = 0
    applyDesired()
    const pending = outbox
    outbox = []
    for (const msg of pending) transport?.send(msg)
}

/** Bring the live connection in line with what the mounted consumers want. */
function applyDesired(): void {
    if (!helloOk || !transport) return
    const d = desired()
    if (d.lobby && !lobbySubscribed) {
        lobbySubscribed = true
        transport.send({ t: "lobby.subscribe" })
    } else if (!d.lobby && lobbySubscribed) {
        lobbySubscribed = false
        transport.send({ t: "lobby.unsubscribe" })
    }
    // Never auto-LEAVE: walking off the game pages keeps the seat on purpose
    // (that is the whole point of the widget). Leaving is always explicit.
    if (d.roomId !== undefined && joinedRoomId !== d.roomId) {
        joinedRoomId = d.roomId
        transport.send({ t: "room.join", roomId: d.roomId })
    }
}

async function connect(): Promise<void> {
    const d = desired()
    if (!d.active || transport !== null) return
    connectedUid = authUid
    connectedMock = d.mock
    setStatus("connecting")
    helloOk = false
    joinedRoomId = undefined
    lobbySubscribed = false

    const handlers: GameTransportHandlers = {
        onOpen: () => {
            setStatus("open")
            const mine = transport
            if (mine) void greet(mine)
        },
        onMessage: (msg) => {
            if (msg.t === "hello.ok") afterHello()
            set(applyMessage(state, msg))
            reconcileSticky(msg)
        },
        onClose: () => {
            helloOk = false
            joinedRoomId = undefined
            lobbySubscribed = false
            transport = null
            // Losing the socket while seated is exactly what starts the
            // server's seat hold, so start the client's countdown from here.
            if (state.yourSeat !== null && state.holdUntil === null) {
                set({ ...state, holdUntil: Date.now() + DEFAULTS.reconnectGraceMs })
            }
            setStatus("closed")
            scheduleReconnect()
        },
    }

    try {
        if (d.mock && import.meta.env.DEV) {
            const { createMockTransport } = await import("./mock/mockGameServer")
            if (!desired().active) return
            transport = createMockTransport(handlers)
        } else {
            transport = createWebSocketTransport(handlers)
        }
    } catch {
        setStatus("closed")
        scheduleReconnect()
        return
    }

    if (pingTimer === null) {
        pingTimer = setInterval(() => {
            if (helloOk) transport?.send({ t: "ping" })
        }, PING_MS)
    }
}

/** The one place that decides whether a socket should exist right now. */
function sync(): void {
    if (typeof window === "undefined" || !("WebSocket" in window)) return
    const d = desired()

    if (!d.active) {
        if (transport === null && reconnectTimer === null) return
        if (idleTimer === null) {
            idleTimer = setTimeout(() => {
                idleTimer = null
                if (desired().active) return
                teardown()
            }, IDLE_CLOSE_MS)
        }
        return
    }

    if (idleTimer !== null) {
        clearTimeout(idleTimer)
        idleTimer = null
    }

    // Identity or transport kind changed under us — rebuild rather than patch.
    if (transport !== null && (connectedUid !== authUid || connectedMock !== d.mock)) {
        teardown()
    }

    if (transport === null && reconnectTimer === null) {
        void connect()
        return
    }
    applyDesired()
}

/* ───────────────────────── outgoing ───────────────────────── */

/** Queue until greeted, then straight down the wire. */
export function send(msg: ClientMessage): void {
    if (helloOk && transport) {
        transport.send(msg)
        return
    }
    outbox.push(msg)
    // A queued message implies intent to be connected; if we idled out, come back.
    sync()
}

export function clearError(): void {
    if (!state.error) return
    set({ ...state, error: null })
}
