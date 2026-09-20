/* ──────────────────────────────────────────────────────────────────────────
   The authoritative game inside a started room (README §3 "Igra", "Timeri").

   Holds the full `GameState` — which never leaves this process. Every member
   receives only `viewFor(state, theirSeat)`; spectators get `viewFor(state, null)`.

   Turn handling:
     • human on turn (connected OR on a seat hold) → `turnTimeoutMs` deadline;
       on expiry the seat's bot plays ONE move for them and the next
       `game.state` carries `autoPlayed: true`. An away player is deliberately
       NOT fast-forwarded: the table keeps its normal rhythm while their seat
       is held, and they can walk back in mid-deadline (README §3 "Timeri")
     • bot seat → the bot acts after a random think delay
     • DEAL_DONE                → `game.nextDeal` is a per-seat ACK: the deal
       advances as soon as every CONNECTED human seat has acked (bots and
       seats on hold do not vote), and otherwise on the `dealDoneAutoMs`
       fallback timer. Acks are kept per deal and reset with it.
       A deal that DECIDES the game never gets here: the engine settles it
       straight into GAME_OVER (README §1.7), so this phase always means
       "another deal follows" and nothing has to auto-advance a finished game
     • GAME_OVER                → the room is marked FINISHED and, once,
       `statsReporter.reportGameResult` tells the backend about it (README §8)
       and every seated human's Live Activity gets its `end` (README §3)
   ────────────────────────────────────────────────────────────────────── */

import {
    EngineError,
    legalBids,
    legalMoves,
    newGame,
    reduce,
    SEATS,
    viewFor,
} from "@bela/engine"
import type { Card, GameAction, GameEvent, GameState, PlayerView, Seat, Suit } from "@bela/engine"
import type { ServerMessage } from "@bela/protocol"
import type { Timings } from "./config.js"
import { codeFromEngine, ProtocolError } from "./errors.js"
import { chooseBid, chooseCard, makeBot, thinkDelay } from "./bots.js"
import type { Bot } from "./bots.js"
import { newSeed } from "./ids.js"
import { randomUUID } from "node:crypto"
import { reportGameAbandoned, reportGameCompleted, reportGameStarted } from "./analyticsReporter.js"
import type { LiveActivitySnapshot } from "./liveActivity.js"
import { log } from "./log.js"
import type { Room } from "./room.js"
import { reportGameResult } from "./statsReporter.js"
import type { Connection } from "./ws.js"


type Timer = ReturnType<typeof setTimeout>

function unref(t: Timer): Timer {
    if (typeof t.unref === "function") t.unref()
    return t
}

export class GameRoom {
    state: GameState
    private declarationsUntil = 0

    private readonly room: Room
    private readonly t: Timings
    /** One bot serves every bot seat: it is stateless and level-free (README §5). */
    private readonly bot: Bot
    /** Seats that have acked the deal currently on screen (`dealAcksFor`). */
    private readonly dealAcks: Set<Seat>
    private dealAcksFor: number | null
    private turnTimer: Timer | null
    private botTimer: Timer | null
    private dealDoneTimer: Timer | null
    private turnDeadline: number | null
    private turnDurationMs: number | null
    private lastAutoPlayed: boolean
    private scheduledSeat: Seat | null
    private scheduledAsBot: boolean | null
    private disposed: boolean
    private readonly analyticsRunId: string
    private readonly startedAt: number
    private autoPlayedActions: number
    private analyticsTerminalReported: boolean

    constructor(room: Room, timings: Timings) {
        this.room = room
        this.t = timings
        this.bot = makeBot()
        this.dealAcks = new Set<Seat>()
        this.dealAcksFor = null
        this.turnTimer = null
        this.botTimer = null
        this.dealDoneTimer = null
        this.turnDeadline = null
        this.turnDurationMs = null
        this.lastAutoPlayed = false
        this.scheduledSeat = null
        this.scheduledAsBot = null
        this.disposed = false
        this.analyticsRunId = randomUUID()
        this.startedAt = Date.now()
        this.autoPlayedActions = 0
        this.analyticsTerminalReported = false
        // `trickReview` travels in the engine config because `viewFor(state,
        // seat)` — the only place the redaction can be enforced — has nothing
        // but the state to read it from. It changes no rule of play.
        this.state = newGame({ targetScore: room.targetScore, gameEndRule: room.gameEndRule, seed: newSeed(), noDeclarations: room.noDeclarations, allowBela: room.allowBela, trickReview: room.trickReview })
    }

