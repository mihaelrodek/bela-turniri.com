/* Scenario battery for heuristicBot.chooseCard when DISCARDING — my partner
 * holds the trick (feeding it, BOT.md §2/§4) or the opponents do (silent,
 * BOT.md §2.0). Asserted through the public `chooseCard` entry point only. */
import { describe, expect, it } from "vitest"
import type { Card } from "@bela/engine"
import { heuristicBot } from "../src/heuristicBot"
import { view } from "./helpers"

const noRng = (): number => 0.5

describe("chooseCard (discard) — partner drawing trumps, backed ace on his JACK (BOT.md §15 fix #1)", () => {
    it("throws the backed ace in on the partner's trump jack, keeping the ten as the new master", () => {
        // "na tvog dečka staviti tog asa da ti napuni, a ujedno pokaže da ima
        // desetku" — APIK is backed by 10PIK, so it goes in whole (11 points)
        // rather than being nursed as a future trick.
        const hand: Card[] = ["APIK", "10PIK", "7HERC", "8HERC"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 2 }, // partner is the caller
            trick: {
                leader: 2,
                turn: 0,
                cards: [
                    { seat: 2, card: "JHERC" }, // partner leads the master trump
                    { seat: 3, card: "7HERC" },
                ],
            },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("APIK")
    })

    it("does NOT substitute a BARE ace on the same jack lead — the abandon-suit logic runs instead", () => {
        // Same premise, but the ace has no ten behind it. The onJack shortcut
        // requires a genuinely backed ace; without one, the ordinary
        // "abandon the shortest suit first" convention takes over, and the
        // bare ace's own suit (PIK) counts as worth keeping (README/BOT.md:
        // holding the ace alone already qualifies), so it never gets touched.
        const hand: Card[] = ["APIK", "7HERC", "8HERC", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 2 },
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
        expect(card).not.toBe("APIK")
    })
})

