/* ──────────────────────────────────────────────────────────────────────────
   Connection lifecycle and message dispatch (README §3, §4).

   Rules enforced here:
     • every frame is JSON and must pass `isClientMessage`; anything else is a
       single `error BAD_REQUEST` and the connection stays open
     • a token-bucket rate limit per connection (`LIMITS.messagesPerSecond`,
       `LIMITS.chatPerSecond`) → `error RATE_LIMITED`
     • `hello` must come first, everything else before it is `UNAUTHENTICATED`
     • `ping` → `pong`; on top of that the server pings every 25 s and
       terminates a socket that misses two pongs
   ────────────────────────────────────────────────────────────────────── */

import type { RawData, WebSocket } from "ws"
import {
    isAvatarPreset,
    isClientMessage,
    isReaction,
    isSeat,
    isTargetScore,
    isTrickReview,
    LIMITS,
    PROTOCOL_VERSION,
} from "@bela/protocol"
import type {
    ClientMessage,
    ClientMessageType,
    ErrorCode,
    ServerMessage,
    UserInfo,
} from "@bela/protocol"
import type { Authenticator } from "./auth.js"
import type { Config, RateLimits, Timings } from "./config.js"
import { handleChat, handleReaction } from "./chat.js"
import { DEFAULT_MESSAGES, isProtocolError, ProtocolError } from "./errors.js"
import { newConnId } from "./ids.js"
import type { ProfileLookup } from "./profiles.js"
import type { Lobby } from "./lobby.js"
import { log } from "./log.js"
import type { Room } from "./room.js"

/** What rooms, the lobby and the game see of a socket. */
export interface Connection {
    readonly id: string
    user: UserInfo | null
    roomId: string | null
    lobbySubscribed: boolean
    send(msg: ServerMessage): void
    error(code: ErrorCode, message?: string, ref?: ClientMessageType): void
    close(): void
}

/* ───────────────────────── token bucket ───────────────────────── */

interface Bucket {
    tokens: number
    capacity: number
    perSecond: number
    last: number
}

function makeBucket(perSecond: number): Bucket {
    const capacity = Math.max(1, perSecond)
    return { tokens: capacity, capacity, perSecond: Math.max(1, perSecond), last: Date.now() }
}

function take(b: Bucket, now: number): boolean {
    const elapsed = Math.max(0, now - b.last)
    b.last = now
    b.tokens = Math.min(b.capacity, b.tokens + (elapsed / 1000) * b.perSecond)
    if (b.tokens < 1) return false
    b.tokens -= 1
    return true
}

/* ───────────────────────── connection ───────────────────────── */

class Conn implements Connection {
    readonly id: string
    user: UserInfo | null
    roomId: string | null
    lobbySubscribed: boolean
    missedPongs: number

    private readonly socket: WebSocket
    private readonly messages: Bucket
    private readonly chat: Bucket
    private lastReactionAt: number | null
    private closed: boolean

    constructor(socket: WebSocket, rates: RateLimits) {
        this.id = newConnId()
        this.socket = socket
        this.user = null
        this.roomId = null
        this.lobbySubscribed = false
        this.missedPongs = 0
        this.messages = makeBucket(rates.messagesPerSecond)
        this.chat = makeBucket(rates.chatPerSecond)
        this.lastReactionAt = null
        this.closed = false
    }

    takeMessage(now: number): boolean {
        return take(this.messages, now)
    }

    takeChat(now: number): boolean {
        return take(this.chat, now)
    }

    /** `LIMITS.reactionCooldownMs` between two reactions from the same connection. */
    takeReaction(now: number): boolean {
        if (this.lastReactionAt !== null && now - this.lastReactionAt < LIMITS.reactionCooldownMs) {
            return false
        }
        this.lastReactionAt = now
        return true
    }

    send(msg: ServerMessage): void {
        if (this.closed) return
        // 1 === WebSocket.OPEN
        if (this.socket.readyState !== 1) return
        try {
            this.socket.send(JSON.stringify(msg))
        } catch (e) {
            log.warn("ws.send.failed", { conn: this.id, err: e })
        }
    }

