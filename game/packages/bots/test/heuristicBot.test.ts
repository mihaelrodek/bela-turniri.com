import { describe, expect, it } from "vitest"
import type { Card, GameState, LegalBids, PlayerView, Seat } from "@bela/engine"
import { cardSuit, declarationPoints, legalMoves, reduce, viewFor } from "@bela/engine"
import { handTricks, suitStrength, weakestCard } from "../src/evaluate"
import { heuristicBot } from "../src/heuristicBot"
import { view } from "./helpers"

const noRng = (): number => 0.5 // heuristic card play is deterministic

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

    it("calls anyway in a tight endgame, rather than let the opponents choose the trump", () => {
        // Both sides are one ordinary deal from 501: whoever takes and passes
        // wins, so "tad se mora zvati i ne dozvoliti protivniku da bira aduta."
        // A lone trump jack would never call at an ordinary score (no second
        // trick anywhere), but it is a real trump, and here that is enough.
        const loneJack: Card[] = ["JHERC", "7PIK", "8PIK", "7TREF", "8TREF", "7KARA"]
        const tight = { seat: 0 as const, hand: loneJack, dealer: 0 as const, targetScore: 501 as const }
        expect(heuristicBot.chooseBid(view({ ...tight, score: { A: 0, B: 0 } }), allSuits, noRng)).toBe("PASS")
        expect(heuristicBot.chooseBid(view({ ...tight, score: { A: 450, B: 420 } }), allSuits, noRng)).toBe("HERC")
        // Aces with no trump at all are still a fall, tight endgame or not
        // (reported 2026-09-21; this test asserted the opposite until then).
        const junk = view({ seat: 0, hand: acesButNoTrumps, dealer: 0, targetScore: 501, score: { A: 450, B: 420 } })
        expect(heuristicBot.chooseBid(junk, allSuits, noRng)).toBe("PASS")
    })

    it("does not make the endgame call on a junk trump, nor when the pass puts an OPPONENT on mus", () => {
        // Reported: 92:90 to 163, the bot called HERC on 8-Q-A with the
        // opposing dealer next to speak.
        const junk: Card[] = ["8HERC", "QHERC", "AHERC", "7PIK", "8TREF", "9KARA"]
        const reported = view({ seat: 2, hand: junk, dealer: 3, targetScore: 163 as never, score: { A: 92, B: 90 } })
        expect(heuristicBot.chooseBid(reported, allSuits, noRng)).toBe("PASS")
        // Same junk with my own PARTNER dealing: still no call — it is a fall.
        const partnerDeals = view({ seat: 1, hand: junk, dealer: 3, targetScore: 501, score: { A: 450, B: 430 } })
        expect(heuristicBot.chooseBid(partnerDeals, allSuits, noRng)).toBe("PASS")
        // A real trump (the jack) still makes the forced call when a partner deals…
        const jack: Card[] = ["JHERC", "7HERC", "7PIK", "8TREF", "9KARA", "8KARA"]
        const mustCall = view({ seat: 1, hand: jack, dealer: 3, targetScore: 501, score: { A: 450, B: 430 } })
        expect(heuristicBot.chooseBid(mustCall, allSuits, noRng)).toBe("HERC")
        // …but not when passing forces the opposing dealer instead.
        const forceHim = view({ seat: 2, hand: jack, dealer: 3, targetScore: 501, score: { A: 450, B: 430 } })
        expect(heuristicBot.chooseBid(forceHim, allSuits, noRng)).toBe("PASS")
    })

    it("the quick game to 163 is not one long endgame: the forced call starts at 122, not at 73", () => {
        // A lone jack: passes at an ordinary score, calls only in the endgame.
        const loneJack: Card[] = ["JHERC", "7PIK", "8PIK", "7TREF", "8TREF", "7KARA"]
        const at = (a: number, b: number) =>
            heuristicBot.chooseBid(
                view({ seat: 0, hand: loneJack, dealer: 0, targetScore: 163 as never, score: { A: a, B: b } }),
                allSuits,
                noRng,
            )
        expect(at(92, 90)).toBe("PASS")
        expect(at(125, 130)).toBe("HERC")
    })

    it("does not fire the endgame exception at an ordinary score", () => {
        const level = view({
            seat: 0,
            hand: acesButNoTrumps,
            targetScore: 501,
            score: { A: 0, B: 0 },
        })
        expect(heuristicBot.chooseBid(level, allSuits, noRng)).toBe("PASS")
    })

    it("does not force a weak call when only the opponents are near the target", () => {
        // 300 + one deal cannot reach 501, so we cannot win the game this deal:
        // a junk call would only fall and hand them everything. Same for
        // 572 vs 924 on 1001 (the reported deal).
        const short = view({
            seat: 0,
            hand: acesButNoTrumps,
            targetScore: 501,
            score: { A: 300, B: 420 },
        })
        expect(heuristicBot.chooseBid(short, allSuits, noRng)).toBe("PASS")
        const far = view({
            seat: 0,
            hand: acesButNoTrumps,
            targetScore: 1001,
            score: { A: 572, B: 924 },
        })
        expect(heuristicBot.chooseBid(far, allSuits, noRng)).toBe("PASS")
    })

    it("passes a middling call when the opponents are almost at the target", () => {
        // J + 7 of trumps and a plain ace calls at an ordinary score, but with
        // the opponents on 990 a fall would hand them the game.
        const hand: Card[] = ["JHERC", "7HERC", "APIK", "7PIK", "8TREF", "9TREF"]
        const calm = view({ seat: 0, hand, dealer: 3, targetScore: 1001, score: { A: 500, B: 400 } })
        expect(heuristicBot.chooseBid(calm, allSuits, noRng)).toBe("HERC")
        const close = view({ seat: 0, hand, dealer: 3, targetScore: 1001, score: { A: 500, B: 990 } })
        expect(heuristicBot.chooseBid(close, allSuits, noRng)).toBe("PASS")
    })

    it("still calls near the target with a hand that is very likely to make it", () => {
        // Jack, nine, ace and length of trumps: worth the risk even at 990.
        const hand: Card[] = ["JHERC", "9HERC", "AHERC", "10HERC", "AKARA", "7PIK"]
        const v = view({ seat: 0, hand, dealer: 3, targetScore: 1001, score: { A: 500, B: 990 } })
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("HERC")
    })

    it("tightens gradually rather than at a fixed score", () => {
        // A hand that calls at 900 but not at 990: the ramp sits between.
        const hand: Card[] = ["JHERC", "7HERC", "APIK", "7PIK", "8TREF", "9TREF"]
        const at = (b: number) =>
            heuristicBot.chooseBid(
                view({ seat: 0, hand, dealer: 3, targetScore: 1001, score: { A: 500, B: b } }),
                allSuits,
                noRng,
            )
        expect(at(880)).toBe("HERC")
        expect(at(990)).toBe("PASS")
    })

    it("calls the document's minimum hands only from the opening seat", () => {
        // Bela + nine with a backed ten elsewhere: suitStrength is only 4.0,
        // so the yardstick passes it; the document calls it when I open.
        const bela: Card[] = ["KHERC", "QHERC", "9HERC", "10PIK", "KPIK", "7TREF"]
        const opening = view({ seat: 0, hand: bela, dealer: 3 })
        expect(heuristicBot.chooseBid(opening, allSuits, noRng)).toBe("HERC")
        const notOpening = view({ seat: 0, hand: bela, dealer: 0 })
        expect(heuristicBot.chooseBid(notOpening, allSuits, noRng)).toBe("PASS")

        // Four small cards of one suit, again only when I open the play.
        const long: Card[] = ["7TREF", "8TREF", "QTREF", "KTREF", "7PIK", "8KARA"]
        expect(heuristicBot.chooseBid(view({ seat: 0, hand: long, dealer: 3 }), allSuits, noRng)).toBe("TREF")
        expect(heuristicBot.chooseBid(view({ seat: 0, hand: long, dealer: 1 }), allSuits, noRng)).toBe("PASS")
    })

    it("does not make a documented minimum call while the opponents are near the target", () => {
        const long: Card[] = ["7TREF", "8TREF", "QTREF", "KTREF", "7PIK", "8KARA"]
        const v = view({ seat: 0, hand: long, dealer: 3, targetScore: 1001, score: { A: 400, B: 985 } })
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("PASS")
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

    it("partner opened low trump and I lack the nine → the JACK, not king or ten", () => {
        const legal: Card[] = ["JHERC", "10HERC", "KHERC"]
        const v = view({
            seat: 0,
            hand: [...legal, "7PIK"],
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            trick: {
                leader: 2,
                turn: 0,
                cards: [{ seat: 2, card: "7HERC" }, { seat: 3, card: "7PIK" }],
            },
        })
        expect(heuristicBot.chooseCard(v, legal, noRng)).toBe("JHERC")
    })

    it("does not return a lone trump ten underneath an outstanding nine", () => {
        const hand: Card[] = ["10HERC", "7PIK", "8PIK"]
        const previous = {
            no: 1,
            leader: 2 as const,
            winner: 2 as const,
            plays: [
                { seat: 2 as const, card: "7HERC" as const },
                { seat: 3 as const, card: "8HERC" as const },
                { seat: 0 as const, card: "QHERC" as const },
                { seat: 1 as const, card: "KHERC" as const },
            ],
            cards: ["7HERC", "8HERC", "QHERC", "KHERC"] as Card[],
        }
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 2 },
            played: [...previous.cards],
            trickHistory: [previous],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("7PIK")
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
    it("opens a lone trump ten when the partner called that suit", () => {
        const hand: Card[] = ["10PIK", "7HERC", "8HERC", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            dealer: 3,
            bidding: { turn: 0, passes: [], trump: "PIK", caller: 2 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("10PIK")
    })

    it("leads the trump jack when my team called and I hold it", () => {
        const v = view({
            seat: 0,
            hand: ["JHERC", "7PIK", "APIK"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 0 }, // I (seat 0) called
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, ["JHERC", "7PIK", "APIK"], noRng)).toBe("JHERC")
    })

    it("as the caller with jack and a low trump, always opens the jack", () => {
        const hand: Card[] = ["JPIK", "8PIK", "AHERC", "7HERC", "10KARA", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 1, passes: [], trump: "PIK", caller: 0 },
            trick: { leader: 0, turn: 0, cards: [] },
        })

        expect(heuristicBot.chooseCard(v, hand, () => 0.2)).toBe("JPIK")
        expect(heuristicBot.chooseCard(v, hand, () => 0.95)).toBe("JPIK")
    })

    it("does not randomly replace the caller's jack with a low trump", () => {
        const hand: Card[] = ["JPIK", "8PIK", "7HERC", "8HERC", "10KARA", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 1, passes: [], trump: "PIK", caller: 0 },
            trick: { leader: 0, turn: 0, cards: [] },
        })

        expect(heuristicBot.chooseCard(v, hand, () => 0.95)).toBe("JPIK")
    })

    it("applies the caller's jack lead whenever it opens a trick", () => {
        const hand: Card[] = ["JPIK", "8PIK", "AHERC", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            played: ["7PIK", "9PIK", "10PIK", "QPIK", "KPIK", "APIK"],
            bidding: { turn: 1, passes: [], trump: "PIK", caller: 0 },
            trick: { leader: 0, turn: 0, cards: [] },
        })

        expect(heuristicBot.chooseCard(v, hand, () => 0.2)).toBe("JPIK")
    })

    it("does not override the caller's special jack-nine-ace sequence", () => {
        const hand: Card[] = ["JPIK", "9PIK", "APIK", "7HERC", "8HERC", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 1, passes: [], trump: "PIK", caller: 0 },
            trick: { leader: 0, turn: 0, cards: [] },
        })

        expect(heuristicBot.chooseCard(v, hand, () => 0.2)).toBe("9PIK")
    })

    it("as the caller with a J-Q-K declaration, leads the jack rather than the queen", () => {
        const hand: Card[] = ["JHERC", "QHERC", "KHERC", "7PIK", "8PIK"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 0 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("JHERC")
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
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
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
            // One trick each: with no trick lost the štihak would still be
            // alive, and then the last trump DOES go first (BOT.md §14.1) —
            // a different rule from the one this test is about.
            tricksWon: { A: 1, B: 1 },
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
        // After the mandatory opening lead is over, partner called and the
        // opponents still hold trumps, but not one card of mine will ever take
        // a trick — continuing to strip the table would achieve nothing.
        const hand: Card[] = ["7HERC", "8HERC", "7PIK", "8TREF"]
        const v = view({
            seat: 0,
            hand,
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 },
            played: ["7KARA", "8KARA", "9KARA", "QKARA"],
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

    it("on defence, follows an ace win with the master nine to capture the remaining trump ten", () => {
        const hand: Card[] = ["9HERC", "7PIK", "8PIK", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            handSizes: { 0: 4, 1: 4, 2: 4, 3: 4 },
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 1 },
            played: ["JHERC", "AHERC", "KHERC", "QHERC", "8HERC", "7HERC"],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("9HERC")
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

/* 2026-09-20, reported: "bot i dalje uzima svojem suigraču adute iako bi
   trebao znati da ih protivnici nemaju". Leading trump has exactly one point
   — stripping the OPPONENTS. Once they are provably out of it, every trump
   lead only pulls the partner's, so the bot leads something else. */
describe("heuristicBot.chooseCard — never pulls only the partner's trumps", () => {
    /** Seat 0 called HERC and leads the second trick; the first was a plain
     *  KARA trick whose cards the scenario supplies. */
    function afterKaraTrick(cards: Card[]): PlayerView {
        return view({
            seat: 0,
            hand: ["JHERC", "9HERC", "APIK", "KPIK", "7TREF", "8TREF", "9TREF"],
            handSizes: { 0: 7, 1: 7, 2: 7, 3: 7 },
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            trick: { leader: 0, turn: 0, cards: [] },
            tricksWon: { A: 1, B: 0 },
            currentDealPoints: { A: 11, B: 0 },
            played: cards,
            trickHistory: [
                {
                    no: 1,
                    leader: 0,
                    winner: 0,
                    plays: cards.map((card, i) => ({ seat: (i as Seat), card })),
                    cards,
                },
            ],
        })
    }

    it("leads a plain suit once both opponents discarded instead of ruffing", () => {
        // Seats 1 and 3 threw PIK on a KARA lead: §1.5 would have obliged them
        // to ruff, so neither holds a trump. Every trump still out is my
        // partner's and the caller's jack stays in hand.
        const v = afterKaraTrick(["AKARA", "7PIK", "8KARA", "9PIK"])
        const card = heuristicBot.chooseCard(v, [...v.hand], noRng)
        expect(cardSuit(card)).not.toBe("HERC")
    })

    it("leads a plain suit when the counting accounts for every trump outside my hand", () => {
        // A, 7, K, 8 of trump are face up, I hold J, 9 and 10, and my
        // partner's king announced the bela — the queen is the only trump left
        // and it is his.
        const cards: Card[] = ["AHERC", "7HERC", "KHERC", "8HERC"]
        const v = view({
            seat: 0,
            hand: ["JHERC", "9HERC", "10HERC", "APIK", "KPIK", "7TREF", "8TREF"],
            handSizes: { 0: 7, 1: 7, 2: 7, 3: 7 },
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            trick: { leader: 0, turn: 0, cards: [] },
            tricksWon: { A: 1, B: 0 },
            currentDealPoints: { A: 15, B: 0 },
            belaDeclared: "A",
            played: cards,
            trickHistory: [
                {
                    no: 1,
                    leader: 0,
                    winner: 0,
                    plays: cards.map((card, i) => ({ seat: (i as Seat), card })),
                    cards,
                },
            ],
        })
        const card = heuristicBot.chooseCard(v, [...v.hand], noRng)
        expect(cardSuit(card)).not.toBe("HERC")
    })

    it("still pulls trumps while an opponent may hold one", () => {
        // The same deal with the first trick followed in suit: nothing is
        // proven about anybody's trumps, so the caller leads his jack.
        const v = afterKaraTrick(["AKARA", "7KARA", "8KARA", "9KARA"])
        expect(heuristicBot.chooseCard(v, [...v.hand], noRng)).toBe("JHERC")
    })

    it("leads a trump anyway from a hand that holds nothing else", () => {
        const v = afterKaraTrick(["AKARA", "7PIK", "8KARA", "9PIK"])
        const trumpsOnly: PlayerView = { ...v, hand: ["JHERC", "9HERC"] }
        expect(cardSuit(heuristicBot.chooseCard(trumpsOnly, ["JHERC", "9HERC"], noRng))).toBe("HERC")
    })
})

/* 2026-09-20, reported from a live table: six rules about cards that are worth
   more now than in two tricks' time (BOT.md §13). These are the WIRING tests —
   each rule's own conditions are unit-tested in `evaluate.test.ts`. */
describe("heuristicBot — BOT.md §13, the reported table rules", () => {
    it("§13.1 last with A and 10 of the led suit: takes it with the ACE, not the king", () => {
        const hand: Card[] = ["APIK", "10PIK", "KPIK"]
        const v = view({
            seat: 0,
            hand,
            played: ["7PIK", "8PIK", "JPIK"],
            trick: {
                leader: 1,
                turn: 0,
                cards: [
                    { seat: 1, card: "7PIK" },
                    { seat: 2, card: "8PIK" },
                    { seat: 3, card: "JPIK" },
                ],
            },
        })
        // The king wins this trick for four points and leaves the ace and the
        // ten in a suit that has now gone round once.
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("APIK")
    })

    it("§13.2 returns the suit the partner opened and I took with the ace", () => {
        const first: Card[] = ["KPIK", "7PIK", "APIK", "8PIK"]
        const v = view({
            seat: 0,
            hand: ["9PIK", "7TREF", "8TREF"],
            handSizes: { 0: 3, 1: 3, 2: 3, 3: 3 },
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
            tricksWon: { A: 1, B: 0 },
            currentDealPoints: { A: 15, B: 0 },
            played: first,
            trickHistory: [
                { no: 1, leader: 2, winner: 0, plays: first.map((card, i) => ({ seat: (((2 + i) % 4) as Seat), card })), cards: first },
            ],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, [...v.hand], noRng)).toBe("9PIK")
    })

    it("§13.2 answers the CALLER's low opening with a trump instead of the suit", () => {
        // Only the caller's low card is the request for trump (owner's
        // correction, 2026-09-20); from a partner who did not call, the same
        // card is a possible singleton and the suit goes back.
        const first: Card[] = ["8PIK", "7PIK", "APIK", "9PIK"]
        const v = view({
            seat: 0,
            hand: ["7HERC", "10PIK", "8TREF"],
            handSizes: { 0: 3, 1: 3, 2: 3, 3: 3 },
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 },
            tricksWon: { A: 1, B: 0 },
            currentDealPoints: { A: 11, B: 0 },
            played: first,
            trickHistory: [
                { no: 1, leader: 2, winner: 0, plays: first.map((card, i) => ({ seat: (((2 + i) % 4) as Seat), card })), cards: first },
            ],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, [...v.hand], noRng)).toBe("7HERC")
    })

    it("§13.3 the caller who called on length flushes the jack with his queen, not a 7/8", () => {
        const hand: Card[] = ["7HERC", "9HERC", "10HERC", "QHERC", "APIK"]
        const v = view({
            seat: 0,
            hand,
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 0 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("QHERC")
    })

    it("§13.4 after taking his low trump with the jack, returns a cheap trump and keeps the nine", () => {
        const first: Card[] = ["7HERC", "8HERC", "JHERC", "10HERC"]
        const hand: Card[] = ["9HERC", "QHERC", "APIK", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            handSizes: { 0: 4, 1: 4, 2: 4, 3: 4 },
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 },
            tricksWon: { A: 1, B: 0 },
            currentDealPoints: { A: 30, B: 0 },
            played: first,
            trickHistory: [
                { no: 1, leader: 2, winner: 0, plays: first.map((card, i) => ({ seat: (((2 + i) % 4) as Seat), card })), cards: first },
            ],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        // `trumpDrawCard` would lead the master nine here; this rule outranks
        // it deliberately, because the nine is the card being protected.
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("QHERC")
    })

    it("§13.5 wins the trump trick with the JACK while the nine is still behind me", () => {
        const v = view({
            seat: 0,
            hand: ["JHERC", "AHERC", "7PIK"],
            played: ["KHERC", "10HERC"],
            trick: {
                leader: 2,
                turn: 0,
                cards: [
                    { seat: 2, card: "KHERC" },
                    { seat: 3, card: "10HERC" },
                ],
            },
        })
        // The ace is the cheaper winner by points, and seat 1's nine would
        // take it off the table.
        expect(heuristicBot.chooseCard(v, ["JHERC", "AHERC"], noRng)).toBe("JHERC")
    })
})
