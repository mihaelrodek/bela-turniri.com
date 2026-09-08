import { describe, expect, it } from "vitest"
import type { Card, Declaration, GameState, Seat, Team } from "../src/index"
import { SEATS, legalMoves, newGame, nextSeat, reduce, teamOf, trickPoints, viewFor } from "../src/index"
import { playing } from "./helpers"

/** A fresh deal with HERC as trump, called by the first bidder. */
function dealtGame(seed: string): GameState {
    const start = newGame({ targetScore: 1001, seed })
    return reduce(start, { type: "BID", seat: start.bidding.turn, trump: "HERC" }).state
}

/** What EVERY recipient may see of the declarations: the scoring pair's only
 *  (README §1.4). A seat additionally sees its own — that is `own()`. */
function scoringTeamDeclarations(state: GameState): Partial<Record<Seat, Declaration[]>> {
    const out: Partial<Record<Seat, Declaration[]>> = {}
    const scoring = state.declarationsScoringTeam
    if (scoring === null) return out
    for (const seat of SEATS) {
        if (teamOf(seat) === scoring) out[seat] = state.declarations[seat]
    }
    return out
}

/** A seed whose deal actually produces a declaration on exactly one side, so
 *  "the other pair's are missing" is a claim with teeth. */
function dealtGameWithDeclarations(): GameState {
    for (let i = 0; i < 400; i++) {
        const state = dealtGame(`decl-seed-${i}`)
        const scoring = state.declarationsScoringTeam
        if (scoring === null) continue
        const losers = SEATS.filter((s) => teamOf(s) !== scoring)
        const winners = SEATS.filter((s) => teamOf(s) === scoring)
        const losing = losers.reduce<number>((n, s) => n + state.declarations[s].length, 0)
        const winning = winners.reduce<number>((n, s) => n + state.declarations[s].length, 0)
        if (losing > 0 && winning > 0) return state
    }
    throw new Error("no seed produced declarations on both teams")
}

/** Play one full deal with the first legal card, collecting the cards in play order. */
function playDeal(start: GameState): { state: GameState; played: Card[] } {
    let state = start
    const played: Card[] = []
    while (state.phase === "PLAYING") {
        const seat = state.trick.turn
        const card = legalMoves(state, seat)[0] as Card
        played.push(card)
        state = reduce(state, { type: "PLAY", seat, card }).state
    }
    return { state, played }
}

describe("viewFor — redaction", () => {
    it("shows only my own hand, and sizes for everyone else", () => {
        const state = dealtGame("view-1")
        const view = viewFor(state, 1)
        expect(view.seat).toBe(1)
        expect(view.hand).toEqual(state.hands[1])
        expect(view.handSizes).toEqual({ 0: 8, 1: 8, 2: 8, 3: 8 })
        expect(Object.keys(view)).not.toContain("hands")
        expect(Object.keys(view)).not.toContain("stock")
        expect(Object.keys(view)).not.toContain("rng")
    })

    it("gives a spectator no hand at all", () => {
        const state = dealtGame("view-2")
        const view = viewFor(state, null)
        expect(view.seat).toBeNull()
        expect(view.hand).toEqual([])
        expect(view.legalMoves).toEqual([])
        expect(view.legalBids).toBeNull()
        expect(view.declarations).toEqual(scoringTeamDeclarations(state))
    })

    it("copies the arrays it exposes", () => {
        const state = dealtGame("view-3")
        const view = viewFor(state, 0)
        expect(view.hand).not.toBe(state.hands[0])
        view.hand.push("AHERC")
        expect(state.hands[0]).toHaveLength(8)
    })

    it("does not mutate the state", () => {
        const state = dealtGame("view-4")
        const snapshot = structuredClone(state)
        viewFor(state, 0)
        viewFor(state, null)
        expect(state).toEqual(snapshot)
    })
})

