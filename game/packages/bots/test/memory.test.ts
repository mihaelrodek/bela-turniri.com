/* The deal's memory (`memory.ts`, BOT.md §16): what the rules of §1.5 prove
 * about the three hands the bot cannot see, and the two decisions built on it.
 */
import { describe, expect, it } from "vitest"
import type { Card, Seat, WonTrick } from "@bela/engine"
import { heuristicBot } from "../src/heuristicBot"
import { recall } from "../src/memory"
import { view } from "./helpers"

const noRng = (): number => 0.5

function wonTrick(no: number, leader: Seat, cards: Card[], winner: Seat): WonTrick {
    return {
        no,
        leader,
        winner,
        plays: cards.map((card, i) => ({ seat: (((leader + i) % 4) as Seat), card })),
        cards,
    }
}

describe("recall — proofs read off the play", () => {
    it("a seat that followed UNDER the holding card has nothing above it (7, 9, 8)", () => {
        const v = view({
            seat: 3,
            hand: ["ATREF", "QTREF", "7PIK", "8PIK", "9PIK", "7KARA", "8KARA", "9KARA"],
            handSizes: { 0: 7, 1: 7, 2: 7, 3: 8 },
            trick: {
                leader: 0,
                turn: 3,
                cards: [
                    { seat: 0, card: "7TREF" },
                    { seat: 1, card: "9TREF" },
                    { seat: 2, card: "8TREF" },
                ],
            },
        })
        const memory = recall(v)
        // Nothing above the 9, and the 7 and the 8 are on the table: void.
        expect(memory.isVoid(2, "TREF")).toBe(true)
        expect(memory.canHold(2, "KTREF")).toBe(false)
        // The leader proved nothing; the second seat went over, which proves nothing.
        expect(memory.canHold(0, "KTREF")).toBe(true)
        expect(memory.canHold(1, "KTREF")).toBe(true)
    })

    it("a discard on a plain lead proves no card of the suit AND no trump", () => {
        const first: Card[] = ["ATREF", "7PIK", "8TREF", "9TREF"] // seat 1 threw a spade
        const v = view({
            seat: 0,
            hand: ["JHERC", "9HERC", "AKARA", "7KARA", "8KARA", "9KARA", "10PIK"],
            handSizes: { 0: 7, 1: 7, 2: 7, 3: 7 },
            played: first,
            trickHistory: [wonTrick(1, 0, first, 0)],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        const memory = recall(v)
        expect(memory.isVoid(1, "TREF")).toBe(true)
        expect(memory.isVoid(1, "HERC")).toBe(true)
        expect(memory.isVoid(3, "HERC")).toBe(false)
    })

    it("a card two seats cannot hold is CERTAINLY in the third", () => {
        // Trump led twice; seats 1 and 3 both failed to follow the second time.
        const first: Card[] = ["JHERC", "7HERC", "8HERC", "QHERC"]
        const second: Card[] = ["9HERC", "7PIK", "KHERC", "8PIK"]
        const v = view({
            seat: 0,
            hand: ["AKARA", "7KARA", "8KARA", "9KARA", "10PIK", "9PIK"],
            handSizes: { 0: 6, 1: 6, 2: 6, 3: 6 },
            played: [...first, ...second],
            trickHistory: [wonTrick(1, 0, first, 0), wonTrick(2, 0, second, 0)],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        const memory = recall(v)
        expect(memory.holder("AHERC")).toBe(2)
        expect(memory.holder("10HERC")).toBe(2)
        expect(memory.possibleHolders("AHERC")).toEqual([2])
    })
})

describe("heuristicBot.chooseCard — decisions from the memory (BOT.md §16)", () => {
    it("takes with the ACE when the suit is about to be ruffed (owner's example)", () => {
        const hand: Card[] = ["ATREF", "QTREF", "7PIK", "8PIK", "9PIK", "7KARA", "8KARA", "9KARA"]
        const v = view({
            seat: 3,
            hand,
            handSizes: { 0: 7, 1: 7, 2: 7, 3: 8 },
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            trick: {
                leader: 0,
                turn: 3,
                cards: [
                    { seat: 0, card: "7TREF" },
                    { seat: 1, card: "9TREF" },
                    { seat: 2, card: "8TREF" },
                ],
            },
        })
        expect(heuristicBot.chooseCard(v, ["ATREF", "QTREF"], noRng)).toBe("ATREF")
    })

    it("takes with the QUEEN and keeps the ace when it can draw every trump itself", () => {
        const hand: Card[] = ["ATREF", "QTREF", "10TREF", "JHERC", "9HERC", "AHERC", "10HERC", "KHERC"]
        const v = view({
            seat: 3,
            hand,
            handSizes: { 0: 7, 1: 7, 2: 7, 3: 8 },
            bidding: { turn: 3, passes: [], trump: "HERC", caller: 3 },
            trick: {
                leader: 0,
                turn: 3,
                cards: [
                    { seat: 0, card: "7TREF" },
                    { seat: 1, card: "9TREF" },
                    { seat: 2, card: "8TREF" },
                ],
            },
        })
        expect(heuristicBot.chooseCard(v, ["ATREF", "QTREF", "10TREF"], noRng)).toBe("QTREF")
    })

    it("puts NO points in when the opponent behind is out of the suit and must ruff", () => {
        const first: Card[] = ["7TREF", "9TREF", "8TREF", "JTREF"] // seat 2 under the 9: void now
        const hand: Card[] = ["ATREF", "KTREF", "7PIK", "8PIK", "9PIK", "7KARA", "8KARA"]
        const v = view({
            seat: 1,
            hand,
            handSizes: { 0: 6, 1: 7, 2: 7, 3: 7 },
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            played: first,
            trickHistory: [wonTrick(1, 0, first, 3)],
            trick: { leader: 0, turn: 1, cards: [{ seat: 0, card: "QTREF" }] },
        })
        // Both beat the queen, so both are legal; seat 2 ruffs either.
        expect(heuristicBot.chooseCard(v, ["ATREF", "KTREF"], noRng)).toBe("KTREF")
    })
})
