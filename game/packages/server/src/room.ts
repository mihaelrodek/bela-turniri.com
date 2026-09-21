/* ──────────────────────────────────────────────────────────────────────────
   RoomState management (README §3 "Soba", §4).

   A room owns 4 seats, its members' connections, the host, and — once
   started — a `GameRoom` holding the authoritative `GameState`.

   Lifecycle: LOBBY → PLAYING → LOBBY. A lobby explicitly abandoned by its
   last human is deleted immediately. Rooms emptied by a dropped socket keep
   their reconnect window and use `emptyRoomTtlMs`; finished ones use
   `finishedRoomTtlMs`.

   Seats survive absence. Leaving the table or losing the socket during a game
   starts a `reconnectGraceMs` SEAT HOLD (2 min): the seat still belongs to
   that uid, the room reports them as `connected: false` with a `holdUntil`,
   and only when the hold expires does a bot take over for good. Meanwhile the
   game runs their turns on the ordinary timer — see `gameRoom.ts`.
   ────────────────────────────────────────────────────────────────────── */

import type {
    ActiveSeatInfo,
    AvatarPreset,
    GameEndRule,
    Reaction,
    RoomOccupant,
    RoomState,
    RoomStatus,
    RoomSummary,
    Seat,
    SeatInfo,
    ServerMessage,
    TargetScore,
    TrickReview,
    UserInfo,
    WinRateRequirement,
} from "@bela/protocol"
import { DEFAULT_GAME_END_RULE, DEFAULT_TRICK_REVIEW, isQuickGame, LIMITS, REACTIONS } from "@bela/protocol"
// TYPE-ONLY on purpose: with `GAME_DEMO_LOBBY` unset nothing under `demo/` is
// loaded at all, and a type import is erased by the compiler (DEMO-LOBBY.md).
import type { DemoIdentity, DemoRoomEvents, DemoRoomHandle, DemoRoomOptions, RealRoomHandle } from "./demo/types.js"
import type { Timings } from "./config.js"
import { ProtocolError } from "./errors.js"
import { botAvatar, botName } from "./bots.js"
import { GameRoom } from "./gameRoom.js"
import { reportGameAbandonment } from "./statsReporter.js"
import type { LiveActivityHub } from "./liveActivity.js"
import { log } from "./log.js"
import type { Connection } from "./ws.js"

/**
 * Internal seat slot — same as the protocol `SeatInfo["occupant"]` plus the uid,
 * plus one state the wire does not have.
 *
 * `DEMO` is a fake person from the pre-launch demo lobby (DEMO-LOBBY.md). It
 * SERIALISES as a seated, connected, ready `PLAYER` and is indistinguishable
 * from one in every message that leaves this process, but internally it is
 * neither a player nor a bot:
 *
 *   • plays like a BOT     — `isBotControlled`, no ack vote, no turn deadline
 *   • counts like a PERSON — wherever a room would be dissolved or deleted for
 *     having too few humans (`otherHumanCount`, `removeBotOnlyLobby`, `isEmpty`)
 *   • counts as NEITHER    — stats, karma, abandonment, Live Activity, analytics
 *
 * A `DEMO` slot reaches an ORDINARY room one way only: `guestSit`, which is
 * reachable solely through the `RealRoomHandle` that `Lobby.realWaitingRooms()`
 * hands out — and that list is empty until `Lobby.watchRealRooms` has been
 * called, which only the demo director does. With the flag off no ordinary room
 * has a code path that produces a `DEMO` slot, so every branch below that tests
 * for one is unreachable there.
 *
 * A GUEST (a `DEMO` slot in an ordinary room) differs from a fake person in a
 * demo room in exactly one respect: it does NOT keep the room alive. The room
 * belongs to the real people in it, and when the last of them goes the guests
 * go with them (`isEmpty`, `removeBotOnlyLobby`, `otherHumanCount`).
 */
export type SeatSlot =
    | { kind: "PLAYER"; uid: string; user: UserInfo; ready: boolean; connected: boolean }
    | { kind: "BOT"; name: string; avatarPreset?: AvatarPreset }
    | { kind: "DEMO"; identity: DemoIdentity }
    | null

/** What a demo room carries beyond an ordinary one: the director's callbacks. */
export interface DemoRoomContext {
    readonly events: DemoRoomEvents
}

/**
 * The `UserInfo` a fake person wears on the wire.
 *
 * Built fresh on every serialisation rather than copied into the seat, so the
 * record the director books after a finished game (`identity.gameStats`,
 * `identity.karma` are mutable by contract) shows up on the next frame instead
 * of at the next time they sit down. `identity.reliability` is NOT mutable —
 * a fake person's karma is never earned back by playing, so it is drawn once
 * alongside `karma` (`demo/identities.ts` `makeReliability`) and just rides
 * along here, same as the mutable fields. `guest` is ABSENT — a signed-in
 * Google user's `UserInfo` has no such field (`auth.ts` sets it only for
 * guests), and a "gost" badge on half the lobby would give the whole thing
 * away.
 */
export function demoUserInfo(identity: DemoIdentity): UserInfo {
    return {
        uid: identity.uid,
        name: identity.name,
        avatarUrl: null,
        avatarPreset: identity.avatarPreset,
        gameStats: identity.gameStats,
        karma: identity.karma,
        reliability: identity.reliability,
    }
}

/** What a room needs from the registry that owns it. */
export interface RoomHost {
    /** Something visible in the lobby changed. */
    changed(): void
    /** Drop this room from the registry. */
    remove(roomId: string): void
}

/**
 * Why a seat is being held for someone who is not here right now.
 *
 *   • `disconnect` — the socket died (tab closed, tunnel, laptop lid). A fresh
 *     `hello` from the same uid walks straight back into the room: that IS a
 *     reconnect and nobody chose to leave.
 *   • `left` — an explicit `room.leave`. The seat is still theirs for the whole
 *     hold window, but a later `hello` must NOT silently re-seat them: they may
 *     be sitting in the lobby deciding, and re-attaching there would cancel the
 *     hold and make the forfeit unreachable. They come back through
 *     `room.join` / `room.joinByCode` — the button the lobby shows them.
 */
export type HoldReason = "disconnect" | "left"

export interface SeatHold {
    seat: Seat
    reason: HoldReason
    /** Epoch ms at which the seat is forfeited. */
    until: number
}

export const SEATS: readonly Seat[] = [0, 1, 2, 3]

/**
 * The order an arriving player fills an empty table in — README §3.3.
 *
 * NOT seat order, and that is the whole point. Seats alternate teams (0+2 are
 * one pair, 1+3 the other, README §1.1), so filling 0→1→2→3 puts the second
 * arrival OPPOSITE the host, the third beside him, and leaves both pairs
 * half-built until the fourth person shows up: from outside the table looks
 * like it seats people at random, and the host watching his own room fill sees
 * "oni" grow before "mi" is even whole.
 *
 * 0→2→1→3 completes the first pair, then the second. Two people at a table
 * are always partners, three are always a full pair plus one — which is what
 * anyone who has ever waited for a fourth expects to see.
 *
 * ONE array, because both halves of the promise read it: `nextSeatForNewcomer`
 * hands out the seat and `canAdmitNewcomer` (hence `RoomSummary.joinable`)
 * decides whether there is one. Reorder it here and both move together.
 */
export const SEAT_FILL_ORDER: readonly Seat[] = [0, 2, 1, 3]

/** Spectators + seated members; a hard cap so one room cannot soak the process. */
const MAX_MEMBERS = 24

/**
 * The one rule tying the two declaration switches together, written down once
 * so `room.create` and `room.setOptions` cannot drift apart.
 *
 * "Bez zvanja" is what `allowBela` qualifies: with declarations ON the bela is
 * a declaration like any other and ALWAYS counts, so `allowBela: false` sent
 * against a room that scores declarations means nothing and is not stored.
 * Only a room that turned declarations off gets to say "…but keep the bela"
 * (the default) or "not even the bela".
 */
function belaCounts(noDeclarations: boolean, allowBela: boolean | undefined): boolean {
    return !noDeclarations || allowBela !== false
}

