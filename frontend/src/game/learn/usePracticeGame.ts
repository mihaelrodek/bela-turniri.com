import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LEARNER_SEAT, botAction, hintForBid, hintForPlay, newPracticeGame, seatToAct, whyIllegal } from "@bela/bots"
import type { BidHint, IllegalReason, PlayHint } from "@bela/bots"
import { reduce, viewFor } from "@bela/engine"
import type { Card, Declaration, GameAction, GameEvent, GameState, PlayerView, Seat, Suit, Team, TrickCard } from "@bela/engine"
import type { SeatBid } from "../components/Seat"
import { COLLECT_MS } from "../components/TrickArea"

/* ──────────────────────────────────────────────────────────────────────────
   usePracticeGame — one game of bela played in the browser (2026-09-29).

   NO SERVER. The state is the engine's own `GameState`, held here; every
   move — the learner's and the three bots' — goes through the engine's
   `reduce`, so a card the rules forbid cannot be played by anybody. Bots
   choose with `botAction` (`@bela/bots`, the same heuristic bot the server
   seats), from their own redacted view. No room, no socket, no karma, no
   stats: nothing that happens here is recorded anywhere.

   What this hook adds on top of the engine is only TIME. `reduce` resolves a
   trick the instant its fourth card lands, which on screen would be a card
   appearing and four cards vanishing in the same frame. So after each action
   the events are read and the felt is held:

     CARD_PLAYED            the card flies in
     TRICK_WON              the four cards stay, then sweep to the winner
     TRUMP_SET              the bid chips stay for a beat, then declarations
                            are shown (when a pair scores any) until dismissed

   While any of that is on screen `busy` is true and nobody moves — not the
   bots, not the learner.
   ────────────────────────────────────────────────────────────────────── */

/** How long a bot "thinks". Long enough to follow who played what. */
const BOT_THINK_MS = 950
/** A finished trick stays on the felt this long before it is swept. */
const TRICK_HOLD_MS = 1300
/** The bid chips stay this long after trump is called. */
const TRUMP_HOLD_MS = 1400

export interface Felt {
    cards: TrickCard[]
    flyIn: Card | null
    collectTo: Seat | null
}

export interface Reveal {
    perSeat: Partial<Record<Seat, Declaration[]>>
    scoringTeam: Team | null
}

export interface IllegalTap {
    card: Card
    reason: IllegalReason | null
    /** Bumped per tap so the same card tapped twice shakes twice. */
    n: number
}

export interface PracticeGame {
    state: GameState
    /** The learner's own redacted view — all the table is ever drawn from. */
    view: PlayerView
    felt: Felt
    busy: boolean
    bids: Partial<Record<Seat, SeatBid>>
    reveal: Reveal | null
    /** The seat that just announced a bela, for a moment. */
    bela: Seat | null
    playHint: PlayHint | null
    bidHint: BidHint | null
    illegal: IllegalTap | null
    myTurn: boolean
    askHint: () => void
    play: (card: Card) => void
    bid: (trump: Suit) => void
    pass: () => void
    nextDeal: () => void
    dismissReveal: () => void
    restart: () => void
}

const EMPTY_FELT: Felt = { cards: [], flyIn: null, collectTo: null }

