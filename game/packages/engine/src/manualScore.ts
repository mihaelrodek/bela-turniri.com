/* Manual deal scoring — the arithmetic of the paper scorepad ("bela blok",
   `frontend/src/blok/BLOK.md`), for a game played at a real table with real
   cards. Same rules as `scoreDeal` (README §1.6), different input: nobody
   played a trick here, a human typed the two numbers.

   It lives in the engine, next to `scoreDeal`, because it is the SAME rule.
   A second copy inside a React component would drift the first time somebody
   touched the fall rule, and the blok's whole purpose is that the number on
   the phone is the number that would have been written on paper.

     card points  = 162 per deal (152 in the cards + 10 for the last trick);
                    a štiglja is 252 for that side and 0 for the other
     declarations = every declaration entered for a side, summed. Unlike
                    `scoreDeal` there is no "strongest declaration wins" contest
                    here: at the table the players have already settled that
                    among themselves and only write down what actually scores.
     pass/fall    = the CALLING side passes iff C > O (strictly). Otherwise it
                    falls: it gets 0 and the opponents get C + O. No rounding.
     belot        = one player held all eight cards of one suit. The deal is
                    not played at all and that side takes the GAME: see below.

   BELOT — DECISION (2026-09-08)
   ────────────────────────────
   A belot ("osam istih karata") ends the game on the spot. The side that
   showed it is awarded THE GAME'S TARGET for that one deal — 1001 on the
   default game, 501 on a game played to 501 — which is why `target` is an
   input here and not a constant. Awarding a hard-coded 1001 would hand a 501
   game twice its own finish line and a 2001 game a deal that decides nothing.

   The award IS the deal's total. Card points are 0/0 (nobody played a trick)
   and declarations, if any were entered, are reported as parts but do NOT
   enter the total: a hand that was never played cannot be added to. The fall
   rule does not run either, so `fell` is always false — printing "PAD" for a
   deal in which no card was led would be a claim about a hand that does not
   exist.

   A belot is deliberately NOT expressed as a huge card split (e.g. 1001/0 in
   `cards`), because `cards` means "points taken in tricks" everywhere else in
   the blok and every screen that sums or explains it would then be lying.

   Who called the deal is irrelevant to a belot — the belot side wins whether
   it called or not — but `caller` is still required and still stored: it is a
   fact about the deal, and `store.ts` walks the callers of every deal for the
   "prolaz" rule.

   INVALID INPUT — DECISION (2026-09-08)
   ─────────────────────────────────────
   `scoreManualDeal` THROWS `EngineError("BAD_REQUEST", …)` on input that
   cannot describe a real deal. It never "fixes up" a number, and it never
   returns a plausible-looking outcome for impossible input.

   Why throw rather than clamp: this function's only job is to produce the
   number a human is about to write in a scorepad and then argue about at the
   table. A silently repaired 150/12 deal would put a wrong, confident total on
   screen; a throw is caught by the one caller that can have bad data (the
   store, reading `localStorage` that any browser extension or older build may
   have written) and shown as "this round is broken" instead of as a score.
   It also matches `scoreDeal`, which throws rather than scoring a deal with no
   trump. Callers rendering a live preview of a half-typed form should catch.

   Rejected:
     - a side's card points that are not a finite integer, or are negative
     - a card split that does not total 162 (with no štiglja and no belot)
     - a štiglja whose card split is not 252 for the štiglja side and 0 for the
       other — the +90 is part of the stored `cards`, per BLOK.md §2, so the
       caller stores 252/0, not 162/0
     - a declaration that is not a finite non-negative integer
     - a `caller`/`stiglja`/`belot` that is not "us"/"them" (`stiglja` and
       `belot` may be null)
     - a deal carrying BOTH a belot and a štiglja: eight cards of one suit
       ends the deal before a trick is led, so nobody can also have taken all
       eight tricks. Two mutually exclusive facts about the same deal is
       exactly the impossible input this function refuses to average out.
     - a belot whose card split is not 0/0 — the same class of contradiction:
       the deal was not played, so no side took anything in tricks
     - a belot with no usable `target` (absent, fractional, < 1). The award is
       the target; without one there is no number to award, and inventing 1001
       would be the silent repair this function exists to refuse.

   Deliberately NOT rejected:
     - a declaration whose value is not one of 20/50/100/150/200. The five
       buttons are a UI convenience, house rules vary, and the blok does not
       referee the table — it adds up what it is told.
     - declarations on a belot deal. They cannot change the total (see above)
       and refusing them would turn a harmless leftover — a 20 tapped in
       before the belot button was — into an unscoreable deal. The entry sheet
       stops offering them while a belot is on; the engine simply reports them.
     - `target` on a deal with no belot: nothing reads it, so nothing can be
       wrong with it.
*/

import { EngineError } from "./types"

/** The two sides of a scorepad. Not seats and not teams: the blok knows only
 *  "us" (the phone's owners) and "them". */
export type ManualSide = "us" | "them"

export interface ManualDealInput {
    caller: ManualSide
    /** Card points per side, štiglja bonus already included: 162 in total, or 252/0. */
    cards: { us: number; them: number }
    /** Individual declarations as entered (`[20, 20, 50]`), not a sum. */
    declarations: { us: number[]; them: number[] }
    /** The side that took all eight tricks, or null. */
    stiglja: ManualSide | null
    /**
     * The side that showed a belot — all eight cards of one suit — or null.
     *
     * OPTIONAL on purpose, and absent reads as `null`: every deal recorded
     * before this field existed is a deal without a belot, so a caller that
     * predates it stays correct rather than becoming unscoreable. Same reason
     * `BlokRound.belot` is tolerated as absent on read (BLOK.md §2).
     */
    belot?: ManualSide | null
    /**
     * The game's points target (1001 / 701 / 501 …) — what a belot awards.
     *
     * REQUIRED exactly when `belot` is set, and unread otherwise. It is not
     * part of the deal, it is the agreement the deal is being played under, so
     * it is passed in rather than stored per round (BLOK.md §2: nothing
     * derivable is stored twice).
     */
    target?: number
}

