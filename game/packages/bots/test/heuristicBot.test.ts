import { describe, expect, it } from "vitest"
import type { Card, GameState } from "@bela/engine"
import { declarationPoints, legalMoves, reduce, viewFor } from "@bela/engine"
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
    it("branch 1: partner holds the trick and I'm last → the most valuable card that does NOT take it off him", () => {
        const v = view({
            seat: 0,
            hand: ["JHERC", "10TREF", "7TREF"],
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
        // The trump J is worth more points but would take the trick off him and
        // burn the best card in the deal on a trick our side already has.
        expect(heuristicBot.chooseCard(v, ["JHERC", "10TREF", "7TREF"], noRng)).toBe("10TREF")
    })

    it("never overtrumps a trick my own partner already holds", () => {
        const v = view({
            seat: 0,
            hand: ["JHERC", "7HERC", "8TREF"],
            trick: {
                leader: 1,
                turn: 0,
                cards: [
                    { seat: 1, card: "7PIK" },
                    { seat: 2, card: "APIK" }, // partner wins
                    { seat: 3, card: "8PIK" },
                ],
            },
        })
        // I am void in PIK, so `legalMoves` would let me ruff my own partner
        // with either trump. The bot discards instead.
        expect(heuristicBot.chooseCard(v, ["JHERC", "7HERC", "8TREF"], noRng)).toBe("8TREF")
    })

    it("gives up the non-beating rule only when the rules leave no choice", () => {
        // Partner led the trump ace; §1.5 forces me over it, and both my legal
        // cards beat him. The bot then falls back to the cheaper of the two.
        const v = view({
            seat: 0,
            hand: ["JHERC", "9HERC"],
            trick: { leader: 2, turn: 0, cards: [{ seat: 2, card: "AHERC" }] },
        })
        expect(heuristicBot.chooseCard(v, ["JHERC", "9HERC"], noRng)).toBe("9HERC")
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

    it("leads an ace of a non-trump suit when the 10 of that suit backs it up", () => {
        const v = view({
            seat: 0,
            hand: ["7PIK", "10PIK", "APIK", "8TREF"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 }, // opponent called
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, ["7PIK", "10PIK", "APIK", "8TREF"], noRng)).toBe("APIK")
    })

    it("keeps a bare ace back and leads something cheap instead (fault 2)", () => {
        const v = view({
            seat: 0,
            hand: ["7PIK", "APIK", "8TREF"], // no 10PIK behind the ace
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, ["7PIK", "APIK", "8TREF"], noRng)).toBe("8TREF")
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

    it("draws trumps with its cheapest trump when the partner called (fault 3)", () => {
        const v = view({
            seat: 0,
            hand: ["7HERC", "AHERC", "APIK", "8TREF"],
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 }, // partner called
            trick: { leader: 0, turn: 0, cards: [] },
        })
        // All three guards hold: the opponents can still have trumps, and APIK
        // is a winner to cash once they are stripped. Trump, not the bare ace;
        // the cheap trump, not the trump ace — the partner holds the top ones.
        expect(heuristicBot.chooseCard(v, ["7HERC", "AHERC", "APIK", "8TREF"], noRng)).toBe("7HERC")
    })

    it("STOPS drawing once the opponents provably hold no trump, and cashes instead", () => {
        // Every trump but mine is face up, so nobody can ruff any more.
        const hand: Card[] = ["JHERC", "APIK", "KPIK", "8TREF", "9TREF", "7KARA"]
        const v = view({
            seat: 0,
            hand,
            handSizes: { 0: 6, 1: 6, 2: 6, 3: 6 },
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 }, // partner called
            played: ["7HERC", "8HERC", "9HERC", "10HERC", "QHERC", "KHERC", "AHERC", "7TREF"],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("APIK")
    })

    it("stops drawing once BOTH opponents have shown void in trump", () => {
        // Trumps are still outstanding, but only my partner can hold them:
        // another trump lead would strip our own side.
        const hand: Card[] = ["7HERC", "AHERC", "APIK", "8TREF"]
        const v = view({
            seat: 0,
            hand,
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 },
            lastTrick: {
                no: 1,
                leader: 0,
                winner: 0,
                plays: [
                    { seat: 0, card: "9HERC" },
                    { seat: 1, card: "7PIK" }, // opponent, void in trump
                    { seat: 2, card: "8HERC" },
                    { seat: 3, card: "7TREF" }, // opponent, void in trump
                ],
                cards: ["9HERC", "7PIK", "8HERC", "7TREF"],
            },
            played: ["9HERC", "7PIK", "8HERC", "7TREF"],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("APIK")
    })

    it("does not draw when our side has nothing to cash afterwards", () => {
        // Partner called of his own accord and the opponents still hold trumps,
        // but not one card of mine will ever take a trick — stripping the table
        // would achieve nothing.
        const hand: Card[] = ["7HERC", "8HERC", "7PIK", "8TREF"]
        const v = view({
            seat: 0,
            hand,
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("7PIK")
    })

    it("as the caller, draws with the top trump left rather than the jack it no longer has", () => {
        const hand: Card[] = ["9HERC", "7HERC", "APIK", "8TREF", "9TREF", "7KARA", "8KARA"]
        const v = view({
            seat: 0,
            hand,
            handSizes: { 0: 7, 1: 7, 2: 7, 3: 7 },
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 0 }, // I called
            played: ["JHERC", "7PIK", "8PIK", "9PIK"],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("9HERC")
    })

    it("as the caller WITHOUT a top trump, does not lead a small one into their jack", () => {
        const hand: Card[] = ["7HERC", "8HERC", "APIK", "10PIK", "8TREF"]
        const v = view({
            seat: 0,
            hand,
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 0 }, // I called
            trick: { leader: 0, turn: 0, cards: [] },
        })
        // The ace with its own 10 behind it, not a trump.
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("APIK")
    })

    it("does not draw trumps when the partner's call was a mus (fault 3)", () => {
        const v = view({
            seat: 0,
            hand: ["7HERC", "AHERC", "APIK", "8TREF"],
            dealer: 2,
            bidding: { turn: 2, passes: [3, 0, 1], trump: "HERC", caller: 2 }, // forced dealer call
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, ["7HERC", "AHERC", "APIK", "8TREF"], noRng)).toBe("8TREF")
    })

    it("does not draw trumps for an opponent's call", () => {
        const v = view({
            seat: 0,
            hand: ["7HERC", "AHERC", "APIK", "8TREF"],
            dealer: 3,
            bidding: { turn: 2, passes: [], trump: "HERC", caller: 1 }, // opponent called
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, ["7HERC", "AHERC", "APIK", "8TREF"], noRng)).toBe("8TREF")
    })

    it("does not draw trumps when the partner's declarations deny the jack and I have none", () => {
        const v = view({
            seat: 0,
            hand: ["7HERC", "AHERC", "APIK", "8TREF"],
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 },
            declarations: {
                2: [{ kind: "SEQUENCE", cards: ["8HERC", "9HERC", "10HERC"], points: 20 }],
            },
            declarationsRevealed: true,
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, ["7HERC", "AHERC", "APIK", "8TREF"], noRng)).toBe("8TREF")
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

/* Announcing bela is a CHOICE for a human (README §1.4) — but the bot has no
   choice to make. It never sends a `bela` flag, and no flag ANNOUNCES, so a
   bot holding K+Q of trump always declares. The same is true of the move the
   server plays for an absent human on a turn timeout: it goes through this
   exact path, without a flag. Twenty points is a gain on the large majority of
   deals, so silence must never cost them. */
describe("heuristicBot and bela (README §1.4, §5)", () => {
    /** The PLAYING state the server would be in, mirrored to the view the bot
     *  gets: seat 0 leads a trick holding nothing but K+Q of trump. */
    function kingQueenOfTrump(): GameState {
        return {
            config: { targetScore: 1001, seed: "bot-bela" },
            dealNo: 1,
            dealer: 3,
            phase: "PLAYING",
            hands: { 0: ["KHERC", "QHERC"], 1: ["7PIK"], 2: ["7TREF"], 3: ["7KARA"] },
            stock: [],
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            trick: { leader: 0, turn: 0, cards: [] },
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

    it("declares: the card it picks is applied with no flag, and the engine announces", () => {
        const state = kingQueenOfTrump()
        const legal = legalMoves(state, 0)
        expect(legal.slice().sort()).toEqual(["KHERC", "QHERC"])

        const card = heuristicBot.chooseCard(viewFor(state, 0), legal, noRng)
        expect(legal).toContain(card)

        // Exactly the action `gameRoom.actForSeat` builds for a bot move (and
        // for a human whose clock ran out): no `bela` field at all.
        const result = reduce(state, { type: "PLAY", seat: 0, card })
        expect(result.events).toContainEqual({ type: "BELA", seat: 0 })
        expect(result.state.belaDeclared).toBe("A")
        expect(result.state.belaRefused).toBeNull()
        expect(declarationPoints(result.state)).toEqual({ A: 20, B: 0 })
    })
})
