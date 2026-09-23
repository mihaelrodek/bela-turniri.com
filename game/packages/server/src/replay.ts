/* ──────────────────────────────────────────────────────────────────────────
   ZAPIS PARTIJE — the full replay of one finished game (README §8.8).

   WHY THIS EXISTS. The bot is tuned against hand-written scenarios and
   self-play simulations, both of which only ever show it the positions we
   already thought of. A replay archive of games REAL people played is the one
   source of positions nobody designed: the deal that fell apart, the discard
   that gave a trick away, the bid that should not have been made. One JSON
   document per game, stored in Postgres, read later by hand or by a script
   (`game/BOT.md` → "Zapisi partija").

   WHAT THIS MODULE IS. A pure, in-memory RECORDER that watches the engine.
   `GameRoom.apply()` hands it every (before, after, events) triple; it keeps
   what the engine itself does not.

   WHY IT HAS TO KEEP ANYTHING AT ALL. `GameState.history` is `DealScore[]` —
   the arithmetic of each deal and nothing else. The CARDS are gone the moment
   the next deal starts: `startDeal` builds a brand-new state with fresh
   `hands` and an empty `tricksWon`, and the previous deal's eight tricks are
   not carried anywhere. So the hands and the tricks must be captured while
   the deal is live, which is exactly what `observe` does.

   PRIVACY. The document holds seat names, the game's own cards and its
   arithmetic. NOTHING ELSE: no tokens, no e-mail, no room codes, no private
   share links. A `DEMO` seat's `demo:` uid never enters (`buildSeats`), the
   same rule `statsReporter` applies to everything it sends.

   HANDS ARE RECORDED IN FULL, all 32 cards of every deal, INCLUDING the hands
   a player never saw. That is deliberate and safe: the game is over and the
   document is never shown to a player — it goes to an admin-only export. A
   replay with only one seat's cards would be useless for exactly the question
   it exists to answer ("what should the bot have done here?").
   ────────────────────────────────────────────────────────────────────── */

import { BOT_VERSION } from "@bela/bots"
import { seatFrom, teamOf } from "@bela/engine"
import type {
    Card,
    Declaration,
    DealScore,
    GameEndRule,
    GameEvent,
    GameState,
    Seat,
    Suit,
    Team,
    TrickCard,
    TrickReview,
} from "@bela/engine"
import type { Room, SeatSlot } from "./room.js"

const SEATS: readonly Seat[] = [0, 1, 2, 3]

/**
 * Hard ceiling on recorded deals. A 1001 game is typically 8-14 deals and a
 * pathological one maybe 40; 64 is far above anything real and still bounds
 * the memory one room can hold while it plays. Past it the recorder stops
 * appending and says so (`truncated`) rather than growing without a limit —
 * a truncated replay is still useful, an unbounded one is a leak.
 */
export const MAX_RECORDED_DEALS = 64

/** One bidding action, in the order it happened. */
export interface ReplayBid {
    seat: Seat
    action: "PASS" | "CALL"
    /** Only on a CALL. */
    trump?: Suit
    /** Only on a CALL: the dealer had no pass left ("mus"). */
    forced?: boolean
}

/** One completed trick, exactly as the engine resolved it. */
export interface ReplayTrick {
    /** 1-based within the deal. */
    no: number
    leader: Seat
    plays: TrickCard[]
    winner: Seat
}

/** What one seat held in declarations this deal (README §1.4). */
export interface ReplayDeclaration {
    seat: Seat
    kind: Declaration["kind"]
    cards: Card[]
    points: Declaration["points"]
}

export interface ReplayDeal {
    dealNo: number
    dealer: Seat
    /**
     * The COMPLETE hand of each seat as dealt — all eight cards, so the four
     * hands together are the whole 32-card deck. Captured at
     * `HAND_COMPLETED`, i.e. after the second round is dealt and before a
     * single card is played.
     *
     * Absent (`null`) only for a deal that never got that far: the game was
     * abandoned or decided during the bidding of its last deal.
     */
    hands: Record<Seat, Card[]> | null
    /**
     * Which two of those eight came from the talon — the second round of
     * dealing, which the engine DOES distinguish (`GameState.stock`, dealt
     * 2-2-2-2 from the seat after the dealer). Worth keeping separately: the
     * first six are what a player bid on, the last two are what they got.
     */
    talon: Record<Seat, Card[]> | null
    bidding: ReplayBid[]
    declarations: ReplayDeclaration[]
    /** Which side actually scored its declarations; null = nobody declared. */
    declarationsScoringTeam: Team | null
    /** Team that announced bela, or null. */
    belaDeclared: Team | null
    /** Seat that DECLINED a bela it held, or null (README §1.4). */
    belaRefused: Seat | null
    /** Eight cards of one suit in one hand — the deal was not played. */
    belot: { seat: Seat; suit: Suit } | null
    tricks: ReplayTrick[]
    /** The settled deal, or null when the deal was cut short by `dosta`. */
    dealScore: DealScore | null
    /** Running game score AFTER this deal was booked. */
    runningScore: Record<Team, number>
}