    error(code: ErrorCode, message?: string, ref?: ClientMessageType): void {
        const frame: ServerMessage =
            ref === undefined
                ? { t: "error", code, message: message ?? DEFAULT_MESSAGES[code] }
                : { t: "error", code, message: message ?? DEFAULT_MESSAGES[code], ref }
        this.send(frame)
    }

    ping(): void {
        if (this.closed) return
        try {
            this.socket.ping()
        } catch {
            /* the close handler will clean up */
        }
    }

    terminate(): void {
        this.closed = true
        try {
            this.socket.terminate()
        } catch {
            /* already gone */
        }
    }

    close(): void {
        this.closed = true
        try {
            this.socket.close(1000, "server closing")
        } catch {
            /* already gone */
        }
    }

    markClosed(): void {
        this.closed = true
    }

    isClosed(): boolean {
        return this.closed
    }
}

/* ───────────────────────── hub ───────────────────────── */

export interface HubDeps {
    cfg: Config
    timings: Timings
    rates: RateLimits
    auth: Authenticator
    lobby: Lobby
    /** Where the in-game name is read and written — see `profile.setName`. */
    profiles: ProfileLookup
}

export class Hub {
    private readonly deps: HubDeps
    private readonly conns: Set<Conn>
    private heartbeat: ReturnType<typeof setInterval> | null

    constructor(deps: HubDeps) {
        this.deps = deps
        this.conns = new Set()
        this.heartbeat = null
        this.startHeartbeat()
    }

    connectionCount(): number {
        return this.conns.size
    }

    handleConnection(socket: WebSocket): void {
        const conn = new Conn(socket, this.deps.rates)
        this.conns.add(conn)
        log.debug("ws.open", { conn: conn.id })

        socket.on("message", (data: RawData, isBinary: boolean) => {
            void this.onMessage(conn, data, isBinary)
        })
        socket.on("pong", () => {
            conn.missedPongs = 0
        })
        socket.on("error", (err: Error) => {
            log.debug("ws.error", { conn: conn.id, err })
        })
        socket.on("close", () => {
            this.onClose(conn)
        })
    }

    private onClose(conn: Conn): void {
        if (!this.conns.delete(conn)) return
        conn.markClosed()
        this.deps.lobby.unsubscribe(conn)
        const room = this.roomOf(conn)
        room?.onDisconnect(conn)
        log.debug("ws.close", { conn: conn.id, uid: conn.user?.uid ?? null })
    }

    private roomOf(conn: Conn): Room | undefined {
        return conn.roomId ? this.deps.lobby.get(conn.roomId) : undefined
    }

    private requireRoom(conn: Conn): Room {
        const room = this.roomOf(conn)
        if (!room) throw new ProtocolError("NOT_IN_ROOM")
        return room
    }

    private async onMessage(conn: Conn, data: RawData, isBinary: boolean): Promise<void> {
        if (conn.isClosed()) return
        if (isBinary) {
            conn.error("BAD_REQUEST", "Očekuje se tekstualni JSON okvir.")
            return
        }
        if (!conn.takeMessage(Date.now())) {
            conn.error("RATE_LIMITED")
            return
        }

        let parsed: unknown
        try {
            parsed = JSON.parse(data.toString()) as unknown
        } catch {
            conn.error("BAD_REQUEST", "Neispravan JSON.")
            return
        }
        if (!isClientMessage(parsed)) {
            conn.error("BAD_REQUEST", "Nepoznata poruka.")
            return
        }
        const msg: ClientMessage = parsed

        if (msg.t === "ping") {
            conn.send({ t: "pong" })
            return
        }
        if (msg.t === "hello") {
            await this.onHello(conn, msg)
            return
        }
        if (!conn.user) {
            conn.error("UNAUTHENTICATED", "Prvo pošaljite hello.", msg.t)
            return
        }
        try {
            // AWAITED, not fire-and-forget: `dispatch` became async for
            // `profile.setName`, which calls the backend, and a ProtocolError
            // thrown after that await would sail straight past this catch and
            // become an unhandled rejection instead of an `error` frame.
            await this.dispatch(conn, msg)
        } catch (e) {
            if (isProtocolError(e)) {
                conn.error(e.code, e.message, msg.t)
                return
            }
            log.error("dispatch.failed", { conn: conn.id, t: msg.t, err: e })
            conn.error("BAD_REQUEST", "Zahtjev se nije mogao obraditi.", msg.t)
        }
    }

