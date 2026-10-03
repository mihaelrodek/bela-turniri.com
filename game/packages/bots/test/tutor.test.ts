/* Tutor — the practice-game driver and the coach (src/tutor.ts). */

import { describe, expect, it } from "vitest"
import type { Card, GameState, Seat } from "@bela/engine"
import { legalBids, reduce, viewFor } from "@bela/engine"
import {
    LEARNER_SEAT,
    biddingState,
    botAction,
    describePlay,
    describeTrick,
    hintForBid,
    hintForPlay,
    newPracticeGame,
    scenarioLegalMoves,
    scenarioView,
    seatToAct,
    whyIllegal,
} from "../src/tutor"
import { makeRng } from "./helpers"

/** Play a whole practice game with the coach's own suggestion standing in for
 *  the learner. Returns the final state and how many actions it took. */
function playOut(seed: string): { state: GameState; actions: number } {
    const rng = makeRng(seed)
    let state = newPracticeGame(seed)
    let actions = 0
    while (state.phase !== "GAME_OVER") {
        if (++actions > 2000) throw new Error("practice game did not finish")
        if (state.phase === "DEAL_DONE") {
            state = reduce(state, { type: "NEXT_DEAL" }).state
            continue
        }
        const bot = botAction(state, rng)
        if (bot !== null) {
            state = reduce(state, bot).state
            continue
        }
        expect(seatToAct(state)).toBe(LEARNER_SEAT)
        const view = viewFor(state, LEARNER_SEAT, { recallTricks: true })
        if (state.phase === "BIDDING") {
            const hint = hintForBid(view, rng)
            expect(hint).not.toBeNull()
            const choice = hint!.choice
            if (choice === "PASS") expect(hint!.forced).toBe(false)
            state = reduce(
                state,
                choice === "PASS"
                    ? { type: "PASS", seat: LEARNER_SEAT }
                    : { type: "BID", seat: LEARNER_SEAT, trump: choice },
            ).state
        } else {
            const hint = hintForPlay(view, rng)
            expect(hint).not.toBeNull()
            expect(view.legalMoves).toContain(hint!.card)
            // Every card that is not legal has a named obligation, every
            // legal one has none.
            for (const card of view.hand) {
                const why = whyIllegal(view, card)
                if (view.legalMoves.includes(card)) expect(why).toBeNull()
                else expect(why).not.toBeNull()
            }
            state = reduce(state, { type: "PLAY", seat: LEARNER_SEAT, card: hint!.card }).state
        }
    }
    return { state, actions }
}

describe("practice game", () => {
    it("runs to a winner on engine rules alone, for several seeds", () => {
        for (const seed of ["ucenje-1", "ucenje-2", "ucenje-3", "ucenje-4", "ucenje-5"]) {
            const { state } = playOut(seed)
            expect(state.phase).toBe("GAME_OVER")
            expect(state.winner).not.toBeNull()
            expect(state.history.length).toBeGreaterThanOrEqual(1)
        }
    })

    it("never moves for the learner", () => {
        let state = newPracticeGame("ucenje-learner")
        const rng = makeRng("ucenje-learner")
        for (let i = 0; i < 8 && seatToAct(state) !== LEARNER_SEAT; i++) {
            const action = botAction(state, rng)
            expect(action).not.toBeNull()
            state = reduce(state, action!).state
        }
        if (seatToAct(state) === LEARNER_SEAT) expect(botAction(state, rng)).toBeNull()
    })
})