describe("viewFor — declarations (README §1.4)", () => {
    it("shows a seat its own declarations after trump selection", () => {
        const state = dealtGame("view-decl")
        const view = viewFor(state, 2)
        expect(view.declarationsRevealed).toBe(true)
        expect(view.declarations[2]).toEqual(state.declarations[2])
    })

    it("shows the scoring pair's declarations and NOTHING of the losing pair", () => {
        const state = dealtGameWithDeclarations()
        const scoring = state.declarationsScoringTeam as Team
        const losers = SEATS.filter((s) => teamOf(s) !== scoring)

        for (const seat of SEATS) {
            const view = viewFor(state, seat)
            for (const other of SEATS) {
                if (teamOf(other) === scoring || other === seat) {
                    expect(view.declarations[other], `seat ${seat} → ${other}`)
                        .toEqual(state.declarations[other])
                } else {
                    expect(view.declarations[other], `seat ${seat} → ${other}`).toBeUndefined()
                }
            }
        }

        // The sharpest form of the leak: a seat on the WINNING team used to be
        // handed both opponents' declarations — cards of hands nobody has
        // played yet. Not one of those cards may appear in the frame.
        const winner = SEATS.find((s) => teamOf(s) === scoring) as Seat
        const wire = JSON.stringify(viewFor(state, winner))
        const own = new Set<string>(viewFor(state, winner).hand)
        for (const loser of losers) {
            for (const declaration of state.declarations[loser]) {
                for (const card of declaration.cards) {
                    if (own.has(card)) continue
                    expect(wire.includes(card), `${card} leaked from seat ${loser}`).toBe(false)
                }
            }
        }
    })

    it("gives a spectator the scoring pair's declarations only", () => {
        const state = dealtGameWithDeclarations()
        const view = viewFor(state, null)
        expect(view.declarations).toEqual(scoringTeamDeclarations(state))
    })

    it("keeps the redaction once tricks have been played", () => {
        let state = dealtGameWithDeclarations()
        const scoring = state.declarationsScoringTeam as Team
        for (let i = 0; i < 4; i++) {
            const seat = state.trick.turn
            state = reduce(state, {
                type: "PLAY",
                seat,
                card: legalMoves(state, seat)[0] as Card,
            }).state
        }
        const seat = SEATS.find((s) => teamOf(s) !== scoring) as Seat
        const view = viewFor(state, seat)
        expect(view.declarationsRevealed).toBe(true)
        const seen = Object.keys(view.declarations).map(Number).sort()
        const allowed = SEATS.filter((s) => teamOf(s) === scoring || s === seat).sort()
        expect(seen).toEqual(allowed)
    })

    it("hands out nothing but a seat's own before trump selection", () => {
        const state = newGame({ targetScore: 1001, seed: "view-decl-pre" })
        const view = viewFor(state, 1)
        expect(view.declarationsRevealed).toBe(false)
        expect(Object.keys(view.declarations)).toEqual(["1"])
        expect(viewFor(state, null).declarations).toEqual({})
    })
})

describe("DECLARATIONS_REVEALED — the shared broadcast frame (README §1.4)", () => {
    it("carries the scoring pair only, so one frame is safe for everybody", () => {
        for (let i = 0; i < 400; i++) {
            const start = newGame({ targetScore: 1001, seed: `evt-${i}` })
            const step = reduce(start, { type: "BID", seat: start.bidding.turn, trump: "HERC" })
            const event = step.events.find((e) => e.type === "DECLARATIONS_REVEALED")
            expect(event).toBeDefined()
            if (event?.type !== "DECLARATIONS_REVEALED") continue

            const scoring = event.scoringTeam
            if (scoring === null) {
                expect(event.perSeat).toEqual({})
                continue
            }
            for (const seat of SEATS) {
                if (teamOf(seat) === scoring) {
                    expect(event.perSeat[seat]).toEqual(step.state.declarations[seat])
                } else {
                    expect(event.perSeat[seat], `seat ${seat} must not be in the frame`)
                        .toBeUndefined()
                }
            }
        }
    })

    it("never names a card of the losing pair's declarations", () => {
        let checked = 0
        for (let i = 0; i < 400 && checked < 10; i++) {
            const start = newGame({ targetScore: 1001, seed: `evt-leak-${i}` })
            const step = reduce(start, { type: "BID", seat: start.bidding.turn, trump: "HERC" })
            const event = step.events.find((e) => e.type === "DECLARATIONS_REVEALED")
            if (event?.type !== "DECLARATIONS_REVEALED" || event.scoringTeam === null) continue
            const losers = SEATS.filter((s) => teamOf(s) !== event.scoringTeam)
            const lost = losers.flatMap((s) => step.state.declarations[s].flatMap((d) => d.cards))
            if (lost.length === 0) continue
            checked++
            const wire = JSON.stringify(event)
            const winnersCards = new Set<string>(
                SEATS.filter((s) => teamOf(s) === event.scoringTeam)
                    .flatMap((s) => step.state.declarations[s].flatMap((d) => d.cards)),
            )
            for (const card of lost) {
                if (winnersCards.has(card)) continue
                expect(wire.includes(card), `${card} leaked into the frame`).toBe(false)
            }
        }
        expect(checked, "no deal produced a losing declaration to test").toBeGreaterThan(0)
    })
})

