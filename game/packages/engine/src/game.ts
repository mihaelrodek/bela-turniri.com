/* The deal/game state machine — README §1.2, §1.5, §1.6, §1.7.

   `reduce` is pure: it always returns a brand new state object and never
   mutates the one it was given (arrays and records that change are copied,
   untouched ones are shared). Illegal input throws EngineError. */

import type {
    Card,
    Declaration,
    GameAction,
    GameConfig,
    GameEvent,
    GameState,
    RngState,
    Seat,
    Suit,
    Team,
    TrickCard,
} from "./types"
import { SEATS, SUITS, EngineError } from "./types"
import { cardRank, cardSuit, fullDeck, sortHand } from "./cards"
import { createRng, nextInt, shuffle } from "./rng"
import { nextSeat, seatFrom, teamOf } from "./seats"
import { isForcedBid, legalMoves, trickPoints, trickWinner } from "./rules"
import { declarationsScoringTeam, findDeclarations } from "./declarations"
import { scoreDeal } from "./scoring"

const EMPTY_DECLARATIONS = (): Record<Seat, Declaration[]> => ({ 0: [], 1: [], 2: [], 3: [] })

function emptyHands(): Record<Seat, Card[]> {
    return { 0: [], 1: [], 2: [], 3: [] }
}

/** Shuffle and hand out 3+3 starting at next(dealer); the last 8 cards wait in the stock. */
function dealSix(
    rng: RngState,
    dealer: Seat,
): { hands: Record<Seat, Card[]>; stock: Card[]; rng: RngState } {
    const shuffled = shuffle(fullDeck(), rng)
    const deck = shuffled.items
    const hands = emptyHands()
    let i = 0
    for (let round = 0; round < 2; round++) {
        for (let step = 0; step < 4; step++) {
            const seat = seatFrom(dealer + 1 + step)
            for (let c = 0; c < 3; c++) {
                hands[seat].push(deck[i] as Card)
                i++
            }
        }
    }
    for (const seat of SEATS) hands[seat] = sortHand(hands[seat])
    return { hands, stock: deck.slice(i), rng: shuffled.rng }
}

/** The second round: 2 cards each from the stock, again starting at next(dealer). */
function dealStock(
    hands: Record<Seat, Card[]>,
    stock: readonly Card[],
    dealer: Seat,
): Record<Seat, Card[]> {
    const out = emptyHands()
    let i = 0
    for (const seat of SEATS) out[seat] = hands[seat].slice()
    for (let step = 0; step < 4; step++) {
        const seat = seatFrom(dealer + 1 + step)
        for (let c = 0; c < 2; c++) {
            out[seat].push(stock[i] as Card)
            i++
        }
    }
    for (const seat of SEATS) out[seat] = sortHand(out[seat])
    return out
}

function startDeal(
    base: Pick<GameState, "config" | "score" | "history">,
    dealNo: number,
    dealer: Seat,
    rng: RngState,
): GameState {
    const dealt = dealSix(rng, dealer)
    const opener = nextSeat(dealer)
    return {
        config: base.config,
        dealNo,
        dealer,
        phase: "BIDDING",
        hands: dealt.hands,
        stock: dealt.stock,
        bidding: { turn: opener, passes: [], trump: null, caller: null },
        trick: { leader: opener, turn: opener, cards: [] },
        tricksWon: { A: [], B: [] },
        declarations: EMPTY_DECLARATIONS(),
        declarationsScoringTeam: null,
        belaDeclared: null,
        belaRefused: null,
        dealScore: null,
        score: base.score,
        history: base.history,
        rng: dealt.rng,
        winner: null,
    }
}

/**
 * README §1.7: the game is over at the END OF THE DEAL in which at least one
 * team is at or past the target — and only then, so a deal is never cut short.
 * A level score buys another deal, however far past the target both teams are.
 *
 * Returns the winner, or null when the game goes on.
 */
function gameWinner(target: number, score: Record<Team, number>): Team | null {
    if (score.A < target && score.B < target) return null
    if (score.A === score.B) return null
    return score.A > score.B ? "A" : "B"
}

export function newGame(config: GameConfig): GameState {
    const seeded = createRng(config.seed)
    // The very first dealer comes out of the RNG; afterwards the deal rotates.
    const pick = nextInt(seeded, 4)
    const dealer = seatFrom(pick.value)
    return startDeal(
        { config, score: { A: 0, B: 0 }, history: [] },
        1,
        dealer,
        pick.rng,
    )
}

