import { describe, expect, it } from "vitest"
import type { Card, GameAction, GameEvent, GameState, Seat, Suit } from "../src/index"
import {
    SEATS,
    SUITS,
    cardSuit,
    legalBids,
    legalMoves,
    newGame,
    nextSeat,
    reduce,
    sortHand,
} from "../src/index"
import { allCards, expectEngineError, playing } from "./helpers"

const cfg = (seed: string, targetScore: 501 | 1001 = 1001) => ({ targetScore, seed })

/** Bid the longest suit (4+ cards), otherwise pass; while playing, take the first legal card. */
function nextAction(state: GameState): GameAction {
    if (state.phase === "BIDDING") {
        const seat = state.bidding.turn
        const counts = new Map<Suit, number>()
        for (const card of state.hands[seat]) {
            const suit = cardSuit(card)
            counts.set(suit, (counts.get(suit) ?? 0) + 1)
        }
        let best: Suit = "HERC"
        let bestCount = -1
        for (const suit of SUITS) {
            const n = counts.get(suit) ?? 0
            if (n > bestCount) {
                best = suit
                bestCount = n
            }
        }
        if (!legalBids(state, seat).canPass || bestCount >= 4) {
            return { type: "BID", seat, trump: best }
        }
        return { type: "PASS", seat }
    }
    if (state.phase === "PLAYING") {
        const seat = state.trick.turn
        return { type: "PLAY", seat, card: legalMoves(state, seat)[0] as Card }
    }
    return { type: "NEXT_DEAL" }
}

function playFirstLegal(
    start: GameState,
    maxSteps: number,
): { state: GameState; events: GameEvent[] } {
    let state = start
    const events: GameEvent[] = []
    for (let i = 0; i < maxSteps && state.phase !== "GAME_OVER"; i++) {
        const next = reduce(state, nextAction(state))
        state = next.state
        events.push(...next.events)
    }
    return { state, events }
}

/** Everyone passes so the dealer is forced to call. */
function forceDealerToCall(start: GameState): { state: GameState; events: GameEvent[] } {
    let state = start
    const events: GameEvent[] = []
    while (state.bidding.passes.length < 3) {
        const passed = reduce(state, { type: "PASS", seat: state.bidding.turn })
        state = passed.state
        events.push(...passed.events)
    }
    const called = reduce(state, { type: "BID", seat: state.bidding.turn, trump: "HERC" })
    return { state: called.state, events: [...events, ...called.events] }
}

describe("newGame (README §1.2)", () => {
    it("deals six cards each, keeps eight in the stock and opens the bidding", () => {
        const state = newGame(cfg("s1"))
        expect(state.dealNo).toBe(1)
        expect(state.phase).toBe("BIDDING")
        expect(state.stock).toHaveLength(8)
        for (const seat of SEATS) expect(state.hands[seat]).toHaveLength(6)
        expect(state.bidding).toEqual({
            turn: nextSeat(state.dealer),
            passes: [],
            trump: null,
            caller: null,
        })
        expect(state.trick).toEqual({
            leader: nextSeat(state.dealer),
            turn: nextSeat(state.dealer),
            cards: [],
        })
        expect(state.score).toEqual({ A: 0, B: 0 })
        expect(state.history).toEqual([])
        expect(state.declarationsScoringTeam).toBeNull()
        expect(state.belaDeclared).toBeNull()
        expect(state.winner).toBeNull()
    })

    it("uses all 32 cards exactly once and keeps hands sorted", () => {
        const state = newGame(cfg("s2"))
        const cards = allCards(state)
        expect(cards).toHaveLength(32)
        expect(new Set(cards).size).toBe(32)
        for (const seat of SEATS) {
            expect(state.hands[seat]).toEqual(sortHand(state.hands[seat]))
        }
    })

    it("picks the first dealer from the seed and is fully deterministic", () => {
        expect(newGame(cfg("same"))).toEqual(newGame(cfg("same")))
        const dealers = new Set(
            ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((s) => newGame(cfg(s)).dealer),
        )
        expect(dealers.size).toBeGreaterThan(1)
    })

    it("different seeds deal different hands", () => {
        expect(newGame(cfg("x")).hands).not.toEqual(newGame(cfg("y")).hands)
    })
})

