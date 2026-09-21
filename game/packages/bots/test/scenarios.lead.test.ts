/* Scenario battery for LEADING a trick (`heuristicBot.chooseCard` when
 * `view.trick.cards` is empty). BOT.md §5 is the priority list; §13.2-§13.6
 * add the 2026-09-20 table rules that slot into it. Every fixture goes
 * through the public `chooseCard` entry point so the ORDER between these
 * rules — not just each rule in isolation — is what gets exercised.
 */
import { describe, expect, it } from "vitest"
import type { Card, PlayerView, Seat, WonTrick } from "@bela/engine"
import { heuristicBot } from "../src/heuristicBot"
import { view } from "./helpers"

const noRng = (): number => 0.5

/** A completed trick in the engine's shape (cards in play order from `leader`). */
function wonTrick(leader: Seat, cards: Card[], winner: Seat): WonTrick {
    return {
        no: 1,
        leader,
        winner,
        plays: cards.map((card, i) => ({ seat: (((leader + i) % 4) as Seat), card })),
        cards,
    }
}

describe("heuristicBot.chooseCard — the caller's own trump lead sequencing (BOT.md §5.2)", () => {
    it("leads the JACK alone, with no nine or ace of trump in hand", () => {
        const hand: Card[] = ["JPIK", "7PIK", "AKARA", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 1, passes: [], trump: "PIK", caller: 0 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("JPIK")
    })

    it("leads the JACK with the nine but no ace of trump (the special J-9-A sequence needs all three)", () => {
        const hand: Card[] = ["JPIK", "9PIK", "7HERC", "8HERC", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 1, passes: [], trump: "PIK", caller: 0 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("JPIK")
    })

    it("holding J-9-A of trump AND a plain ace, opens with the trump ACE first", () => {
        const hand: Card[] = ["JPIK", "9PIK", "APIK", "AHERC", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 1, passes: [], trump: "PIK", caller: 0 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("APIK")
    })

    it("holding J-9-A of trump WITHOUT a plain ace, opens with the NINE (keeping the jack for last)", () => {
        const hand: Card[] = ["JPIK", "9PIK", "APIK", "7HERC", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 1, passes: [], trump: "PIK", caller: 0 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("9PIK")
    })
})

describe("heuristicBot.chooseCard — the caller WITHOUT the jack, called on length (BOT.md §13.3, §15.6)", () => {
    it("flushes the missing jack with the QUEEN when held, not a small trump", () => {
        const hand: Card[] = ["7PIK", "9PIK", "10PIK", "QPIK", "AHERC", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "PIK", caller: 0 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("QPIK")
    })

    it("flushes with the KING when there is no queen either — never a small trump under the jack", () => {
        const hand: Card[] = ["7PIK", "9PIK", "10PIK", "KPIK", "AHERC", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "PIK", caller: 0 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("KPIK")
    })

    it("flushes with a SMALL trump only when neither queen nor king is held", () => {
        const hand: Card[] = ["7PIK", "8PIK", "10PIK", "AHERC", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "PIK", caller: 0 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("7PIK")
    })

    it("does NOT flush with only two trumps — the length threshold is three", () => {
        // Same shape as the length-call rule's own documented exclusion
        // (BOT.md §13.3): a bare A+10 of trump is not "called on length" at
        // all, so this falls through to something else entirely (the backed
        // plain ace, since PIK is not led at all here).
        const hand: Card[] = ["10PIK", "APIK", "AHERC", "10HERC", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "PIK", caller: 0 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        const card = heuristicBot.chooseCard(v, hand, noRng)
        expect(card).not.toMatch(/PIK$/)
    })
})

describe("heuristicBot.chooseCard — the caller's partner opening the first trick (BOT.md §5.0, §15.4)", () => {
    it("opens with a trump for the caller who voluntarily named it", () => {
        const hand: Card[] = ["KPIK", "7HERC", "8HERC", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "PIK", caller: 2 }, // partner called
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("KPIK")
    })

    it("does NOT open trump with a SOLO nine — plays the ordinary opening book instead", () => {
        const hand: Card[] = ["9PIK", "7HERC", "8HERC", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "PIK", caller: 2 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        const card = heuristicBot.chooseCard(v, hand, noRng)
        expect(card).not.toBe("9PIK")
    })

    it("does NOT open trump with only bare 7s and 8s of it", () => {
        const hand: Card[] = ["7PIK", "8PIK", "7HERC", "8HERC", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "PIK", caller: 2 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        const card = heuristicBot.chooseCard(v, hand, noRng)
        expect(cardIsTrump(card, "PIK")).toBe(false)
    })

    it("does not open his own ace suit while holding no trump at all", () => {
        // §15.3: I am void of trump entirely (openingTrumpForCallingPartner
        // cannot fire), and my ace is my only way back into the lead later —
        // it stays home even though it is the first round of the suit.
        const hand: Card[] = ["AHERC", "7KARA", "8KARA", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "PIK", caller: 2 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).not.toBe("AHERC")
    })
})

function cardIsTrump(card: Card, trump: string): boolean {
    return card.endsWith(trump)
}

describe("heuristicBot.chooseCard — returning the partner's suit (BOT.md §13.2)", () => {
    it("returns a NON-CALLER partner's suit after taking it with the ace, low", () => {
        const first: Card[] = ["QKARA", "7KARA", "AKARA", "8KARA"] // partner (2) opens
        const v = view({
            seat: 0,
            hand: ["9KARA", "7TREF", "8TREF"],
            handSizes: { 0: 3, 1: 3, 2: 3, 3: 3 },
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 }, // opponent called
            tricksWon: { A: 1, B: 0 },
            currentDealPoints: { A: 14, B: 0 },
            played: first,
            trickHistory: [wonTrick(2, first, 0)],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, [...v.hand], noRng)).toBe("9KARA")
    })

    it("returns the SAME suit even when I took it with the TEN instead of the ace (§15.5)", () => {
        const first: Card[] = ["QKARA", "7KARA", "10KARA", "8KARA"] // partner (2) opens, I win with the 10
        const v = view({
            seat: 0,
            hand: ["9KARA", "7TREF", "8TREF"],
            handSizes: { 0: 3, 1: 3, 2: 3, 3: 3 },
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
            tricksWon: { A: 1, B: 0 },
            currentDealPoints: { A: 13, B: 0 },
            played: first,
            trickHistory: [wonTrick(2, first, 0)],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, [...v.hand], noRng)).toBe("9KARA")
    })

    it("returns TRUMP instead when the CALLER-partner opened LOW plain (a request, not a suit to give back)", () => {
        const first: Card[] = ["8KARA", "7KARA", "AKARA", "9KARA"] // caller-partner (2) opens LOW
        const v = view({
            seat: 0,
            hand: ["7HERC", "9KARA", "8TREF"],
            handSizes: { 0: 3, 1: 3, 2: 3, 3: 3 },
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 }, // partner called
            tricksWon: { A: 1, B: 0 },
            currentDealPoints: { A: 11, B: 0 },
            played: first,
            trickHistory: [wonTrick(2, first, 0)],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, [...v.hand], noRng)).toBe("7HERC")
    })

    it("returns the SUIT (not trump) when the CALLER-partner opened a HIGH plain card", () => {
        const first: Card[] = ["KKARA", "7KARA", "AKARA", "9KARA"] // caller-partner (2) opens the KING
        const v = view({
            seat: 0,
            hand: ["7HERC", "9KARA", "8TREF"],
            handSizes: { 0: 3, 1: 3, 2: 3, 3: 3 },
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 },
            tricksWon: { A: 1, B: 0 },
            currentDealPoints: { A: 15, B: 0 },
            played: first,
            trickHistory: [wonTrick(2, first, 0)],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, [...v.hand], noRng)).toBe("9KARA")
    })
})

describe("heuristicBot.chooseCard — low trump back after taking the partner's low trump with the jack (BOT.md §13.4)", () => {
    it("returns a CHEAP trump, keeping the master nine at home", () => {
        const first: Card[] = ["8PIK", "7PIK", "JPIK", "10PIK"] // partner (2) low trump, I win with J
        const hand: Card[] = ["9PIK", "KPIK", "AHERC", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            handSizes: { 0: 4, 1: 4, 2: 4, 3: 4 },
            bidding: { turn: 1, passes: [], trump: "PIK", caller: 2 },
            tricksWon: { A: 1, B: 0 },
            currentDealPoints: { A: 32, B: 0 },
            played: first,
            trickHistory: [wonTrick(2, first, 0)],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("KPIK")
    })
})

describe("heuristicBot.chooseCard — singleton lead to invite a ruff (BOT.md §13.6)", () => {
    /** Trick 1 (a plain KARA trick I win) leaves me on lead for trick 2,
     *  defending against an opponent caller, with no signal history at all. */
    function afterAPlainTrickIWon(hand: Card[], handSize: number): PlayerView {
        const first: Card[] = ["7HERC", "10HERC", "8HERC", "9HERC"]
        return view({
            seat: 0,
            hand,
            handSizes: { 0: handSize, 1: handSize, 2: handSize, 3: handSize },
            bidding: { turn: 1, passes: [], trump: "KARA", caller: 1 }, // opponent called
            played: first,
            trickHistory: [wonTrick(3, first, 0)], // I won it with the 10
            trick: { leader: 0, turn: 0, cards: [] },
        })
    }

    it("leads a singleton with a small trump to ruff it back, unplayed suit, no ace located anywhere", () => {
        const hand: Card[] = ["7KARA", "KPIK", "7TREF", "8TREF", "9TREF", "10TREF"]
        const v = afterAPlainTrickIWon(hand, 6)
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("KPIK")
    })

    it("does NOT use the singleton rule as the CALLER — his trumps are for drawing, not ruffing", () => {
        const hand: Card[] = ["7KARA", "KPIK", "7TREF", "8TREF", "9TREF", "10TREF"]
        const first: Card[] = ["7HERC", "10HERC", "8HERC", "9HERC"]
        const v = view({
            seat: 0,
            hand,
            handSizes: { 0: 6, 1: 6, 2: 6, 3: 6 },
            bidding: { turn: 1, passes: [], trump: "KARA", caller: 0 }, // I called
            played: first,
            trickHistory: [wonTrick(3, first, 0)],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        const card = heuristicBot.chooseCard(v, hand, noRng)
        expect(card).not.toBe("KPIK")
    })

    it("does NOT lead the singleton with no SMALL trump to ruff with (only the jack/nine)", () => {
        const hand: Card[] = ["JKARA", "KPIK", "7TREF", "8TREF", "9TREF", "10TREF"]
        const v = afterAPlainTrickIWon(hand, 6)
        const card = heuristicBot.chooseCard(v, hand, noRng)
        expect(card).not.toBe("KPIK")
    })

    it("does NOT treat a singleton ACE as this rule's business", () => {
        // A plain solo ace on the first round with 4+ cards outstanding is
        // legitimately led by the GENERAL ace-worth-spending rule (BOT.md §6,
        // `shouldSpendAce`) regardless of `singletonLead` — that rule
        // explicitly excludes aces ("solo as nije stvar ovog pravila"), so to
        // isolate its exclusion the ace must NOT also qualify under §6. One
        // extra PIK card already face up (the suit's second round) kills
        // `isFirstRoundOf`, so nothing else can pick the ace here either —
        // singletonLead's own exclusion is the only thing left to check.
        const hand: Card[] = ["7KARA", "APIK", "7TREF", "8TREF", "9TREF", "10TREF"]
        const first: Card[] = ["7HERC", "10HERC", "8HERC", "9HERC"]
        const v = view({
            seat: 0,
            hand,
            handSizes: { 0: 6, 1: 6, 2: 6, 3: 6 },
            bidding: { turn: 1, passes: [], trump: "KARA", caller: 1 },
            played: [...first, "7PIK"], // PIK already round once
            trickHistory: [wonTrick(3, first, 0)],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        const card = heuristicBot.chooseCard(v, hand, noRng)
        expect(card).not.toBe("APIK")
    })

    it("does NOT lead a singleton suit the partner has already shown void in", () => {
        const priorPik: Card[] = ["7PIK", "9PIK", "KKARA", "8PIK"] // partner (2) discards a KARA on a PIK lead — void in PIK
        const hand: Card[] = ["7KARA", "KPIK", "7TREF", "8TREF", "9TREF", "10TREF"]
        const v = view({
            seat: 0,
            hand,
            handSizes: { 0: 6, 1: 6, 2: 6, 3: 6 },
            bidding: { turn: 1, passes: [], trump: "KARA", caller: 1 },
            played: priorPik,
            trickHistory: [wonTrick(0, priorPik, 3)],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        const card = heuristicBot.chooseCard(v, hand, noRng)
        expect(card).not.toBe("KPIK")
    })

    it("does NOT lead a singleton in a suit already played this deal", () => {
        const first: Card[] = ["7PIK", "8PIK", "9PIK", "QPIK"]
        const hand: Card[] = ["7KARA", "KPIK", "7TREF", "8TREF", "9TREF", "10TREF"]
        const v = view({
            seat: 0,
            hand,
            handSizes: { 0: 6, 1: 6, 2: 6, 3: 6 },
            bidding: { turn: 1, passes: [], trump: "KARA", caller: 1 },
            played: first,
            trickHistory: [wonTrick(1, first, 3)],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        const card = heuristicBot.chooseCard(v, hand, noRng)
        expect(card).not.toBe("KPIK")
    })

    it("allows a singleton TEN specifically when the partner's declaration proves he holds that suit's ace", () => {
        const hand: Card[] = ["7KARA", "10PIK", "7TREF", "8TREF", "9TREF"]
        const v = view({
            seat: 0,
            hand,
            handSizes: { 0: 5, 1: 5, 2: 5, 3: 5 },
            bidding: { turn: 1, passes: [], trump: "KARA", caller: 1 },
            declarations: { 2: [{ kind: "SEQUENCE", cards: ["APIK", "KPIK", "QPIK"], points: 20 }] },
            declarationsRevealed: true,
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("10PIK")
    })
})

describe("heuristicBot.chooseCard — cashing a plain ace once the opponents provably hold no trump (BOT.md §5.3)", () => {
    it("cashes a plain ace with length behind it once every trump is accounted for", () => {
        const hand: Card[] = ["APIK", "7PIK", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            handSizes: { 0: 3, 1: 3, 2: 3, 3: 3 },
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
            played: ["7HERC", "8HERC", "9HERC", "10HERC", "JHERC", "QHERC", "KHERC", "AHERC"],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("APIK")
    })

    it("does NOT lead an ace when it would force the PARTNER (shown void, might still hold trump) to ruff it", () => {
        // BOT.md §6's veto: a plain ace led while the partner is a proven
        // void in that suit and the opponents have not been stripped of
        // trump would make HIM burn a trump on my own winning card. This
        // veto also covers `aceToCash`'s narrower "opponents already have no
        // trump" case, since neither can be true here (trump untouched).
        const priorPik: Card[] = ["7PIK", "7KARA", "8PIK", "9PIK"] // partner (2) discards KARA — void in PIK; I win with 9PIK
        const hand: Card[] = ["APIK", "7TREF", "8TREF"]
        const v = view({
            seat: 0,
            hand,
            handSizes: { 0: 3, 1: 3, 2: 3, 3: 3 },
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
            played: priorPik,
            trickHistory: [wonTrick(1, priorPik, 0)],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).not.toBe("APIK")
    })
})

describe("heuristicBot.chooseCard — never pulls trumps that can only be the partner's (BOT.md §14.1 wiring)", () => {
    it("switches off a would-be trump lead once declarations prove every outstanding trump is my partner's", () => {
        // A, 7, K, 8 of trump face up; I hold J, 9, 10; partner's declared
        // king proves the bela — the queen is the only trump left and it is
        // his. Leading trump here would only strip my own side.
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
            trickHistory: [wonTrick(0, cards, 0)],
        })
        const card = heuristicBot.chooseCard(v, [...v.hand], noRng)
        expect(card).not.toMatch(/HERC$/)
    })

    it("still leads trump normally while an OPPONENT could plausibly hold one", () => {
        const cards: Card[] = ["AHERC", "7HERC", "8HERC", "9HERC"] // no bela shown, nothing proven
        const v = view({
            seat: 0,
            hand: ["JHERC", "KHERC", "10HERC", "APIK", "KPIK", "7TREF", "8TREF"],
            handSizes: { 0: 7, 1: 7, 2: 7, 3: 7 },
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            trick: { leader: 0, turn: 0, cards: [] },
            tricksWon: { A: 1, B: 0 },
            currentDealPoints: { A: 25, B: 0 },
            played: cards,
            trickHistory: [wonTrick(0, cards, 0)],
        })
        expect(heuristicBot.chooseCard(v, [...v.hand], noRng)).toBe("JHERC")
    })
})
