/* Scenario battery for ŠTIHAK (BOT.md §8, §14) — the three seats of a chase
 * for all eight tricks: the RUNNER who keeps leading master trumps, his
 * PARTNER who keeps the take-over suit whole, and the DEFENDERS who must not
 * throw away their only stopper. Every fixture goes through the public
 * `heuristicBot.chooseCard`, with the pass already banked
 * (`currentDealPoints[mine] >= 82`) and the opponents still on zero tricks
 * (`stigljaIsLive`), which is what "chasing the štihak" means throughout.
 */
import { describe, expect, it } from "vitest"
import type { Card, PlayerView, Seat, WonTrick } from "@bela/engine"
import { heuristicBot } from "../src/heuristicBot"
import { view } from "./helpers"

const noRng = (): number => 0.5

function wonTrick(leader: Seat, cards: Card[], winner: Seat): WonTrick {
    return {
        no: 1,
        leader,
        winner,
        plays: cards.map((card, i) => ({ seat: (((leader + i) % 4) as Seat), card })),
        cards,
    }
}

describe("heuristicBot.chooseCard — the RUNNER keeps leading master trumps (BOT.md §14.1)", () => {
    it("leads its strongest remaining trump, beyond what the ORDINARY draw rule would stop at", () => {
        // The jack, ace, 10, king, queen, 8 and 7 of trump are all already
        // gone (played elsewhere), so the ordinary `shouldDrawTrumps` (which
        // needs `opponentMax > 0`) would refuse to lead trump at all — there
        // is nothing left to strip. `stigljaTrumpRun` keeps going anyway,
        // because every trump left in the deck is in MY hand and leading it
        // is a free discard for my partner. No jack in hand, so
        // `callerJackLead`/`callerLengthTrumpLead` cannot intercept first.
        const hand: Card[] = ["9HERC", "10HERC", "7PIK"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 }, // I called
            tricksWon: { A: 0, B: 0 },
            currentDealPoints: { A: 85, B: 0 }, // pass already banked
            played: ["JHERC", "AHERC", "KHERC", "QHERC", "8HERC", "7HERC"],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("9HERC")
    })

    it("stops the run once the only trumps left outstanding can only be the partner's", () => {
        // Same shape as the ordinary "never pulls only the partner's trumps"
        // wiring test, with a štihak now also live and chased: A, 7, K, 8 of
        // trump are face up, both opponents have shown void in trump on the
        // last trick, so whatever is left of HERC must be my partner's.
        const hand: Card[] = ["JHERC", "AHERC", "APIK", "8TREF"]
        const v = view({
            seat: 0,
            hand,
            dealer: 3,
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            tricksWon: { A: 1, B: 0 },
            currentDealPoints: { A: 85, B: 0 },
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
        const card = heuristicBot.chooseCard(v, hand, noRng)
        expect(card).not.toMatch(/HERC$/)
    })

    it("stops the run once the partner has discarded from EVERY suit the runner still needs him for", () => {
        // Partner threw a PIK card on a KARA lead — void in KARA, and PIK is
        // my only NEEDED plain suit (no master of my own there). The
        // historical trick's led suit is KARA (not TREF) specifically so
        // that partner's proven void lands away from PIK, leaving `avoids`
        // clean at exactly [PIK] with no accidental "wants" side-signal from
        // the same play. No jack in hand (already gone, accounted below) so
        // the ordinary caller leads cannot intercept first.
        const first: Card[] = ["7KARA", "8PIK", "8KARA", "9KARA"] // leader 1, partner (2) discards PIK
        const hand: Card[] = ["9HERC", "10HERC", "7PIK", "AKARA"]
        const v = view({
            seat: 0,
            hand,
            handSizes: { 0: 4, 1: 6, 2: 7, 3: 6 },
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            tricksWon: { A: 1, B: 0 },
            currentDealPoints: { A: 85, B: 0 },
            played: [...first, "JHERC", "AHERC", "KHERC", "QHERC", "8HERC", "7HERC"],
            trickHistory: [wonTrick(1, first, 0)],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("AKARA")
    })

    it("keeps the LAST trump as a re-entry when there is nothing to follow it up with", () => {
        // Every other trump is already accounted for (outstanding is 0, so
        // the separate "only the partner's trumps" stop above does not
        // apply here). PIK is my only plain card and no master of its own,
        // and I hold nothing else to follow up with — no plain master, no
        // suit my partner has asked for, no ace of my own already cashed —
        // so the run stops rather than spending its last card for nothing.
        const hand: Card[] = ["9HERC", "7PIK"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            tricksWon: { A: 1, B: 0 },
            currentDealPoints: { A: 85, B: 0 },
            played: ["JHERC", "AHERC", "10HERC", "KHERC", "QHERC", "8HERC", "7HERC"],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).not.toBe("9HERC")
    })

    it("DOES lead the last trump when a plain suit still needs the partner, as long as I hold a DIFFERENT plain master to follow up with", () => {
        // PIK's ace is already gone (played away), so my 10PIK is now that
        // suit's master — a real card to keep the lead alive with. TREF
        // still needs the partner (my only TREF card is a bare 7), so the
        // "unanswered suit" condition that stopped the previous test is
        // present here too — but this time there IS something to follow
        // with, so the last trump goes.
        const hand: Card[] = ["9HERC", "10PIK", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            tricksWon: { A: 1, B: 0 },
            currentDealPoints: { A: 85, B: 0 },
            played: ["JHERC", "AHERC", "10HERC", "KHERC", "QHERC", "8HERC", "7HERC", "APIK"],
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("9HERC")
    })
})

describe("heuristicBot.chooseCard — the runner's PARTNER keeps the take-over suit whole (BOT.md §14.2)", () => {
    it("discards the abandoned suits high to low, shortest first, while the runner draws", () => {
        // Partner (seat 2, the runner) leads the trump JACK — unbeatable, so
        // the trick is safe regardless of my position. I have nothing in
        // trump; KARA (4 cards) is my take-over suit by LENGTH, PIK and TREF
        // are not. The shortest abandoned suit — PIK — clears first.
        const hand: Card[] = ["7KARA", "8KARA", "9KARA", "10KARA", "7PIK", "7TREF", "8TREF"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 2 }, // partner called
            tricksWon: { A: 1, B: 0 },
            currentDealPoints: { A: 85, B: 0 },
            trick: {
                leader: 2,
                turn: 0,
                cards: [
                    { seat: 2, card: "JHERC" },
                    { seat: 3, card: "7HERC" },
                ],
            },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("7PIK")
    })

    it("never touches the take-over suit while any abandoned card remains, even a valuable one", () => {
        const hand: Card[] = ["7KARA", "8KARA", "9KARA", "10KARA", "KTREF", "QTREF"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 2 },
            tricksWon: { A: 1, B: 0 },
            currentDealPoints: { A: 85, B: 0 },
            trick: {
                leader: 2,
                turn: 0,
                cards: [
                    { seat: 2, card: "JHERC" },
                    { seat: 3, card: "7HERC" },
                ],
            },
        })
        const card = heuristicBot.chooseCard(v, hand, noRng)
        expect(card).not.toMatch(/KARA$/)
        expect(card).toBe("KTREF")
    })
})

describe("heuristicBot.chooseCard — the DEFENDER keeps the guard on his only stopper (BOT.md §14.3)", () => {
    /** Opponents (from my seat's perspective, my SIDE is defending) have
     *  already taken both tricks so far — the štihak is live against me. */
    function opponentsRunningAgainstMe(hand: Card[], played: Card[], handSize: number): PlayerView {
        return view({
            seat: 0,
            hand,
            handSizes: { 0: handSize, 1: handSize, 2: handSize, 3: handSize },
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 1 }, // opponent called
            tricksWon: { A: 0, B: 2 },
            played,
            trick: { leader: 1, turn: 0, cards: [{ seat: 1, card: "7HERC" }] }, // opponent leads trump; I have none, must discard
        })
    }

    it("keeps a 10-plus-two-small guard under an outstanding ace whole, discards elsewhere", () => {
        // TREF: I hold 10-8-7 (three cards) with the ace still out — the
        // guard needs all three (one stronger card outstanding + 1 = 2, but
        // holding exactly the cards needed to survive two more rounds keeps
        // the lot). KARA is a safe, unguarded single to throw instead.
        const hand: Card[] = ["10TREF", "8TREF", "7TREF", "7KARA"]
        const v = opponentsRunningAgainstMe(hand, [], 4)
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("7KARA")
    })

    it("keeps a king-plus-three guard under both the ace and ten outstanding whole", () => {
        const hand: Card[] = ["KPIK", "9PIK", "8PIK", "7PIK", "7KARA"]
        const v = opponentsRunningAgainstMe(hand, [], 5)
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("7KARA")
    })

    it("keeps a BARE master (already the highest outstanding) rather than throwing it away", () => {
        // Every higher TREF card is already face up; my lone king is now
        // the suit's master and the only card that can ever stop it.
        const hand: Card[] = ["KTREF", "7KARA"]
        const played: Card[] = ["ATREF", "10TREF"]
        const v = opponentsRunningAgainstMe(hand, played, 2)
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("7KARA")
    })

    it("says NOTHING special (falls back to the ordinary discard) while MY side still holds a trick", () => {
        // Same guarded shape as the first case, but my side has already won
        // one trick this deal — `opponentsChasingStiglja` needs the
        // opponents on ALL tricks so far (at least two), so this is not a
        // štihak defence at all; the ordinary cheapest-discard rule decides
        // instead (and may well break the "guard").
        const hand: Card[] = ["10TREF", "8TREF", "7TREF", "7KARA"]
        const v = view({
            seat: 0,
            hand,
            handSizes: { 0: 4, 1: 4, 2: 4, 3: 4 },
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 1 },
            tricksWon: { A: 1, B: 1 }, // my side has a trick — not a štihak defence
            trick: { leader: 1, turn: 0, cards: [{ seat: 1, card: "7HERC" }] },
        })
        // Cheapest legal discard by points: all four are 0 points, so the
        // ordinary tie-break (shortest suit) applies rather than any guard.
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("7KARA")
    })
})
