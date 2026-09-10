/* ──────────────────────────────────────────────────────────────────────────
   The reported "the bot discarded a heart while it still had a trump" case,
   nailed down against the engine (README §1.5).

   A bot can only ever play a card out of the `legal` array the server hands it
   (`chooseCard(view, legal, rng)`), so the only way an illegal card could reach
   the table is a hole in `legalMoves`. These tests drive the real engine on a
   hand-built state that reproduces the reported layout exactly: TREF (žir) is
   trump, KARA is led, the bot is void in KARA and holds both a trump and a
   heart.

   History: the first version of §1.5 let a void player play ANYTHING while his
   own partner held the trick, so the heart was legal then. The rule was
   changed on 2026-09-09 (reported twice as wrong): a void player who holds a
   trump plays a trump, whoever is winning. The heart is now illegal in every
   layout below.
   ────────────────────────────────────────────────────────────────────── */

import { describe, expect, it } from "vitest"
import type { Card, GameState, Seat, TrickCard } from "@bela/engine"
import { legalMoves } from "@bela/engine"

/** Minimal PLAYING state: trump TREF, seat 2 on turn, whatever trick we pass. */
function state(hand2: Card[], trickCards: TrickCard[], leader: Seat): GameState {
    return {
        config: { targetScore: 501, seed: "report" },
        dealNo: 1,
        dealer: 3,
        phase: "PLAYING",
        hands: { 0: [], 1: [], 2: hand2, 3: [] },
        stock: [],
        bidding: { turn: 0, passes: [], trump: "TREF", caller: 0 },
        trick: { leader, turn: 2, cards: trickCards },
        tricksWon: { A: [], B: [] },
        declarations: { 0: [], 1: [], 2: [], 3: [] },
        declarationsScoringTeam: null,
        belaDeclared: null,
        belaRefused: null,
        dealScore: null,
        score: { A: 0, B: 0 },
        history: [],
        rng: { s: 1 },
        winner: null,
    }
}

// Seat 2 (team A, partner of seat 0) is void in KARA and holds a trump + a heart.
const HAND: Card[] = ["9HERC", "KHERC", "7TREF", "QPIK"]

describe("engine legalMoves — the reported discard (README §1.5)", () => {
    it("an OPPONENT is winning the led suit → only trumps are legal (no heart discard)", () => {
        const s = state(HAND, [{ seat: 1, card: "AKARA" }], 1)
        expect(legalMoves(s, 2)).toEqual(["7TREF"])
    })

    it("an opponent already trumped → only a HIGHER trump if held, else any trump", () => {
        const s = state(HAND, [
            { seat: 1, card: "7KARA" },
            { seat: 3, card: "8KARA" },
        ], 1)
        // Nobody trumped yet, so the plain rule applies: must trump.
        expect(legalMoves(s, 2)).toEqual(["7TREF"])

        const overtrumped = state(["9HERC", "7TREF", "ATREF"], [
            { seat: 1, card: "7KARA" },
            { seat: 3, card: "10TREF" },
        ], 1)
        // 10TREF is the best trump so far; only trumps above it are legal.
        expect(legalMoves(overtrumped, 2)).toEqual(["ATREF"])

        const cannotOvertrump = state(["9HERC", "7TREF"], [
            { seat: 1, card: "7KARA" },
            { seat: 3, card: "10TREF" },
        ], 1)
        // No trump above the 10 — the lower trump is still compulsory.
        expect(legalMoves(cannotOvertrump, 2)).toEqual(["7TREF"])
    })

    it("my PARTNER is winning → the trump is STILL compulsory; the heart discard is illegal", () => {
        const s = state(HAND, [
            { seat: 0, card: "AKARA" }, // partner leads and holds the trick
            { seat: 1, card: "8KARA" },
        ], 0)
        expect(legalMoves(s, 2)).toEqual(["7TREF"])
    })

    it("partner led but an opponent overtook → the trump is compulsory", () => {
        const s = state(HAND, [
            { seat: 0, card: "8KARA" },
            { seat: 1, card: "AKARA" }, // opponent takes over
        ], 0)
        expect(legalMoves(s, 2)).toEqual(["7TREF"])
    })

    it("void in the led suit with no trump at all → anything is legal", () => {
        const s = state(["9HERC", "KHERC", "QPIK"], [{ seat: 1, card: "AKARA" }], 1)
        expect(legalMoves(s, 2)).toEqual(["9HERC", "KHERC", "QPIK"])
    })
})