    /** Stable id for lifecycle reports belonging to this one started game. */
    get runId(): string {
        return this.analyticsRunId
    }

    /** First broadcast + first timer, right after `room.start`. */
    begin(): void {
        reportGameStarted(this.analyticsRunId, this.room, this.startedAt)
        this.schedule()
        this.broadcastState()
    }

    /* ───────────────────────── client actions ───────────────────────── */

    private seatOf(conn: Connection): Seat {
        const uid = conn.user?.uid
        if (!uid) throw new ProtocolError("UNAUTHENTICATED")
        const seat = this.room.seatOfUid(uid)
        if (seat === null) throw new ProtocolError("NOT_YOUR_TURN", "Ne sjedite za stolom.")
        return seat
    }

    bid(conn: Connection, trump: Suit): void {
        this.applyChecked({ type: "BID", seat: this.seatOf(conn), trump }, false)
    }

    pass(conn: Connection): void {
        this.applyChecked({ type: "PASS", seat: this.seatOf(conn) }, false)
    }

    /** `bela` is the answer to "Zovi belu?" the client asked before sending the
     *  move (README §1.4). Absent = announce, which is also what the turn
     *  timeout and every bot move below produce. */
    play(conn: Connection, card: Card, bela?: boolean): void {
        if (this.declarationsUntil > Date.now()) throw new ProtocolError("BAD_REQUEST", "Pričekajte prikaz zvanja.")
        this.applyChecked({ type: "PLAY", seat: this.seatOf(conn), card, bela }, false)
    }

    /**
     * "I have read the receipt." NOT "deal now": one player closing their
     * summary used to yank the table forward under everybody else, which is
     * why the client stopped sending this at all and the 8 s timer became the
     * only pace. It is an ACK now — the table advances when every connected
     * human has acked, so a solo game against bots is instant and a table of
     * four waits for the slowest of the four, capped by `dealDoneAutoMs`.
     *
     * `seatOf` throws for a spectator: watching is not voting.
     */
    nextDeal(conn: Connection): void {
        const seat = this.seatOf(conn)
        if (this.state.phase !== "DEAL_DONE") return
        this.ackDeal(seat)
    }

    /** Record one seat's ack for the deal on screen and advance if it was the
     *  last one outstanding. */
    private ackDeal(seat: Seat): void {
        if (this.dealAcksFor !== this.state.dealNo) {
            this.dealAcksFor = this.state.dealNo
            this.dealAcks.clear()
        }
        this.dealAcks.add(seat)
        this.advanceIfAllAcked()
    }

    /** Every connected human seat has acked (and there is at least one). A
     *  disconnected player — seat on hold — and a bot never hold the table. */
    private allConnectedHumansAcked(): boolean {
        if (this.dealAcksFor !== this.state.dealNo) return false
        let voters = 0
        for (const seat of SEATS) {
            const slot = this.room.slotAt(seat)
            if (!slot || slot.kind !== "PLAYER" || !slot.connected) continue
            voters += 1
            if (!this.dealAcks.has(seat)) return false
        }
        return voters > 0
    }

    private advanceIfAllAcked(): boolean {
        if (this.state.phase !== "DEAL_DONE") return false
        if (!this.allConnectedHumansAcked()) return false
        // `autoPlayed: false` — a deal somebody asked for is not a deal the
        // server played for them.
        this.autoApply({ type: "NEXT_DEAL" }, false)
        return true
    }

    /* ───────────────────────── engine plumbing ───────────────────────── */

    private applyChecked(action: GameAction, autoPlayed: boolean): void {
        if (this.disposed) throw new ProtocolError("BAD_REQUEST", "Igra više nije aktivna.")
        try {
            this.apply(action, autoPlayed)
        } catch (e) {
            throw toProtocolError(e)
        }
    }