describe("chooseCard (discard) — partner drawing trumps, a suit to take over: abandon high-to-low, shortest first (BOT.md §15 fix #1)", () => {
    // Every fixture in this block sets `tricksWon` so the OTHER team already
    // has a trick, i.e. `stigljaIsLive` is false. Left at the `view()`
    // default (0-0, nobody has won a trick yet, true at the very start of
    // every deal), `stigljaSignalDiscard` — a separate, štihak-specific rule
    // that happens to share the same "shortest suit, high card" shape —
    // would fire first and mask what `signalDiscard` itself does.
    //
    // The "keep" suit also has to be a BACKED ace (ace + 10 together), not a
    // bare one: a bare ace is stripped out of the candidate pool entirely by
    // `fillCard`'s unconditional bare-ace exclusion, taking its whole suit
    // out of the "what's worth keeping" scan before `signalDiscard` ever
    // runs — so a bare ace can't anchor the "kept suit" side of this rule at
    // all, only a backed one can.
    //
    // Partner leads the trump ACE rather than the jack: with a backed ace of
    // my own in the pool, a JACK lead would instead trigger the more specific
    // "backed ace on the jack" shortcut (the cluster above) before this one
    // ever runs. Playing the jack and nine of trump out first makes the ace
    // the new master, so the trick is still safe without being a jack lead.
    const jackAndNineGone: Card[] = ["JKARA", "9KARA"]

    it("throws the HIGHEST card of the shortest abandoned suit first", () => {
        // PIK (ace backed by the 10) is worth keeping outright. HERC (3
        // cards, no ace/backed-ten/master) and TREF (2 cards, same) are both
        // given up; TREF is shorter, so it goes first, high card first.
        const hand: Card[] = ["APIK", "10PIK", "KHERC", "8HERC", "7HERC", "KTREF", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 0, passes: [], trump: "KARA", caller: 2 },
            tricksWon: { A: 0, B: 1 },
            played: jackAndNineGone,
            trick: {
                leader: 2,
                turn: 0,
                cards: [
                    { seat: 2, card: "AKARA" }, // now the master trump
                    { seat: 3, card: "7KARA" },
                ],
            },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("KTREF")
    })

    it("moves to the NEXT card of that same shortest suit before touching the other abandoned suit", () => {
        // Same hand with the king of TREF already gone — the low 7 of TREF
        // is still cheaper to abandon than starting on HERC.
        const hand: Card[] = ["APIK", "10PIK", "KHERC", "8HERC", "7HERC", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 0, passes: [], trump: "KARA", caller: 2 },
            tricksWon: { A: 0, B: 1 },
            played: [...jackAndNineGone, "KTREF"],
            trick: {
                leader: 2,
                turn: 0,
                cards: [
                    { seat: 2, card: "AKARA" },
                    { seat: 3, card: "7KARA" },
                ],
            },
        })
        const card = heuristicBot.chooseCard(v, hand, noRng)
        expect(card).toBe("7TREF")
        // The kept suit (PIK, the backed ace) is never touched in either
        // discard.
        expect(card).not.toBe("APIK")
        expect(card).not.toBe("10PIK")
    })

    it("ties the shortest-suit tie-break to the FEWEST points, not suit order", () => {
        // HERC and TREF are now the same length (2 cards each); TREF carries
        // fewer points (a queen and a 7, 3 total) than HERC (a king and an 8,
        // 4 total), so TREF still goes first despite HERC coming first in
        // suit-declaration order.
        const hand: Card[] = ["APIK", "10PIK", "KHERC", "8HERC", "QTREF", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 0, passes: [], trump: "KARA", caller: 2 },
            tricksWon: { A: 0, B: 1 },
            played: jackAndNineGone,
            trick: {
                leader: 2,
                turn: 0,
                cards: [
                    { seat: 2, card: "AKARA" },
                    { seat: 3, card: "7KARA" },
                ],
            },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("QTREF")
    })

    it("keeps a suit worth keeping via a MASTER card, not just an ace or length", () => {
        // TREF's queen is already the master (its ace, 10 AND king are all
        // face up — a plain master needs to beat every outstanding rank, and
        // the 10 outranks the queen) — worth keeping on its own merits, so
        // PIK (weak, no ace/master) is what gets abandoned instead.
        const hand: Card[] = ["QTREF", "7TREF", "KPIK", "8PIK", "7PIK"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 0, passes: [], trump: "KARA", caller: 2 },
            tricksWon: { A: 0, B: 1 },
            played: ["ATREF", "10TREF", "KTREF"],
            trick: {
                leader: 2,
                turn: 0,
                cards: [
                    { seat: 2, card: "JKARA" },
                    { seat: 3, card: "7KARA" },
                ],
            },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("KPIK")
    })
})

describe("chooseCard (discard) — partner drawing trumps, nothing worth keeping: points are fed (BOT.md §4)", () => {
    it("feeds the highest-points card when no suit is worth protecting", () => {
        // No aces, no backed tens, no masters, no length-4 suit anywhere —
        // there is nothing left to say, so every point goes across. The king
        // (4) beats the two queens (3 each).
        //
        // The opponents already have a trick this deal (`tricksWon: {B: 1}`),
        // so `stigljaIsLive` is false and the newer §15.14 "stop" signal
        // (`stigljaStopSignal`, a LOW card from a fresh suit, reserved for a
        // live štihak with nothing to take over in) does not intercept —
        // this isolates the plain BOT.md §4 "feed everything" fallback.
        const hand: Card[] = ["KHERC", "QPIK", "QTREF"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 0, passes: [], trump: "KARA", caller: 2 },
            tricksWon: { A: 0, B: 1 },
            trick: {
                leader: 2,
                turn: 0,
                cards: [
                    { seat: 2, card: "JKARA" },
                    { seat: 3, card: "7KARA" },
                ],
            },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("KHERC")
    })

    it("SIGNALS STOP with a low card from a fresh suit instead, while the štihak is still live (BOT.md §15.14)", () => {
        // Same hand, but now the opponents have NOT taken a trick yet
        // (`stigljaIsLive`): with nothing worth keeping anywhere, feeding the
        // highest card (the king) would look like an ordinary point-feed:
        // `stigljaStopSignal` instead throws a LOW card of an as-yet-untouched
        // suit, distinct from the high-first "abandon" convention, so the
        // runner reads it unambiguously as "nothing here to take over".
        const hand: Card[] = ["KHERC", "QPIK", "QTREF"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 0, passes: [], trump: "KARA", caller: 2 },
            trick: {
                leader: 2,
                turn: 0,
                cards: [
                    { seat: 2, card: "JKARA" },
                    { seat: 3, card: "7KARA" },
                ],
            },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("QPIK")
    })
})

