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

export interface GameConfig {
    targetScore: TargetScore
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

export interface WonTrick {
    winner: Seat
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
    /** Computed once hands reach 8 cards; per seat. Revealed to players after the first trick. */
    declarations: Record<Seat, Declaration[]>
    /** Team that scores its declarations this deal (null = nobody declared anything). */
    declarationsScoringTeam: Team | null
    belaDeclared: Team | null
    dealScore: DealScore | null
    score: Record<Team, number>
    history: DealScore[]
    rng: RngState
    winner: Team | null
}

export type GameAction =
    | { type: "BID"; seat: Seat; trump: Suit }
    | { type: "PASS"; seat: Seat }
    | { type: "PLAY"; seat: Seat; card: Card }
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
          perSeat: Record<Seat, Declaration[]>
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
    /** The last completed trick, so the UI can animate it being collected. */
    lastTrick: WonTrick | null
    /**
     * Declarations visible to this seat: own declarations always; everyone's
     * once the first trick of the deal is done (README §1.4).
     */
    declarations: Partial<Record<Seat, Declaration[]>>
    declarationsRevealed: boolean
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
