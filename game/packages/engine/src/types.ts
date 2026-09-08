/* ──────────────────────────────────────────────────────────────────────────
   @bela/engine — public types. THIS FILE IS THE CONTRACT between the engine,
   the bots, the server and the UI. See game/README.md §1–§2 for the rules the
   values here encode. Change the README first, then this file.

   No `enum`, no namespaces, no parameter properties: the frontend compiles
   these sources with `erasableSyntaxOnly`.
   ────────────────────────────────────────────────────────────────────── */

export const SUITS = ["HERC", "KARA", "PIK", "TREF"] as const
export type Suit = (typeof SUITS)[number]

/** Natural order, also the order used for sequences (terca/kvarta/…). */
export const RANKS = ["7", "8", "9", "10", "J", "Q", "K", "A"] as const
export type Rank = (typeof RANKS)[number]

/** Wire-stable card id, e.g. "JHERC", "10PIK". */
export type Card = `${Rank}${Suit}`

export type Seat = 0 | 1 | 2 | 3
export const SEATS: readonly Seat[] = [0, 1, 2, 3]

export type Team = "A" | "B"

export type Phase = "BIDDING" | "PLAYING" | "DEAL_DONE" | "GAME_OVER"

export type TargetScore = 501 | 701 | 1001

/**
 * "Gledanje štihova" — who may review the completed tricks of the deal, with
 * seat attribution (README §1.8). NOT a rule of play: `reduce`, `legalMoves`
 * and `scoreDeal` never read it. It exists here only because `viewFor(state,
 * seat)` is the one place redaction can be enforced and `state` is its only
 * input.
 *
 *   • `off`        — nobody reviews anything. THE DEFAULT.
 *   • `leaderPair` — the seat that LEADS the current trick and its partner.
 *                    Not "whoever is on the move": the leader's pair.
 *   • `all`        — everyone at the table, spectators included.
 */
export type TrickReview = "off" | "leaderPair" | "all"
export const TRICK_REVIEWS: readonly TrickReview[] = ["off", "leaderPair", "all"]
export const DEFAULT_TRICK_REVIEW: TrickReview = "off"

export interface GameConfig {
    targetScore: TargetScore
    /** Defaults to standard declarations. */
    noDeclarations?: boolean
    /** Only configurable when noDeclarations is true; defaults to allowed. */
    allowBela?: boolean
    /** Who may review completed tricks; defaults to `off`. */
    trickReview?: TrickReview
    /** Any string; the engine derives its PRNG from it. Same seed + same actions ⇒ same game. */
    seed: string
}

/** Serialisable PRNG state (mulberry32 / xorshift — implementation detail, but must be plain data). */
export interface RngState {
    s: number
}

export type DeclarationKind = "FOUR" | "SEQUENCE"

export interface Declaration {
    kind: DeclarationKind
    /** Sorted; for SEQUENCE ascending in natural rank order, for FOUR one per suit in SUITS order. */
    cards: Card[]
    points: 20 | 50 | 100 | 150 | 200
}

export interface TrickCard {
    seat: Seat
    card: Card
}

export interface TrickState {
    leader: Seat
    /** Seat expected to play next. Meaningless once 4 cards are down (engine resolves immediately). */
    turn: Seat
    cards: TrickCard[]
}

export interface BiddingState {
    turn: Seat
    passes: Seat[]
    trump: Suit | null
    caller: Seat | null
}

/**
 * A completed trick, stored as it was actually played.
 *
 * `plays` is the record: every card WITH the seat that threw it, in play
 * order. Nothing else can answer "who played what" — `cards` alone cannot,
 * and the leader used to be re-derived by walking the win chain backwards
 * from the current trick, which was fragile bookkeeping to hang a feature on.
 * `no` makes the global order of the deal explicit even though `tricksWon` is
 * bucketed per team.
 *
 * `winner` and `cards` are kept (and always populated) because scoring, the
 * bots and the UI already read them: `cards` is exactly
 * `plays.map(p => p.card)`.
 */