export function reduce(
    state: GameState,
    action: GameAction,
): { state: GameState; events: GameEvent[] } {
    if (action.type === "BID") return applyBid(state, action.seat, action.trump)
    if (action.type === "PASS") return applyPass(state, action.seat)
    if (action.type === "PLAY") return applyPlay(state, action.seat, action.card, action.bela)
    if (action.type === "NEXT_DEAL") return applyNextDeal(state)
    throw new EngineError("BAD_REQUEST", `Nepoznata akcija: ${String((action as GameAction).type)}`)
}

function assertBidding(state: GameState, seat: Seat): void {
    if (state.phase !== "BIDDING") {
        throw new EngineError("BAD_PHASE", "Zvanje aduta nije u tijeku.")
    }
    if (state.bidding.turn !== seat) {
        throw new EngineError("NOT_YOUR_TURN", `Na potezu je sjedalo ${state.bidding.turn}.`)
    }
}

function applyBid(
    state: GameState,
    seat: Seat,
    trump: Suit,
): { state: GameState; events: GameEvent[] } {
    assertBidding(state, seat)
    if (!SUITS.includes(trump)) {
        throw new EngineError("BAD_REQUEST", `Nepoznata boja: ${String(trump)}`)
    }

    const forced = isForcedBid(state, seat)
    const events: GameEvent[] = [
        { type: "BID", seat, trump },
        { type: "TRUMP_SET", trump, caller: seat, forced },
    ]

    const hands = dealStock(state.hands, state.stock, state.dealer)
    events.push({ type: "HAND_COMPLETED" })

    const declarations = EMPTY_DECLARATIONS()
    if (!state.config.noDeclarations) {
        for (const s of SEATS) declarations[s] = findDeclarations(hands[s])
    }
    const scoringTeam = declarationsScoringTeam(declarations, state.dealer)
    if (!state.config.noDeclarations) {
        // Only the SCORING pair travels (README §1.4). The server broadcasts
        // one identical events frame to the whole table, so the payload has to
        // be safe for every recipient — and the losing pair's declarations are
        // three-plus named cards of hands nobody has played yet. They are lost
        // at a real table too; here they simply never leave `state`.
        const perSeat: Partial<Record<Seat, Declaration[]>> = {}
        if (scoringTeam !== null) {
            for (const s of SEATS) {
                if (teamOf(s) === scoringTeam) perSeat[s] = declarations[s].slice()
            }
        }
        events.push({ type: "DECLARATIONS_REVEALED", perSeat, scoringTeam })
    }

    const opener = nextSeat(state.dealer)
    return {
        state: {
            ...state,
            phase: "PLAYING",
            hands,
            stock: [],
            bidding: { turn: seat, passes: state.bidding.passes, trump, caller: seat },
            trick: { leader: opener, turn: opener, cards: [] },
            declarations,
            declarationsScoringTeam: scoringTeam,
        },
        events,
    }
}

function applyPass(state: GameState, seat: Seat): { state: GameState; events: GameEvent[] } {
    assertBidding(state, seat)
    if (isForcedBid(state, seat)) {
        throw new EngineError("ILLEGAL_MOVE", "Djelitelj mora zvati adut (mus).")
    }
    return {
        state: {
            ...state,
            bidding: {
                ...state.bidding,
                turn: nextSeat(seat),
                passes: [...state.bidding.passes, seat],
            },
        },
        events: [{ type: "PASS", seat }],
    }
}

