import { useCallback, useEffect, useMemo, useReducer, useRef } from "react"
import { PROTOCOL_VERSION } from "@bela/protocol"
import type {
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
import { useAuth } from "../../auth/authContextValue"
import type {
    GameConnectionStatus,
    GameError,
    GameTransport,
    GameTransportHandlers,
    QueuedGameEvent,
} from "../types"

/* ──────────────────────────────────────────────────────────────────────────
   useGameSocket — the ONE connection a game page holds.

   Shape follows `hooks/useLiveSocket.ts` (the tournament realtime channel):
   the socket lives entirely inside one effect, every callback the effect needs
   is reached through a ref so a re-render never tears the connection down, and
   reconnects walk a jittered backoff ladder. What is different here is that
   this socket is STATEFUL — it authenticates, it belongs to a room, and the
   server's frames ARE the data (there is no REST to refetch from) — so the
   reducer below keeps the latest room, view, chat and error, and a reconnect
   has to replay `hello` + `room.join` before anything else is sent.

   Ordering rule: nothing goes out before `hello.ok` comes back. Anything the
   UI sends in the meantime (a fast click during a reconnect) waits in
   `outboxRef` and is flushed in order once the server has greeted us —
   otherwise the server answers UNAUTHENTICATED and the click is simply lost.

   Public URL is /ws/game; the Vite dev proxy and Caddy both forward it to the
   Node game server on 8285.
   ────────────────────────────────────────────────────────────────────── */

/** 1 s, 2 s, 4 s, 8 s, then a 15 s ceiling — README §3's reconnect budget. */
const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 15_000
/** ±30 % so a server restart doesn't bring every table back in one thundering herd. */
const RECONNECT_JITTER = 0.3
/** Application-level keepalive; the server heartbeats at 25 s (README §4). */
const PING_MS = 20_000

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

interface SocketState {
    status: GameConnectionStatus
    me: UserInfo | null
    rooms: RoomSummary[]
    room: RoomState | null
    yourSeat: Seat | null
    view: PlayerView | null
    turnDeadline: number | null
    autoPlayed: boolean
    events: QueuedGameEvent[]
    chat: ChatMessage[]
    reactions: SeatReaction[]
    error: GameError | null
    /** Monotonic id source for `events`. */
    seq: number
    /** Monotonic id source for `reactions`. */
    reactionSeq: number
}

const initialState: SocketState = {
    status: "connecting",
    me: null,
    rooms: [],
    room: null,
    yourSeat: null,
    view: null,
    turnDeadline: null,
    autoPlayed: false,
    events: [],
    chat: [],
    reactions: [],
    error: null,
    seq: 0,
    reactionSeq: 0,
}

type Action =
    | { type: "status"; status: GameConnectionStatus }
    | { type: "message"; msg: ServerMessage }
    | { type: "clearError" }

function reducer(state: SocketState, action: Action): SocketState {
    switch (action.type) {
        case "status":
            return state.status === action.status ? state : { ...state, status: action.status }
        case "clearError":
            return state.error ? { ...state, error: null } : state
        case "message": {
            const msg = action.msg
            switch (msg.t) {
                case "hello.ok":
                    return { ...state, me: msg.user, error: null }
                case "pong":
                    return state
                case "error":
                    return { ...state, error: { code: msg.code, message: msg.message, ref: msg.ref } }
                case "lobby.rooms":
                    return { ...state, rooms: msg.rooms }
                case "room.joined":
                case "room.state":
                    return { ...state, room: msg.room, yourSeat: msg.yourSeat }
                case "room.left":
                    // Keep the chat log: the user may be bouncing between the
                    // room and the lobby, and losing it on every hop is worse
                    // than showing a stale line or two.
                    return { ...state, room: null, yourSeat: null, view: null, turnDeadline: null }
                case "game.state":
                    return {
                        ...state,
                        view: msg.view,
                        turnDeadline: msg.turnDeadline,
                        autoPlayed: msg.autoPlayed,
                    }
                case "game.events": {
                    if (msg.events.length === 0) return state
                    const queued = msg.events.map((event, i) => ({ id: state.seq + i, event }))
                    const events = [...state.events, ...queued]
                    return {
                        ...state,
                        seq: state.seq + msg.events.length,
                        events: events.length > MAX_EVENTS ? events.slice(-MAX_EVENTS) : events,
                    }
                }
                case "chat.msg": {
                    const chat = [...state.chat, msg.msg]
                    return { ...state, chat: chat.length > MAX_CHAT ? chat.slice(-MAX_CHAT) : chat }
                }
                case "chat.reaction": {
                    // Append rather than replace-by-seat: two reactions from
                    // the same seat in quick succession are two bubbles, and
                    // the id is what lets the second one restart the timer.
                    const next = [
                        ...state.reactions,
                        {
                            id: state.reactionSeq,
                            from: msg.from,
                            seat: msg.seat,
                            reaction: msg.reaction,
                            at: msg.at,
                        },
                    ]
                    return {
                        ...state,
                        reactionSeq: state.reactionSeq + 1,
                        reactions: next.length > MAX_REACTIONS ? next.slice(-MAX_REACTIONS) : next,
                    }
                }
            }
            return state
        }
    }
}

function socketUrl(): string {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
    return `${proto}//${window.location.host}/ws/game`
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

export interface UseGameSocketOptions {
    /** Room to (re)join as soon as the connection is greeted. */
    roomId?: string
    /** Subscribe to the lobby room list (the lobby page does, a table does not). */
    lobby?: boolean
    /** Dev-only: talk to `mock/mockGameServer.ts` instead of the network. */
    mock?: boolean
}

export interface GameSocket {
    status: GameConnectionStatus
    /** Who the server thinks we are — null until `hello.ok`. */
    me: UserInfo | null
    rooms: RoomSummary[]
    room: RoomState | null
    yourSeat: Seat | null
    view: PlayerView | null
    turnDeadline: number | null
    /** True when the last move was played by a bot standing in for a human. */
    autoPlayed: boolean
    events: QueuedGameEvent[]
    chat: ChatMessage[]
    /** Emoji reactions as they arrive; the table floats each for ~2 s. */
    reactions: SeatReaction[]
    error: GameError | null
    send: (msg: ClientMessage) => void
    /** `chat.react` — rate-limited to one per `LIMITS.reactionCooldownMs` by
     *  the sender (`ReactionsBar`) and by the server. */
    sendReaction: (reaction: Reaction) => void
    clearError: () => void
}

export function useGameSocket(options: UseGameSocketOptions = {}): GameSocket {
    const { roomId, lobby = false, mock = false } = options
    const { user } = useAuth()
    const [state, dispatch] = useReducer(reducer, initialState)

    const transportRef = useRef<GameTransport | null>(null)
    const helloOkRef = useRef(false)
    const outboxRef = useRef<ClientMessage[]>([])
    const roomIdRef = useRef<string | undefined>(roomId)
    const lobbyRef = useRef(lobby)
    const joinedRoomRef = useRef<string | undefined>(undefined)

    // The signed-in user, reachable from inside the connection effect without
    // making it a dependency (see the effect's own note on identity).
    const userRef = useRef(user)

    roomIdRef.current = roomId
    lobbyRef.current = lobby
    userRef.current = user

    /** Queue until greeted, then straight down the wire. */
    const send = useCallback((msg: ClientMessage) => {
        if (helloOkRef.current && transportRef.current) {
            transportRef.current.send(msg)
            return
        }
        outboxRef.current.push(msg)
    }, [])

    const sendReaction = useCallback(
        (reaction: Reaction) => {
            send({ t: "chat.react", reaction })
        },
        [send],
    )

    const clearError = useCallback(() => dispatch({ type: "clearError" }), [])

    // Identity, not the User object: Firebase hands out a new instance on
    // every token refresh and reconnecting the table each time would be
    // absurd. A genuine sign-in/sign-out does have to re-`hello`, though.
    const uid = user?.uid ?? null

    useEffect(() => {
        if (typeof window === "undefined" || !("WebSocket" in window)) return

        let disposed = false
        let attempt = 0
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null
        let pingTimer: ReturnType<typeof setInterval> | null = null

        const clearTimers = () => {
            if (reconnectTimer !== null) {
                clearTimeout(reconnectTimer)
                reconnectTimer = null
            }
            if (pingTimer !== null) {
                clearInterval(pingTimer)
                pingTimer = null
            }
        }

        const scheduleReconnect = () => {
            if (disposed || reconnectTimer !== null) return
            const base = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** Math.min(attempt, 4))
            const delay = Math.round(base * (1 + (Math.random() * 2 - 1) * RECONNECT_JITTER))
            attempt += 1
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null
                void connect()
            }, delay)
        }

        /** Everything that must happen (again) after every successful greet. */
        const afterHello = () => {
            helloOkRef.current = true
            attempt = 0
            const transport = transportRef.current
            if (!transport) return
            if (lobbyRef.current) transport.send({ t: "lobby.subscribe" })
            if (roomIdRef.current) {
                joinedRoomRef.current = roomIdRef.current
                transport.send({ t: "room.join", roomId: roomIdRef.current })
            }
            const pending = outboxRef.current
            outboxRef.current = []
            for (const msg of pending) transport.send(msg)
        }

        const onMessage = (msg: ServerMessage) => {
            if (disposed) return
            if (msg.t === "hello.ok") afterHello()
            dispatch({ type: "message", msg })
        }

        async function connect() {
            if (disposed) return
            dispatch({ type: "status", status: "connecting" })
            helloOkRef.current = false

            const handlers: GameTransportHandlers = {
                onOpen: () => {
                    if (disposed) return
                    dispatch({ type: "status", status: "open" })
                    void greet()
                },
                onMessage,
                onClose: () => {
                    if (disposed) return
                    helloOkRef.current = false
                    joinedRoomRef.current = undefined
                    dispatch({ type: "status", status: "closed" })
                    scheduleReconnect()
                },
            }

            try {
                if (mock && import.meta.env.DEV) {
                    const { createMockTransport } = await import("../mock/mockGameServer")
                    if (disposed) return
                    transportRef.current = createMockTransport(handlers)
                } else {
                    transportRef.current = createWebSocketTransport(handlers)
                }
            } catch {
                dispatch({ type: "status", status: "closed" })
                scheduleReconnect()
                return
            }

            if (pingTimer === null) {
                pingTimer = setInterval(() => {
                    if (helloOkRef.current) transportRef.current?.send({ t: "ping" })
                }, PING_MS)
            }
        }

        /** `hello` carries a fresh Firebase ID token; the server verifies it
         *  against securetoken.google.com (README §3). A token we cannot mint
         *  is sent as `undefined` rather than not sent at all, so a dev server
         *  running with GAME_DEV_ALLOW_ANON still greets us. */
        async function greet() {
            let token: string | undefined
            try {
                token = await userRef.current?.getIdToken()
            } catch {
                token = undefined
            }
            if (disposed) return
            transportRef.current?.send({ t: "hello", v: PROTOCOL_VERSION, token })
        }

        void connect()

        return () => {
            disposed = true
            clearTimers()
            helloOkRef.current = false
            joinedRoomRef.current = undefined
            const transport = transportRef.current
            transportRef.current = null
            transport?.close()
        }
        // `uid` and `mock` are the only two things that legitimately rebuild
        // the connection. roomId / lobby are read from refs inside so that
        // walking between rooms reuses the same socket.
    }, [uid, mock])

    // Walking from one room to another over the SAME connection. A fresh
    // connection doesn't come through here at all — `afterHello` re-joins,
    // because at that point nothing may be sent yet.
    useEffect(() => {
        if (!helloOkRef.current) return
        if (!roomId || joinedRoomRef.current === roomId) return
        joinedRoomRef.current = roomId
        send({ t: "room.join", roomId })
    }, [roomId, send])

    return useMemo(
        () => ({
            status: state.status,
            me: state.me,
            rooms: state.rooms,
            room: state.room,
            yourSeat: state.yourSeat,
            view: state.view,
            turnDeadline: state.turnDeadline,
            autoPlayed: state.autoPlayed,
            events: state.events,
            chat: state.chat,
            reactions: state.reactions,
            error: state.error,
            send,
            sendReaction,
            clearError,
        }),
        [state, send, sendReaction, clearError],
    )
}
