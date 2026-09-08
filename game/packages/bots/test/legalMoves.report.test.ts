/* ──────────────────────────────────────────────────────────────────────────
   The reported "the bot discarded a heart while it still had a trump" case,
   nailed down against the engine (README §1.5).

   A bot can only ever play a card out of the `legal` array the server hands it
   (`chooseCard(view, legal, rng)`), so the only way an illegal card could reach
   the table is a hole in `legalMoves`. These tests drive the real engine on a
   hand-built state that reproduces the reported layout exactly: TREF (žir) is
   trump, KARA is led, the bot is void in KARA and holds both a trump and a
   heart.

   Result: `legalMoves` is correct. It offers the heart ONLY when the bot's own
   partner is winning the trick — which §1.5 explicitly allows — and offers
   nothing but trumps whenever an opponent is winning. The reported hand is
   therefore case (a): a legal, and in fact conventional, discard.
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
    })

    it("my PARTNER is winning → anything is legal, so the heart discard is a LEGAL play", () => {
        const s = state(HAND, [
            { seat: 0, card: "AKARA" }, // partner leads and holds the trick
            { seat: 1, card: "8KARA" },
        ], 0)
        const legal = legalMoves(s, 2)
        expect(legal).toEqual(HAND)
        expect(legal).toContain("9HERC") // the "wrong" discard the report describes
        expect(legal).toContain("7TREF") // the trump it kept back — also legal
    })

    it("partner led but an opponent overtook → the trump is compulsory again", () => {
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
