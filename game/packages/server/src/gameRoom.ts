/* ──────────────────────────────────────────────────────────────────────────
   The authoritative game inside a started room (README §3 "Igra", "Timeri").

   Holds the full `GameState` — which never leaves this process. Every member
   receives only `viewFor(state, theirSeat)`; spectators get `viewFor(state, null)`.

   Turn handling:
     • connected human on turn  → `turnTimeoutMs` deadline; on expiry the seat's
       bot acts for them and the next `game.state` carries `autoPlayed: true`
     • bot / disconnected human → the bot acts after a random think delay
     • DEAL_DONE                → any seated human may send `game.nextDeal`
       (first one wins); with nobody connected it auto-advances after 4 s
     • GAME_OVER                → the room is marked FINISHED
   ────────────────────────────────────────────────────────────────────── */

import {
    EngineError,
    legalBids,
    legalMoves,
    newGame,
    reduce,
    viewFor,
} from "@bela/engine"
import type { Card, GameAction, GameEvent, GameState, PlayerView, Seat, Suit } from "@bela/engine"
import type { ServerMessage } from "@bela/protocol"
import type { Timings } from "./config.js"
import { codeFromEngine, ProtocolError } from "./errors.js"
import { chooseBid, chooseCard, DEFAULT_BOT_LEVEL, makeBot, thinkDelay } from "./bots.js"
import type { Bot } from "./bots.js"
import { newSeed } from "./ids.js"
import { log } from "./log.js"
import type { Room } from "./room.js"
import type { Connection } from "./ws.js"

import type { BotLevel } from "@bela/protocol"

interface SeatBot {
    level: BotLevel
    bot: Bot
}

type Timer = ReturnType<typeof setTimeout>

function unref(t: Timer): Timer {
    if (typeof t.unref === "function") t.unref()
    return t
}

export class GameRoom {
    state: GameState

    private readonly room: Room
    private readonly t: Timings
    private readonly bots: Map<Seat, SeatBot>
    private turnTimer: Timer | null
    private botTimer: Timer | null
    private dealDoneTimer: Timer | null
    private turnDeadline: number | null
    private lastAutoPlayed: boolean
    private scheduledSeat: Seat | null
    private scheduledAsBot: boolean | null
    private disposed: boolean

    constructor(room: Room, timings: Timings) {
        this.room = room
        this.t = timings
        this.bots = new Map()
        this.turnTimer = null
        this.botTimer = null
        this.dealDoneTimer = null
        this.turnDeadline = null
        this.lastAutoPlayed = false
        this.scheduledSeat = null
        this.scheduledAsBot = null
        this.disposed = false
        this.state = newGame({ targetScore: room.targetScore, seed: newSeed() })
    }

    /** First broadcast + first timer, right after `room.start`. */
    begin(): void {
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

    play(conn: Connection, card: Card): void {
        this.applyChecked({ type: "PLAY", seat: this.seatOf(conn), card }, false)
    }

    nextDeal(conn: Connection): void {
        this.seatOf(conn)
        // "First one wins": a second confirmation for the same deal is a no-op.
        if (this.state.phase !== "DEAL_DONE") return
        this.applyChecked({ type: "NEXT_DEAL" }, false)
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
        const result = reduce(this.state, action)
        this.state = result.state
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
            cache.set(seat, view)
        }
        return {
            t: "game.state",
            view,
            turnDeadline: this.turnDeadline,
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

    private isBotControlled(seat: Seat): boolean {
        const slot = this.room.slotAt(seat)
        if (!slot) return true
        if (slot.kind === "BOT") return true
        return !slot.connected
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

        if (st.phase === "GAME_OVER") {
            this.turnDeadline = null
            this.scheduledSeat = null
            this.scheduledAsBot = null
            this.room.onGameOver()
            return
        }

        if (st.phase === "DEAL_DONE") {
            this.turnDeadline = null
            this.scheduledSeat = null
            this.scheduledAsBot = null
            if (!this.room.hasConnectedHuman()) {
                this.dealDoneTimer = unref(
                    setTimeout(() => {
                        this.dealDoneTimer = null
                        this.autoApply({ type: "NEXT_DEAL" })
                    }, this.t.dealDoneAutoMs),
                )
            }
            return
        }

        const seat = this.currentSeat()
        if (seat === null) return
        const asBot = this.isBotControlled(seat)
        this.scheduledSeat = seat
        this.scheduledAsBot = asBot

        if (asBot) {
            this.turnDeadline = null
            const delay = thinkDelay(this.t.botThinkMinMs, this.t.botThinkMaxMs)
            this.botTimer = unref(
                setTimeout(() => {
                    this.botTimer = null
                    this.actForSeat(seat)
                }, delay),
            )
        } else {
            this.turnDeadline = Date.now() + this.t.turnTimeoutMs
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
            this.schedule()
            return
        }
        const seat = this.currentSeat()
        const asBot = seat === null ? null : this.isBotControlled(seat)
        if (seat === this.scheduledSeat && asBot === this.scheduledAsBot) return
        this.schedule()
    }

    /* ───────────────────────── bot turns ───────────────────────── */

    private botForSeat(seat: Seat): Bot {
        const slot = this.room.slotAt(seat)
        const level: BotLevel = slot && slot.kind === "BOT" ? slot.level : DEFAULT_BOT_LEVEL
        const existing = this.bots.get(seat)
        if (existing && existing.level === level) return existing.bot
        const bot = makeBot(level)
        this.bots.set(seat, { level, bot })
        return bot
    }

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
        const bot = this.botForSeat(seat)
        const view = viewFor(st, seat)

        try {
            if (st.phase === "BIDDING") {
                const legal = legalBids(st, seat)
                let choice: Suit | "PASS"
                try {
                    choice = chooseBid(bot, view, legal)
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
        this.bots.clear()
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
