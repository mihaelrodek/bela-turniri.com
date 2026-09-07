import { describe, expect, it } from "vitest"
import type { Card } from "../src/index"
import { legalBids, legalMoves, trickPoints, trickWinner } from "../src/index"
import { makeState, playing, tc } from "./helpers"

describe("trickWinner (README §1.5)", () => {
    it("gives it to the highest card of the led suit", () => {
        const cards = [tc(0, "10PIK"), tc(1, "KPIK"), tc(2, "APIK"), tc(3, "7PIK")]
        expect(trickWinner(cards, "HERC")).toBe(2)
    })

    it("ignores discards of other suits", () => {
        const cards = [tc(1, "9PIK"), tc(2, "ATREF"), tc(3, "AKARA"), tc(0, "7PIK")]
        expect(trickWinner(cards, "HERC")).toBe(1)
    })

    it("a trump beats every plain card", () => {
        const cards = [tc(0, "APIK"), tc(1, "7HERC"), tc(2, "10PIK"), tc(3, "KPIK")]
        expect(trickWinner(cards, "HERC")).toBe(1)
    })

    it("the highest trump wins when several trump", () => {
        const cards = [tc(0, "APIK"), tc(1, "10HERC"), tc(2, "9HERC"), tc(3, "AHERC")]
        // trump order J > 9 > A > 10 → 9HERC is the strongest here
        expect(trickWinner(cards, "HERC")).toBe(2)
    })

    it("uses the trump order when trumps are led", () => {
        const cards = [tc(2, "AHERC"), tc(3, "10HERC"), tc(0, "JHERC"), tc(1, "KHERC")]
        expect(trickWinner(cards, "HERC")).toBe(0)
    })

    it("works on a partial trick", () => {
        expect(trickWinner([tc(3, "7PIK")], "HERC")).toBe(3)
        expect(trickWinner([tc(3, "7PIK"), tc(0, "8PIK")], "HERC")).toBe(0)
    })
})

describe("trickPoints", () => {
    it("adds the card values of the trick", () => {
        const cards = [tc(0, "APIK"), tc(1, "JHERC"), tc(2, "10PIK"), tc(3, "QPIK")]
        expect(trickPoints(cards, "HERC")).toBe(11 + 20 + 10 + 3)
    })

    it("accepts raw card ids too", () => {
        const cards: Card[] = ["APIK", "JHERC", "10PIK", "QPIK"]
        expect(trickPoints(cards, "HERC")).toBe(44)
    })
})

describe("legalBids (README §1.2)", () => {
    it("offers all four suits and a pass to a normal bidder", () => {
        const state = makeState({
            phase: "BIDDING",
            dealer: 3,
            bidding: { turn: 0, passes: [], trump: null, caller: null },
        })
        expect(legalBids(state, 0)).toEqual({
            canPass: true,
            suits: ["HERC", "KARA", "PIK", "TREF"],
        })
    })

    it("still allows a pass to the dealer while fewer than three have passed", () => {
        const state = makeState({
            phase: "BIDDING",
            dealer: 3,
            bidding: { turn: 3, passes: [0, 1], trump: null, caller: null },
        })
        expect(legalBids(state, 3).canPass).toBe(true)
    })

    it("forces the dealer after three passes (mus)", () => {
        const state = makeState({
            phase: "BIDDING",
            dealer: 3,
            bidding: { turn: 3, passes: [0, 1, 2], trump: null, caller: null },
        })
        expect(legalBids(state, 3)).toEqual({
            canPass: false,
            suits: ["HERC", "KARA", "PIK", "TREF"],
        })
    })

    it("is empty for anyone not on turn or outside BIDDING", () => {
        const bidding = makeState({
            phase: "BIDDING",
            bidding: { turn: 0, passes: [], trump: null, caller: null },
        })
        expect(legalBids(bidding, 2)).toEqual({ canPass: false, suits: [] })
        const playingState = makeState({ phase: "PLAYING" })
        expect(legalBids(playingState, 0)).toEqual({ canPass: false, suits: [] })
    })
})