function randomSeed(): string {
    return `ucenje-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

export function usePracticeGame(reducedMotion: boolean): PracticeGame {
    const [state, setState] = useState<GameState>(() => newPracticeGame(randomSeed()))
    const [felt, setFelt] = useState<Felt>(EMPTY_FELT)
    const [busy, setBusy] = useState(false)
    const [bids, setBids] = useState<Partial<Record<Seat, SeatBid>>>({})
    const [reveal, setReveal] = useState<Reveal | null>(null)
    const [bela, setBela] = useState<Seat | null>(null)
    const [playHint, setPlayHint] = useState<PlayHint | null>(null)
    const [bidHint, setBidHint] = useState<BidHint | null>(null)
    const [illegal, setIllegal] = useState<IllegalTap | null>(null)

    /* The truth between renders: a bot's timer fires with whatever `state`
       its closure captured, so moves are always applied to this ref. */
    const stateRef = useRef(state)
    const timers = useRef(new Set<number>())

    const later = useCallback((run: () => void, ms: number) => {
        const id = window.setTimeout(() => {
            timers.current.delete(id)
            run()
        }, ms)
        timers.current.add(id)
    }, [])

    const clearTimers = useCallback(() => {
        for (const id of timers.current) window.clearTimeout(id)
        timers.current.clear()
    }, [])

    useEffect(() => clearTimers, [clearTimers])

    const hold = reducedMotion ? Math.round(TRICK_HOLD_MS * 0.7) : TRICK_HOLD_MS
    const sweep = reducedMotion ? 0 : COLLECT_MS

    const show = useCallback(
        (next: GameState, events: readonly GameEvent[]) => {
            let played: Card | null = null
            let won: Extract<GameEvent, { type: "TRICK_WON" }> | null = null
            let trumpSet = false
            let revealed: Reveal | null = null

            for (const event of events) {
                if (event.type === "DEALT") {
                    setBids({})
                    setFelt(EMPTY_FELT)
                } else if (event.type === "PASS") {
                    setBids((cur) => ({ ...cur, [event.seat]: { kind: "pass" } }))
                } else if (event.type === "BID") {
                    setBids((cur) => ({ ...cur, [event.seat]: { kind: "suit", suit: event.trump } }))
                } else if (event.type === "TRUMP_SET") {
                    trumpSet = true
                } else if (event.type === "DECLARATIONS_REVEALED") {
                    if (event.scoringTeam !== null) revealed = { perSeat: event.perSeat, scoringTeam: event.scoringTeam }
                } else if (event.type === "CARD_PLAYED") {
                    played = event.card
                } else if (event.type === "BELA") {
                    const seat = event.seat
                    setBela(seat)
                    later(() => setBela((cur) => (cur === seat ? null : cur)), 1800)
                } else if (event.type === "TRICK_WON") {
                    won = event
                }
            }

            if (won !== null) {
                const trick = won
                setBusy(true)
                setFelt({ cards: trick.cards.map((c) => ({ ...c })), flyIn: played, collectTo: null })
                later(() => setFelt((cur) => ({ ...cur, flyIn: null, collectTo: trick.winner })), hold)
                later(() => {
                    setFelt(EMPTY_FELT)
                    setBusy(false)
                }, hold + sweep)
                return
            }
            if (trumpSet) {
                const pending = revealed
                setBusy(true)
                later(() => {
                    setBids({})
                    if (pending !== null) setReveal(pending)
                    else setBusy(false)
                }, TRUMP_HOLD_MS)
                return
            }
            if (played !== null) {
                setFelt({ cards: next.trick.cards.map((c) => ({ ...c })), flyIn: played, collectTo: null })
            }
        },
        [later, hold, sweep],
    )

    const apply = useCallback(
        (action: GameAction): boolean => {
            let result: { state: GameState; events: GameEvent[] }
            try {
                result = reduce(stateRef.current, action)
            } catch {
                // The engine refused the move (not this seat's turn, an
                // illegal card). Nothing changed; nothing to show.
                return false
            }
            stateRef.current = result.state
            setState(result.state)
            setPlayHint(null)
            setBidHint(null)
            setIllegal(null)
            show(result.state, result.events)
            return true
        },
        [show],
    )

    /* The bots. One timer per position: it is set when a bot is on turn and
       nothing is being shown, and cleared if anything changes first. */
    useEffect(() => {
        if (busy || reveal !== null) return
        const seat = seatToAct(state)
        if (seat === null || seat === LEARNER_SEAT) return
        const id = window.setTimeout(() => {
            const action = botAction(stateRef.current, Math.random)
            if (action !== null) apply(action)
        }, BOT_THINK_MS)
        return () => window.clearTimeout(id)
    }, [state, busy, reveal, apply])

    const view = useMemo(() => viewFor(state, LEARNER_SEAT, { recallTricks: true }), [state])
    const myTurn = !busy && reveal === null && seatToAct(state) === LEARNER_SEAT

    const play = useCallback(
        (card: Card) => {
            if (!myTurn || state.phase !== "PLAYING") return
            if (!view.legalMoves.includes(card)) {
                setIllegal((cur) => ({ card, reason: whyIllegal(view, card), n: (cur?.n ?? 0) + 1 }))
                return
            }
            // A bela is announced, as it is for anyone who does not answer
            // the table's "Zovi belu?" (README §1.4): the flag is omitted.
            apply({ type: "PLAY", seat: LEARNER_SEAT, card })
        },
        [myTurn, state.phase, view, apply],
    )

    const bid = useCallback(
        (trump: Suit) => {
            if (myTurn && state.phase === "BIDDING") apply({ type: "BID", seat: LEARNER_SEAT, trump })
        },
        [myTurn, state.phase, apply],
    )

    const pass = useCallback(() => {
        if (myTurn && state.phase === "BIDDING") apply({ type: "PASS", seat: LEARNER_SEAT })
    }, [myTurn, state.phase, apply])

    const askHint = useCallback(() => {
        if (!myTurn) return
        setIllegal(null)
        if (state.phase === "BIDDING") setBidHint((cur) => cur ?? hintForBid(view, Math.random))
        else if (state.phase === "PLAYING") setPlayHint((cur) => cur ?? hintForPlay(view, Math.random))
    }, [myTurn, state.phase, view])

    const nextDeal = useCallback(() => {
        if (stateRef.current.phase === "DEAL_DONE") apply({ type: "NEXT_DEAL" })
    }, [apply])

    const dismissReveal = useCallback(() => {
        setReveal(null)
        setBusy(false)
    }, [])

    const restart = useCallback(() => {
        clearTimers()
        const fresh = newPracticeGame(randomSeed())
        stateRef.current = fresh
        setState(fresh)
        setFelt(EMPTY_FELT)
        setBusy(false)
        setBids({})
        setReveal(null)
        setBela(null)
        setPlayHint(null)
        setBidHint(null)
        setIllegal(null)
    }, [clearTimers])

    return {
        state,
        view,
        felt,
        busy,
        bids,
        reveal,
        bela,
        playHint,
        bidHint,
        illegal,
        myTurn,
        askHint,
        play,
        bid,
        pass,
        nextDeal,
        dismissReveal,
        restart,
    }
}