/**
 * The end-of-game rule this room actually plays by (2026-09-20).
 *
 * "Brza 163" is decided at the end of a deal and nowhere else, so `dosta` is
 * not merely ignored there — it is NORMALISED AWAY at the door, on create and
 * on every `setOptions`. The engine would ignore it anyway (`newGame`), but a
 * room that kept it would advertise "dosta" on its lobby row and in the
 * settings sheet while playing "prolaz", and the host would have no way to
 * tell which of the two was true.
 */
function endRuleFor(targetScore: TargetScore, rule: GameEndRule | undefined): GameEndRule {
    if (isQuickGame(targetScore)) return DEFAULT_GAME_END_RULE
    return rule ?? DEFAULT_GAME_END_RULE
}

/** Fields of `room.setOptions` — every one optional, absent = leave alone. */
export interface RoomOptionsPatch {
    targetScore?: TargetScore
    gameEndRule?: GameEndRule
    allowSpectators?: boolean
    noDeclarations?: boolean
    allowBela?: boolean
    trickReview?: TrickReview
}

export interface RoomInit {
    gameEndRule?: GameEndRule
    allowSpectators?: boolean
    noDeclarations?: boolean
    allowBela?: boolean
    trickReview?: TrickReview
    id: string
    name: string
    /** 4-digit join code, allocated by the `Lobby` (it alone knows what's taken). */
    code: string
    host: UserInfo
    targetScore: TargetScore
    private: boolean
    minWinRatePercent?: WinRateRequirement
    lobby: RoomHost
    timings: Timings
    /** Lock-screen fan-out (README §3 "Live Activity"); absent = off. */
    liveActivity?: LiveActivityHub | null
    /** Present ONLY for a room built by `Lobby.createDemoRoom` (DEMO-LOBBY.md). */
    demo?: DemoRoomContext | null
}

export class Room {
    readonly id: string
    readonly code: string
    readonly createdAt: number
    private: boolean
    // Not readonly: the host may still retune these in the LOBBY via
    // `setOptions` (README §3). They are the DEAL's rules, so `requireLobby`
    // there keeps them frozen for as long as a game is running — `GameRoom`
    // copies them into the engine config once, at `room.start`.
    allowSpectators: boolean
    noDeclarations: boolean
    allowBela: boolean
    gameEndRule: GameEndRule
    /** "Gledanje štihova" — same for the whole room, editable until the deal starts. */
    trickReview: TrickReview
    readonly timings: Timings
    name: string
    hostUid: string
    status: RoomStatus
    targetScore: TargetScore
    readonly minWinRatePercent: WinRateRequirement
    readonly seats: [SeatSlot, SeatSlot, SeatSlot, SeatSlot]
    readonly conns: Set<Connection>
    game: GameRoom | null
    readonly liveActivity: LiveActivityHub | null
    /** Non-null = a demo room (DEMO-LOBBY.md). Null for every ordinary room,
     *  and the single gate on everything `DEMO` in this file. */
    readonly demo: DemoRoomContext | null

    private readonly lobby: RoomHost
    private deleteTimer: ReturnType<typeof setTimeout> | null
    /** uid → the seat hold running while a seated player is away. */
    private readonly holds: Map<string, SeatHold & { timer: ReturnType<typeof setTimeout> }>
    private disposed: boolean
    /** Last reaction per DEMO seat — a fake person obeys the same cooldown a
     *  real one does (`Conn.takeReaction`), which is per sender, not per room. */
    private readonly demoReactionAt: Map<Seat, number>
    /** A demo room's game has ended and nobody has started another. */
    private demoFinished: boolean

    constructor(init: RoomInit) {
        this.id = init.id
        this.code = init.code
        this.name = init.name
        this.hostUid = init.host.uid
        this.status = "LOBBY"
        this.targetScore = init.targetScore
        this.private = init.private
        this.minWinRatePercent = init.minWinRatePercent ?? 0
        this.allowSpectators = init.allowSpectators === true
        this.noDeclarations = init.noDeclarations === true
        this.allowBela = belaCounts(this.noDeclarations, init.allowBela)
        this.gameEndRule = endRuleFor(this.targetScore, init.gameEndRule)
        this.trickReview = init.trickReview ?? DEFAULT_TRICK_REVIEW
        this.createdAt = Date.now()
        this.seats = [null, null, null, null]
        this.conns = new Set<Connection>()
        this.game = null
        this.lobby = init.lobby
        this.timings = init.timings
        this.liveActivity = init.liveActivity ?? null
        this.deleteTimer = null
        this.holds = new Map()
        this.disposed = false
        this.demo = init.demo ?? null
        this.demoReactionAt = new Map()
        this.demoFinished = false
    }

    /**
     * The status the DIRECTOR sees. Same as `this.status`, with one addition
     * the wire deliberately does not have: a demo room whose game has ended
     * reports "FINISHED" until somebody starts another.
     *
     * The room itself goes straight back to "LOBBY" on game over (`onGameOver`)
     * and must keep doing so — that is what tells every client the table is
     * open again. But "the game ended and nobody has cleared the table yet" is
     * exactly the state the director winds down (walk people out one by one,
     * then `close`), and without this it would have nothing to poll: `onGameOver`
     * is an event, and an event missed is a room that stands there forever.
     */
    demoStatus(): RoomStatus {
        if (this.status === "LOBBY" && this.demoFinished) return "FINISHED"
        return this.status
    }

    isDisposed(): boolean {
        return this.disposed
    }

    /* ───────────────────────── queries ───────────────────────── */

    isHost(uid: string): boolean {
        return this.hostUid === uid
    }

    slotAt(seat: Seat): SeatSlot {
        return this.seats[seat]
    }

    analyticsOptions(): Record<string, unknown> {
        return {
            targetScore: this.targetScore,
            gameEndRule: this.gameEndRule,
            private: this.private,
            minWinRatePercent: this.minWinRatePercent,
            allowSpectators: this.allowSpectators,
            noDeclarations: this.noDeclarations,
            allowBela: this.allowBela,
            trickReview: this.trickReview,
        }
    }

    seatOfUid(uid: string): Seat | null {
        for (const s of SEATS) {
            const slot = this.seats[s]
            if (slot && slot.kind === "PLAYER" && slot.uid === uid) return s
        }
        return null
    }

    /** Does any live connection belong to this uid? */
    hasConnFor(uid: string): boolean {
        for (const c of this.conns) if (c.user?.uid === uid) return true
        return false
    }

    /** The running seat hold for this uid, if any (timer stripped). */
    holdFor(uid: string): SeatHold | null {
        const hold = this.holds.get(uid)
        if (!hold) return null
        return { seat: hold.seat, reason: hold.reason, until: hold.until }
    }

    /** `game.active` payload for this uid — null when they hold no seat here. */
    activeSeatFor(uid: string): ActiveSeatInfo | null {
        const seat = this.seatOfUid(uid)
        if (seat === null) return null
        const hold = this.holds.get(uid)
        return {
            roomId: this.id,
            roomName: this.name,
            code: this.private ? this.code : "",
            status: this.status,
            targetScore: this.targetScore,
            seat,
            present: this.hasConnFor(uid),
            holdUntil: hold ? hold.until : null,
        }
    }

    seatsTaken(): number {
        return SEATS.filter((s) => this.seats[s] !== null).length
    }

    /**
     * The seat the next arrival gets, or null when the table is full.
     *
     * Not the lowest free seat — the first free seat in `SEAT_FILL_ORDER`, so
     * one pair fills before the other. Everything about WHY lives on that
     * constant; this is just where the array is read.
     */
    nextSeatForNewcomer(): Seat | null {
        for (const s of SEAT_FILL_ORDER) if (this.seats[s] === null) return s
        return null
    }

    /**
     * Could somebody who is not already here enter this room at all?
     *
     * ONE PREDICATE, two call sites: `assertCanJoin` enforces it and
     * `toSummary().joinable` publishes it, so the lobby row and the server can
     * never disagree about whether a room is full. It deliberately ignores the
     * private-room code — that is a separate question with its own error.
     */
    /**
     * A PRIVATE room whose game is already running and which the host opened to
     * spectators may be WATCHED without the code (owner, 2026-09-21): a running
     * table has no free seat, so the newcomer can only ever be an audience, and
     * the lobby ("Privatna" + "Gledatelji omogućeni") has already told everyone
     * what they may do. The code still guards SITTING — it is required in the
     * waiting room, and it is never sent to a spectator (`stateFor`), so
     * watching is not a way to learn it.
     *
     * Demo rooms are scenery and stay closed however they are configured.
     */
    private openToWatchers(): boolean {
        return this.status === "PLAYING" && this.allowSpectators && !this.demo
    }