    private async onHello(
        conn: Conn,
        msg: Extract<ClientMessage, { t: "hello" }>,
    ): Promise<void> {
        if (conn.user) {
            conn.error("BAD_REQUEST", "Već ste prijavljeni.", "hello")
            return
        }
        let user: UserInfo
        try {
            user = await this.deps.auth.authenticate({ token: msg.token, devName: msg.devName, guest: msg.guest })
        } catch (e) {
            if (isProtocolError(e)) conn.error(e.code, e.message, "hello")
            else conn.error("UNAUTHENTICATED", DEFAULT_MESSAGES.UNAUTHENTICATED, "hello")
            return
        }
        if (conn.isClosed() || !this.conns.has(conn)) return
        conn.user = user
        conn.send({ t: "hello.ok", user, v: PROTOCOL_VERSION })
        log.info("hello", { conn: conn.id, uid: user.uid })

        // Reconnect: a room is still holding this uid's seat.
        //
        // We only walk them straight back in when the hold exists because their
        // SOCKET died — that is a genuine reconnect. After an explicit
        // `room.leave` the hold is still theirs, but re-attaching here would
        // cancel it and pin the seat forever while they sit in the lobby; they
        // get `game.active` instead and come back through the lobby's button
        // (`room.join`). See `HoldReason` in room.ts.
        const room = this.deps.lobby.findRoomForUid(user.uid)
        const hold = room?.holdFor(user.uid) ?? null
        if (room && (room.hasConnFor(user.uid) || hold === null || hold.reason === "disconnect")) {
            try {
                room.attach(conn)
                conn.send(room.joinedMessageFor(conn))
                room.broadcastState()
                room.game?.sendStateTo(conn)
                log.info("room.reconnect", { room: room.id, uid: user.uid })
            } catch (e) {
                log.warn("room.reconnect.failed", { room: room.id, uid: user.uid, err: e })
            }
        }
        this.deps.lobby.sendActiveSeat(conn)
    }