describe("viewFor — declarationPoints (the scoreboard's \"+x\")", () => {
    it("is zero before trump selection", () => {
        const state = newGame({ targetScore: 1001, seed: "decl-pts-pre" })
        expect(viewFor(state, 0).declarationPoints).toEqual({ A: 0, B: 0 })
    })

    it("gives the scoring team its declarations and the other team nothing", () => {
        const state = dealtGameWithDeclarations()
        const scoring = state.declarationsScoringTeam as Team
        const other: Team = scoring === "A" ? "B" : "A"
        const expected = SEATS.filter((s) => teamOf(s) === scoring)
            .flatMap((s) => state.declarations[s])
            .reduce((sum, d) => sum + d.points, 0)

        const points = viewFor(state, 0).declarationPoints as Record<Team, number>
        expect(points[scoring]).toBe(expected)
        expect(points[scoring]).toBeGreaterThan(0)
        expect(points[other]).toBe(0)
    })

    it("includes an announced bela, for whichever team announced it", () => {
        const base = playing({
            trump: "HERC",
            leader: 0,
            hands: { 0: ["KHERC"], 1: [], 2: [], 3: [] },
        })
        expect(viewFor(base, 0).declarationPoints).toEqual({ A: 0, B: 0 })
        const withBela: GameState = { ...base, belaDeclared: "B" }
        expect(viewFor(withBela, 0).declarationPoints).toEqual({ A: 0, B: 20 })
    })

    it("excludes a REFUSED bela, and never leaks the refusal itself", () => {
        const base = playing({
            trump: "HERC",
            leader: 0,
            hands: { 0: ["KHERC", "QHERC"], 1: [], 2: [], 3: [] },
        })
        const refused = reduce(base, { type: "PLAY", seat: 0, card: "KHERC", bela: false }).state
        expect(refused.belaRefused).toBe(0)
        for (const seat of [0, 1, 2, 3, null] as (Seat | null)[]) {
            const view = viewFor(refused, seat)
            expect(view.declarationPoints).toEqual({ A: 0, B: 0 })
            expect(view.belaDeclared).toBeNull()
            // The refusal is NOT in the view — not for the refuser, not for
            // anybody. "Seat 0 declined a bela" is the same sentence as "seat 0
            // holds K+Q of trump", which is exactly what the player chose to
            // hide (README §1.4).
            expect("belaRefused" in view).toBe(false)
            expect(JSON.stringify(view)).not.toContain("belaRefused")
        }
    })

    it("matches DealScore.declarationPoints at settlement", () => {
        let state = dealtGameWithDeclarations()
        const before = viewFor(state, 0).declarationPoints as Record<Team, number>
        while (state.phase === "PLAYING") {
            const seat = state.trick.turn
            state = reduce(state, { type: "PLAY", seat, card: legalMoves(state, seat)[0] as Card }).state
        }
        const settled = state.dealScore?.declarationPoints as Record<Team, number>
        // The only thing that may have moved between the two is a bela
        // announced along the way; the contest itself is decided before the
        // first card.
        expect(viewFor(state, 0).declarationPoints).toEqual(settled)
        expect(settled.A - before.A).toBeLessThanOrEqual(20)
        expect(settled.B - before.B).toBeLessThanOrEqual(20)
    })
})