    canAdmitNewcomer(): boolean {
        if (this.conns.size >= MAX_MEMBERS) return false
        // Seats cannot be taken mid-game, so a running table only admits
        // people the host explicitly opened it to.
        if (this.status === "PLAYING") return this.allowSpectators
        return this.nextSeatForNewcomer() !== null || this.allowSpectators
    }

    /**
     * Seats a PERSON sits on, as the lobby counts people (`RoomSummary.humans`).
     *
     * A fake person is one of them: the whole point of the demo lobby is that
     * a row saying "4 igrača" and four faces above it agree. Callers that need
     * "a real account is sitting here" ask `realHumanSeats()` instead.
     */
    humanSeats(): Seat[] {
        return SEATS.filter((s) => {
            const kind = this.seats[s]?.kind
            return kind === "PLAYER" || kind === "DEMO"
        })
    }

    /** Seats held by a REAL signed-in/guest account. Never a fake person. */
    realHumanSeats(): Seat[] {
        return SEATS.filter((s) => this.seats[s]?.kind === "PLAYER")
    }

    hasConnectedHuman(): boolean {
        return SEATS.some((s) => {
            const slot = this.seats[s]
            return slot?.kind === "PLAYER" && slot.connected
        })
    }

    /** Fake people currently seated here; 0 in every ordinary room. */
    private demoSeatCount(): number {
        return SEATS.filter((s) => this.seats[s]?.kind === "DEMO").length
    }

    /**
     * Other seats occupied by someone the table would miss — including a
     * temporarily disconnected player whose reconnect hold is still active,
     * and (demo rooms only) a fake person. This feeds SUSTAINABILITY decisions
     * ("is there still a game here?"), never consequence ones: karma and
     * abandonment read `otherRealHumanCount`, which fake people never inflate.
     */
    private otherHumanCount(uid: string): number {
        let count = 0
        for (const seat of SEATS) {
            const slot = this.seats[seat]
            // A fake person sustains a DEMO room (there is nobody else to) but
            // never an ORDINARY one: a table whose only real player's hold ran
            // out must dissolve exactly as it does against three bots, and
            // guests are not a reason to keep a real game standing. With two
            // real people seated this count is 2 from the PLAYER branch alone,
            // so the two-human case is unaffected either way.
            if (slot?.kind === "DEMO") {
                if (this.demo) count++
            } else if (slot?.kind === "PLAYER" && slot.uid !== uid) count++
        }
        return count
    }

    /** Real accounts other than `uid` at this table — the karma-relevant count. */
    private otherRealHumanCount(uid: string): number {
        let count = 0
        for (const seat of SEATS) {
            const slot = this.seats[seat]
            if (slot?.kind === "PLAYER" && slot.uid !== uid) count++
        }
        return count
    }

    /**
     * Nobody is here any more, so the room may be deleted on a TTL.
     *
     * A seated fake person counts as somebody IN A DEMO ROOM: that room
     * routinely has zero connections (nobody real is watching it) and must
     * still survive, exactly as a room full of real people whose sockets all
     * blinked would. A GUEST in an ordinary room does not: it came because a
     * real person was sitting there, and leaves with them.
     */
    isEmpty(): boolean {
        if (this.conns.size > 0) return false
        return this.demo === null || this.demoSeatCount() === 0
    }

    /* ───────────────────────── serialisation ───────────────────────── */

    private seatInfo(seat: Seat): SeatInfo {
        const slot = this.seats[seat]
        if (!slot) return { seat, occupant: null }
        if (slot.kind === "BOT") {
            return { seat, occupant: { kind: "BOT", name: slot.name, ...(slot.avatarPreset ? { avatarPreset: slot.avatarPreset } : {}) } }
        }
        // A fake person is a seated, connected, ready player and nothing else:
        // no hold, no `guest`, no marker of any kind (DEMO-LOBBY.md §3).
        if (slot.kind === "DEMO") {
            return {
                seat,
                occupant: {
                    kind: "PLAYER",
                    user: demoUserInfo(slot.identity),
                    ready: true,
                    connected: true,
                    holdUntil: null,
                },
            }
        }
        return {
            seat,
            occupant: {
                kind: "PLAYER",
                user: slot.user,
                ready: slot.ready,
                connected: slot.connected,
                holdUntil: this.holds.get(slot.uid)?.until ?? null,
            },
        }
    }

    /** One seat for the PUBLIC lobby list: presentation data, never identity. */
    private occupantOf(seat: Seat): RoomOccupant {
        const slot = this.seats[seat]
        if (!slot) return null
        if (slot.kind === "BOT") return { kind: "BOT", name: slot.name, ...(slot.avatarPreset ? { avatarPreset: slot.avatarPreset } : {}) }
        if (slot.kind === "DEMO") {
            return { kind: "PLAYER", name: slot.identity.name, connected: true, avatarPreset: slot.identity.avatarPreset }
        }
        return {
            kind: "PLAYER",
            name: slot.user.name,
            connected: slot.connected,
            avatarPreset: slot.user.avatarPreset ?? null,
        }
    }

    /**
     * The lobby row. Sent to EVERY `lobby.rooms` subscriber, in the room or
     * not, so it must stay free of anything private: the join code is redacted
     * unless the receiver is a member (`includePrivateCode`), uids never
     * travel at all (`hostUid` lives on `RoomState`), and `occupants` carries
     * only public names and app-provided avatar preset ids.
     */
    toSummary(includePrivateCode = false): RoomSummary {
        return {
            id: this.id,
            name: this.name,
            code: this.private && includePrivateCode ? this.code : "",
            status: this.status,
            targetScore: this.targetScore,
            gameEndRule: this.gameEndRule,
            noDeclarations: this.noDeclarations,
            private: this.private,
            allowSpectators: this.allowSpectators,
            minWinRatePercent: this.minWinRatePercent,
            seatsTaken: this.seatsTaken(),
            humans: this.humanSeats().length,
            occupants: [
                this.occupantOf(0),
                this.occupantOf(1),
                this.occupantOf(2),
                this.occupantOf(3),
            ],
            joinable: this.canAdmitNewcomer(),
            createdAt: this.createdAt,
        }
    }

    toState(includeCode = true): RoomState {
        const spectators: UserInfo[] = []
        const seen = new Set<string>()
        for (const c of this.conns) {
            const u = c.user
            if (!u) continue
            if (seen.has(u.uid)) continue
            if (this.seatOfUid(u.uid) !== null) continue
            seen.add(u.uid)
            spectators.push(u)
        }
        return {
            ...this.toSummary(includeCode),
            hostUid: this.hostUid,
            allowBela: this.allowBela,
            trickReview: this.trickReview,
            seats: [this.seatInfo(0), this.seatInfo(1), this.seatInfo(2), this.seatInfo(3)],
            spectators,
            turnTimeoutMs: this.timings.turnTimeoutMs,
        }
    }

    /* ───────────────────────── messaging ───────────────────────── */

    broadcast(msg: ServerMessage): void {
        for (const c of this.conns) c.send(msg)
    }

    /** `room.joined` addressed to one member (their own seat included). */
    joinedMessageFor(conn: Connection): ServerMessage {
        const uid = conn.user?.uid ?? null
        return {
            t: "room.joined",
            room: this.toState(uid !== null && this.seatOfUid(uid) !== null),
            yourSeat: uid ? this.seatOfUid(uid) : null,
        }
    }

    broadcastState(): void {
        // Two snapshots at most: one with the private code for people who hold
        // a seat, one without it for spectators — a spectator of a private room
        // (allowed once the game runs) must not leave with the way in.
        const withCode = this.toState(true)
        const withoutCode = this.private ? this.toState(false) : withCode
        for (const c of this.conns) {
            const uid = c.user?.uid ?? null
            const seat = uid ? this.seatOfUid(uid) : null
            c.send({ t: "room.state", room: seat !== null ? withCode : withoutCode, yourSeat: seat })
        }
    }

