import { describe, expect, it } from "vitest"
import type { Card, GameState, LegalBids } from "@bela/engine"
import { declarationPoints, legalMoves, reduce, viewFor } from "@bela/engine"
import { handTricks, suitStrength, weakestCard } from "../src/evaluate"
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

/* The 2026-09-09 bidding rule (BOT.md §1): two separate questions. WHICH suit
   is about the trump holding alone (`suitStrength`, gated by
   MIN_TRUMP_STRENGTH); WHETHER to call is about the whole hand
   (`handTricks`), the plain aces included. */
describe("heuristicBot.chooseBid — the whole-hand rule (BOT.md §1)", () => {
    const allSuits: LegalBids = { canPass: true, suits: ["HERC", "KARA", "PIK", "TREF"] }

    /** Three plain aces and a long, weak TREF: a fine hand with nothing to
     *  name. Every suit scores 1.5 or below on the trump question. */
    const acesButNoTrumps: Card[] = ["AHERC", "AKARA", "APIK", "7TREF", "8TREF", "QTREF"]

    it("passes below MIN_TRUMP_STRENGTH even when the plain suits are strong", () => {
        const v = view({ seat: 0, hand: acesButNoTrumps })
        // The whole-hand score clears the threshold twice over — and it is
        // still a pass, because naming a suit this hand does not hold is a
        // fall with the bidding already over.
        expect(handTricks(acesButNoTrumps, "HERC")).toBeGreaterThan(2)
        expect(suitStrength(acesButNoTrumps, "HERC")).toBeLessThan(4.5)
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("PASS")
    })

    it("calls on the jack with a card beside it and a plain ace", () => {
        // "dečko i mala u adutu te strani as" — suitStrength 4.5 exactly, and
        // 1.8 expected tricks against a threshold of 1.0 in this seat.
        const hand: Card[] = ["JHERC", "7HERC", "APIK", "7PIK", "8TREF", "9TREF"]
        const v = view({ seat: 0, hand, dealer: 3 }) // dealer 3 → I open the play
        expect(suitStrength(hand, "HERC")).toBe(4.5)
        expect(handTricks(hand, "HERC")).toBeCloseTo(1.8, 10)
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("HERC")
    })

    it("still calls in a mus, where neither threshold applies", () => {
        // The same hand that passes above: on a mus there is no choice, so the
        // trump-strength gate is skipped along with the trick threshold.
        const v = view({ seat: 3, hand: acesButNoTrumps })
        expect(
            heuristicBot.chooseBid(v, { canPass: false, suits: ["HERC", "KARA", "PIK", "TREF"] }, noRng),
        ).toBe("HERC")
    })

    it("calls anyway in the endgame, rather than let the opponents choose the trump", () => {
        // 420 + one ordinary deal carries them past 501 while we stay short:
        // "tad se mora zvati i ne dozvoliti protivniku da bira aduta."
        const v = view({
            seat: 0, // team A
            hand: acesButNoTrumps,
            targetScore: 501,
            score: { A: 300, B: 420 },
        })
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("HERC")
    })

    it("does not fire the endgame exception at an ordinary score", () => {
        const level = view({
            seat: 0,
            hand: acesButNoTrumps,
            targetScore: 501,
            score: { A: 0, B: 0 },
        })
        expect(heuristicBot.chooseBid(level, allSuits, noRng)).toBe("PASS")

        // …nor when we are one deal from the target ourselves: passing does not
        // hand them the game, so the ordinary rule stands.
        const bothClose = view({
            seat: 0,
            hand: acesButNoTrumps,
            targetScore: 501,
            score: { A: 450, B: 420 },
        })
        expect(heuristicBot.chooseBid(bothClose, allSuits, noRng)).toBe("PASS")
    })

    it("ignores the endgame rule entirely when no target is known", () => {
        // A hand-built view may carry no `targetScore`; the score-aware rule is
        // then simply skipped rather than guessed at.
        const v = view({ seat: 0, hand: acesButNoTrumps, score: { A: 300, B: 420 } })
        expect(v.targetScore).toBeUndefined()
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("PASS")
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

    it("forced to ruff my own partner (§1.5, void with trumps) → the weakest trump", () => {
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
        // Void in PIK with trumps in hand: the engine offers only the trumps,
        // every one of which takes the trick off him. The trick is ours
        // either way, so the jack stays home.
        expect(heuristicBot.chooseCard(v, ["JHERC", "7HERC"], noRng)).toBe("7HERC")
    })

    it("third to play: fills partner's safe trick, but never with a BARE ace", () => {
        // Partner led the trump jack; the fourth player cannot beat it, so the
        // trick is ours and every point I add is banked. The ace still stays
        // home — it is a trick of its own, and the user's rule is that an ace
        // goes only when its own 10 is behind it (BOT.md §2.3).
        const bare = view({
            seat: 0,
            hand: ["APIK", "7TREF"],
            handSizes: { 0: 2, 1: 2, 2: 1, 3: 2 },
            trick: {
                leader: 2,
                turn: 0,
                cards: [{ seat: 2, card: "JHERC" }, { seat: 3, card: "7HERC" }],
            },
        })
        expect(heuristicBot.chooseCard(bare, ["APIK", "7TREF"], noRng)).toBe("7TREF")

        // With the 10 of the suit at home the ace is spendable: eleven points
        // are banked and my own 10 inherits the suit.
        const backed = view({
            seat: 0,
            hand: ["APIK", "10PIK", "KTREF"],
            handSizes: { 0: 3, 1: 3, 2: 2, 3: 3 },
            trick: {
                leader: 2,
                turn: 0,
                cards: [{ seat: 2, card: "JHERC" }, { seat: 3, card: "7HERC" }],
            },
        })
        expect(heuristicBot.chooseCard(backed, ["APIK", "10PIK", "KTREF"], noRng)).toBe("APIK")
    })

    it("third to play: does NOT feed an ace while the fourth player could still ruff", () => {
        // Partner holds with the ace of PIK — the master of the suit — but
        // HERC (trump) is unaccounted for and seat 1 has shown nothing.
        const v = view({
            seat: 0,
            hand: ["AKARA", "7TREF"],
            trick: {
                leader: 2,
                turn: 0,
                cards: [{ seat: 2, card: "APIK" }, { seat: 3, card: "8PIK" }],
            },
        })
        expect(heuristicBot.chooseCard(v, ["AKARA", "7TREF"], noRng)).toBe("7TREF")
    })

    it("fills partner's safe trick with the ten, keeping an ace that is a sure trick of its own", () => {
        // Last to play; partner holds. Every trump is gone, so APIK — the
        // master of an untouched suit — wins a whole trick later. The ten goes.
        const v = view({
            seat: 0,
            hand: ["APIK", "10TREF", "7TREF"],
            played: ["7HERC", "8HERC", "9HERC", "10HERC", "JHERC", "QHERC", "KHERC", "AHERC"],
            trick: {
                leader: 1,
                turn: 0,
                cards: [
                    { seat: 1, card: "7KARA" },
                    { seat: 2, card: "AKARA" },
                    { seat: 3, card: "8KARA" },
                ],
            },
        })
        expect(heuristicBot.chooseCard(v, ["APIK", "10TREF", "7TREF"], noRng)).toBe("10TREF")
    })

    it("second to play with the master of the led suit takes the trick with it, not with a provisional nine", () => {
        const v = view({
            seat: 0,
            hand: ["9PIK", "APIK", "7TREF"],
            trick: { leader: 3, turn: 0, cards: [{ seat: 3, card: "7PIK" }] },
        })
        expect(heuristicBot.chooseCard(v, ["9PIK", "APIK"], noRng)).toBe("APIK")
    })

    it("opening quietly never leads a bare ten from the shortest suit", () => {
        const v = view({
            seat: 0,
            hand: ["10PIK", "7TREF", "8TREF", "9TREF"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
        })
        expect(heuristicBot.chooseCard(v, ["10PIK", "7TREF", "8TREF", "9TREF"], noRng)).toBe("7TREF")
    })

    it("opens with the ace on the first round of a suit it holds little of", () => {
        const v = view({
            seat: 0,
            hand: ["APIK", "7PIK", "7TREF", "8TREF"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
        })
        expect(heuristicBot.chooseCard(v, ["APIK", "7PIK", "7TREF", "8TREF"], noRng)).toBe("APIK")
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

    it("partner opened the trump 8 → the NINE, not the cheaper queen (BOT.md §9)", () => {
        // §1.5 makes me go over him and every legal card does, so the old rule
        // took the weakest of them — the queen, three points against the
        // nine's fourteen. But the queen is only provisionally safe: the 10,
        // the ace and the jack all beat it, while the nine falls to the jack
        // alone. He opened low because he wants the trumps drawn.
        const legal: Card[] = ["9HERC", "QHERC"]
        const v = view({
            seat: 0,
            hand: ["9HERC", "QHERC", "7PIK"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 },
            trick: { leader: 2, turn: 0, cards: [{ seat: 2, card: "8HERC" }] },
        })
        expect(weakestCard(legal, "HERC")).toBe("QHERC") // what it used to play
        expect(heuristicBot.chooseCard(v, legal, noRng)).toBe("9HERC")
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

    it("keeps a bare ace back after the first round of its suit and leads something cheap instead (fault 2)", () => {
        const v = view({
            seat: 0,
            hand: ["7PIK", "APIK", "8TREF"],
            played: ["8PIK", "9PIK", "KPIK", "7KARA"], // PIK has been round once; somebody was void
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, ["7PIK", "APIK", "8TREF"], noRng)).toBe("8TREF")
    })

    it("opens quietly from a suit it holds more than one of, not the singleton", () => {
        // TREF is the shortest suit, and the old rule led its 8 for exactly
        // that reason. A singleton is led hoping somebody ruffs it, and the
        // document prices that hope at 2:1 against (`isThinLead`), so the
        // lowest card of the suit it actually holds goes instead.
        const v = view({
            seat: 0,
            hand: ["7PIK", "8PIK", "9PIK", "8TREF"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, ["7PIK", "8PIK", "9PIK", "8TREF"], noRng)).toBe("7PIK")
    })

    it("leads a singleton anyway when every plain card it holds is one", () => {
        // Both plain cards are singletons, so there is no un-thin lead. The
        // fallback must stay OFF the trumps: a trump led here would be a draw
        // that `shouldDrawTrumps` has just refused.
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
        expect(heuristicBot.chooseCard(v, ["7HERC", "AHERC", "APIK", "8TREF"], noRng)).not.toMatch(/HERC$/)
    })

    it("does not draw trumps for an opponent's call", () => {
        const v = view({
            seat: 0,
            hand: ["7HERC", "AHERC", "APIK", "8TREF"],
            dealer: 3,
            bidding: { turn: 2, passes: [], trump: "HERC", caller: 1 }, // opponent called
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, ["7HERC", "AHERC", "APIK", "8TREF"], noRng)).not.toMatch(/HERC$/)
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
        expect(heuristicBot.chooseCard(v, ["7HERC", "AHERC", "APIK", "8TREF"], noRng)).not.toMatch(/HERC$/)
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

    it("as the caller's partner with the bela, leads the trump KING (BOT.md §11)", () => {
        // The sending half of the convention `readSeatFromLeads` reads back:
        // the king says "bela here, and no jack". It outranks drawing trumps,
        // which would otherwise open with the cheap 7 from this same hand.
        const hand: Card[] = ["KHERC", "QHERC", "7PIK", "8TREF"]
        const v = view({
            seat: 0,
            hand,
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 }, // partner called
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("KHERC")
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