describe("viewFor — turn, legal moves and legal bids", () => {
    it("reports the bidding turn during BIDDING and offers bids only to that seat", () => {
        const state = newGame({ targetScore: 1001, seed: "view-bid" })
        const onTurn = state.bidding.turn
        const other = nextSeat(onTurn)
        expect(viewFor(state, onTurn).turn).toBe(onTurn)
        expect(viewFor(state, onTurn).legalBids).toEqual({
            canPass: true,
            suits: ["HERC", "KARA", "PIK", "TREF"],
        })
        expect(viewFor(state, other).legalBids).toBeNull()
        expect(viewFor(state, other).turn).toBe(onTurn)
        expect(viewFor(state, onTurn).legalMoves).toEqual([])
    })

    it("reports the trick turn during PLAYING and fills legalMoves only for that seat", () => {
        const state = dealtGame("view-play")
        const onTurn = state.trick.turn
        const other = nextSeat(onTurn)
        expect(viewFor(state, onTurn).turn).toBe(onTurn)
        expect(viewFor(state, onTurn).legalMoves).toEqual(legalMoves(state, onTurn))
        expect(viewFor(state, onTurn).legalMoves.length).toBeGreaterThan(0)
        expect(viewFor(state, other).legalMoves).toEqual([])
        expect(viewFor(state, onTurn).legalBids).toBeNull()
    })

    it("has no turn once the deal or the game is over", () => {
        const start = dealtGame("view-done")
        const { state } = playDeal(start)
        expect(state.phase).toBe("DEAL_DONE")
        expect(viewFor(state, 0).turn).toBeNull()
        expect(viewFor(state, 0).legalMoves).toEqual([])
        expect(viewFor(state, 0).dealScore).not.toBeNull()
        expect(viewFor(state, 0).history).toHaveLength(1)
    })
})