    /* ───────────────────────── membership ───────────────────────── */

    /**
     * Enforce admission before attaching a new connection (README §3.2).
     *
     * Anyone already here — a seat holder walking back in, or a second tab of
     * the same uid — is always let through. A newcomer must satisfy the room's
     * personal win-rate gate and its capacity predicate. Passing both means
     * `attach` either seats them (a free seat in the lobby) or lets them watch
     * (spectators on); failure is explicit, never a silent downgrade.
     */
    assertCanJoin(conn: Connection, codeProvided: boolean): void {
        const uid = conn.user?.uid
        const returningPlayer = uid !== undefined && this.seatOfUid(uid) !== null
        const alreadyHere = uid !== undefined && this.hasConnFor(uid)
        if (this.private && !codeProvided && !returningPlayer && !alreadyHere && !this.openToWatchers()) {
            throw new ProtocolError("ROOM_CODE_REQUIRED", "Za ulaz u privatnu sobu potrebna je šifra.")
        }
        if (returningPlayer || alreadyHere) return
        const winRate = conn.user?.gameStats?.global.winRate ?? 0
        if (winRate * 100 < this.minWinRatePercent) {
            throw new ProtocolError(
                "WIN_RATE_TOO_LOW",
                `Za ulaz je potrebno najmanje ${this.minWinRatePercent}% pobjeda.`,
            )
        }
        if (this.canAdmitNewcomer()) return
        // Two distinct refusals, because the fix differs: a running table that
        // never wanted an audience vs. a table with nowhere left to sit.
        if (this.status === "PLAYING" && !this.allowSpectators) {
            throw new ProtocolError("SPECTATORS_DISABLED", "Gledatelji nisu omogućeni za ovu igru.")
        }
        throw new ProtocolError("ROOM_FULL", "Soba je puna — nema slobodnog sjedala.")
    }

    /**
     * Attach a connection. Returns true when this was a reconnect into a seat
     * the room was still holding for that uid.
     *
     * AUTO-SEAT: a newcomer entering a room in `LOBBY` that still has a free
     * seat is SEATED, not parked as a spectator. Sitting used to be a separate
     * `room.sit` the redesigned room screen no longer offers, so a second
     * player landed seatless at a half-empty table and was told it was full.
     * Seating here — in the one place every entry route goes through
     * (`hello`, `room.join`, `room.joinByCode`, `Lobby.create`) — is what makes
     * `assertCanJoin`'s promise true: pass the check, get the seat.
     *
     * WHICH seat is `SEAT_FILL_ORDER` (0→2→1→3): one pair fills before the
     * other, so the second person to arrive is the host's partner.
     */
    attach(conn: Connection): boolean {
        const user = conn.user
        if (!user) throw new ProtocolError("UNAUTHENTICATED")
        if (this.conns.size >= MAX_MEMBERS && !this.hasConnFor(user.uid)) {
            throw new ProtocolError("ROOM_FULL", "Soba je puna.")
        }
        this.cancelDeleteTimer()
        this.conns.add(conn)
        conn.roomId = this.id

        // Whichever route brought them back (`hello`, `room.join`,
        // `room.joinByCode`), being here again cancels the hold.
        this.cancelHold(user.uid)
        this.liveActivity?.rejoin(this.id, user.uid)
        const seat = this.seatOfUid(user.uid)
        let reconnected = false
        if (seat !== null) {
            const slot = this.seats[seat]
            if (slot && slot.kind === "PLAYER") {
                reconnected = !slot.connected
                slot.connected = true
                slot.user = user
            }
        } else if (this.status === "LOBBY") {
            const free = this.nextSeatForNewcomer()
            if (free !== null) {
                this.seats[free] = { kind: "PLAYER", uid: user.uid, user, ready: false, connected: true }
                log.info("seat.autoSeated", { room: this.id, seat: free, uid: user.uid })
            }
        }
        this.lobby.changed()
        this.game?.onPresenceChanged()
        // LAST, once the seat array, the holds and the lobby all agree: the
        // director may call straight back into this room from the callback.
        const nowSeated = this.seatOfUid(user.uid)
        if (nowSeated !== null) this.fireDemo((e) => e.onHumanSeated?.(nowSeated))
        return reconnected
    }

    /** Socket died: active play gets a hold; a lobby seat is released. */
    onDisconnect(conn: Connection): void {
        if (!this.conns.delete(conn)) return
        const user = conn.user
        const seatBefore = user ? this.seatOfUid(user.uid) : null
        conn.roomId = null
        if (user && !this.hasConnFor(user.uid)) this.holdOrRelease(user.uid, "disconnect")
        // A dropped socket does not cost you the host badge — the hold expiring
        // (or an explicit leave from the lobby seat) does.
        this.afterMembershipChange(null, this.freedSeat(seatBefore))
    }

    /** `seat` if it was a real person's and is now free — nothing otherwise. */
    private freedSeat(seat: Seat | null): Seat | null {
        if (seat === null) return null
        return this.seats[seat] === null ? seat : null
    }

    /**
     * Explicit `room.leave`. During PLAYING this does NOT hand the seat to a
     * bot any more: walking back to the lobby is not a forfeit, it starts the
     * same `reconnectGraceMs` hold a dropped socket gets (README §3 "Timeri").
     * In LOBBY there is nothing to hold — the seat is freed immediately so the
     * table doesn't look full to everyone else.
     */
    leave(conn: Connection): void {
        const user = conn.user
        const leavingSeat = user ? this.seatOfUid(user.uid) : null
        this.conns.delete(conn)
        conn.roomId = null
        if (user && leavingSeat !== null && !this.hasConnFor(user.uid)) {
            // Walking out ends the lock-screen activity even though the seat
            // is still held: the player chose to leave, and a reconnect-style
            // stream of updates would contradict that. `room.join` resumes it.
            this.endLiveActivity(user.uid)
            // Every active table gets the same reconnect window, including a
            // single player with three bots. A refresh and an app setting
            // change must never destroy the room merely because nobody else
            // happens to be connected. If the player does not return, the
            // hold-expiry path below dissolves an unsustainable room.
            this.holdOrRelease(user.uid, "left")
        }
        conn.send({ t: "room.left" })
        this.afterMembershipChange(user?.uid ?? null, this.freedSeat(leavingSeat))
    }

    /** Close a running room that can no longer sustain a human-vs-human game. */
    private dissolveAfterPlayersLeft(): void {
        this.game?.abandon("INSUFFICIENT_HUMANS")
        const remaining = [...this.conns]
        this.conns.clear()
        for (const member of remaining) {
            member.roomId = null
            member.send({ t: "room.left" })
            member.send({ t: "game.active", seat: null })
        }
        log.info("room.dissolved", { room: this.id, reason: "fewer-than-two-humans" })
        this.lobby.remove(this.id)
    }

    /**
     * Give up the seat here and now, no hold. This is the lobby's "Napusti
     * igru": the only way to hand a held seat back before its hold runs out,
     * and — since one game at a time is now enforced by refusal rather than by
     * forfeit (README §3.2) — the only way to become free to open another room.
     */
    abandonSeat(uid: string): void {
        this.cancelHold(uid)
        const seat = this.seatOfUid(uid)
        if (seat === null) return
        this.reportConfirmedAbandonment(uid)
        this.endLiveActivity(uid)
        this.releaseSeat(uid)
        if (this.isHost(uid)) this.transferHost(uid)
        log.info("seat.abandoned", { room: this.id, uid })
        if (this.removeBotOnlyLobby()) return
        this.broadcastState()
        this.lobby.changed()
        this.game?.onPresenceChanged()
        this.fireDemo((e) => e.onHumanGone?.(seat))
    }

    /**
     * A demo waiting room that its last real visitor has left goes back to
     * being scenery — and scenery has no "Bot Ana" in it. Bots a visitor added
     * leave with him; mid-game nothing is touched (the deal needs its players).
     */
    private sweepDemoBots(): void {
        if (!this.demo || this.status !== "LOBBY") return
        if (this.conns.size > 0 || this.realHumanSeats().length > 0) return
        for (const seat of SEATS) {
            if (this.seats[seat]?.kind === "BOT") this.seats[seat] = null
        }
    }