export interface RoundOutcome {
    /** Final points of the deal, after the fall rule — or the target, on a
     *  belot. */
    total: { us: number; them: number }
    /** The parts, for the entry screen: cards, declarations. On a belot both
     *  are reported and NEITHER is in `total`; see the header. */
    cards: { us: number; them: number }
    declarations: { us: number; them: number }
    /** true when the calling side fell. Always false on a belot: no card was
     *  played, so there was no call to go down on. */
    fell: boolean
}

/** 152 in the cards + 10 for the last trick. */
const DEAL_CARD_POINTS = 162
/** A štiglja is all of it plus 90. */
const STIGLJA_CARD_POINTS = DEAL_CARD_POINTS + 90

const SIDES: readonly ManualSide[] = ["us", "them"]

function otherSide(side: ManualSide): ManualSide {
    return side === "us" ? "them" : "us"
}

function isSide(value: unknown): value is ManualSide {
    return value === "us" || value === "them"
}

function bad(message: string): never {
    throw new EngineError("BAD_REQUEST", message)
}

function assertPointValue(value: number, what: string): void {
    if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
        bad(`${what} mora biti cijeli broj.`)
    }
    if (value < 0) bad(`${what} ne može biti negativan.`)
}

function sumDeclarations(values: number[], side: ManualSide): number {
    if (!Array.isArray(values)) bad(`Zvanja strane "${side}" moraju biti popis brojeva.`)
    let sum = 0
    for (const value of values) {
        assertPointValue(value, `Zvanje strane "${side}"`)
        sum += value
    }
    return sum
}

/**
 * Score one manually entered deal. See the header for the rules and for what
 * counts as invalid input.
 */
export function scoreManualDeal(input: ManualDealInput): RoundOutcome {
    if (input === null || typeof input !== "object") bad("Podjela nije zadana.")
    if (!isSide(input.caller)) bad('Zvač podjele mora biti "us" ili "them".')
    if (input.stiglja !== null && !isSide(input.stiglja)) {
        bad('Štiglja mora biti "us", "them" ili null.')
    }
    // Absent is "no belot" — see the field's doc comment.
    const belot: ManualSide | null = input.belot ?? null
    if (belot !== null && !isSide(belot)) bad('Belot mora biti "us", "them" ili null.')
    if (input.cards === null || typeof input.cards !== "object") bad("Bodovi iz karata nisu zadani.")
    if (input.declarations === null || typeof input.declarations !== "object") {
        bad("Zvanja nisu zadana.")
    }

    for (const side of SIDES) assertPointValue(input.cards[side], `Bodovi iz karata strane "${side}"`)

    if (belot !== null) {
        // Two mutually exclusive facts about one deal — see the header.
        if (input.stiglja !== null) bad("Belot i štiglja ne mogu biti u istoj podjeli.")
        if (input.cards.us !== 0 || input.cards.them !== 0) {
            bad("Kod belota nijedna strana nema bodove iz karata — podjela se ne igra.")
        }
        if (
            typeof input.target !== "number"
            || !Number.isFinite(input.target)
            || !Number.isInteger(input.target)
            || input.target < 1
        ) {
            bad("Belot treba bodovni cilj partije (cijeli broj veći od 0).")
        }
    } else if (input.stiglja === null) {
        const total = input.cards.us + input.cards.them
        if (total !== DEAL_CARD_POINTS) {
            bad(`Bodovi iz karata moraju biti ukupno ${DEAL_CARD_POINTS}, a zbroj je ${total}.`)
        }
    } else {
        const loser = otherSide(input.stiglja)
        if (input.cards[input.stiglja] !== STIGLJA_CARD_POINTS || input.cards[loser] !== 0) {
            bad(
                `Kod štiglje strana koja ju je uzela ima ${STIGLJA_CARD_POINTS} bodova iz karata, a protivnik 0.`,
            )
        }
    }

    const cards = { us: input.cards.us, them: input.cards.them }
    const declarations = {
        us: sumDeclarations(input.declarations.us, "us"),
        them: sumDeclarations(input.declarations.them, "them"),
    }

    /* A belot short-circuits the whole pad rule: the target goes to the side
       that showed it, the other side gets nothing, and `cards` /
       `declarations` are carried out only as the parts that were entered. The
       validation above has already proved `target` is a usable number. */
    if (belot !== null) {
        const award = input.target as number
        const belotTotal: Record<ManualSide, number> = { us: 0, them: 0 }
        belotTotal[belot] = award
        return { total: belotTotal, cards, declarations, fell: false }
    }

    const caller = input.caller
    const other = otherSide(caller)
    const callerTotal = cards[caller] + declarations[caller]
    const otherTotal = cards[other] + declarations[other]
    const fell = !(callerTotal > otherTotal)

    const total: Record<ManualSide, number> = { us: 0, them: 0 }
    if (fell) {
        total[caller] = 0
        total[other] = callerTotal + otherTotal
    } else {
        total[caller] = callerTotal
        total[other] = otherTotal
    }

    return { total, cards, declarations, fell }
}