describe("viewFor — played cards and the last trick", () => {
    it("updates current deal points after every completed trick", () => {
        let state = dealtGame("view-live-points")
        const expected: Record<Team, number> = { A: 0, B: 0 }

        for (let trickNo = 1; trickNo <= 8; trickNo++) {
            const cards: Card[] = []
            for (let i = 0; i < 4; i++) {
                const seat = state.trick.turn
                const card = legalMoves(state, seat)[0] as Card
                cards.push(card)
                state = reduce(state, { type: "PLAY", seat, card }).state
            }
            expected[teamOf(state.trick.leader)] += trickPoints(cards, "HERC")
            expect(viewFor(state, 0).currentDealPoints, `after trick ${trickNo}`).toEqual(expected)
        }
    })

    it("counts COMPLETED tricks only — a trick in progress adds nothing", () => {
        let state = dealtGame("view-live-partial")

        // Trick one, three cards down: those points are on the table, not yet
        // in anybody's pile, so nobody's deal figure may move.
        for (let i = 0; i < 3; i++) {
            const seat = state.trick.turn
            state = reduce(state, { type: "PLAY", seat, card: legalMoves(state, seat)[0] as Card }).state
            expect(viewFor(state, state.trick.turn).currentDealPoints).toEqual({ A: 0, B: 0 })
        }
        expect(state.trick.cards).toHaveLength(3)

        const seat = state.trick.turn
        const fourth = legalMoves(state, seat)[0] as Card
        const cards = [...state.trick.cards.map((c) => c.card), fourth]
        state = reduce(state, { type: "PLAY", seat, card: fourth }).state

        const after = viewFor(state, 0).currentDealPoints
        expect(after[teamOf(state.trick.leader)]).toBe(trickPoints(cards, "HERC"))
        expect(after.A + after.B).toBe(trickPoints(cards, "HERC"))
    })

    it("says nothing about cards still in hand while it reports deal points", () => {
        let state = dealtGame("view-live-secret")
        for (let i = 0; i < 6; i++) {
            const seat = state.trick.turn
            state = reduce(state, { type: "PLAY", seat, card: legalMoves(state, seat)[0] as Card }).state
        }

        const view = viewFor(state, 0)
        expect(view.currentDealPoints.A + view.currentDealPoints.B).toBeGreaterThan(0)

        // Everything the view mentions is either mine, on the table, or already
        // played out of a completed trick. No other seat's hand leaks — not as
        // a card id, and not as an inferable per-seat total.
        const visible = new Set<string>([
            ...view.hand,
            ...view.played,
            ...view.trick.cards.map((c) => c.card),
            ...Object.values(view.declarations).flat().flatMap((d) => d.cards),
        ])
        const wire = JSON.stringify(view)
        for (const other of [1, 2, 3] as const) {
            for (const card of state.hands[other]) {
                if (visible.has(card)) continue
                expect(wire.includes(card), `${card} leaked from seat ${other}`).toBe(false)
            }
        }
        expect(Object.keys(view)).not.toContain("hands")
        expect(Object.keys(view)).not.toContain("stock")
    })

    it("lists every card of the completed tricks in play order", () => {
        const { state, played } = playDeal(dealtGame("view-played"))
        const view = viewFor(state, null)
        expect(played).toHaveLength(32)
        expect(view.played).toEqual(played)
        expect(new Set(view.played).size).toBe(32)
    })

    it("grows a trick at a time and never includes the trick in progress", () => {
        let state = dealtGame("view-progress")
        const played: Card[] = []
        let completed = 0
        while (state.phase === "PLAYING") {
            const seat = state.trick.turn
            const card = legalMoves(state, seat)[0] as Card
            state = reduce(state, { type: "PLAY", seat, card }).state
            played.push(card)
            if (state.trick.cards.length === 0) completed++
            const view = viewFor(state, seat)
            expect(view.played).toHaveLength(completed * 4)
            expect(view.played).toEqual(played.slice(0, completed * 4))
        }
    })

    it("exposes the last completed trick and the running trick counts", () => {
        let state = dealtGame("view-last")
        expect(viewFor(state, 0).lastTrick).toBeNull()
        expect(viewFor(state, 0).tricksWon).toEqual({ A: 0, B: 0 })

        const first: Card[] = []
        for (let i = 0; i < 4; i++) {
            const seat = state.trick.turn
            const card = legalMoves(state, seat)[0] as Card
            first.push(card)
            state = reduce(state, { type: "PLAY", seat, card }).state
        }
        const view = viewFor(state, 0)
        expect(view.lastTrick?.cards).toEqual(first)
        expect(view.lastTrick?.winner).toBe(state.trick.leader)
        expect(view.tricksWon.A + view.tricksWon.B).toBe(1)
    })

    it("keeps the last trick and the scores visible in DEAL_DONE", () => {
        const { state } = playDeal(dealtGame("view-deal-done"))
        const view = viewFor(state, 1)
        expect(view.lastTrick).not.toBeNull()
        expect(view.tricksWon.A + view.tricksWon.B).toBe(8)
        expect(view.played).toHaveLength(32)
        expect(view.score).toEqual(state.score)
        expect(view.handSizes).toEqual({ 0: 0, 1: 0, 2: 0, 3: 0 })
    })
})

describe("viewFor — trivia", () => {
    it("carries the bela flag and the trick in progress", () => {
        const state = playing({
            trump: "HERC",
            leader: 0,
            cards: [{ seat: 0, card: "APIK" }],
            hands: { 1: ["7PIK", "KPIK"] },
        })
        const view = viewFor(state, 1)
        expect(view.trick.cards).toEqual([{ seat: 0, card: "APIK" }])
        expect(view.trick.cards[0]).not.toBe(state.trick.cards[0])
        expect(view.belaDeclared).toBeNull()
        expect(view.handSizes).toEqual({ 0: 0, 1: 2, 2: 0, 3: 0 })
    })
})