    private apply(action: GameAction, autoPlayed: boolean): void {
        if (autoPlayed && action.type !== "NEXT_DEAL") this.autoPlayedActions += 1
        const result = reduce(this.state, action)
        this.state = result.state
        // Not when the same action also ENDED the game: on "dosta" a pair can
        // go out on its declarations alone (README §1.7), and arming the
        // display window then made `schedule()` park the GAME_OVER
        // finalisation (stats, live activity, room back to LOBBY) behind an
        // 8 s timer that a room emptying out in the meantime would cancel for
        // good. The client's own event queue still plays the reveal first.
        if (
            result.state.phase !== "GAME_OVER"
            && result.events.some((event) => event.type === "DECLARATIONS_REVEALED")
        ) {
            this.declarationsUntil = Date.now() + this.t.declarationsMs
        }
        this.lastAutoPlayed = autoPlayed
        this.schedule()
        // Events BEFORE the state on purpose: the events describe the
        // transition and the state is its result, so a client that reacts to
        // `game.state` (e.g. "phase is GAME_OVER, show the dialog") can rely
        // on every event of that transition having already arrived. The UI's
        // event queue is order-agnostic; the ordering matters for anything
        // that treats the state as the "done" signal.
        this.broadcastEvents(result.events)
        this.broadcastState()
    }

    /* ───────────────────────── broadcasting ───────────────────────── */

    private broadcastEvents(events: GameEvent[]): void {
        if (events.length === 0) return
        this.room.broadcast({ t: "game.events", events })
    }

    private stateMessage(seat: Seat | null, cache: Map<Seat | null, PlayerView>): ServerMessage {
        let view = cache.get(seat)
        if (!view) {
            view = viewFor(this.state, seat)
            if (this.declarationsUntil > Date.now()) view = { ...view, legalMoves: [] }
            cache.set(seat, view)
        }
        return {
            t: "game.state",
            declarationsPending: this.declarationsUntil > Date.now(),
            view,
            turnDeadline: this.turnDeadline,
            turnDurationMs: this.turnDurationMs,
            autoPlayed: this.lastAutoPlayed,
        }
    }

    broadcastState(): void {
        const cache = new Map<Seat | null, PlayerView>()
        for (const conn of this.room.conns) {
            const uid = conn.user?.uid ?? null
            const seat = uid ? this.room.seatOfUid(uid) : null
            conn.send(this.stateMessage(seat, cache))
        }
        // Rides on the same broadcast every client already gets, so the lock
        // screen can never show a state the table has not seen (README §3).
        this.room.liveActivity?.onGameState(this.room, this.liveSnapshot())
    }

    /** What the Live Activity fan-out reads: the state and the running deadline. */
    liveSnapshot(): LiveActivitySnapshot {
        return { state: this.state, turnDeadline: this.turnDeadline }
    }

    /** Used on join / reconnect so a late arrival is immediately in sync. */
    sendStateTo(conn: Connection): void {
        const uid = conn.user?.uid ?? null
        const seat = uid ? this.room.seatOfUid(uid) : null
        conn.send(this.stateMessage(seat, new Map<Seat | null, PlayerView>()))
    }

    /* ───────────────────────── scheduling ───────────────────────── */

    private currentSeat(): Seat | null {
        const st = this.state
        if (st.phase === "BIDDING") return st.bidding.turn
        if (st.phase === "PLAYING") return st.trick.turn
        return null
    }

    /**
     * Only an actual bot slot is bot-controlled. A disconnected human is NOT:
     * their seat is on hold, so the ordinary turn deadline runs and the bot
     * steps in exactly once, at expiry, through `actForSeat` (`autoPlayed`).
     * Returning true here — as this used to — meant a bot started playing for
     * anyone the instant their socket blinked.
     */
    private isBotControlled(seat: Seat): boolean {
        const slot = this.room.slotAt(seat)
        if (!slot) return true
        return slot.kind === "BOT"
    }

    private clearTimers(): void {
        if (this.turnTimer) clearTimeout(this.turnTimer)
        if (this.botTimer) clearTimeout(this.botTimer)
        if (this.dealDoneTimer) clearTimeout(this.dealDoneTimer)
        this.turnTimer = null
        this.botTimer = null
        this.dealDoneTimer = null
    }