/** One seat at the table, as the analytics wire already describes it (§8.7). */
export interface ReplaySeat {
    seat: Seat
    team: Team
    kind: "PLAYER" | "GUEST" | "BOT" | "DEMO"
    /** Firebase uid, or null for a guest, a bot and a demo seat. */
    uid: string | null
    name: string
}

/** The document stored in `game_replays.replay`. */
export interface GameReplay {
    /** Bump when the SHAPE below changes incompatibly. */
    version: 1
    /** `@bela/bots`' own stamp — which bot played this. */
    botVersion: string
    settings: {
        targetScore: number
        gameEndRule: GameEndRule
        noDeclarations: boolean
        allowBela: boolean
        trickReview: TrickReview
    }
    seats: ReplaySeat[]
    deals: ReplayDeal[]
    winner: Team
    scoreA: number
    scoreB: number
    dealsCount: number
    playedAt: string
    durationMs: number
    /** Present only when the deal cap cut the record short. */
    truncated?: true
}

function emptyCards(): Record<Seat, Card[]> {
    return { 0: [], 1: [], 2: [], 3: [] }
}

/** Name as shown above the seat, bounded like the backend column. */
function trimName(raw: string | null | undefined, fallback: string): string {
    const name = (raw ?? "").trim()
    return (name.length === 0 ? fallback : name).slice(0, 64)
}

function seatOf(slot: SeatSlot, seat: Seat): ReplaySeat {
    const team = teamOf(seat)
    if (slot !== null && slot.kind === "BOT") {
        return { seat, team, kind: "BOT", uid: null, name: trimName(slot.name, "Bot") }
    }
    if (slot !== null && slot.kind === "DEMO") {
        // A fake person's uid (`demo:…`) never leaves this process — the same
        // rule `statsReporter.seatPlayer` enforces on the stats wire.
        return { seat, team, kind: "DEMO", uid: null, name: trimName(slot.identity.name, "Demo") }
    }
    if (slot !== null && slot.kind === "PLAYER") {
        const guest = slot.user.guest === true
        return {
            seat,
            team,
            kind: guest ? "GUEST" : "PLAYER",
            // A guest has no account, so there is no uid to record — their
            // in-game name is the only handle, exactly as in §8.7.
            uid: guest ? null : slot.uid,
            name: trimName(slot.user.name, guest ? "Gost" : "Igrač"),
        }
    }
    return { seat, team, kind: "BOT", uid: null, name: "Bot" }
}

/**
 * Watches one game and keeps what the engine throws away.
 *
 * One instance per {@link GameRoom}; `observe` is called once per reduction,
 * `build` once at GAME_OVER.
 */
export class ReplayRecorder {
    private readonly deals: ReplayDeal[] = []
    private readonly startedAt: number
    private truncated = false

    constructor(initial: GameState, startedAt: number) {
        this.startedAt = startedAt
        // Deal 1 is dealt by `newGame`, before the recorder ever sees an
        // action, so it is opened here; every later deal arrives as `DEALT`.
        this.openDeal(initial.dealNo, initial.dealer, initial.score)
    }

    /** How many deals are on record (for tests and logging). */
    get dealCount(): number {
        return this.deals.length
    }

    private openDeal(dealNo: number, dealer: Seat, score: Record<Team, number>): void {
        if (this.deals.length >= MAX_RECORDED_DEALS) {
            this.truncated = true
            return
        }
        this.deals.push({
            dealNo,
            dealer,
            hands: null,
            talon: null,
            bidding: [],
            declarations: [],
            declarationsScoringTeam: null,
            belaDeclared: null,
            belaRefused: null,
            belot: null,
            tricks: [],
            dealScore: null,
            runningScore: { ...score },
        })
    }

    /** The deal currently being recorded, or undefined past the cap. */
    private current(): ReplayDeal | undefined {
        return this.deals[this.deals.length - 1]
    }

