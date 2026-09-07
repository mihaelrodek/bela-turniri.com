import { describe, expect, it } from "vitest"
import type { Card } from "@bela/engine"
import { heuristicBot } from "../src/heuristicBot"
import { view } from "./helpers"

const noRng = (): number => 0.5 // heuristic bot never consults rng

describe("heuristicBot.chooseBid (README §5)", () => {
    it("passes below the 5.5 threshold when it can", () => {
        // HERC score: 10 (1) + K (0.5) = 1.5, well under 5.5.
        const v = view({ seat: 0, hand: ["10HERC", "KHERC", "7PIK", "8PIK", "7TREF", "8TREF"] })
        expect(
            heuristicBot.chooseBid(v, { canPass: true, suits: ["HERC", "KARA", "PIK", "TREF"] }, noRng),
        ).toBe("PASS")
    })

    it("calls the best suit at or above the threshold", () => {
        // HERC: J(4) + 9(3) = 7 >= 5.5.
        const v = view({ seat: 0, hand: ["JHERC", "9HERC", "7PIK", "8PIK", "7TREF", "8TREF"] })
        expect(
            heuristicBot.chooseBid(v, { canPass: true, suits: ["HERC", "KARA", "PIK", "TREF"] }, noRng),
        ).toBe("HERC")
    })

    it("is forced to call the best suit with no threshold when it cannot pass (mus)", () => {
        // Weak hand overall, but PIK is relatively the best of a bad lot.
        const v = view({ seat: 3, hand: ["7HERC", "8KARA", "7PIK", "8PIK", "7TREF", "8TREF"] })
        expect(
            heuristicBot.chooseBid(v, { canPass: false, suits: ["HERC", "KARA", "PIK", "TREF"] }, noRng),
        ).toBe("PIK")
    })
})

describe("heuristicBot.chooseCard — priority branches (README §5)", () => {
    it("branch 1: partner holds the trick and I'm last → most valuable legal card", () => {
        const v = view({
            seat: 0,
            hand: ["JHERC", "7TREF"],
            trick: {
                leader: 1,
                turn: 0,
                cards: [
                    { seat: 1, card: "7PIK" },
                    { seat: 2, card: "APIK" }, // partner (2) wins with APIK
                    { seat: 3, card: "8PIK" },
                ],
            },
        })
        // Partner (seat 2) currently wins with APIK; I'm 4th to play (last).
        expect(heuristicBot.chooseCard(v, ["JHERC", "7TREF"], noRng)).toBe("JHERC")
    })

    it("branch 2: partner holds the trick, I'm not last → cheapest legal card", () => {
        const v = view({
            seat: 0,
            hand: ["JHERC", "7TREF"],
            trick: {
                leader: 2,
                turn: 0,
                cards: [{ seat: 2, card: "AHERC" }], // partner (2) leads and currently wins
            },
        })
        expect(heuristicBot.chooseCard(v, ["JHERC", "7TREF"], noRng)).toBe("7TREF")
    })

    it("branch 3: I can win → cheapest winning legal card", () => {
        const v = view({
            seat: 0,
            hand: ["10PIK", "KPIK"],
            trick: { leader: 1, turn: 0, cards: [{ seat: 1, card: "8PIK" }] },
        })
        expect(heuristicBot.chooseCard(v, ["10PIK", "KPIK"], noRng)).toBe("KPIK")
    })

    it("branch 4: otherwise → cheapest discard, preferring non-trump and the shortest suit", () => {
        const v = view({
            seat: 0,
            hand: ["7TREF", "8KARA", "9KARA", "QHERC"],
            // Opponent (seat 1) currently wins with the trump jack; I can't beat it and my
            // partner isn't holding the trick.
            trick: { leader: 1, turn: 0, cards: [{ seat: 1, card: "JHERC" }] },
        })
        const legal: Card[] = ["7TREF", "8KARA", "9KARA", "QHERC"]
        expect(heuristicBot.chooseCard(v, legal, noRng)).toBe("7TREF")
    })
})

describe("heuristicBot.chooseCard — leading a trick", () => {
    it("leads the trump jack when my team called and I hold it", () => {
        const v = view({
            seat: 0,
            hand: ["JHERC", "7PIK", "APIK"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 0 }, // I (seat 0) called
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, ["JHERC", "7PIK", "APIK"], noRng)).toBe("JHERC")
    })

    it("leads an ace of a non-trump suit when not drawing trumps", () => {
        const v = view({
            seat: 0,
            hand: ["7PIK", "APIK", "8TREF"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 }, // opponent called
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, ["7PIK", "APIK", "8TREF"], noRng)).toBe("APIK")
    })

    it("leads the lowest card of the shortest non-trump suit absent an ace", () => {
        const v = view({
            seat: 0,
            hand: ["7PIK", "8PIK", "9PIK", "8TREF"], // TREF length 1 is shortest
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, ["7PIK", "8PIK", "9PIK", "8TREF"], noRng)).toBe("8TREF")
    })

    it("falls back to the weakest card when only trumps remain", () => {
        const v = view({
            seat: 0,
            hand: ["7HERC", "JHERC"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, ["7HERC", "JHERC"], noRng)).toBe("7HERC")
    })
})
