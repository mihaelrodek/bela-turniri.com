/* The deal reported on 2026-09-29 (three screenshots, "BRZA 163").
 *
 * Seats: 0 = the human caller, 1 = Bot Ivan, 2 = Bot Sara (partner),
 * 3 = Bot Ivo (dealer). Trump is PIK (zelena). The caller did NOT open with
 * the jack or with a trump — he opened the karo QUEEN, "mala van aduta":
 * he holds the trump jack and wants trump put through as soon as his
 * partner gets the lead.
 */
import { describe, expect, it } from "vitest"
import type { Card, Seat, WonTrick } from "@bela/engine"
import { heuristicBot } from "../src/heuristicBot"
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

describe("reported 2026-09-29 — A+10 and the caller's small plain opening", () => {
    it("the defender LAST to play takes with the ACE, not the ten, holding both", () => {
        const v = view({
            seat: 3,
            hand: ["AKARA", "10KARA", "8KARA", "9HERC", "7TREF", "8TREF", "QPIK", "KTREF"],
            bidding: { turn: 0, passes: [], trump: "PIK", caller: 0 },
            trick: {
                leader: 0,
                turn: 3,
                cards: [
                    { seat: 0, card: "QKARA" },
                    { seat: 1, card: "7KARA" },
                    { seat: 2, card: "KKARA" },
                ],
            },
        })
        expect(heuristicBot.chooseCard(v, ["AKARA", "10KARA", "8KARA"], noRng)).toBe("AKARA")
    })

    it("the defender THIRD to play also takes with the ACE, not the ten, against the caller", () => {
        const v = view({
            seat: 2,
            hand: ["AKARA", "10KARA", "8KARA", "9HERC", "7TREF", "8TREF", "QPIK", "KTREF"],
            // Seat 1 called; my partner (0) led low, the caller went over him.
            bidding: { turn: 1, passes: [], trump: "PIK", caller: 1 },
            trick: {
                leader: 0,
                turn: 2,
                cards: [
                    { seat: 0, card: "7KARA" },
                    { seat: 1, card: "QKARA" },
                ],
            },
        })
        expect(heuristicBot.chooseCard(v, ["AKARA", "10KARA", "8KARA"], noRng)).toBe("AKARA")
    })

    it("forced over my own partner on DEFENCE, the ACE goes in, not the ten", () => {
        const v = view({
            seat: 2,
            hand: ["AHERC", "10HERC", "8HERC", "KKARA", "7TREF", "8TREF"],
            handSizes: { 0: 6, 1: 6, 2: 6, 3: 6 },
            bidding: { turn: 3, passes: [], trump: "PIK", caller: 3 }, // they called
            tricksWon: { A: 0, B: 1 },
            trick: {
                leader: 0,
                turn: 2,
                cards: [
                    { seat: 0, card: "QHERC" }, // my partner leads
                    { seat: 1, card: "9HERC" },
                ],
            },
        })
        expect(heuristicBot.chooseCard(v, ["AHERC", "10HERC"], noRng)).toBe("AHERC")
    })

    it("the partner who wins the lead puts TRUMP through, not the caller's suit back", () => {
        const first: Card[] = ["QKARA", "7KARA", "KKARA", "10KARA"] // caller opens small, Ivo takes
        const second: Card[] = ["9HERC", "10HERC", "7HERC", "AHERC"] // Ivo leads, Sara takes with the ace
        const hand: Card[] = ["JKARA", "7PIK", "QTREF", "8TREF", "KHERC", "9TREF"]
        const v = view({
            seat: 2,
            hand,
            handSizes: { 0: 6, 1: 6, 2: 6, 3: 6 },
            bidding: { turn: 0, passes: [], trump: "PIK", caller: 0 },
            tricksWon: { A: 1, B: 1 },
            currentDealPoints: { A: 21, B: 17 },
            played: [...first, ...second],
            lastTrick: wonTrick(2, 3, second, 2),
            trickHistory: [wonTrick(1, 0, first, 3), wonTrick(2, 3, second, 2)],
            trick: { leader: 2, turn: 2, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, [...hand], noRng)).toBe("7PIK")
    })

    it("third to play with Q-K-A over a jack takes with the ACE — the ten is still out behind", () => {
        // Caller (0) opens herc 9, Marin (1) plays the jack; Tin (2), the
        // caller's partner, holds Q-K-A. The queen "wins" only until Klara (3)
        // plays the ten that nobody has seen yet.
        const hand: Card[] = ["QHERC", "KHERC", "AHERC", "9PIK", "10PIK", "JPIK", "7TREF", "8TREF"]
        const v = view({
            seat: 2,
            hand,
            bidding: { turn: 0, passes: [], trump: "KARA", caller: 0 },
            trick: {
                leader: 0,
                turn: 2,
                cards: [
                    { seat: 0, card: "9HERC" },
                    { seat: 1, card: "JHERC" },
                ],
            },
        })
        expect(heuristicBot.chooseCard(v, ["QHERC", "KHERC", "AHERC"], noRng)).toBe("AHERC")
    })
})
