/* Scenario battery for BIDDING (`heuristicBot.chooseBid`, BOT.md §1). Every
 * fixture goes through the public entry point with a `LegalBids` object, so
 * the PRIORITY between the trump-strength gate, the whole-hand threshold, the
 * seat adjustments, the danger ramp and the endgame override is what gets
 * exercised, not the pure helpers in isolation (those already have their own
 * coverage in evaluate.test.ts).
 */
import { describe, expect, it } from "vitest"
import type { Card, LegalBids } from "@bela/engine"
import { heuristicBot } from "../src/heuristicBot"
import { view } from "./helpers"

const noRng = (): number => 0.5
const allSuits: LegalBids = { canPass: true, suits: ["HERC", "KARA", "PIK", "TREF"] }

describe("heuristicBot.chooseBid — seat adjustments on a clean, ordinary score (BOT.md §1)", () => {
    // suitStrength(HERC) = 9(3) + K(.5) + 8(.5) + 7(.5) = 4.5 exactly (clears
    // MIN_TRUMP_STRENGTH on the nose, no jack in the suit at all).
    // handTricks = 0.9 (the 9) + (4 trumps - 3) * 0.45 = 1.35 — no bela (K
    // without the Q), no plain-side value (both fillers are 0-point cards).
    const noJackHand: Card[] = ["9HERC", "KHERC", "8HERC", "7HERC", "7PIK", "8TREF"]

    it("calls when the PARTNER opens the play (easiest seat, threshold 0.85)", () => {
        // dealer = 1 → opener = next(1) = 2 = my partner.
        const v = view({ seat: 0, hand: noJackHand, dealer: 1 })
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("HERC")
    })

    it("calls when I OPEN the play myself (threshold 1.0)", () => {
        // dealer = 3 → opener = next(3) = 0 = me.
        const v = view({ seat: 0, hand: noJackHand, dealer: 3 })
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("HERC")
    })

    it("PASSES the exact same hand when an OPPONENT opens the play and I hold no jack (threshold 1.45)", () => {
        // "Rizik je zvati bez dečka ako ti je igrač prvi na igri" —
        // NO_JACK_UNDER_GUN_PENALTY (+0.35) pushes the threshold to 1.45,
        // above this hand's 1.35 handTricks, even though the same hand calls
        // comfortably from the two easier seats above.
        // dealer = 2 (my partner) → opener = next(2) = 3 = an opponent.
        const v = view({ seat: 0, hand: noJackHand, dealer: 2 })
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("PASS")
    })

    it("still calls when an opponent opens the play, once I actually hold the jack", () => {
        // Same shape (suitStrength 4.5, no bela) but the jack replaces the
        // king, so NO_JACK_UNDER_GUN_PENALTY never applies: handTricks jumps
        // to 1.0 (J) + 0 (8/7) + (3 trumps, no length bonus) = 1.0, against
        // the ORDINARY opponent-opens threshold of 1.1 — not quite enough on
        // its own, so a small plain ace is added to clear it (1.8 total).
        const hand: Card[] = ["JHERC", "8HERC", "7HERC", "APIK", "7PIK", "8TREF"]
        const v = view({ seat: 0, hand, dealer: 2 })
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("HERC")
    })
})

describe("heuristicBot.chooseBid — weak and strong hands regardless of seat (BOT.md §1)", () => {
    // suitStrength tops out at 1.5 (a single ace) in every suit — fails
    // MIN_TRUMP_STRENGTH (4.5) everywhere, so no seat bonus can rescue it.
    const weakHand: Card[] = ["AHERC", "7PIK", "8PIK", "7KARA", "8KARA", "7TREF"]

    it("passes a weak hand from the easiest seat (partner opens)", () => {
        const v = view({ seat: 0, hand: weakHand, dealer: 1 })
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("PASS")
    })

    it("passes the same weak hand from every other seat too", () => {
        for (const dealer of [0, 2, 3] as const) {
            const v = view({ seat: 0, hand: weakHand, dealer })
            expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("PASS")
        }
    })

    // J + 8 + 7 + A + 10 of KARA: suitStrength = 4+.5+.5+1.5+1 = 7.5,
    // handTricks = 1.0(J) + .55(A) + .3(10) + (5-3)*.45 = 2.75 — comfortably
    // above even the toughest ordinary-score threshold (1.45).
    const strongHand: Card[] = ["JKARA", "8KARA", "7KARA", "AKARA", "10KARA", "7HERC"]

    it("calls a strong hand from the hardest seat (opponent opens, no bela risk)", () => {
        const v = view({ seat: 0, hand: strongHand, dealer: 2 })
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("KARA")
    })
})