function applyPlay(
    state: GameState,
    seat: Seat,
    card: Card,
    bela?: boolean,
): { state: GameState; events: GameEvent[] } {
    if (state.phase !== "PLAYING") {
        throw new EngineError("BAD_PHASE", "Štihovi se trenutno ne igraju.")
    }
    if (state.trick.turn !== seat) {
        throw new EngineError("NOT_YOUR_TURN", `Na potezu je sjedalo ${state.trick.turn}.`)
    }
    const trump = state.bidding.trump
    if (trump === null) throw new EngineError("BAD_PHASE", "Adut nije određen.")

    const hand = state.hands[seat]
    if (!hand.includes(card)) {
        throw new EngineError("ILLEGAL_MOVE", `Karta ${card} nije u ruci sjedala ${seat}.`)
    }
    if (!legalMoves(state, seat).includes(card)) {
        throw new EngineError("ILLEGAL_MOVE", `Karta ${card} nije legalan potez.`)
    }

    const events: GameEvent[] = [{ type: "CARD_PLAYED", seat, card }]

    /* Bela — the holder's CHOICE, decided on the FIRST of trump K/Q (README
       §1.4). "First" means the other one is still in hand at this moment.

       The `bela` flag is an answer, not an authority. Whether a bela exists at
       all is derived HERE, from the hand, exactly as it always was; the flag
       can only suppress it. So a `bela: true` the hand does not back is
       IGNORED rather than rejected: it could never have scored anything, and
       bouncing an otherwise legal card mid-trick over a stale flag (an old
       client build, a reconnect that mis-guessed) would punish the player for
       a claim that was harmless. `bela: false` is likewise ignored when there
       is nothing to decline.

       `undefined` means "no answer", and no answer DECLARES: the turn timer,
       a disconnected seat and every bot move arrive without a flag, and 20
       points is a gain on the large majority of deals, so silence must not
       cost them.

       A refusal is final for the deal, and it is silent: there is no event
       for it. Announcing "seat 2 declined a bela" would publish the very fact
       the player is hiding — that they hold K+Q of trump. */
    let belaDeclared = state.belaDeclared
    let belaRefused = state.belaRefused
    const belaAllowed = !state.config.noDeclarations || state.config.allowBela !== false
    if (belaAllowed && belaDeclared === null && belaRefused === null && cardSuit(card) === trump) {
        const rank = cardRank(card)
        const twin = rank === "K" ? `Q${trump}` : rank === "Q" ? `K${trump}` : null
        if (twin !== null && hand.includes(twin as Card)) {
            if (bela === false) {
                belaRefused = seat
            } else {
                belaDeclared = teamOf(seat)
                events.push({ type: "BELA", seat })
            }
        }
    }

    const hands: Record<Seat, Card[]> = { ...state.hands }
    hands[seat] = hand.filter((c) => c !== card)

    const trickCards: TrickCard[] = [...state.trick.cards, { seat, card }]

    if (trickCards.length < 4) {
        return {
            state: {
                ...state,
                hands,
                belaDeclared,
                belaRefused,
                trick: { ...state.trick, turn: nextSeat(seat), cards: trickCards },
            },
            events,
        }
    }

    // Fourth card: resolve the trick immediately.
    const winner = trickWinner(trickCards, trump)
    const points = trickPoints(trickCards, trump)
    const trickNo = state.tricksWon.A.length + state.tricksWon.B.length + 1
    events.push({ type: "TRICK_WON", winner, cards: trickCards, points, trickNo })

    const winnerTeam: Team = teamOf(winner)
    const tricksWon = {
        A: state.tricksWon.A.slice(),
        B: state.tricksWon.B.slice(),
    }
    tricksWon[winnerTeam] = [
        ...tricksWon[winnerTeam],
        {
            no: trickNo,
            leader: state.trick.leader,
            winner,
            // Copied, not aliased: `trickCards` is also the array the events
            // carry, and a stored trick must never change afterwards.
            plays: trickCards.map((c) => ({ ...c })),
            cards: trickCards.map((c) => c.card),
        },
    ]

    let next: GameState = {
        ...state,
        hands,
        belaDeclared,
        belaRefused,
        tricksWon,
        trick: { leader: winner, turn: winner, cards: [] },
    }

    if (trickNo === 8) {
        const dealScore = scoreDeal(next)
        const score: Record<Team, number> = {
            A: next.score.A + dealScore.total.A,
            B: next.score.B + dealScore.total.B,
        }
        // The deal that settles the game ENDS it here, not on the next
        // NEXT_DEAL (README §1.7). DEAL_DONE therefore means exactly one
        // thing — "another deal follows" — and nothing has to ask the player
        // for a deal that is never going to be played.
        const winner = gameWinner(state.config.targetScore, score)
        next = {
            ...next,
            phase: winner === null ? "DEAL_DONE" : "GAME_OVER",
            dealScore,
            score,
            history: [...next.history, dealScore],
            winner,
        }
        events.push({ type: "DEAL_SCORED", dealScore })
        if (winner !== null) events.push({ type: "GAME_OVER", winner, score: { ...score } })
    }

    return { state: next, events }
}

function applyNextDeal(state: GameState): { state: GameState; events: GameEvent[] } {
    if (state.phase !== "DEAL_DONE") {
        throw new EngineError("BAD_PHASE", "Nova podjela je moguća tek nakon obračuna.")
    }

    // Settlement already ends a decided game (see applyPlay), so in ordinary
    // play this never fires. It stays because DEAL_DONE is a state anyone may
    // hand the reducer — a saved game, a test, a future server that adjusts a
    // score between deals — and "one team is past the target" must mean the
    // same thing wherever the state came from.
    const winner = gameWinner(state.config.targetScore, state.score)
    if (winner !== null) {
        return {
            state: { ...state, phase: "GAME_OVER", winner },
            events: [{ type: "GAME_OVER", winner, score: { ...state.score } }],
        }
    }

    // Not there yet, or tied at/over the target → one more deal (README §1.7).
    const dealer = nextSeat(state.dealer)
    const dealNo = state.dealNo + 1
    const next = startDeal(
        { config: state.config, score: state.score, history: state.history },
        dealNo,
        dealer,
        state.rng,
    )
    return { state: next, events: [{ type: "DEALT", dealNo, dealer }] }
}