    private async dispatch(conn: Conn, msg: ClientMessage): Promise<void> {
        switch (msg.t) {
            case "hello":
            case "ping":
                return // handled earlier

            case "lobby.subscribe":
                this.deps.lobby.subscribe(conn)
                return

            case "lobby.unsubscribe":
                this.deps.lobby.unsubscribe(conn)
                return

            case "room.create": {
                if ((msg.noDeclarations !== undefined && typeof msg.noDeclarations !== "boolean") ||
                    (msg.allowBela !== undefined && typeof msg.allowBela !== "boolean") ||
                    (msg.allowSpectators !== undefined && typeof msg.allowSpectators !== "boolean")) {
                    throw new ProtocolError("BAD_REQUEST", "Neispravne postavke zvanja.")
                }
                if (msg.name !== undefined && typeof msg.name !== "string") {
                    throw new ProtocolError("BAD_REQUEST", "Naziv sobe mora biti tekst.")
                }
                if (!isTargetScore(msg.targetScore)) {
                    throw new ProtocolError("BAD_REQUEST", "Neispravan cilj (501, 701 ili 1001).")
                }
                if (msg.gameEndRule !== undefined && msg.gameEndRule !== "prolaz" && msg.gameEndRule !== "dosta") {
                    throw new ProtocolError("BAD_REQUEST", "Neispravno pravilo završetka igre.")
                }
                if (msg.trickReview !== undefined && !isTrickReview(msg.trickReview)) {
                    throw new ProtocolError("BAD_REQUEST", "Neispravna postavka gledanja štihova.")
                }
                // One game at a time: refuse BEFORE leaving the current room,
                // or leaving a lobby room would free the seat and let the
                // check pass on the way out.
                this.requireSingleSeat(conn, null)
                this.leaveCurrentRoom(conn)
                const room = this.deps.lobby.create(conn, {
                    name: msg.name,
                    targetScore: msg.targetScore,
                    gameEndRule: msg.gameEndRule,
                    private: msg.private === true,
                    allowSpectators: msg.allowSpectators === true,
                    noDeclarations: msg.noDeclarations === true,
                    allowBela: msg.allowBela !== false,
                    trickReview: msg.trickReview,
                })
                conn.send(room.joinedMessageFor(conn))
                this.afterEnteringRoom(conn, room)
                return
            }

            case "room.join": {
                if (typeof msg.roomId !== "string" || msg.roomId.length === 0) {
                    throw new ProtocolError("BAD_REQUEST", "Nedostaje oznaka sobe.")
                }
                const room = this.deps.lobby.require(msg.roomId)
                room.assertCanJoin(conn, false)
                this.requireSingleSeat(conn, room.id)
                if (conn.roomId !== room.id) this.leaveCurrentRoom(conn)
                room.attach(conn)
                conn.send(room.joinedMessageFor(conn))
                room.broadcastState()
                room.game?.sendStateTo(conn)
                this.afterEnteringRoom(conn, room)
                return
            }

            case "room.joinByCode": {
                if (typeof msg.code !== "string" || msg.code.length === 0) {
                    throw new ProtocolError("BAD_REQUEST", "Nedostaje šifra sobe.")
                }
                const room = this.deps.lobby.findByCode(msg.code)
                room.assertCanJoin(conn, true)
                this.requireSingleSeat(conn, room.id)
                if (conn.roomId !== room.id) this.leaveCurrentRoom(conn)
                room.attach(conn)
                conn.send(room.joinedMessageFor(conn))
                room.broadcastState()
                room.game?.sendStateTo(conn)
                this.afterEnteringRoom(conn, room)
                return
            }

            case "room.leave": {
                const room = this.roomOf(conn)
                if (room) {
                    room.leave(conn)
                } else {
                    // Not in the room any more, but a seat may still be held
                    // for us there — this is the lobby's "napusti igru", which
                    // forfeits the hold instead of waiting it out.
                    const uid = conn.user?.uid
                    const holding = uid ? this.deps.lobby.findRoomForUid(uid) : undefined
                    if (!uid || !holding) throw new ProtocolError("NOT_IN_ROOM")
                    holding.abandonSeat(uid)
                    conn.send({ t: "room.left" })
                }
                this.deps.lobby.sendActiveSeat(conn)
                return
            }

            case "room.sit": {
                if (!isSeat(msg.seat)) throw new ProtocolError("BAD_REQUEST", "Neispravno sjedalo.")
                this.requireRoom(conn).sit(conn, msg.seat)
                return
            }

            case "room.stand":
                this.requireRoom(conn).stand(conn)
                return

            case "room.addBot": {
                if (!isSeat(msg.seat)) throw new ProtocolError("BAD_REQUEST", "Neispravno sjedalo.")
                this.requireRoom(conn).addBot(conn, msg.seat)
                return
            }

            case "room.removeBot": {
                if (!isSeat(msg.seat)) throw new ProtocolError("BAD_REQUEST", "Neispravno sjedalo.")
                this.requireRoom(conn).removeBot(conn, msg.seat)
                return
            }

            case "profile.setName": {
                /* The in-game name, for a signed-in player and a guest alike
                   (protocol `profile.setName`). It lands here rather than on
                   the app's REST API because a guest has no bearer token —
                   their identity exists only as the uid this server derived
                   from their browser's secret, and that same uid is what the
                   once-a-week limit is measured against.

                   The rule itself lives in the backend, which owns the clock
                   and the row; this only carries the answer back. */
                if (typeof msg.name !== "string") throw new ProtocolError("BAD_REQUEST")
                const trimmed = msg.name.trim()
                if (trimmed.length === 0 || trimmed.length > LIMITS.playerNameMax) {
                    throw new ProtocolError("BAD_REQUEST", "Ime za igru mora imati 1 do 16 znakova.")
                }
                if (!conn.user) throw new ProtocolError("UNAUTHENTICATED")

                const result = await this.deps.profiles.setGameName(conn.user.uid, trimmed)
                if (!result.ok) {
                    if (result.error === "RATE_LIMITED") {
                        // Send the standing name back with the instant it may
                        // next change BEFORE the refusal: the error frame has
                        // nowhere to carry a timestamp, and a client that only
                        // hears "no" cannot tell the player when to come back.
                        // The name is unchanged on purpose — it is what the
                        // seat is still wearing.
                        if (result.nextChangeAt !== undefined) {
                            conn.send({ t: "profile.name", name: conn.user.name, nextChangeAt: result.nextChangeAt })
                        }
                        throw new ProtocolError("NAME_RATE_LIMITED")
                    }
                    if (result.error === "BAD_REQUEST") throw new ProtocolError("BAD_REQUEST")
                    throw new ProtocolError("BAD_REQUEST", "Ime trenutačno nije moguće promijeniti.")
                }

                // The name lives on this connection's `UserInfo`, which is what
                // seats are rendered from — so every other connection sees it
                // through the room's own state rather than a message of its own.
                conn.user = { ...conn.user, name: result.name }
                conn.send({ t: "profile.name", name: result.name, nextChangeAt: result.nextChangeAt })
                const room = this.roomOf(conn)
                if (room) {
                    room.renameOccupant(conn.user.uid, result.name)
                    room.broadcastState()
                    this.deps.lobby.changed()
                }
                return
            }

            case "profile.setAvatar": {
                /* The picked face (protocol `profile.setAvatar`). Same socket
                   as `profile.setName` and for the same reason — a guest has
                   no bearer token — but with one important difference:

                   THIS IS CONNECTION-LOCAL, EVEN FOR A SIGNED-IN PLAYER. The
                   backend's internal channel exposes a write for the in-game
                   name (`PUT /internal/profiles/{uid}/game-name`) and nothing
                   for the avatar, and inventing an endpoint here is not this
                   server's call. So the pick reaches the table immediately and
                   survives for as long as the socket does; on the next `hello`
                   a signed-in player falls back to whatever their profile row
                   says (they change that on the profile screen, which does
                   have a REST write). A guest keeps theirs because their
                   browser stores it and sends it with every greeting.
                   FOLLOW-UP: an internal avatar write would close this. */
                if (!isAvatarPreset(msg.preset)) {
                    throw new ProtocolError("BAD_REQUEST", "Nepoznat avatar.")
                }
                if (!conn.user) throw new ProtocolError("UNAUTHENTICATED")
                const preset = msg.preset

                conn.user = { ...conn.user, avatarPreset: preset }
                conn.send({ t: "profile.avatar", preset })
                const avatarRoom = this.roomOf(conn)
                if (avatarRoom) {
                    avatarRoom.restyleOccupant(conn.user.uid, preset)
                    avatarRoom.broadcastState()
                    // No `lobby.changed()`, unlike a rename: the public
                    // `RoomOccupant` carries a name and nothing else
                    // (README §3), so the lobby list has nothing to redraw.
                }
                return
            }

            case "room.setPrivate":
                if (typeof msg.private !== "boolean") throw new ProtocolError("BAD_REQUEST")
                this.requireRoom(conn).setPrivate(conn, msg.private)
                return

            case "room.setOptions": {
                // Same shape checks as `room.create`, with one difference: here
                // EVERY field may be absent and absent means "leave it alone".
                // A present-but-wrong value is still refused rather than
                // coerced — a silently ignored `targetScore` would leave the
                // host's switch showing a setting the room never took.
                if ((msg.noDeclarations !== undefined && typeof msg.noDeclarations !== "boolean") ||
                    (msg.allowBela !== undefined && typeof msg.allowBela !== "boolean") ||
                    (msg.allowSpectators !== undefined && typeof msg.allowSpectators !== "boolean")) {
                    throw new ProtocolError("BAD_REQUEST", "Neispravne postavke zvanja.")
                }
                if (msg.targetScore !== undefined && !isTargetScore(msg.targetScore)) {
                    throw new ProtocolError("BAD_REQUEST", "Neispravan cilj (501, 701 ili 1001).")
                }
                if (msg.gameEndRule !== undefined && msg.gameEndRule !== "prolaz" && msg.gameEndRule !== "dosta") {
                    throw new ProtocolError("BAD_REQUEST", "Neispravno pravilo završetka igre.")
                }
                if (msg.trickReview !== undefined && !isTrickReview(msg.trickReview)) {
                    throw new ProtocolError("BAD_REQUEST", "Neispravna postavka gledanja štihova.")
                }
                this.requireRoom(conn).setOptions(conn, {
                    targetScore: msg.targetScore,
                    gameEndRule: msg.gameEndRule,
                    allowSpectators: msg.allowSpectators,
                    noDeclarations: msg.noDeclarations,
                    allowBela: msg.allowBela,
                    trickReview: msg.trickReview,
                })
                return
            }

            case "room.ready":
                this.requireRoom(conn).setReady(conn, msg.ready === true)
                return

            case "room.start":
                this.requireRoom(conn).start(conn)
                return

            case "game.bid": {
                const game = this.requireGame(conn)
                if (!isSuit(msg.trump)) throw new ProtocolError("BAD_REQUEST", "Neispravan adut.")
                game.bid(conn, msg.trump)
                return
            }

            case "game.pass":
                this.requireGame(conn).pass(conn)
                return

            case "game.play": {
                const game = this.requireGame(conn)
                if (typeof msg.card !== "string" || msg.card.length === 0) {
                    throw new ProtocolError("BAD_REQUEST", "Neispravna karta.")
                }
                // "Zovi belu?" travels as a flag on the move itself (README
                // §1.4). Only its SHAPE is checked here; whether the seat
                // really holds K+Q of trump is the engine's business, and a
                // flag it cannot back is simply ignored there.
                if (msg.bela !== undefined && typeof msg.bela !== "boolean") {
                    throw new ProtocolError("BAD_REQUEST", "Neispravna oznaka bele.")
                }
                game.play(conn, msg.card, msg.bela)
                return
            }

            case "game.nextDeal":
                this.requireGame(conn).nextDeal(conn)
                return

            case "chat.send": {
                const room = this.requireRoom(conn)
                if (!conn.takeChat(Date.now())) {
                    throw new ProtocolError("RATE_LIMITED", "Prebrzo šaljete poruke u chat.")
                }
                handleChat(room, conn, msg.text)
                return
            }

            case "chat.react": {
                const room = this.requireRoom(conn)
                if (!isReaction(msg.reaction)) {
                    throw new ProtocolError("BAD_REQUEST", "Neispravna reakcija.")
                }
                if (!conn.takeReaction(Date.now())) {
                    throw new ProtocolError("RATE_LIMITED", "Prebrzo šaljete reakcije.")
                }
                handleReaction(room, conn, msg.reaction)
                return
            }
        }
    }