    private afterMembershipChange(leavingUid: string | null, freedSeat: Seat | null = null): void {
        this.sweepDemoBots()
        if (leavingUid !== null && this.isHost(leavingUid)) this.transferHost(leavingUid)
        if (this.removeBotOnlyLobby()) return
        this.broadcastState()
        this.lobby.changed()
        this.game?.onPresenceChanged()
        this.scheduleDeleteIfEmpty()
        if (freedSeat !== null) this.fireDemo((e) => e.onHumanGone?.(freedSeat))
    }

    /**
     * A lobby belongs to its human members, never to its bots. Once its last
     * human member has gone, remove it right away; a player who stood up is
     * still a human spectator and must keep the lobby alive.
     *
     * A fake person is a member in this sense in a DEMO room: that waiting room
     * normally has nobody connected at all and must not evaporate the moment
     * the one real visitor walks out again. A GUEST in an ordinary room is not:
     * the room goes, and the guests go with it (the director is told through
     * `onRoomClosed` and releases them).
     */
    private removeBotOnlyLobby(): boolean {
        if (this.status !== "LOBBY" || this.conns.size > 0) return false
        if (this.demo && this.demoSeatCount() > 0) return false
        log.info("room.deleted", { room: this.id, status: this.status, reason: "no-human-members" })
        this.lobby.remove(this.id)
        return true
    }

    /** PLAYING → mark the seat away and start the hold; LOBBY → just free it. */
    private holdOrRelease(uid: string, reason: HoldReason): void {
        const seat = this.seatOfUid(uid)
        if (seat === null) return
        if (this.status !== "PLAYING") {
            this.cancelHold(uid)
            this.seats[seat] = null
            return
        }
        const slot = this.seats[seat]
        if (slot && slot.kind === "PLAYER") slot.connected = false
        this.startHold(uid, seat, reason)
    }

    /** Free (LOBBY) or bot-ify (PLAYING) the seat held by `uid`. */
    private releaseSeat(uid: string): void {
        const seat = this.seatOfUid(uid)
        if (seat === null) return
        this.seats[seat] = this.vacatedSlot(seat)
    }

    /**
     * What goes into a seat whose person is gone for good.
     *
     * Normally: a visible bot mid-game, an empty chair in the lobby. In a DEMO
     * room the chair is left EMPTY even mid-game — "Bot Ana" appearing where a
     * real player just sat is the single most obvious tell in DEMO-LOBBY.md §3,
     * and an empty seat is already bot-driven (`isBotControlled` returns true
     * for a null slot), so the table keeps playing while the director is told
     * (`onHumanGone`) and puts a new fake person there with `replace`. There is
     * therefore no frame in which the wire says `kind: "BOT"` for that seat:
     * it goes straight from PLAYER to null to PLAYER.
     */
    private vacatedSlot(seat: Seat): SeatSlot {
        if (this.status !== "PLAYING") return null
        return this.demo ? null : this.makeBotSlot(seat)
    }

    private cancelHold(uid: string): void {
        const hold = this.holds.get(uid)
        if (!hold) return
        clearTimeout(hold.timer)
        this.holds.delete(uid)
    }

    private startHold(uid: string, seat: Seat, reason: HoldReason): void {
        this.cancelHold(uid)
        const until = Date.now() + this.timings.reconnectGraceMs
        const timer = setTimeout(() => {
            this.holds.delete(uid)
            if (this.disposed) return
            if (this.hasConnFor(uid)) return
            const slot = this.seats[seat]
            if (!slot || slot.kind !== "PLAYER" || slot.uid !== uid) return
            // A disconnected solo/two-person table may wait out its reconnect
            // grace, but it must not turn into a one-person or bot-only game
            // when that grace expires. A demo room is never dissolved this way:
            // its life belongs to the director, which is told below and winds
            // the room down itself (`close`).
            if (this.status === "PLAYING" && !this.demo && this.otherHumanCount(uid) < 2) {
                this.reportConfirmedAbandonment(uid)
                this.dissolveAfterPlayersLeft()
                return
            }
            // Hold expired (README §3 "Timeri"): mid-game the bot takes the seat
            // for good; in the lobby the seat simply opens up again.
            this.endLiveActivity(uid)
            this.reportConfirmedAbandonment(uid)
            this.seats[seat] = this.vacatedSlot(seat)
            if (this.isHost(uid)) this.transferHost(uid)
            log.info("seat.holdExpired", { room: this.id, seat, uid, reason })
            this.broadcastState()
            this.lobby.changed()
            this.game?.onPresenceChanged()
            this.fireDemo((e) => e.onHumanGone?.(seat))
        }, this.timings.reconnectGraceMs)
        if (typeof timer.unref === "function") timer.unref()
        this.holds.set(uid, { seat, reason, until, timer })
        log.info("seat.hold", { room: this.id, seat, uid, reason, until })
    }

    /** A player earns the reconnect window; only losing that seat is a leave. */
    private reportConfirmedAbandonment(uid: string): void {
        // A solo practice table is not a reliability signal. At least one
        // other human must have been left waiting when the player gave up the
        // seat; bot-only games remain consequence-free. FAKE people are not a
        // reliability signal either (DEMO-LOBBY.md §2.3: "Bez kazne za karmu"),
        // hence the REAL count here where the dissolve rule above uses the
        // sustainability one.
        if (this.status === "PLAYING" && this.game && this.otherRealHumanCount(uid) > 0) {
            reportGameAbandonment(this.game.runId, uid)
        }
    }

    /** `end` for one seated uid, only while a game is actually running. */
    private endLiveActivity(uid: string): void {
        if (this.status !== "PLAYING" || !this.game) return
        this.liveActivity?.endFor(this, this.game.liveSnapshot(), uid)
    }

    private transferHost(leavingUid: string): void {
        // In a demo room the host is always a fake person, and stays one: the
        // client's "Pokreni igru" is gated on `hostUid === me.uid`
        // (GameRoomPage), so handing the badge to a real visitor would ask them
        // to start a game the director is about to start itself. With no fake
        // person left to hold it the badge simply stays where it is — nobody
        // owns it, which is exactly the state a wound-down demo room is in.
        if (this.demo) {
            for (const s of SEATS) {
                const slot = this.seats[s]
                if (slot?.kind === "DEMO" && slot.identity.uid !== leavingUid) {
                    this.hostUid = slot.identity.uid
                    return
                }
            }
            return
        }
        // ORDINARY room: only a real account, never a guest. The `PLAYER` test
        // is what guarantees it — a `DEMO` slot can never match, so the badge
        // falls through to another real seat or to a connected spectator.
        for (const s of SEATS) {
            const slot = this.seats[s]
            if (slot?.kind === "PLAYER" && slot.uid !== leavingUid) {
                this.hostUid = slot.uid
                return
            }
        }
        for (const c of this.conns) {
            const u = c.user
            if (u && u.uid !== leavingUid) {
                this.hostUid = u.uid
                return
            }
        }
    }

    private makeBotSlot(_seat: Seat): SeatSlot {
        const usedNames = this.seats.flatMap((slot) => slot?.kind === "BOT" ? [slot.name] : [])
        return { kind: "BOT", name: botName(usedNames), avatarPreset: botAvatar() }
    }

    /* ───────────────────────── seat commands ───────────────────────── */

    private requireUser(conn: Connection): UserInfo {
        const u = conn.user
        if (!u) throw new ProtocolError("UNAUTHENTICATED")
        if (!this.conns.has(conn)) throw new ProtocolError("NOT_IN_ROOM")
        return u
    }

    private requireLobby(): void {
        if (this.status !== "LOBBY") {
            throw new ProtocolError("ALREADY_STARTED", "Igra je već započela.")
        }
    }

    private requireHost(conn: Connection): UserInfo {
        const u = this.requireUser(conn)
        if (!this.isHost(u.uid)) throw new ProtocolError("NOT_HOST")
        return u
    }

    sit(conn: Connection, seat: Seat): void {
        const user = this.requireUser(conn)
        this.requireLobby()
        const target = this.seats[seat]
        if (target) {
            if (target.kind === "PLAYER" && target.uid === user.uid) return
            throw new ProtocolError("SEAT_TAKEN")
        }
        const previous = this.seatOfUid(user.uid)
        if (previous !== null) this.seats[previous] = null
        this.seats[seat] = { kind: "PLAYER", uid: user.uid, user, ready: false, connected: true }
        this.broadcastState()
        this.lobby.changed()
    }