    private schedule(): void {
        this.clearTimers()
        if (this.disposed) return
        const st = this.state

        if (this.declarationsUntil > Date.now()) {
            this.turnDeadline = null
            this.turnDurationMs = null
            this.scheduledSeat = null
            this.scheduledAsBot = null
            this.botTimer = unref(setTimeout(() => {
                this.declarationsUntil = 0
                this.schedule()
                this.broadcastState()
            }, this.declarationsUntil - Date.now()))
            return
        }

        if (st.phase === "GAME_OVER") {
            this.turnDeadline = null
            this.turnDurationMs = null
            this.scheduledSeat = null
            this.scheduledAsBot = null
            // `apply()` only reaches this branch once per game (the engine's
            // `reduce()` sets GAME_OVER exactly once, and once here neither
            // `apply()` nor `onPresenceChanged()` calls `schedule()` again —
            // see their guards), so this is exactly-once, not per-broadcast.
            this.analyticsTerminalReported = true
            reportGameCompleted(this.analyticsRunId, this.room, st, this.startedAt, this.autoPlayedActions)
            reportGameResult(this.room, st, this.analyticsRunId)
            this.room.liveActivity?.endAll(this.room, this.liveSnapshot())
            this.room.onGameOver()
            return
        }

        if (st.phase === "DEAL_DONE") {
            this.turnDeadline = null
            this.turnDurationMs = null
            this.scheduledSeat = null
            this.scheduledAsBot = null
            // The FALLBACK, not the pace (2026-09-20). Nobody has to press
            // anything — the summary is a receipt, not a decision — but the
            // clients say when they are done with it (`game.nextDeal`, one
            // ack per connected human seat) and the table moves the moment
            // the last of them has. This timer is what happens when an ack
            // never comes: an old client, a tab in the background, a seat
            // whose socket is limping. Each client dismisses its own summary
            // dialog BEFORE acking, so the next deal never lands behind an
            // open modal.
            this.dealDoneTimer = unref(
                setTimeout(() => {
                    this.dealDoneTimer = null
                    this.autoApply({ type: "NEXT_DEAL" })
                }, this.t.dealDoneAutoMs),
            )
            return
        }

        const seat = this.currentSeat()
        if (seat === null) return
        const asBot = this.isBotControlled(seat)
        this.scheduledSeat = seat
        this.scheduledAsBot = asBot

        if (asBot) {
            const delay = thinkDelay(this.t.botThinkMinMs, this.t.botThinkMaxMs)
            this.turnDeadline = Date.now() + delay
            this.turnDurationMs = delay
            this.botTimer = unref(
                setTimeout(() => {
                    this.botTimer = null
                    this.actForSeat(seat)
                }, delay),
            )
        } else {
            this.turnDeadline = Date.now() + this.t.turnTimeoutMs
            this.turnDurationMs = this.t.turnTimeoutMs
            this.turnTimer = unref(
                setTimeout(() => {
                    this.turnTimer = null
                    log.info("turn.timeout", { room: this.room.id, seat })
                    this.actForSeat(seat)
                }, this.t.turnTimeoutMs),
            )
        }
    }

    /** A seat connected or disconnected — re-evaluate who is on the clock. */
    onPresenceChanged(): void {
        if (this.disposed) return
        const st = this.state
        if (st.phase === "DEAL_DONE") {
            // Somebody we were waiting on may have just dropped: the deal is
            // held by the seats that are HERE, so re-count before re-arming.
            if (this.advanceIfAllAcked()) return
            this.schedule()
            return
        }
        const seat = this.currentSeat()
        const asBot = seat === null ? null : this.isBotControlled(seat)
        if (seat === this.scheduledSeat && asBot === this.scheduledAsBot) return
        this.schedule()
    }

    /* ───────────────────────── bot turns ───────────────────────── */

    /** Apply an action the server decided on (bot move, timeout, auto next deal). */
    private autoApply(action: GameAction, autoPlayed = true): void {
        if (this.disposed) return
        try {
            this.apply(action, autoPlayed)
        } catch (e) {
            log.error("auto.action.failed", { room: this.room.id, action: action.type, err: e })
            // Never leave the table stuck on a broken timer.
            this.schedule()
        }
    }