describe("heuristicBot.chooseBid — forced dealer call (mus), no threshold at all (BOT.md §1)", () => {
    it("calls the best of four weak suits when forced, from a seat other than the usual example", () => {
        // KARA is the only suit clearing even a token score (9+A = 4.5); every
        // other suit is a single low card. A mus ignores BOTH thresholds, so
        // this calls despite failing MIN_TRUMP_STRENGTH by nothing at all —
        // wait, it exactly MEETS 4.5, but the point of a mus test is that it
        // would call even if it did not.
        const hand: Card[] = ["9KARA", "AKARA", "7HERC", "8HERC", "7PIK", "7TREF"]
        const v = view({ seat: 1, hand, dealer: 1, bidding: { turn: 1, passes: [2, 3, 0], trump: null, caller: null } })
        const legal: LegalBids = { canPass: false, suits: ["HERC", "KARA", "PIK", "TREF"] }
        expect(heuristicBot.chooseBid(v, legal, noRng)).toBe("KARA")
    })

    it("still calls the best suit on a mus even when NOT one suit clears the ordinary trump-strength gate", () => {
        // Every suit here is worth less than MIN_TRUMP_STRENGTH (4.5): PIK is
        // the least bad at 1.0 (two low cards). A mus has no gate to fail.
        const hand: Card[] = ["7HERC", "8KARA", "7PIK", "8PIK", "7TREF", "8TREF"]
        const v = view({ seat: 2, hand, dealer: 2, bidding: { turn: 2, passes: [3, 0, 1], trump: null, caller: null } })
        const legal: LegalBids = { canPass: false, suits: ["HERC", "KARA", "PIK", "TREF"] }
        expect(heuristicBot.chooseBid(v, legal, noRng)).toBe("PIK")
    })
})

describe("heuristicBot.chooseBid — the danger ramp against 1001 (BOT.md §1, checkpoints 880/930/950/990)", () => {
    // The ramp (DANGER_RAMP_START 120, SPAN 100) starts at target-120 = 881
    // and is fully clipped to 1 by target-20 = 981, so 880 sits just below it
    // (danger ≈ 0), 990 sits past its top (danger = 1, clipped), and
    // 930/950 sample the middle of the slope.
    const at = (hand: Card[], opponentScore: number, dealer: 0 | 1 | 2 | 3 = 3) =>
        heuristicBot.chooseBid(
            view({ seat: 0, hand, dealer, targetScore: 1001, score: { A: 500, B: opponentScore } }),
            allSuits,
            noRng,
        )

    it("a WEAK hand passes at every checkpoint — the danger ramp only ever tightens the gate further", () => {
        const weakHand: Card[] = ["AHERC", "7PIK", "8PIK", "7KARA", "8KARA", "7TREF"]
        for (const score of [880, 930, 950, 990]) {
            expect(at(weakHand, score)).toBe("PASS")
        }
    })

    it("a VERY STRONG hand (suitStrength ≥ 8) calls at every checkpoint, including full danger", () => {
        // J+9+A+10 of KARA: suitStrength = 4+3+1.5+1 = 9.5 ≥
        // DANGER_MIN_TRUMP_STRENGTH (8); handTricks = 1+.9+.55+.3 = 2.75,
        // plus a plain ace = 3.55, clearing even the 990 threshold (base 1.0
        // for "I open" + 1.5 extra tricks at full danger = 2.5).
        const strongHand: Card[] = ["JKARA", "9KARA", "AKARA", "10KARA", "APIK", "7HERC"]
        for (const score of [880, 930, 950, 990]) {
            expect(at(strongHand, score)).toBe("KARA")
        }
    })

    it("a MIDDLING hand (J+9, suitStrength 7.0) tightens gradually and flips between 930 and 950", () => {
        // suitStrength(HERC) = J(4) + 9(3) = 7.0 — clears MIN_TRUMP_STRENGTH
        // everywhere but fails DANGER_MIN_TRUMP_STRENGTH (8) once danger
        // exceeds (7.0-4.5)/3.5 ≈ 0.71, i.e. around 952 on this ramp.
        // handTricks = 1.0(J) + 0.9(9) = 1.9, with no other value in hand.
        const middlingHand: Card[] = ["JHERC", "9HERC", "7PIK", "8PIK", "7TREF", "8TREF"]
        expect(at(middlingHand, 880)).toBe("HERC")
        expect(at(middlingHand, 930)).toBe("HERC")
        expect(at(middlingHand, 950)).toBe("PASS")
        expect(at(middlingHand, 990)).toBe("PASS")
    })
})