describe("legalMoves (README §1.5, every branch)", () => {
    it("the leader may play anything", () => {
        const state = playing({
            trump: "HERC",
            leader: 0,
            hands: { 0: ["9HERC", "7PIK", "ATREF"] },
        })
        expect(legalMoves(state, 0)).toEqual(["9HERC", "7PIK", "ATREF"])
    })

    it("1. holding the led plain suit ⇒ must follow it", () => {
        const state = playing({
            trump: "HERC",
            leader: 0,
            cards: [tc(0, "APIK")],
            hands: { 1: ["9HERC", "7PIK", "KPIK", "ATREF"] },
        })
        expect(legalMoves(state, 1)).toEqual(["7PIK", "KPIK"])
    })

    it("1a. trumps led ⇒ must go over the best trump if able", () => {
        const state = playing({
            trump: "HERC",
            leader: 0,
            cards: [tc(0, "10HERC")],
            hands: { 1: ["9HERC", "QHERC", "APIK"] },
        })
        expect(legalMoves(state, 1)).toEqual(["9HERC"])
    })

    it("1b. trumps led and cannot go over ⇒ any trump, but only trumps", () => {
        const state = playing({
            trump: "HERC",
            leader: 0,
            cards: [tc(0, "JHERC")],
            hands: { 1: ["9HERC", "QHERC", "APIK"] },
        })
        expect(legalMoves(state, 1)).toEqual(["9HERC", "QHERC"])
    })

    it("1c. holding trumps beats the partner too — no partner exception when following", () => {
        // Seat 1 led trumps, seat 2 followed, seat 3 (partner of 1) still must overtrump.
        const state = playing({
            trump: "HERC",
            leader: 1,
            cards: [tc(1, "10HERC"), tc(2, "7HERC")],
            hands: { 3: ["9HERC", "AHERC", "APIK"] },
        })
        expect(legalMoves(state, 3)).toEqual(["9HERC", "AHERC"])
    })

    it("2a. void and the partner is winning ⇒ anything", () => {
        const state = playing({
            trump: "HERC",
            leader: 0,
            cards: [tc(0, "APIK"), tc(1, "7PIK")],
            hands: { 2: ["9HERC", "QHERC", "ATREF"] },
        })
        expect(legalMoves(state, 2)).toEqual(["9HERC", "QHERC", "ATREF"])
    })

    it("2a. the partner winning with a trump also frees the hand", () => {
        const state = playing({
            trump: "HERC",
            leader: 0,
            cards: [tc(0, "APIK"), tc(1, "10HERC"), tc(2, "7PIK")],
            hands: { 3: ["9HERC", "AKARA"] },
        })
        expect(legalMoves(state, 3)).toEqual(["9HERC", "AKARA"])
    })

    it("2b. void, an opponent is winning, no trump played yet ⇒ must trump", () => {
        const state = playing({
            trump: "HERC",
            leader: 0,
            cards: [tc(0, "APIK")],
            hands: { 1: ["9HERC", "QHERC", "ATREF"] },
        })
        expect(legalMoves(state, 1)).toEqual(["9HERC", "QHERC"])
    })

    it("2b. void, an opponent trumped and we can overtrump ⇒ only higher trumps", () => {
        const state = playing({
            trump: "HERC",
            leader: 0,
            cards: [tc(0, "APIK"), tc(1, "10HERC")],
            hands: { 2: ["9HERC", "QHERC", "ATREF"] },
        })
        expect(legalMoves(state, 2)).toEqual(["9HERC"])
    })

    it("2b. void, an opponent trumped and we cannot overtrump ⇒ any trump", () => {
        const state = playing({
            trump: "HERC",
            leader: 0,
            cards: [tc(0, "APIK"), tc(1, "JHERC")],
            hands: { 2: ["9HERC", "QHERC", "ATREF"] },
        })
        expect(legalMoves(state, 2)).toEqual(["9HERC", "QHERC"])
    })

    it("2c. void with no trumps at all ⇒ anything", () => {
        const state = playing({
            trump: "HERC",
            leader: 0,
            cards: [tc(0, "APIK"), tc(1, "10HERC")],
            hands: { 2: ["AKARA", "7TREF"] },
        })
        expect(legalMoves(state, 2)).toEqual(["AKARA", "7TREF"])
    })

    it("is empty when it is not this seat's turn", () => {
        const state = playing({
            trump: "HERC",
            leader: 0,
            cards: [tc(0, "APIK")],
            hands: { 1: ["7PIK"], 2: ["KPIK"] },
        })
        expect(legalMoves(state, 2)).toEqual([])
        expect(legalMoves(state, 0)).toEqual([])
    })

    it("is empty outside PLAYING", () => {
        const state = makeState({ phase: "BIDDING", hands: { 0: ["APIK"], 1: [], 2: [], 3: [] } })
        expect(legalMoves(state, 0)).toEqual([])
        const done = makeState({ phase: "DEAL_DONE", hands: { 0: ["APIK"], 1: [], 2: [], 3: [] } })
        expect(legalMoves(done, 0)).toEqual([])
    })

    it("never mutates the state it inspects", () => {
        const state = playing({
            trump: "HERC",
            leader: 0,
            cards: [tc(0, "APIK")],
            hands: { 1: ["9HERC", "7PIK", "KPIK"] },
        })
        const snapshot = structuredClone(state)
        legalMoves(state, 1)
        expect(state).toEqual(snapshot)
    })
})
