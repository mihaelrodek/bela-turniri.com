/* ──────────────────────────────────────────────────────────────────────────
   DEMO LOBBY — the contract between its three parts (game/DEMO-LOBBY.md).

   PRE-LAUNCH ONLY. With `GAME_DEMO_LOBBY` unset the server must behave
   byte-for-byte as it did before this directory existed: nothing here may be
   imported on a hot path without the flag check in `index.ts`/`server.ts`.

     identities.ts   who the fake people are            (pure data + rng)
     Room / Lobby    HOW a fake person sits, plays, leaves (mechanics, room.ts)
     director.ts     WHEN they do it                     (population control)

   The mechanics know nothing about populations; the director never touches a
   seat array. This file is the only thing both sides import from each other.

   GUESTS IN REAL ROOMS (DEMO-LOBBY.md "Gosti u pravim sobama"). A fake person
   may also sit down in a room a REAL person opened, so somebody who creates a
   public table and waits is not left staring at three empty chairs. That needs
   a second, much smaller handle — `RealRoomHandle` — plus `watchRealRooms` /
   `realWaitingRooms` on the lobby API. Both are OPTIONAL members: a lobby that
   does not implement them (and a lobby the flag never switched on, which
   returns an empty list) simply never gets guests, and the director degrades to
   demo rooms only.

   The asymmetry with `DemoRoomHandle` is deliberate and is the whole safety
   argument: a guest cannot start, close, replace or host anything in a real
   room. It can sit, stand and react — nothing else — and the room's own rules
   (the real host presses "Pokreni igru", the room dies when its last real
   person leaves) are untouched.
   ────────────────────────────────────────────────────────────────────── */

import type { GameEndRule, PlayerGameStats, Seat, TargetScore } from "@bela/protocol"

/** A fake person. Stable for the life of the process, so the same "Dado" shows
 *  up again an hour later with the same face and a record that only moved by
 *  the games he was seen playing. */
export interface DemoIdentity {
    /** `demo:<slug>` — the prefix is what every reporter filters on. */
    readonly uid: string
    /** ≤ LIMITS.playerNameMax, passes `validatePlayerName`. */
    readonly name: string
    readonly avatarPreset: string
    /** Mutable on purpose: the director books wins/losses as games finish. */
    gameStats: PlayerGameStats
    /** 0..KARMA_MAX. */
    karma: number
    /** How this person plays the CLOCK, not the cards (the cards are the bot's). */
    readonly tempo: DemoTempo
}

/** Think-time profile, milliseconds. A human is not uniform: mostly quick,
 *  sometimes slow, now and then very slow. */
export interface DemoTempo {
    readonly fastMs: readonly [number, number]
    readonly slowMs: readonly [number, number]
    /** Probability that a given move is a "slow" one. */
    readonly slowChance: number
}

export interface DemoRoomOptions {
    targetScore: TargetScore
    gameEndRule: GameEndRule
    allowSpectators: boolean
    /** A locked room in the list: never joinable, only ever scenery. */
    private: boolean
    noDeclarations?: boolean
}

/** What the mechanics tell the director. All optional, all fire-and-forget. */
export interface DemoRoomEvents {
    /** A REAL person took a seat (or came back to one). */
    onHumanSeated?(seat: Seat): void
    /** A real person flipped "Spreman". */
    onHumanReady?(seat: Seat, ready: boolean): void
    /** A real person's seat is free again (left, or their hold expired). */
    onHumanGone?(seat: Seat): void
    /**
     * NO LONGER CALLED by the mechanics (owner, 2026-09-21): "Dodaj bota" adds
     * a real, visible, removable bot in a demo room like anywhere else, and the
     * seat shows up as "HUMAN" (= not yours) in `seatMap()`. Kept optional so
     * the director's implementation and its tests need not change.
     */
    onBotRequested?(seat: Seat): DemoIdentity | null
    onGameOver?(winner: "A" | "B" | null): void
    /** The room object is gone; drop every timer that points at it. */
    onDisposed?(): void
}

/**
 * The director's handle on ONE demo room. Implemented by `Room` (room.ts);
 * every method is a no-op returning false once the room is disposed.
 */
export interface DemoRoomHandle {
    readonly id: string
    readonly options: Readonly<DemoRoomOptions>
    status(): "LOBBY" | "PLAYING" | "FINISHED"
    /** null = free. "HUMAN" = a real person; never touch that seat. */
    seatMap(): ReadonlyArray<DemoIdentity | "HUMAN" | null>
    humanCount(): number
    spectatorCount(): number
    /** Seat a fake person. False when the seat is taken or the game runs. */
    sit(identity: DemoIdentity, seat: Seat): boolean
    /** A fake person leaves a LOBBY seat. Mid-game use `replace`. */
    leave(seat: Seat): boolean
    /** Mid-game: another fake person takes over a seat whose human is gone for
     *  good (the normal rules would put "Bot Ana" there). */
    replace(seat: Seat, identity: DemoIdentity): boolean
    /** Start the game. Requires four occupied seats and every REAL person
     *  ready; a room of four fake people starts unconditionally. */
    start(): boolean
    /** A fixed emoji reaction from a fake person, subject to the same cooldown
     *  as a real one. */
    react(seat: Seat, reaction: string): boolean
    /** Close the room: people "leave", then it is removed from the lobby. */
    close(): void
    /** Points so far in the running game, for the director's bookkeeping. */
    score(): { A: number; B: number } | null
}