    /**
     * Record one engine transition.
     *
     * `before` is needed for exactly one thing — the talon. By the time the
     * BID has been reduced, `after.stock` is empty (the cards are in the
     * hands), so which two each seat received can only be read from the state
     * as it was.
     */
    observe(before: GameState, after: GameState, events: readonly GameEvent[]): void {
        for (const event of events) {
            switch (event.type) {
                case "DEALT":
                    this.openDeal(event.dealNo, event.dealer, after.score)
                    break
                case "PASS":
                    this.current()?.bidding.push({ seat: event.seat, action: "PASS" })
                    break
                case "TRUMP_SET":
                    // The CALL, not the raw `BID` event: only this one knows
                    // whether the dealer was forced ("mus"), which is the
                    // difference between a bad bid and no choice at all.
                    this.current()?.bidding.push({
                        seat: event.caller,
                        action: "CALL",
                        trump: event.trump,
                        forced: event.forced,
                    })
                    break
                case "HAND_COMPLETED":
                    this.captureHands(before, after)
                    break
                case "BELOT":
                    {
                        const deal = this.current()
                        if (deal) deal.belot = { seat: event.seat, suit: event.suit }
                    }
                    break
                case "TRICK_WON":
                    this.current()?.tricks.push({
                        no: event.trickNo,
                        // `plays[0]` is the opening card by construction, so
                        // the leader is read off the record rather than
                        // re-derived from a win chain.
                        leader: (event.cards[0]?.seat ?? after.trick.leader),
                        plays: event.cards.map((c) => ({ ...c })),
                        winner: event.winner,
                    })
                    break
                case "DEAL_SCORED":
                    {
                        const deal = this.current()
                        if (deal) deal.dealScore = event.dealScore
                    }
                    break
                default:
                    break
            }
        }
        // Read off the END state of the transition, not off an event: a bela
        // REFUSAL has no event by design (announcing "seat 2 declined" would
        // publish the very holding the player is hiding), and the running
        // score only settles once the deal is booked.
        const deal = this.current()
        if (deal !== undefined && deal.dealNo === after.dealNo) {
            deal.belaDeclared = after.belaDeclared
            deal.belaRefused = after.belaRefused
            deal.runningScore = { ...after.score }
        }
    }

    /**
     * The eight-card hands, the talon split, and every seat's declarations —
     * all of it exists for exactly one instant: after `HAND_COMPLETED` and
     * before the first card is played.
     */
    private captureHands(before: GameState, after: GameState): void {
        const deal = this.current()
        if (deal === undefined || deal.hands !== null) return

        const hands = emptyCards()
        for (const seat of SEATS) hands[seat] = after.hands[seat].slice()
        deal.hands = hands

        // The second round of dealing: 2 cards each from `stock`, starting at
        // the seat after the dealer — the same walk `dealStock` does, so the
        // split is the engine's, not a guess.
        const talon = emptyCards()
        for (let step = 0; step < 4; step++) {
            const seat = seatFrom(before.dealer + 1 + step)
            talon[seat] = before.stock.slice(step * 2, step * 2 + 2)
        }
        deal.talon = talon

        // EVERY seat's declarations, including the pair that lost the contest
        // and never showed them. Lost at the table, but this is analysis after
        // the fact and "what did the other side hold?" is half the question.
        for (const seat of SEATS) {
            for (const decl of after.declarations[seat]) {
                deal.declarations.push({
                    seat,
                    kind: decl.kind,
                    cards: decl.cards.slice(),
                    points: decl.points,
                })
            }
        }
        deal.declarationsScoringTeam = after.declarationsScoringTeam
    }

    /**
     * The finished document, or null when the game has no winner (nothing to
     * study in a game that never ended).
     */
    build(room: Room, state: GameState): GameReplay | null {
        if (state.winner === null) return null
        const replay: GameReplay = {
            version: 1,
            botVersion: BOT_VERSION,
            settings: {
                targetScore: room.targetScore,
                gameEndRule: room.gameEndRule,
                noDeclarations: room.noDeclarations,
                allowBela: room.allowBela,
                trickReview: room.trickReview,
            },
            seats: SEATS.map((seat) => seatOf(room.slotAt(seat), seat)),
            deals: this.deals,
            winner: state.winner,
            scoreA: state.score.A,
            scoreB: state.score.B,
            // The engine's own count, not `deals.length`: past the cap they
            // differ, and the true number is the one worth recording.
            dealsCount: state.history.length,
            playedAt: new Date(this.startedAt).toISOString(),
            durationMs: Math.max(0, Date.now() - this.startedAt),
        }
        if (this.truncated) replay.truncated = true
        return replay
    }
}