export interface WonTrick {
    /** 1-based position within the deal. */
    no: number
    /** Who opened the trick; `plays[0].seat`. */
    leader: Seat
    winner: Seat
    /** Every play, with its seat, in play order. */
    plays: TrickCard[]
    /** The same cards without their seats, in play order. */
    cards: Card[]
}

export interface DealScore {
    dealNo: number
    trump: Suit
    caller: Seat
    callerTeam: Team
    /** Card points incl. +10 last trick and +90 štiglja. */
    cardPoints: Record<Team, number>
    /** Only the defended declarations + bela. */
    declarationPoints: Record<Team, number>
    stiglja: Team | null
    /** Whether the calling team passed (C > O). */
    passed: boolean
    /** What is actually added to the running score. On a fall, callerTeam gets 0 and the other team everything. */
    total: Record<Team, number>
}

/** FULL state. Only the server ever holds this — never send it over the wire. */
export interface GameState {
    config: GameConfig
    dealNo: number
    dealer: Seat
    phase: Phase
    hands: Record<Seat, Card[]>
    /** Cards still to be dealt after bidding (the 2×4 second round). Empty once hands are complete. */
    stock: Card[]
    bidding: BiddingState
    trick: TrickState
    tricksWon: Record<Team, WonTrick[]>
    /** Computed once hands reach 8 cards; per seat. Revealed after trump selection, before the first card. */
    declarations: Record<Seat, Declaration[]>
    /** Team that scores its declarations this deal (null = nobody declared anything). */
    declarationsScoringTeam: Team | null
    belaDeclared: Team | null
    /**
     * The seat that DECLINED to announce bela this deal, or null (README §1.4).
     *
     * Announcing is a CHOICE, not an automatism: on a deal the caller's team is
     * about to lose, every point of the deal goes to the opponents, so a bela
     * would be 20 points handed to the other side. A player who can see the
     * fall coming stays quiet.
     *
     * The refusal is asked once — when the FIRST of trump K/Q is played — and
     * is FINAL for the deal. It lives here, in the state, rather than in the
     * client, so nothing a browser does can resurrect it: a reconnecting
     * client, the bot playing on a timeout, or the bot that took the seat over
     * all see the same dead bela.
     *
     * Deliberately NOT in `PlayerView`: publishing "seat 2 refused a bela"
     * would announce exactly the fact the player chose to hide — that they
     * hold K+Q of trump. It never leaves the server.
     */
    belaRefused: Seat | null
    dealScore: DealScore | null
    score: Record<Team, number>
    history: DealScore[]
    rng: RngState
    winner: Team | null
}

export type GameAction =
    | { type: "BID"; seat: Seat; trump: Suit }
    | { type: "PASS"; seat: Seat }
    /**
     * `bela` is the player's ANSWER to "Zovi belu?", asked only when this card
     * is the first of trump K/Q out of a hand that holds both (README §1.4):
     *
     *   • omitted / `true` → announce. Silence declares: no answer, a timeout,
     *     a disconnect and every bot move all land here, and 20 points is a
     *     gain on the large majority of deals.
     *   • `false`          → decline, once and for the whole deal
     *     (`belaRefused`). The second of the two cards is then an ordinary
     *     card: it is never asked about again and never scores.
     *
     * The flag can only SUPPRESS a bela the hand already backs — it can never
     * create one. A `true` from a seat that does not hold both is not an
     * error, it is simply nothing: see `applyPlay`.
     */
    | { type: "PLAY"; seat: Seat; card: Card; bela?: boolean }
    | { type: "NEXT_DEAL" }

export type GameEvent =
    | { type: "DEALT"; dealNo: number; dealer: Seat }
    | { type: "BID"; seat: Seat; trump: Suit }
    | { type: "PASS"; seat: Seat }
    | { type: "TRUMP_SET"; trump: Suit; caller: Seat; forced: boolean }
    | { type: "HAND_COMPLETED" }
    | { type: "CARD_PLAYED"; seat: Seat; card: Card }
    | { type: "BELA"; seat: Seat }
    | { type: "TRICK_WON"; winner: Seat; cards: TrickCard[]; points: number; trickNo: number }
    | {
          type: "DECLARATIONS_REVEALED"
          /**
           * ONLY the seats of `scoringTeam` (README §1.4) — the losing pair's
           * declarations are lost and are never transmitted. Partial, so a
           * non-scoring seat has no entry at all rather than an empty array.
           *
           * The server broadcasts one identical `game.events` frame to
           * everybody at the table, so whatever this carries must be safe for
           * every recipient. Trimming it here — rather than redacting the
           * frame per connection — keeps that single-frame guarantee true.
           * A seat's OWN declarations, which it may always see, travel in
           * `PlayerView.declarations`, not in this event.
           */
          perSeat: Partial<Record<Seat, Declaration[]>>
          scoringTeam: Team | null
      }
    | { type: "DEAL_SCORED"; dealScore: DealScore }
    | { type: "GAME_OVER"; winner: Team; score: Record<Team, number> }