describe("heuristicBot.chooseBid — the endgame override: BOTH sides near the target (BOT.md §1)", () => {
    it("calls a hand it would normally pass when a deal could end the game for EITHER side", () => {
        // Target 701, both scores within one ordinary deal (90) of it: the
        // "never let the opponents pick the trump" rule fires on a hand that
        // would otherwise never call — but it still needs a real trump
        // (suitStrength >= 4, i.e. at least the jack; BOT.md §15.15).
        const weakHand: Card[] = ["JHERC", "7PIK", "8PIK", "7KARA", "8KARA", "7TREF"]
        const v = view({
            seat: 0,
            hand: weakHand,
            dealer: 2, // opponent opens — the hardest ordinary seat
            targetScore: 701,
            score: { A: 620, B: 630 },
        })
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("HERC")
    })

    it("does NOT force a call when only the OPPONENTS are close — we cannot win the game this deal either way", () => {
        const weakHand: Card[] = ["AHERC", "7PIK", "8PIK", "7KARA", "8KARA", "7TREF"]
        const v = view({
            seat: 0,
            hand: weakHand,
            dealer: 2,
            targetScore: 701,
            score: { A: 400, B: 630 },
        })
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("PASS")
    })

    it("does not force a call when only WE are close and the opponents are far behind", () => {
        // mustNotPass requires BOTH sides within one deal; here only we are.
        const weakHand: Card[] = ["AHERC", "7PIK", "8PIK", "7KARA", "8KARA", "7TREF"]
        const v = view({
            seat: 0,
            hand: weakHand,
            dealer: 2,
            targetScore: 701,
            score: { A: 630, B: 300 },
        })
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("PASS")
    })
})