describe("bidding (README §1.2)", () => {
    it("rejects a bid or a pass from the wrong seat", () => {
        const state = newGame(cfg("bid1"))
        const wrong = ((state.bidding.turn + 1) % 4) as Seat
        expectEngineError(
            () => reduce(state, { type: "BID", seat: wrong, trump: "PIK" }),
            "NOT_YOUR_TURN",
        )
        expectEngineError(() => reduce(state, { type: "PASS", seat: wrong }), "NOT_YOUR_TURN")
    })

    it("rejects an unknown suit and an unknown action", () => {
        const state = newGame(cfg("bid2"))
        expectEngineError(
            () =>
                reduce(state, {
                    type: "BID",
                    seat: state.bidding.turn,
                    trump: "SRCE" as unknown as Suit,
                }),
            "BAD_REQUEST",
        )
        expectEngineError(
            () => reduce(state, { type: "SURRENDER" } as unknown as GameAction),
            "BAD_REQUEST",
        )
    })

    it("moves the turn on after a pass and records it", () => {
        const state = newGame(cfg("bid3"))
        const first = state.bidding.turn
        const step = reduce(state, { type: "PASS", seat: first })
        expect(step.events).toEqual([{ type: "PASS", seat: first }])
        expect(step.state.bidding.passes).toEqual([first])
        expect(step.state.bidding.turn).toBe(nextSeat(first))
        expect(step.state.phase).toBe("BIDDING")
    })

    it("forces the dealer to call after three passes (mus)", () => {
        let state = newGame(cfg("mus"))
        for (let i = 0; i < 3; i++) {
            state = reduce(state, { type: "PASS", seat: state.bidding.turn }).state
        }
        expect(state.bidding.turn).toBe(state.dealer)
        expect(legalBids(state, state.dealer)).toEqual({ canPass: false, suits: [...SUITS] })
        expectEngineError(
            () => reduce(state, { type: "PASS", seat: state.dealer }),
            "ILLEGAL_MOVE",
        )
        const step = reduce(state, { type: "BID", seat: state.dealer, trump: "PIK" })
        expect(step.events[1]).toEqual({
            type: "TRUMP_SET",
            trump: "PIK",
            caller: state.dealer,
            forced: true,
        })
    })

    it("marks a voluntary call as not forced", () => {
        const state = newGame(cfg("free"))
        const seat = state.bidding.turn
        const step = reduce(state, { type: "BID", seat, trump: "TREF" })
        expect(step.events[0]).toEqual({ type: "BID", seat, trump: "TREF" })
        expect(step.events[1]).toEqual({
            type: "TRUMP_SET",
            trump: "TREF",
            caller: seat,
            forced: false,
        })
    })

    it("completes the hands to eight cards and computes declarations", () => {
        const state = newGame(cfg("hand"))
        const step = reduce(state, { type: "BID", seat: state.bidding.turn, trump: "HERC" })
        const next = step.state
        expect(step.events.map((e) => e.type)).toEqual(["BID", "TRUMP_SET", "HAND_COMPLETED"])
        expect(next.phase).toBe("PLAYING")
        expect(next.stock).toEqual([])
        for (const seat of SEATS) {
            expect(next.hands[seat]).toHaveLength(8)
            expect(next.hands[seat]).toEqual(sortHand(next.hands[seat]))
        }
        expect(allCards(next)).toHaveLength(32)
        expect(new Set(allCards(next)).size).toBe(32)
        expect(next.trick).toEqual({
            leader: nextSeat(next.dealer),
            turn: nextSeat(next.dealer),
            cards: [],
        })
        expect(next.bidding.trump).toBe("HERC")
        expect(next.bidding.caller).toBe(state.bidding.turn)
    })

    it("refuses to play before a trump is set", () => {
        const state = newGame(cfg("early"))
        const seat = state.trick.turn
        const card = state.hands[seat][0] as Card
        expectEngineError(() => reduce(state, { type: "PLAY", seat, card }), "BAD_PHASE")
    })

    it("the forced route still produces a playable deal", () => {
        const { state, events } = forceDealerToCall(newGame(cfg("forced")))
        expect(events.filter((e) => e.type === "PASS")).toHaveLength(3)
        expect(state.phase).toBe("PLAYING")
        for (const seat of SEATS) expect(state.hands[seat]).toHaveLength(8)
        expect(state.bidding.caller).toBe(state.dealer)
    })
})