describe("lesson positions", () => {
    const at = (seat: Seat, card: Card) => ({ seat, card })

    it("following suit: only the led suit is legal", () => {
        const hand: Card[] = ["7HERC", "KHERC", "APIK", "9TREF"]
        const scenario = { hand, trick: [at(3, "AHERC")], trump: "TREF" as const }
        expect(scenarioLegalMoves(scenario).sort()).toEqual(["7HERC", "KHERC"].sort())
        const view = scenarioView(scenario)
        expect(whyIllegal(view, "APIK")).toBe("followSuit")
        expect(whyIllegal(view, "9TREF")).toBe("followSuit")
        expect(whyIllegal(view, "7HERC")).toBeNull()
    })

    it("iber: a stronger card of the led suit must be played", () => {
        const hand: Card[] = ["7HERC", "AHERC", "APIK"]
        const scenario = { hand, trick: [at(3, "KHERC")], trump: "TREF" as const }
        expect(scenarioLegalMoves(scenario)).toEqual(["AHERC"])
        expect(whyIllegal(scenarioView(scenario), "7HERC")).toBe("mustOvertake")
    })

    it("no card of the led suit: a trump is compulsory", () => {
        const hand: Card[] = ["7TREF", "APIK", "10KARA"]
        const scenario = { hand, trick: [at(3, "KHERC")], trump: "TREF" as const }
        expect(scenarioLegalMoves(scenario)).toEqual(["7TREF"])
        expect(whyIllegal(scenarioView(scenario), "APIK")).toBe("mustTrump")
    })

    it("a trump on the table must be beaten when possible", () => {
        const hand: Card[] = ["7TREF", "JTREF", "APIK"]
        const scenario = { hand, trick: [at(2, "KHERC"), at(3, "9TREF")], trump: "TREF" as const }
        expect(scenarioLegalMoves(scenario)).toEqual(["JTREF"])
        expect(whyIllegal(scenarioView(scenario), "7TREF")).toBe("mustOvertrump")
    })

    it("neither the suit nor a trump: anything goes", () => {
        const hand: Card[] = ["7KARA", "APIK"]
        const scenario = { hand, trick: [at(3, "KHERC")], trump: "TREF" as const }
        expect(scenarioLegalMoves(scenario).sort()).toEqual(["7KARA", "APIK"].sort())
    })

    it("mus: the dealer may not pass after three passes", () => {
        const hand: Card[] = ["7HERC", "8HERC", "9PIK", "KPIK", "QTREF", "10KARA"]
        const forced = biddingState(hand, 3)
        expect(forced.dealer).toBe(LEARNER_SEAT)
        expect(legalBids(forced, LEARNER_SEAT).canPass).toBe(false)
        const free = biddingState(hand, 1)
        expect(free.dealer).not.toBe(LEARNER_SEAT)
        expect(legalBids(free, LEARNER_SEAT).canPass).toBe(true)
        expect(legalBids(biddingState(hand, 0), LEARNER_SEAT).canPass).toBe(true)
    })
})