    stand(conn: Connection): void {
        const user = this.requireUser(conn)
        this.requireLobby()
        // The other way a no-spectator room could end up showing a spectator:
        // standing up in it. "Bez gledatelja" has to mean nobody in the room
        // without a seat, whichever direction they arrived from — the way out
        // of the chair here is `room.leave`.
        if (!this.allowSpectators) {
            throw new ProtocolError("SPECTATORS_DISABLED", "Ova soba nema gledatelja — izađite iz sobe umjesto ustajanja.")
        }
        const seat = this.seatOfUid(user.uid)
        if (seat === null) throw new ProtocolError("BAD_REQUEST", "Ne sjedite za stolom.")
        this.seats[seat] = null
        if (this.removeBotOnlyLobby()) return
        this.broadcastState()
        this.lobby.changed()
        this.fireDemo((e) => e.onHumanGone?.(seat))
    }

    addBot(conn: Connection, seat: Seat): void {
        this.requireUser(conn)
        this.requireLobby()
        if (this.seats[seat]) throw new ProtocolError("SEAT_TAKEN")
        // "Dodaj bota" adds a BOT — a visible one, with no record and a
        // "Makni bota" button — in a demo room exactly as anywhere else (owner,
        // 2026-09-21; an earlier version quietly seated a fake PERSON here,
        // which is not what the button says). The director sees the seat as
        // taken ("HUMAN" in `demoSeatMap` = not his to touch) and the bots are
        // swept out again when the last real person leaves (`sweepDemoBots`).
        this.seats[seat] = this.makeBotSlot(seat)
        this.broadcastState()
        this.lobby.changed()
    }

    removeBot(conn: Connection, seat: Seat): void {
        this.requireUser(conn)
        this.requireLobby()
        const slot = this.seats[seat]
        if (!slot || slot.kind !== "BOT") {
            throw new ProtocolError("BAD_REQUEST", "Na tom sjedalu nema bota.")
        }
        this.seats[seat] = null
        this.broadcastState()
        this.lobby.changed()
    }

    setReady(conn: Connection, ready: boolean): void {
        const user = this.requireUser(conn)
        this.requireLobby()
        const seat = this.seatOfUid(user.uid)
        if (seat === null) throw new ProtocolError("BAD_REQUEST", "Prvo sjednite za stol.")
        const slot = this.seats[seat]
        if (slot && slot.kind === "PLAYER") slot.ready = ready
        this.broadcastState()
        this.fireDemo((e) => e.onHumanReady?.(seat, ready))
    }

    /**
     * A player changed their in-game name (`profile.setName`). Their seat and
     * their spectator entry both carry a COPY of the `UserInfo` taken when
     * they sat down, so the new name has to be written into those copies or
     * the table keeps showing the old one until they rejoin.
     *
     * Nothing else about the room moves; the caller broadcasts.
     */
    renameOccupant(uid: string, name: string): void {
        this.patchOccupant(uid, { name })
    }

    /**
     * The same thing for the picked face (`profile.setAvatar`). Split from
     * `renameOccupant` only at the call site: a face and a name travel by
     * different rules (one has a once-a-week clock, the other does not), but
     * once they arrive they land in exactly the same copies.
     */
    restyleOccupant(uid: string, avatarPreset: string): void {
        this.patchOccupant(uid, { avatarPreset })
    }

    /** Writes `patch` into every copy of this uid's `UserInfo` the room holds. */
    private patchOccupant(uid: string, patch: Partial<UserInfo>): void {
        for (const slot of this.seats) {
            if (slot && slot.kind === "PLAYER" && slot.uid === uid) {
                slot.user = { ...slot.user, ...patch }
            }
        }
        for (const c of this.conns) {
            if (c.user?.uid === uid) c.user = { ...c.user, ...patch }
        }
    }

    /** Any SEATED player may flip this, not only the host (2026-09-20, user
     *  request) — the same rule `start` has. A spectator may not: whether the
     *  room is listed is the table's call, not the audience's. */
    setPrivate(conn: Connection, isPrivate: boolean): void {
        const user = this.requireUser(conn)
        if (this.seatOfUid(user.uid) === null) {
            throw new ProtocolError("BAD_REQUEST", "Samo igrač za stolom može mijenjati privatnost sobe.")
        }
        this.private = isPrivate
        this.broadcastState()
        this.lobby.changed()
    }

    /**
     * `room.setOptions` — the host retunes the room's own rules while it is
     * still in the LOBBY (README §3).
     *
     * Two guards, and both matter. HOST ONLY, like every other room-wide
     * switch (`setPrivate`, `addBot`): these are settings everyone at the table
     * plays under. LOBBY ONLY, unlike `setPrivate`: the target score, the end
     * rule and the declaration switches are the *deal's* rules and `GameRoom`
     * has already copied them into the engine config — changing them mid-game
     * would leave the room advertising one game and the engine scoring another.
     *
     * Only the fields PRESENT in the patch are written, so a client can flip
     * one switch without restating the other five. Values are validated in
     * `ws.ts` (same place `room.create` validates its own), so anything that
     * gets here is already of the right shape.
     */
    setOptions(conn: Connection, patch: RoomOptionsPatch): void {
        this.requireHost(conn)
        this.requireLobby()
        if (patch.targetScore !== undefined) this.targetScore = patch.targetScore
        if (patch.gameEndRule !== undefined) this.gameEndRule = patch.gameEndRule
        // Re-resolved from the PAIR, whichever half the patch carried: switching
        // the target to 163 has to drop a `dosta` that was already set, and
        // switching away from 163 must not resurrect one (2026-09-20).
        this.gameEndRule = endRuleFor(this.targetScore, this.gameEndRule)
        if (patch.allowSpectators !== undefined) this.allowSpectators = patch.allowSpectators
        if (patch.trickReview !== undefined) this.trickReview = patch.trickReview
        // The declaration pair is resolved TOGETHER through the same rule
        // `room.create` uses, whichever half of it the patch carries: a room
        // that scores declarations always counts the bela.
        const noDeclarations = patch.noDeclarations ?? this.noDeclarations
        const allowBela = patch.allowBela ?? this.allowBela
        this.noDeclarations = noDeclarations
        this.allowBela = belaCounts(noDeclarations, allowBela)
        log.info("room.options", {
            room: this.id,
            target: this.targetScore,
            gameEndRule: this.gameEndRule,
            allowSpectators: this.allowSpectators,
            noDeclarations: this.noDeclarations,
            allowBela: this.allowBela,
            trickReview: this.trickReview,
        })
        this.broadcastState()
        // `targetScore`, `gameEndRule`, `noDeclarations` and `allowSpectators`
        // all live on the public `RoomSummary` too, so the lobby rows have to
        // be redrawn — same fan-out `setPrivate` triggers.
        this.lobby.changed()
    }

    /* ───────────────────────── start / finish ───────────────────────── */

    start(conn: Connection): void {
        const user = this.requireUser(conn)
        this.requireLobby()
        const humans = this.humanSeats()
        if (humans.length === 0) {
            throw new ProtocolError(
                "NOT_ENOUGH_PLAYERS",
                "Za početak igre potreban je barem jedan igrač za stolom.",
            )
        }
        if (this.seatOfUid(user.uid) === null) {
            throw new ProtocolError("BAD_REQUEST", "Samo igrač za stolom može pokrenuti igru.")
        }
        for (const s of humans) {
            const slot = this.seats[s]
            if (slot?.kind === "PLAYER" && !slot.ready) {
                throw new ProtocolError("BAD_REQUEST", "Nisu svi igrači spremni.")
            }
        }
        if (this.seats.some((slot) => slot === null)) {
            throw new ProtocolError(
                "NOT_ENOUGH_PLAYERS",
                "Za početak igre moraju biti popunjena sva četiri mjesta.",
            )
        }
        this.launch()
    }