describe("playing (README §1.5)", () => {
    it("rejects a card that is not in hand, an illegal one, and the wrong seat", () => {
        const state = playing({
            trump: "HERC",
            leader: 0,
            cards: [{ seat: 0, card: "APIK" }],
            hands: { 1: ["7PIK", "KPIK", "9HERC"] },
        })
        expectEngineError(
            () => reduce(state, { type: "PLAY", seat: 1, card: "AKARA" }),
            "ILLEGAL_MOVE",
        )
        expectEngineError(
            () => reduce(state, { type: "PLAY", seat: 1, card: "9HERC" }),
            "ILLEGAL_MOVE",
        )
        expectEngineError(
            () => reduce(state, { type: "PLAY", seat: 2, card: "7PIK" }),
            "NOT_YOUR_TURN",
        )
    })

    it("keeps the trick open until the fourth card", () => {
        const state = playing({
            trump: "HERC",
            leader: 0,
            hands: { 0: ["APIK", "8TREF"] },
        })
        const step = reduce(state, { type: "PLAY", seat: 0, card: "APIK" })
        expect(step.events).toEqual([{ type: "CARD_PLAYED", seat: 0, card: "APIK" }])
        expect(step.state.trick).toEqual({
            leader: 0,
            turn: 1,
            cards: [{ seat: 0, card: "APIK" }],
        })
        expect(step.state.hands[0]).toEqual(["8TREF"])
    })

    it("resolves the trick on the fourth card and emits TRICK_WON", () => {
        const state = playing({
            trump: "HERC",
            leader: 0,
            cards: [
                { seat: 0, card: "APIK" },
                { seat: 1, card: "7PIK" },
                { seat: 2, card: "10PIK" },
            ],
            hands: { 3: ["KPIK", "8TREF"] },
        })
        const step = reduce(state, { type: "PLAY", seat: 3, card: "KPIK" })
        expect(step.events.map((e) => e.type)).toEqual([
            "CARD_PLAYED",
            "TRICK_WON",
            "DECLARATIONS_REVEALED",
        ])
        expect(step.events[1]).toMatchObject({
            type: "TRICK_WON",
            winner: 0,
            points: 11 + 10 + 4,
            trickNo: 1,
        })
        expect(step.state.tricksWon.A).toHaveLength(1)
        expect(step.state.tricksWon.A[0]?.cards).toEqual(["APIK", "7PIK", "10PIK", "KPIK"])
        expect(step.state.tricksWon.B).toHaveLength(0)
        expect(step.state.trick).toEqual({ leader: 0, turn: 0, cards: [] })
        expect(step.state.hands[3]).toEqual(["8TREF"])
    })

    it("reveals declarations only once, after the first trick", () => {
        const first = playing({
            trump: "HERC",
            leader: 0,
            cards: [
                { seat: 0, card: "APIK" },
                { seat: 1, card: "7PIK" },
                { seat: 2, card: "10PIK" },
            ],
            hands: { 3: ["KPIK"] },
        })
        const afterFirst = reduce(first, { type: "PLAY", seat: 3, card: "KPIK" })
        expect(afterFirst.events.some((e) => e.type === "DECLARATIONS_REVEALED")).toBe(true)

        const second = playing({
            trump: "HERC",
            leader: 0,
            cards: [
                { seat: 0, card: "AKARA" },
                { seat: 1, card: "7KARA" },
                { seat: 2, card: "10KARA" },
            ],
            hands: { 3: ["KKARA"] },
        })
        second.tricksWon.A = [{ winner: 0, cards: ["APIK", "7PIK", "10PIK", "KPIK"] }]
        const afterSecond = reduce(second, { type: "PLAY", seat: 3, card: "KKARA" })
        expect(afterSecond.events.some((e) => e.type === "DECLARATIONS_REVEALED")).toBe(false)
    })

    it("announces bela when the first of trump K/Q is played", () => {
        const state = playing({
            trump: "HERC",
            leader: 0,
            hands: { 0: ["QHERC", "KHERC", "APIK"] },
        })
        const first = reduce(state, { type: "PLAY", seat: 0, card: "KHERC" })
        expect(first.events).toContainEqual({ type: "BELA", seat: 0 })
        expect(first.state.belaDeclared).toBe("A")

        // Playing the second of the pair later announces nothing new.
        const later = playing({ trump: "HERC", leader: 0, hands: { 0: ["QHERC", "APIK"] } })
        const second = reduce(later, { type: "PLAY", seat: 0, card: "QHERC" })
        expect(second.events.some((e) => e.type === "BELA")).toBe(false)
        expect(second.state.belaDeclared).toBeNull()
    })

    it("announces bela for team B as well, starting from the queen", () => {
        const state = playing({
            trump: "PIK",
            leader: 1,
            hands: { 1: ["KPIK", "QPIK", "AHERC"] },
        })
        const step = reduce(state, { type: "PLAY", seat: 1, card: "QPIK" })
        expect(step.events).toContainEqual({ type: "BELA", seat: 1 })
        expect(step.state.belaDeclared).toBe("B")
    })

    it("does not announce bela for a non-trump K/Q pair", () => {
        const state = playing({ trump: "HERC", leader: 0, hands: { 0: ["KPIK", "QPIK"] } })
        const step = reduce(state, { type: "PLAY", seat: 0, card: "KPIK" })
        expect(step.events.some((e) => e.type === "BELA")).toBe(false)
        expect(step.state.belaDeclared).toBeNull()
    })
})