export interface LegalBids {
    canPass: boolean
    suits: Suit[]
}

/**
 * REDACTED state for one seat (or a spectator when `seat` is null). This is
 * what goes over the wire and what bots see — never anything more.
 */
export interface PlayerView {
    seat: Seat | null
    phase: Phase
    dealNo: number
    dealer: Seat
    /** Own cards, sorted. Empty for spectators. */
    hand: Card[]
    /** How many cards each seat holds. */
    handSizes: Record<Seat, number>
    bidding: BiddingState
    trick: TrickState
    /** Number of tricks won so far per team this deal. */
    tricksWon: Record<Team, number>
    /** Card points collected in completed tricks of the current deal. */
    currentDealPoints: Record<Team, number>
    /** The last completed trick, so the UI can animate it being collected. */
    lastTrick: WonTrick | null
    /**
     * Every completed trick of this deal in play order, with seat attribution
     * — the "gledanje štihova" review (README §1.8).
     *
     * `null` means THIS seat may not review them, and then the data is simply
     * not here: the restriction is applied in `viewFor`, on the server, so it
     * cannot be undone from a browser. Optional (rather than required) so a
     * PlayerView assembled by hand — the bots' simulation sub-views — need not
     * carry it; `undefined` reads the same as `null`.
     */
    trickHistory?: WonTrick[] | null
    /**
     * Declarations visible to this seat (README §1.4): its OWN always — they
     * are its own cards — plus, once trump has been selected, the seats of the
     * team that WON the declarations contest. The losing pair's declarations
     * are lost and are never sent to anybody, so a seat whose own pair lost
     * finds only itself here. A spectator gets the scoring team's only.
     */
    declarations: Partial<Record<Seat, Declaration[]>>
    /**
     * The declaration bonus each team has banked this deal: the scoring team's
     * declarations summed, plus 20 for an announced bela to whichever team
     * announced it (engine `declarationPoints`, the same arithmetic
     * `DealScore.declarationPoints` uses — the scoreboard's "+150" and the
     * deal summary can therefore never disagree).
     *
     * `{A: 0, B: 0}` before trump selection. It does NOT include card points,
     * the last-trick +10, a štiglja, or the pass/fall verdict — those are
     * settled by `scoreDeal` and appear in `DealScore`.
     *
     * Optional for the same reason as `trickHistory`: `@bela/bots` assembles
     * PlayerViews by hand for its simulations. `undefined` means "no bonus
     * known"; read it as 0.
     */
    declarationPoints?: Record<Team, number>
    declarationsRevealed: boolean
    declarationsScoringTeam: Team | null
    belaDeclared: Team | null
    dealScore: DealScore | null
    score: Record<Team, number>
    history: DealScore[]
    winner: Team | null
    /** Who must act now (bid or play), or null when nobody (DEAL_DONE / GAME_OVER). */
    turn: Seat | null
    /** Legal moves for THIS seat right now (empty when it is not our turn). */
    legalMoves: Card[]
    legalBids: LegalBids | null
    /** Cards no longer in play this deal (all completed tricks), in play order — for bots and a discard pile. */
    played: Card[]
}

export class EngineError extends Error {
    readonly code: "NOT_YOUR_TURN" | "ILLEGAL_MOVE" | "BAD_PHASE" | "BAD_REQUEST"
    constructor(code: EngineError["code"], message: string) {
        super(message)
        this.code = code
        this.name = "EngineError"
    }
}