describe("coach reasons", () => {
    const at = (seat: Seat, card: Card) => ({ seat, card })
    const rng = makeRng("coach")

    it("names the only legal card", () => {
        const view = scenarioView({ hand: ["7HERC", "AHERC", "APIK"], trick: [at(3, "KHERC")], trump: "TREF" })
        expect(hintForPlay(view, rng)).toEqual({ card: "AHERC", reason: "onlyCard" })
    })

    it("describes a lead by the card led", () => {
        const view = scenarioView({ hand: ["JTREF", "AHERC", "7PIK", "KKARA"], trick: [], trump: "TREF" })
        expect(describePlay(view, "JTREF")).toBe("leadTrump")
        expect(describePlay(view, "AHERC")).toBe("leadAce")
        expect(describePlay(view, "7PIK")).toBe("leadLow")
        expect(describePlay(view, "KKARA")).toBe("lead")
    })

    it("tells a ruff from taking in suit", () => {
        const ruff = scenarioView({ hand: ["7TREF", "8TREF"], trick: [at(3, "KHERC")], trump: "TREF" })
        expect(describePlay(ruff, "7TREF")).toBe("ruff")
        // The 10 is already beaten by nothing held lower, so both A and 10
        // would win over the king: the 10 is the cheaper winner.
        const take = scenarioView({ hand: ["10HERC", "AHERC"], trick: [at(3, "KHERC")], trump: "TREF" })
        expect(describePlay(take, "10HERC")).toBe("takeCheap")
        expect(describePlay(take, "AHERC")).toBe("take")
    })

    it("feeds the partner only when the trick is certainly theirs", () => {
        // We play last: partner's ace cannot be beaten any more.
        const last = scenarioView({
            hand: ["10PIK", "7PIK", "8KARA"],
            trick: [at(1, "8HERC"), at(2, "AHERC"), at(3, "7HERC")],
            trump: "TREF",
        })
        expect(describePlay(last, "10PIK")).toBe("feedPartner")
        expect(describePlay(last, "7PIK")).toBe("partnerHolds")
        // An opponent still plays after us: nothing is certain, nothing is fed.
        const open = scenarioView({
            hand: ["10PIK", "7PIK", "8KARA"],
            trick: [at(2, "AHERC"), at(3, "7HERC")],
            trump: "TREF",
        })
        expect(describePlay(open, "10PIK")).toBe("partnerHolds")
    })

    it("explains a discard on partner's trump jack (owner report, 2026-09-29)", () => {
        // Partner holds the trick with the jack of trump; no trump in hand.
        const view = scenarioView({
            hand: ["8HERC", "KHERC", "AHERC", "JPIK", "QPIK", "APIK", "7TREF"],
            trick: [at(2, "JKARA"), at(3, "7KARA")],
            trump: "KARA",
        })
        // The lone 7: a suit with no ace and no ten, aces held elsewhere.
        expect(describePlay(view, "7TREF")).toBe("signalDiscard")
        // The richest card that does not win, on a trick that is partner's.
        expect(describePlay(view, "AHERC")).toBe("feedPartner")
        expect(describePlay(view, "APIK")).toBe("feedPartner")
        // A king from a suit headed by its ace is neither.
        expect(describePlay(view, "KHERC")).toBe("partnerHolds")
    })

    it("does not call a discard a signal without an ace to keep", () => {
        const view = scenarioView({
            hand: ["8HERC", "KHERC", "QPIK", "7TREF"],
            trick: [at(2, "JKARA"), at(3, "7KARA")],
            trump: "KARA",
        })
        expect(describePlay(view, "7TREF")).toBe("partnerHolds")
    })

    it("says so when nothing can win", () => {
        const view = scenarioView({ hand: ["7HERC", "KHERC"], trick: [at(3, "AHERC")], trump: "TREF" })
        expect(describePlay(view, "7HERC")).toBe("cantWinLow")
        expect(describePlay(view, "KHERC")).toBe("cantWin")
    })

    it("reports the facts behind a bid", () => {
        const strong = viewFor(biddingState(["JHERC", "9HERC", "AHERC", "7PIK", "8KARA", "7TREF"], 0), LEARNER_SEAT)
        const hint = hintForBid(strong, rng)
        expect(hint).toEqual({ choice: "HERC", reason: "jackAndNine", forced: false, count: 3 })

        const forced = viewFor(biddingState(["7HERC", "8HERC", "7PIK", "8PIK", "7KARA", "8TREF"], 3), LEARNER_SEAT)
        const must = hintForBid(forced, rng)
        expect(must?.forced).toBe(true)
        expect(must?.choice).not.toBe("PASS")
    })
})

describe("trick verdicts", () => {
    const at = (seat: Seat, card: Card) => ({ seat, card })

    it("names the strongest card of the led suit", () => {
        const verdict = describeTrick([at(1, "KPIK"), at(2, "10PIK"), at(3, "AHERC"), at(0, "9PIK")], "TREF")
        expect(verdict).toMatchObject({ winner: { seat: 2, card: "10PIK" }, lead: "PIK", reason: "highestOfLed" })
    })

    it("names a trump played on a plain lead", () => {
        const verdict = describeTrick([at(1, "APIK"), at(2, "10PIK"), at(3, "7TREF"), at(0, "KPIK")], "TREF")
        expect(verdict).toMatchObject({ winner: { seat: 3, card: "7TREF" }, reason: "trumpBeats" })
    })

    it("names the strongest trump when trump is led", () => {
        const verdict = describeTrick([at(2, "ATREF"), at(3, "9TREF"), at(0, "10TREF"), at(1, "JTREF")], "TREF")
        expect(verdict).toMatchObject({ winner: { seat: 1, card: "JTREF" }, reason: "highestTrump" })
    })

    it("has nothing to say about an empty trick", () => {
        expect(describeTrick([], "TREF")).toBeNull()
    })
})

describe("pass reasons", () => {
    const rng = makeRng("pass")
    const passHint = (hand: Card[]) => hintForBid(viewFor(biddingState(hand, 1), LEARNER_SEAT), rng)

    it("says so when the hand holds no jack and no nine", () => {
        const hint = passHint(["7HERC", "8HERC", "7PIK", "QKARA", "8TREF", "KTREF"])
        expect(hint).toMatchObject({ choice: "PASS", reason: "passNoTop" })
    })

    it("says so when a jack or nine has no length behind it", () => {
        const hint = passHint(["JHERC", "7PIK", "8PIK", "QKARA", "8TREF", "KTREF"])
        if (hint?.choice === "PASS") expect(hint.reason).toBe("passShort")
    })
})