describe("immutability and determinism", () => {
    it("reduce never mutates the state it is given", () => {
        let state = newGame(cfg("immutable"))
        const actions: GameAction[] = [
            { type: "PASS", seat: state.bidding.turn },
            { type: "BID", seat: nextSeat(state.bidding.turn), trump: "HERC" },
        ]
        for (const action of actions) {
            const snapshot = structuredClone(state)
            const step = reduce(state, action)
            expect(state).toEqual(snapshot)
            expect(step.state).not.toBe(state)
            state = step.state
        }
        for (let i = 0; i < 4; i++) {
            const seat = state.trick.turn
            const card = legalMoves(state, seat)[0] as Card
            const snapshot = structuredClone(state)
            const step = reduce(state, { type: "PLAY", seat, card })
            expect(state).toEqual(snapshot)
            state = step.state
        }
    })

    it("leaves the state untouched when it throws", () => {
        const state = newGame(cfg("throwing"))
        const snapshot = structuredClone(state)
        expectEngineError(() => reduce(state, { type: "NEXT_DEAL" }), "BAD_PHASE")
        expect(state).toEqual(snapshot)
    })

    it("the same seed and the same actions give a deep-equal state", () => {
        const a = playFirstLegal(newGame(cfg("determinism")), 60)
        const b = playFirstLegal(newGame(cfg("determinism")), 60)
        expect(a.state).toEqual(b.state)
        expect(a.events).toEqual(b.events)
    })

    it("a different seed diverges", () => {
        const a = playFirstLegal(newGame(cfg("seed-a")), 60)
        const b = playFirstLegal(newGame(cfg("seed-b")), 60)
        expect(a.state).not.toEqual(b.state)
    })
})