/**
 * The director's handle on ONE room a REAL person opened. Deliberately tiny:
 * everything a guest is allowed to do there and nothing else. Implemented by
 * `Lobby.realWaitingRooms()` (room.ts `RealRoom`); every method is dead — false
 * / empty — once the room has left the lobby.
 */
export interface RealRoomHandle {
    readonly id: string
    /** When the real person opened it; the arrival quiet period counts from here. */
    readonly createdAt: number
    /** False for a locked room: no NEW guest may join one (the ones already
     *  sitting stay — they are "people", not scenery). */
    isPublic(): boolean
    status(): "LOBBY" | "PLAYING" | "FINISHED"
    /** Free chairs, in the room's own `SEAT_FILL_ORDER`. */
    freeSeats(): readonly Seat[]
    /** REAL accounts seated here. Guests are never counted. */
    humanCount(): number
    /** The fake people currently seated, so the director can reconcile its own
     *  bookkeeping against the room rather than trust it. */
    guests(): readonly DemoIdentity[]
    /** Seat a fake person; `seat` omitted = the room's own next seat. False for
     *  a private room, a running game, a full table, or a room with nobody real. */
    sitGuest(identity: DemoIdentity, seat?: Seat): boolean
    /** That fake person stands up. False when they are not seated here. */
    removeGuest(identity: DemoIdentity): boolean
    /** A fixed emoji from a seated guest, under the ordinary reaction cooldown. */
    react(identity: DemoIdentity, reaction: string): boolean
}

/** What the LOBBY tells the director about real rooms. All fire-and-forget. */
export interface RealRoomEvents {
    /** An ordinary room appeared. */
    onRoomOpened?(room: RealRoomHandle): void
    /**
     * Something the director paces on changed:
     *   `human`   — a real person sat down or left (restarts the quiet period)
     *   `options` — privacy or room settings moved
     *   `status`  — the game started, or ended
     */
    onRoomChanged?(room: RealRoomHandle, what: "human" | "options" | "status"): void
    /** It is gone from the lobby; release every guest booked against it. */
    onRoomClosed?(roomId: string): void
}

/** What `Lobby` offers the director. */
export interface DemoLobbyApi {
    createDemoRoom(options: DemoRoomOptions, host: DemoIdentity, events: DemoRoomEvents): DemoRoomHandle | null
    /** Live rooms that are NOT demo rooms — real activity the director yields to. */
    realRoomCount(): number
    totalRoomCount(): number
    /** Start receiving real-room events. Calling it is ALSO what unlocks
     *  `realWaitingRooms()`: with the demo flag off nobody ever calls this, so
     *  the list stays empty and no ordinary room can ever get a guest. */
    watchRealRooms?(events: RealRoomEvents): void
    /** Public LOBBY rooms with at least one real person and a free seat. */
    realWaitingRooms?(): readonly RealRoomHandle[]
}

/** Everything random or timed goes through these, so tests are deterministic. */
export interface DemoClock {
    now(): number
    setTimeout(fn: () => void, ms: number): unknown
    clearTimeout(handle: unknown): void
}

export interface DemoDirectorConfig {
    /** Total demo rooms wander inside this band. Default 8..12. */
    totalRooms: readonly [number, number]
    /** Of those, this many are PLAYING. Default 5..6. */
    playingRooms: readonly [number, number]
    /** PLAYING rooms that allow spectators. Default 2. */
    watchableRooms: number
}

/**
 * Ceilings on a tempo draw, in milliseconds, enforced by the MECHANICS
 * (`gameRoom.ts`) rather than trusted from an identity.
 *
 * They live here, in the contract, and not in `identities.ts`: `gameRoom.ts` is
 * a hot path in every server, demo or not, and importing the identity module
 * from it would pull the whole name corpus into memory on a server started with
 * the flag off. This file is two constants and a predicate — nothing to load.
 *
 *   • CEILING  — no "thinking" pause is ever longer than this, whatever a
 *     tempo says; nine seconds is already the longest believable stare.
 *   • HEADROOM — and it always lands this far before the turn deadline, so the
 *     ring a fake person's seat shows never enters the client's "hurry up"
 *     treatment. Nobody plays that calmly and then buzzer-beats, every deal.
 */
export const DEMO_TEMPO_CEILING_MS = 9_000
export const DEMO_TEMPO_HEADROOM_MS = 2_500

export const DEMO_UID_PREFIX = "demo:"
export function isDemoUid(uid: string | null | undefined): boolean {
    return typeof uid === "string" && uid.startsWith(DEMO_UID_PREFIX)
}