    private requireGame(conn: Conn): NonNullable<Room["game"]> {
        const room = this.requireRoom(conn)
        const game = room.game
        if (!game) throw new ProtocolError("BAD_REQUEST", "Igra još nije započela.")
        return game
    }

    private leaveCurrentRoom(conn: Conn): void {
        const room = this.roomOf(conn)
        if (room) room.leave(conn)
    }

    /**
     * ONE GAME AT A TIME (README §3.2). A seat somewhere else is a refusal,
     * not something to quietly throw away — the client disables these actions
     * from `game.active`, and this is the authority behind that.
     *
     * `enteringRoomId` is the room being entered (null when creating one):
     * your own seat in it never blocks you, so walking back into your own
     * table keeps working exactly as before.
     */
    private requireSingleSeat(conn: Conn, enteringRoomId: string | null): void {
        const uid = conn.user?.uid
        if (!uid) return
        this.deps.lobby.requireNoSeatElsewhere(uid, enteringRoomId)
    }

    private afterEnteringRoom(conn: Conn, _room: Room): void {
        this.deps.lobby.sendActiveSeat(conn)
    }

    /* ───────────────────────── heartbeat ───────────────────────── */

    private startHeartbeat(): void {
        const timer = setInterval(() => {
            for (const conn of this.conns) {
                if (conn.missedPongs >= this.deps.timings.heartbeatMisses) {
                    log.info("ws.heartbeat.timeout", { conn: conn.id })
                    conn.terminate()
                    continue
                }
                conn.missedPongs += 1
                conn.ping()
            }
        }, this.deps.timings.heartbeatMs)
        if (typeof timer.unref === "function") timer.unref()
        this.heartbeat = timer
    }

    close(): void {
        if (this.heartbeat) clearInterval(this.heartbeat)
        this.heartbeat = null
        for (const conn of this.conns) conn.close()
        this.conns.clear()
    }
}

const SUIT_SET: ReadonlySet<string> = new Set(["HERC", "KARA", "PIK", "TREF"])

function isSuit(x: unknown): x is "HERC" | "KARA" | "PIK" | "TREF" {
    return typeof x === "string" && SUIT_SET.has(x)
}