describe("a full deterministic game (README §1.6, §1.7)", () => {
    it("runs from the seed to GAME_OVER while every invariant holds", () => {
        let state = newGame(cfg("full-game-1"))
        let steps = 0
        let lastScore = { A: 0, B: 0 }
        let deals = 0

        while (state.phase !== "GAME_OVER") {
            steps++
            expect(steps).toBeLessThan(5000)

            // Nothing is ever lost or duplicated.
            const cards = allCards(state)
            expect(cards).toHaveLength(32)
            expect(new Set(cards).size).toBe(32)

            if (state.phase === "PLAYING") {
                expect(state.trick.cards.length).toBeLessThan(4)
                const sizes = SEATS.map((s) => state.hands[s].length)
                const max = Math.max(...sizes)
                for (const s of SEATS) {
                    const alreadyPlayed = state.trick.cards.some((c) => c.seat === s) ? 1 : 0
                    expect(state.hands[s].length).toBe(max - alreadyPlayed)
                }
            }

            const before = state
            const result = reduce(state, nextAction(state))
            state = result.state

            for (const event of result.events) {
                if (event.type !== "DEAL_SCORED") continue
                deals++
                const { dealScore } = event
                const cardTotal = dealScore.cardPoints.A + dealScore.cardPoints.B
                expect(cardTotal).toBe(dealScore.stiglja === null ? 162 : 252)
                expect(dealScore.total.A + dealScore.total.B).toBe(
                    cardTotal + dealScore.declarationPoints.A + dealScore.declarationPoints.B,
                )
                expect(state.tricksWon.A.length + state.tricksWon.B.length).toBe(8)
                expect(state.phase).toBe("DEAL_DONE")
                if (!dealScore.passed) expect(dealScore.total[dealScore.callerTeam]).toBe(0)
            }

            expect(state.score.A).toBeGreaterThanOrEqual(lastScore.A)
            expect(state.score.B).toBeGreaterThanOrEqual(lastScore.B)
            lastScore = state.score
            expect(state.dealNo).toBeGreaterThanOrEqual(before.dealNo)
        }

        expect(deals).toBeGreaterThan(1)
        expect(state.history).toHaveLength(deals)
        expect(state.winner).not.toBeNull()
        const winner = state.winner as "A" | "B"
        const loser = winner === "A" ? "B" : "A"
        expect(state.score[winner]).toBeGreaterThanOrEqual(1001)
        expect(state.score[winner]).toBeGreaterThan(state.score[loser])
        expect(state.score.A + state.score.B).toBe(
            state.history.reduce((sum, d) => sum + d.total.A + d.total.B, 0),
        )
    })

    it("plays a 501 game too, rotating the dealer each deal", () => {
        let state = newGame(cfg("full-game-501", 501))
        const dealers: Seat[] = [state.dealer]
        let steps = 0
        while (state.phase !== "GAME_OVER") {
            expect(steps++).toBeLessThan(5000)
            const before = state.dealNo
            state = reduce(state, nextAction(state)).state
            if (state.dealNo !== before) dealers.push(state.dealer)
        }
        expect(dealers.length).toBeGreaterThan(1)
        for (let i = 1; i < dealers.length; i++) {
            expect(dealers[i]).toBe(nextSeat(dealers[i - 1] as Seat))
        }
        expect(state.winner).not.toBeNull()
    })

    it("refuses NEXT_DEAL outside DEAL_DONE and any action after GAME_OVER", () => {
        expectEngineError(() => reduce(newGame(cfg("guards")), { type: "NEXT_DEAL" }), "BAD_PHASE")

        let state = newGame(cfg("guards-2"))
        while (state.phase !== "GAME_OVER") state = reduce(state, nextAction(state)).state
        expectEngineError(() => reduce(state, { type: "NEXT_DEAL" }), "BAD_PHASE")
        expectEngineError(
            () => reduce(state, { type: "PLAY", seat: 0, card: "AHERC" }),
            "BAD_PHASE",
        )
        expectEngineError(() => reduce(state, { type: "PASS", seat: 0 }), "BAD_PHASE")
        expectEngineError(
            () => reduce(state, { type: "BID", seat: 0, trump: "HERC" }),
            "BAD_PHASE",
        )
    })

    it("keeps playing when the target is reached but the scores are tied", () => {
        const base = playing({ trump: "HERC", leader: 0, hands: {} })
        const state: GameState = { ...base, phase: "DEAL_DONE", score: { A: 1001, B: 1001 } }
        const step = reduce(state, { type: "NEXT_DEAL" })
        expect(step.state.phase).toBe("BIDDING")
        expect(step.state.winner).toBeNull()
        expect(step.state.score).toEqual({ A: 1001, B: 1001 })
        expect(step.events).toEqual([
            { type: "DEALT", dealNo: state.dealNo + 1, dealer: nextSeat(state.dealer) },
        ])
        for (const seat of SEATS) expect(step.state.hands[seat]).toHaveLength(6)
    })

    it("ends the game as soon as one team is past the target", () => {
        const base = playing({ trump: "HERC", leader: 0, hands: {} })
        const state: GameState = { ...base, phase: "DEAL_DONE", score: { A: 1010, B: 300 } }
        const done = reduce(state, { type: "NEXT_DEAL" })
        expect(done.state.phase).toBe("GAME_OVER")
        expect(done.state.winner).toBe("A")
        expect(done.events).toEqual([
            { type: "GAME_OVER", winner: "A", score: { A: 1010, B: 300 } },
        ])
    })

    it("does not end the game before the target is reached", () => {
        const base = playing({ trump: "HERC", leader: 0, hands: {} })
        const state: GameState = { ...base, phase: "DEAL_DONE", score: { A: 1000, B: 300 } }
        const next = reduce(state, { type: "NEXT_DEAL" })
        expect(next.state.phase).toBe("BIDDING")
        expect(next.state.winner).toBeNull()
    })
})