    /** Everything `room.start` does once its checks have passed. Shared with
     *  the demo director's `start()`, which has different checks and no caller. */
    private launch(): void {
        if (!this.allowSpectators) {
            for (const member of [...this.conns]) {
                const uid = member.user?.uid
                if (uid && this.seatOfUid(uid) !== null) continue
                this.conns.delete(member)
                member.roomId = null
                member.send({ t: "room.left" })
                member.send({ t: "game.active", seat: null })
            }
        }
        this.cancelDeleteTimer()
        this.game?.dispose()
        this.status = "PLAYING"
        this.demoFinished = false
        this.game = new GameRoom(this, this.timings)
        this.liveActivity?.beginGame(this)
        log.info("room.start", { room: this.id, target: this.targetScore })
        this.broadcastState()
        this.lobby.changed()
        this.game.begin()
    }

    /** Called by the GameRoom when the engine reaches GAME_OVER. */
    onGameOver(winner: "A" | "B" | null = null): void {
        if (this.status !== "PLAYING") return
        this.status = "LOBBY"
        // Whoever started the game — the director or a real person pressing
        // "Pokreni igru" — this is the one path out of PLAYING, so both the
        // event and the pollable state below are fired for both.
        this.demoFinished = true
        for (const slot of this.seats) {
            if (slot?.kind === "PLAYER") slot.ready = false
        }
        log.info("room.finished", { room: this.id })
        this.broadcastState()
        this.lobby.changed()
        // A demo room is never empty while fake people sit in it (`isEmpty`),
        // so this is a no-op there: the finished table stays up for the
        // director to wind down at a human pace.
        this.scheduleDeleteIfEmpty()
        this.fireDemo((e) => e.onGameOver?.(winner))
    }

    /* ───────────────────────── deletion ───────────────────────── */

    private cancelDeleteTimer(): void {
        if (this.deleteTimer) {
            clearTimeout(this.deleteTimer)
            this.deleteTimer = null
        }
    }

    scheduleDeleteIfEmpty(): void {
        if (!this.isEmpty()) return
        this.scheduleDelete(this.timings.emptyRoomTtlMs)
    }

    private scheduleDelete(ms: number): void {
        this.cancelDeleteTimer()
        const timer = setTimeout(() => {
            this.deleteTimer = null
            if (this.disposed) return
            if (this.status !== "FINISHED" && !this.isEmpty()) return
            log.info("room.deleted", { room: this.id, status: this.status })
            this.lobby.remove(this.id)
        }, ms)
        if (typeof timer.unref === "function") timer.unref()
        this.deleteTimer = timer
    }

    /* ───────────────────────── demo lobby (DEMO-LOBBY.md) ─────────────────────────
       Everything below is dead code in an ordinary room: every method starts
       at `this.demo`, which only `Lobby.createDemoRoom` ever sets. */

    /**
     * Tell the director something happened. SYNCHRONOUS and always the LAST
     * statement of whatever changed the room, so the callback may call straight
     * back into this room (`replace`, `leave`, `close`) without finding it
     * half-updated. A throwing director is its own problem, never the table's.
     */
    private fireDemo(emit: (events: DemoRoomEvents) => void): void {
        const ctx = this.demo
        if (!ctx || this.disposed) return
        try {
            emit(ctx.events)
        } catch (err) {
            log.error("demo.event.failed", { room: this.id, err })
        }
    }

    /** The room's live settings, as the director's `DemoRoomOptions`. */
    demoOptions(): Readonly<DemoRoomOptions> {
        return {
            targetScore: this.targetScore,
            gameEndRule: this.gameEndRule,
            allowSpectators: this.allowSpectators,
            private: this.private,
            noDeclarations: this.noDeclarations,
        }
    }

    /**
     * Per-seat: the fake person on it, "HUMAN" for anything the director must
     * not touch, null for a free chair.
     *
     * A BOT slot reports "HUMAN" too. It can only get there one way — a real
     * visitor pressed "Dodaj bota" and the director declined to supply a person
     * — and "not yours" is the only thing the director needs to know about it.
     */
    demoSeatMap(): ReadonlyArray<DemoIdentity | "HUMAN" | null> {
        return SEATS.map((seat) => {
            const slot = this.seats[seat]
            if (!slot) return null
            if (slot.kind === "DEMO") return slot.identity
            return "HUMAN" as const
        })
    }

    /** Real accounts seated here (including one on a reconnect hold). */
    demoHumanCount(): number {
        return this.realHumanSeats().length
    }

    /** Distinct real people in the room without a seat. */
    demoSpectatorCount(): number {
        const seen = new Set<string>()
        for (const c of this.conns) {
            const u = c.user
            if (!u || seen.has(u.uid)) continue
            if (this.seatOfUid(u.uid) !== null) continue
            seen.add(u.uid)
        }
        return seen.size
    }

    /** A fake person takes a free LOBBY seat. */
    demoSit(identity: DemoIdentity, seat: Seat): boolean {
        if (this.disposed || !this.demo) return false
        if (this.status !== "LOBBY") return false
        if (this.seats[seat] !== null) return false
        // The same face at two seats of one table is a tell of its own; the
        // director owns "not in two ROOMS at once", this owns "not twice here".
        if (this.demoSeatOf(identity.uid) !== null) return false
        this.seats[seat] = { kind: "DEMO", identity }
        this.cancelDeleteTimer()
        this.broadcastState()
        this.lobby.changed()
        return true
    }

    /** A fake person gives up a LOBBY seat. Mid-game the director uses `replace`. */
    demoLeave(seat: Seat): boolean {
        if (this.disposed || !this.demo) return false
        if (this.status !== "LOBBY") return false
        const slot = this.seats[seat]
        if (!slot || slot.kind !== "DEMO") return false
        this.seats[seat] = null
        this.demoReactionAt.delete(seat)
        if (this.isHost(slot.identity.uid)) this.transferHost(slot.identity.uid)
        this.broadcastState()
        this.lobby.changed()
        return true
    }

    /**
     * A fake person takes over a seat nobody real owns — the mid-game answer to
     * a hold that expired (`vacatedSlot` left the chair empty and told the
     * director). Refused for a seat a real person still holds, at any status.
     */
    demoReplace(identity: DemoIdentity, seat: Seat): boolean {
        if (this.disposed || !this.demo) return false
        const slot = this.seats[seat]
        if (slot?.kind === "PLAYER") return false
        if (this.demoSeatOf(identity.uid) !== null) return false
        this.seats[seat] = { kind: "DEMO", identity }
        this.demoReactionAt.delete(seat)
        this.broadcastState()
        this.lobby.changed()
        // The seat's controller changed while the engine is mid-deal: whoever
        // is on the clock may now be bot-driven (or stop being).
        this.game?.onPresenceChanged()
        return true
    }

    /**
     * Start a demo table. Unlike `start(conn)` there is no caller and there may
     * be no real person at all — but every real person who IS seated must have
     * pressed "Spreman", exactly as they would have to for a human host.
     */
    demoStart(): boolean {
        if (this.disposed || !this.demo) return false
        if (this.status !== "LOBBY") return false
        if (this.seats.some((slot) => slot === null)) return false
        for (const seat of SEATS) {
            const slot = this.seats[seat]
            if (slot?.kind === "PLAYER" && !slot.ready) return false
        }
        this.launch()
        return true
    }

    /** A fixed emoji from a fake person, under the real cooldown. */
    demoReact(seat: Seat, reaction: string): boolean {
        if (this.disposed || !this.demo) return false
        return this.reactAsFakePerson(seat, reaction)
    }

    /** The body of `demoReact`, shared with the guest path (`guestReact`): the
     *  gate differs (demo room vs. a seat a guest holds), the behaviour must not. */
    private reactAsFakePerson(seat: Seat, reaction: string): boolean {
        const slot = this.seats[seat]
        if (!slot || slot.kind !== "DEMO") return false
        if (!(REACTIONS as readonly string[]).includes(reaction)) return false
        const now = Date.now()
        const last = this.demoReactionAt.get(seat)
        if (last !== undefined && now - last < LIMITS.reactionCooldownMs) return false
        this.demoReactionAt.set(seat, now)
        this.broadcast({
            t: "chat.reaction",
            from: demoUserInfo(slot.identity),
            seat,
            reaction: reaction as Reaction,
            at: now,
        })
        return true
    }

    /** Points in the running game, or null when no game is running. */
    demoScore(): { A: number; B: number } | null {
        if (!this.game) return null
        return { A: this.game.state.score.A, B: this.game.state.score.B }
    }