    private actForSeat(seat: Seat): void {
        if (this.disposed) return
        const st = this.state
        if (this.currentSeat() !== seat) return
        const slot = this.room.slotAt(seat)
        // Acting for a human (timeout or disconnect) is what `autoPlayed` marks.
        const autoPlayed = slot?.kind === "PLAYER"
        const bot = this.bot
        // `recallTricks` — the bot's memory, not the room's review setting
        // (README §1.8). A bot is stateless between moves, so without the
        // seat-attributed history it could not remember who discarded what two
        // tricks ago; those cards fell face up in front of everyone, so it is
        // recall, not hidden information. This also holds when the bot acts
        // FOR a human (timeout or disconnect, the `autoPlayed` flag): the
        // person it stands in for would have remembered the same public play.
        // Nothing else widens — the view that reaches a BROWSER is built in
        // `stateMessage`, and that one keeps the `trickReview` rule.
        const view = viewFor(st, seat, { recallTricks: true })

        try {
            if (st.phase === "BIDDING") {
                const legal = legalBids(st, seat)
                let choice: Suit | "PASS"
                try {
                    // A human who let the clock run out said nothing, and at
                    // a bela table nothing means "dalje" — the bot must not
                    // name a trump on their behalf (2026-09-20, user
                    // request). Only the forced call ("mus", no pass
                    // allowed) still needs the bot to pick a suit.
                    choice = autoPlayed && legal.canPass ? "PASS" : chooseBid(bot, view, legal)
                } catch (e) {
                    log.warn("bot.bid.threw", { room: this.room.id, seat, err: e })
                    choice = legal.canPass ? "PASS" : (legal.suits[0] ?? "HERC")
                }
                if (choice === "PASS" && !legal.canPass) choice = legal.suits[0] ?? "HERC"
                if (choice !== "PASS" && !legal.suits.includes(choice)) {
                    choice = legal.suits[0] ?? (legal.canPass ? "PASS" : "HERC")
                }
                this.autoApply(
                    choice === "PASS"
                        ? { type: "PASS", seat }
                        : { type: "BID", seat, trump: choice },
                    autoPlayed,
                )
                return
            }

            if (st.phase === "PLAYING") {
                const legal = legalMoves(st, seat)
                const fallback = legal[0]
                if (fallback === undefined) {
                    log.error("bot.play.noLegalMoves", { room: this.room.id, seat })
                    return
                }
                let card: Card
                try {
                    card = chooseCard(bot, view, legal)
                } catch (e) {
                    log.warn("bot.play.threw", { room: this.room.id, seat, err: e })
                    card = fallback
                }
                if (!legal.includes(card)) card = fallback
                // No `bela` flag, deliberately: nobody answered "Zovi belu?"
                // — the clock ran out, the seat is away, or it is a bot — and
                // no answer ANNOUNCES (README §1.4). Twenty points is a gain
                // on the large majority of deals, so silence must not cost
                // the player them. The bot follows the same rule.
                this.autoApply({ type: "PLAY", seat, card }, autoPlayed)
            }
        } catch (e) {
            log.error("bot.turn.failed", { room: this.room.id, seat, err: e })
            this.schedule()
        }
    }

    dispose(): void {
        this.disposed = true
        this.clearTimers()
    }

    abandon(reason: string): void {
        if (this.analyticsTerminalReported || this.state.phase === "GAME_OVER") return
        this.analyticsTerminalReported = true
        reportGameAbandoned(
            this.analyticsRunId,
            this.room,
            this.state,
            this.startedAt,
            this.autoPlayedActions,
            reason,
        )
    }
}

function toProtocolError(e: unknown): ProtocolError {
    if (e instanceof ProtocolError) return e
    if (e instanceof EngineError) return new ProtocolError(codeFromEngine(e.code), e.message)
    if (typeof e === "object" && e !== null) {
        const maybe = e as { name?: unknown; code?: unknown; message?: unknown }
        if (maybe.name === "EngineError" && typeof maybe.code === "string") {
            const message = typeof maybe.message === "string" ? maybe.message : undefined
            return new ProtocolError(codeFromEngine(maybe.code), message)
        }
    }
    log.error("game.unexpected", { err: e })
    return new ProtocolError("BAD_REQUEST", "Neispravan potez.")
}