describe("chooseCard (discard) — a bare ace is never fed, even outside a trump draw", () => {
    it("keeps the bare ace home and feeds the next-best card instead", () => {
        // Partner (seat 2) leads a plain ace; I am seat 0, third to act in
        // the natural rotation (2, 3, 0, 1). Every trump is already down, so
        // the trick is provably safe regardless of who still has to play —
        // no trump lead is involved at all, so this exercises the
        // unconditional bare-ace exclusion in `fillCard` on its own, not the
        // abandon-suit machinery (which only runs on a trump lead).
        const hand: Card[] = ["ATREF", "KHERC", "7HERC"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 0, passes: [], trump: "PIK", caller: 2 },
            played: ["7PIK", "8PIK", "9PIK", "10PIK", "JPIK", "QPIK", "KPIK", "APIK"],
            trick: {
                leader: 2,
                turn: 0,
                cards: [
                    { seat: 2, card: "AKARA" }, // partner's master plain ace
                    { seat: 3, card: "7KARA" },
                ],
            },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("KHERC")
    })
})

describe("chooseCard (discard) — opponents winning: cheapest, no signal at all (BOT.md §2.0)", () => {
    it("throws the cheapest card, NOT the highest card of the shortest suit the signal convention would have picked", () => {
        // If this were a feeding discard, `signalDiscard` would abandon the
        // shorter/cheaper suit (PIK: king+7, 4 points total) high first —
        // KPIK. Against the opponents nothing is said, so the plain 0-point
        // card wins instead (a genuine divergence between the two rules).
        const hand: Card[] = ["KPIK", "7PIK", "10HERC", "9HERC"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 0, passes: [], trump: "TREF", caller: 1 }, // opponent called
            trick: { leader: 1, turn: 0, cards: [{ seat: 1, card: "AKARA" }] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("7PIK")
    })

    it("the SAME hand and suits, but with the partner DRAWING TRUMP instead, signals via the high card", () => {
        // The abandon-suit convention is specifically about a trump draw
        // (BOT.md §15 fix #1), not any safe partner lead — a plain-suit
        // partner lead just feeds the most valuable card (see the
        // "nothing worth keeping" block above). So the fair contrast to the
        // opponent-holds-it case above is the SAME hand on a partner trump
        // lead, not a partner plain-suit lead.
        const hand: Card[] = ["KPIK", "7PIK", "AHERC", "10HERC"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 0, passes: [], trump: "TREF", caller: 2 }, // partner called
            tricksWon: { A: 0, B: 1 }, // keep štihak-chasing out of it
            played: ["JTREF", "9TREF"], // jack and nine already gone
            trick: { leader: 2, turn: 0, cards: [{ seat: 2, card: "ATREF" }] }, // now the master trump
        })
        // HERC (backed ace) is worth keeping; PIK (no ace/backed-ten/master)
        // is abandoned, high card first.
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("KPIK")
    })

    it("keeps the last card of a dead suit rather than throw it as the cheapest option", () => {
        // Every other PIK card in the deck is face up — my 7PIK is the very
        // last one, kept back to force a trump out of somebody later
        // ("rađe mu daj kralja … nego tu 7 ili 8").
        const hand: Card[] = ["7PIK", "KHERC"]
        const v = view({
            seat: 0,
            hand,
            bidding: { turn: 0, passes: [], trump: "TREF", caller: 1 },
            played: ["APIK", "10PIK", "KPIK", "QPIK", "JPIK", "9PIK", "8PIK"],
            trick: { leader: 1, turn: 0, cards: [{ seat: 1, card: "AKARA" }] },
        })
        expect(heuristicBot.chooseCard(v, hand, noRng)).toBe("KHERC")
    })
})