    /* ─────────────── guests in ORDINARY rooms (DEMO-LOBBY.md) ───────────────
       A real person opens a public table and waits; fake people trickle in so
       the table can actually start. Everything here refuses outright in a demo
       room (`this.demo` — those use `demoSit`/`demoLeave`) and is unreachable
       unless `Lobby.watchRealRooms` has been called, which only the director
       does. The real host keeps every power they had: they press "Pokreni
       igru", they may add and remove bots, and the room is still theirs. */

    /** Fake people seated in THIS room, in seat order. */
    guestIdentities(): DemoIdentity[] {
        const out: DemoIdentity[] = []
        for (const seat of SEATS) {
            const slot = this.seats[seat]
            if (slot?.kind === "DEMO") out.push(slot.identity)
        }
        return out
    }

    /**
     * A guest takes a chair. `seat` omitted = `nextSeatForNewcomer()`, the same
     * `SEAT_FILL_ORDER` a real arrival gets, so a table with two people in it
     * still shows them as partners.
     *
     * Refused for: a demo room, a running game, a taken chair, a PRIVATE room
     * (a locked table is not somewhere a stranger wanders into — the guests
     * already sitting stay), and a room with nobody REAL in it, which is the
     * invariant the whole feature rests on: a guest never exists on its own.
     */
    guestSit(identity: DemoIdentity, seat?: Seat): boolean {
        if (this.disposed || this.demo) return false
        if (this.status !== "LOBBY") return false
        if (this.private) return false
        if (this.realHumanSeats().length === 0) return false
        if (this.demoSeatOf(identity.uid) !== null) return false
        const target = seat ?? this.nextSeatForNewcomer()
        if (target === null) return false
        if (this.seats[target] !== null) return false
        this.seats[target] = { kind: "DEMO", identity }
        log.info("guest.seated", { room: this.id, seat: target, uid: identity.uid })
        this.broadcastState()
        this.lobby.changed()
        return true
    }

    /** A guest stands up (gave up waiting, or the game is over). LOBBY only —
     *  mid-deal nobody may leave a seat that is holding cards. */
    guestLeave(identity: DemoIdentity): boolean {
        if (this.disposed || this.demo) return false
        if (this.status !== "LOBBY") return false
        const seat = this.demoSeatOf(identity.uid)
        if (seat === null) return false
        this.seats[seat] = null
        this.demoReactionAt.delete(seat)
        // No `transferHost`: a guest is never the host of an ordinary room
        // (`hostUid` only ever holds a real uid there), so there is nothing to
        // hand on. The room's own emptiness rules still apply.
        this.broadcastState()
        this.lobby.changed()
        this.scheduleDeleteIfEmpty()
        return true
    }

    /** A guest's emoji, under the same cooldown a real person has. */
    guestReact(identity: DemoIdentity, reaction: string): boolean {
        if (this.disposed || this.demo) return false
        const seat = this.demoSeatOf(identity.uid)
        if (seat === null) return false
        return this.reactAsFakePerson(seat, reaction)
    }

    /** The seat a fake person with this uid sits on, if any. */
    private demoSeatOf(uid: string): Seat | null {
        for (const seat of SEATS) {
            const slot = this.seats[seat]
            if (slot?.kind === "DEMO" && slot.identity.uid === uid) return seat
        }
        return null
    }

    /**
     * Wind the room down: the fake people "leave", anyone real gets the
     * ordinary `room.left` they would get from a dissolved room, and the lobby
     * drops it (which disposes it and fires `onDisposed`).
     */
    demoClose(): void {
        if (this.disposed || !this.demo) return
        for (const seat of SEATS) {
            if (this.seats[seat]?.kind === "DEMO") this.seats[seat] = null
        }
        this.game?.abandon("DEMO_CLOSED")
        const remaining = [...this.conns]
        this.conns.clear()
        for (const member of remaining) {
            member.roomId = null
            member.send({ t: "room.left" })
            member.send({ t: "game.active", seat: null })
        }
        log.info("demo.room.closed", { room: this.id })
        this.lobby.remove(this.id)
    }

    dispose(): void {
        this.disposed = true
        this.cancelDeleteTimer()
        for (const hold of this.holds.values()) clearTimeout(hold.timer)
        this.holds.clear()
        // A running game that vanishes (dissolved, server shutdown) still owes
        // its players an `end` — otherwise their lock screen waits 12 h.
        if (this.status === "PLAYING" && this.game) {
            this.liveActivity?.endAll(this, this.game.liveSnapshot())
        }
        this.liveActivity?.forgetRoom(this.id)
        this.game?.dispose()
        this.game = null
        // Not through `fireDemo`: this is the one event whose whole point is
        // that the room is already gone, so the disposed guard cannot apply.
        const ctx = this.demo
        if (ctx) {
            try {
                ctx.events.onDisposed?.()
            } catch (err) {
                log.error("demo.event.failed", { room: this.id, err })
            }
        }
    }
}

/**
 * The director's handle on one demo room (`DemoRoomHandle`).
 *
 * A thin adapter rather than `Room implements DemoRoomHandle`, because the two
 * disagree about one name: the interface wants `status()` as a method and the
 * room has had `status` as a field since day one. Every call is synchronous and
 * every one of them is a no-op returning false once the room is disposed.
 */
export class DemoRoom implements DemoRoomHandle {
    private readonly room: Room

    constructor(room: Room) {
        this.room = room
    }

    get id(): string {
        return this.room.id
    }

    get options(): Readonly<DemoRoomOptions> {
        return this.room.demoOptions()
    }

    status(): RoomStatus {
        return this.room.demoStatus()
    }

    seatMap(): ReadonlyArray<DemoIdentity | "HUMAN" | null> {
        return this.room.demoSeatMap()
    }

    humanCount(): number {
        return this.room.demoHumanCount()
    }

    spectatorCount(): number {
        return this.room.demoSpectatorCount()
    }

    sit(identity: DemoIdentity, seat: Seat): boolean {
        return this.room.demoSit(identity, seat)
    }

    leave(seat: Seat): boolean {
        return this.room.demoLeave(seat)
    }

    replace(seat: Seat, identity: DemoIdentity): boolean {
        return this.room.demoReplace(identity, seat)
    }

    start(): boolean {
        return this.room.demoStart()
    }

    react(seat: Seat, reaction: string): boolean {
        return this.room.demoReact(seat, reaction)
    }

    close(): void {
        this.room.demoClose()
    }

    score(): { A: number; B: number } | null {
        return this.room.demoScore()
    }
}

/**
 * The director's handle on ONE room a real person opened (`RealRoomHandle`).
 *
 * Only `Lobby.realWaitingRooms()` / `Lobby.watchRealRooms` ever construct one,
 * and only after the demo director has asked to watch — so with the flag off
 * this class is never instantiated and `Room.guestSit` is never called.
 *
 * Everything is a dead no-op once the room has left the lobby: the director
 * polls its handles and a stale one must answer "nothing here" rather than
 * throw or, worse, seat somebody into a disposed room.
 */
export class RealRoom implements RealRoomHandle {
    private readonly room: Room

    constructor(room: Room) {
        this.room = room
    }

    get id(): string {
        return this.room.id
    }

    get createdAt(): number {
        return this.room.createdAt
    }

    isPublic(): boolean {
        return !this.room.isDisposed() && !this.room.private
    }

    status(): RoomStatus {
        return this.room.status
    }

    freeSeats(): readonly Seat[] {
        if (this.room.isDisposed()) return []
        return SEAT_FILL_ORDER.filter((s) => this.room.slotAt(s) === null)
    }

    humanCount(): number {
        if (this.room.isDisposed()) return 0
        return this.room.realHumanSeats().length
    }

    guests(): readonly DemoIdentity[] {
        if (this.room.isDisposed()) return []
        return this.room.guestIdentities()
    }

    sitGuest(identity: DemoIdentity, seat?: Seat): boolean {
        return this.room.guestSit(identity, seat)
    }

    removeGuest(identity: DemoIdentity): boolean {
        return this.room.guestLeave(identity)
    }

    react(identity: DemoIdentity, reaction: string): boolean {
        return this.room.guestReact(identity, reaction)
    }
}