describe("heuristicBot.chooseBid — documented minimum calls, opening seat only, danger clear (BOT.md §1)", () => {
    // "Bela i devetku u zamišljenom adutu te bezec desetku u strancu" — K+Q+9
    // of the trump suit (bela plus the guarding nine) with a backed ten
    // elsewhere. suitStrength here is only 3+2*.5 = 4.0 (K,Q count .5 each,
    // 9 counts 3), below MIN_TRUMP_STRENGTH — the ordinary gate would refuse
    // it; only the documented minimum picks it up.
    const belaHand: Card[] = ["KHERC", "QHERC", "9HERC", "10PIK", "KPIK", "7TREF"]

    it("calls the bela+9+backed-ten minimum when I open the play", () => {
        const v = view({ seat: 0, hand: belaHand, dealer: 3 }) // I open
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("HERC")
    })

    it("passes the same bela+9+backed-ten hand when somebody ELSE opens the play", () => {
        const v = view({ seat: 0, hand: belaHand, dealer: 0 }) // partner deals, opponent opens
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("PASS")
    })

    it("passes the bela+9 minimum once the opponents are near the target, even though I open", () => {
        const v = view({
            seat: 0,
            hand: belaHand,
            dealer: 3,
            targetScore: 1001,
            score: { A: 400, B: 985 },
        })
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("PASS")
    })

    // "Četiri karte u istoj boji" — length alone, no ace, no jack. TREF here
    // scores only 4*.5 = 2.0 on suitStrength, well below the ordinary gate.
    const lengthHand: Card[] = ["7TREF", "8TREF", "QTREF", "KTREF", "7PIK", "8KARA"]

    it("calls the four-of-a-suit minimum when I open the play", () => {
        const v = view({ seat: 0, hand: lengthHand, dealer: 3 })
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("TREF")
    })

    it("passes the four-of-a-suit hand when somebody else opens the play", () => {
        const v = view({ seat: 0, hand: lengthHand, dealer: 1 })
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("PASS")
    })
})

describe("heuristicBot.chooseBid — partner on mus with one prior pass: the ramp stands down (BOT.md §1, §15.2)", () => {
    // The middling J+9 hand from the danger-ramp block above: at B=950
    // (danger ≈ 0.69) it PASSES under the ordinary ramp when I am NOT the
    // partner of the dealer (shown first, as a baseline). `partnerOnMus`
    // (heuristicBot.ts: `bidThreshold`'s RESCUE_PARTNER rebate and
    // `chooseBid`'s ramp-stand-down) is gated on `partnerOf(seat) ===
    // view.dealer && passes.length === 1`. That length is not arbitrary:
    // partnerships are fixed opposite seats (partner(X) = (X+2)%4 always),
    // and the bidding order from a dealer D is [D+1, D+2, D+3, D] — so the
    // seat whose partner IS the dealer is always D+2, the SECOND bidder, who
    // can only ever see exactly one prior pass (D+1's) at the moment of
    // deciding their own bid. `passes.length === 1` is therefore exactly the
    // one reachable moment "suigrač je djelitelj" can be true from my seat.
    const middlingHand: Card[] = ["JHERC", "9HERC", "7PIK", "8PIK", "7TREF", "8TREF"]

    it("passes under the ordinary ramp when my partner is NOT the dealer (baseline)", () => {
        const v = view({
            seat: 0,
            hand: middlingHand,
            dealer: 3, // I open the play myself; partner is not the dealer
            targetScore: 1001,
            score: { A: 500, B: 950 },
        })
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("PASS")
    })

    it("calls the SAME hand at the SAME danger once my partner is the dealer with one prior pass", () => {
        // dealer = 2 (my partner); I am the second bidder in the D+1,D+2,D+3
        // order, so exactly one pass (seat 3's) precedes mine — the ramp
        // stands down and the ordinary rescue bonus applies instead.
        const v = view({
            seat: 0,
            hand: middlingHand,
            dealer: 2,
            targetScore: 1001,
            score: { A: 500, B: 950 },
            bidding: { turn: 0, passes: [3], trump: null, caller: null },
        })
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("HERC")
    })

    it("does NOT stand the ramp down on a fabricated two-pass state — the trigger is exactly one pass", () => {
        // `passes.length === 2` with `partnerOf(seat) === dealer` cannot
        // arise from a real bidding sequence at all (the seat whose partner
        // is dealer is always the SECOND bidder, never the third) — this
        // pins down that the code's `=== 1` check means what it says, not a
        // looser "two or more" reading.
        const v = view({
            seat: 0,
            hand: middlingHand,
            dealer: 2,
            targetScore: 1001,
            score: { A: 500, B: 950 },
            bidding: { turn: 0, passes: [3, 1], trump: null, caller: null },
        })
        expect(heuristicBot.chooseBid(v, allSuits, noRng)).toBe("PASS")
    })
})
