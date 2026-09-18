import { useCallback, useEffect, useRef, useState } from "react"
import type { GameEvent } from "@bela/protocol"
import type { QueuedGameEvent } from "../types"

/* ──────────────────────────────────────────────────────────────────────────
   useEventQueue — plays `game.events` back ONE AT A TIME.

   The server is free to send a whole batch in a single frame (four
   CARD_PLAYED plus TRICK_WON land together the moment the fourth card
   completes a trick) and it sends the NEW `game.state` alongside, in which
   the trick is already cleared. If the UI simply followed the state it would
   blink: the four cards would vanish the instant the last one landed and
   nobody would see who took the trick.

   So animation-bearing events get a dwell time here and the table renders
   from the ACTIVE event while one is playing, falling back to the view
   otherwise. Every `GameEvent["type"]` must appear in `EVENT_DWELL_MS` — the
   Record type makes a new event kind a compile error rather than an event
   silently swallowed.
   ────────────────────────────────────────────────────────────────────── */

/**
 * Milliseconds the UI dwells on each event before pulling the next one.
 *
 * Zero means "nothing to animate, the `PlayerView` already says it". Bids and
 * passes deliberately have a short non-zero beat so fast bot bidding remains
 * understandable even when several events arrive in one frame.
 *
 * A PLAY is not in that group. The server batches (the fourth card of a trick
 * arrives together with its TRICK_WON, and a whole run of bot plays can land
 * in one frame) and it clears `view.trick` the instant the trick resolves, so
 * a UI that simply followed the state would show cards appearing and vanishing
 * inside a single frame. `GameRoomPage` therefore renders the trick from what
 * this queue has RELEASED while it is playing, and CARD_PLAYED's dwell is the
 * beat between one card landing and the next one leaving a hand.
 */
export const EVENT_DWELL_MS: Record<GameEvent["type"], number> = {
    /** The cards themselves are the deal feedback; no introductory popup. */
    DEALT: 0,
    /** Let every caller/pass remain visible before the turn marker moves. */
    BID: 800,
    PASS: 800,
    /** Long enough to read the "X zove herc" banner. */
    TRUMP_SET: 1600,
    /** The complete eight-card hand stays visible before results cover it. */
    HAND_COMPLETED: 1600,
    /** A card has to be SEEN landing: 320 ms of flight (TrickArea's FLY_MS)
     *  plus a beat to read it before the next player throws. The server's own
     *  bot pacing (1300–2300 ms) is longer than this, so for bot plays the
     *  queue is already idle and this dwell costs nothing; it is what makes
     *  MY card and any batched run of plays legible. */
    CARD_PLAYED: 800,
    /** The "Bela!" flash. */
    BELA: 1400,
    /** Belot ends the game; let the full-hand celebration finish first. */
    BELOT: 3200,
    /** 950 ms holding the four cards (TRICK_HOLD_MS in GameRoomPage) plus the
     *  500 ms they take to slide to the winner and fade, and a little slack.
     *  Shorter than the sum and the next card is dealt over a trick still
     *  leaving the table. The fourth card got its own landing beat before this
     *  event ever became active, so the full read is: card lands → beat →
     *  four cards held → winner sweeps them up. */
    TRICK_WON: 1550,
    /** The declarations overlay before the first card — 5.2 s, or until it is
     *  closed explicitly (game/DESIGN.md §2.7). */
    DECLARATIONS_REVEALED: 5200,
    /** The deal summary is a dialog the player dismisses; no dwell. */
    DEAL_SCORED: 0,
    GAME_OVER: 0,
}

/** Reduced motion shortens movement, not reading. Informational moments keep
 * enough time to understand what happened; only dealing, card flight and the
 * trick sweep become nearly immediate. */
const REDUCED_DWELL_MS: Record<GameEvent["type"], number> = {
    DEALT: 0,
    BID: 500,
    PASS: 500,
    TRUMP_SET: 1200,
    HAND_COMPLETED: 1200,
    CARD_PLAYED: 260,
    BELA: 1200,
    BELOT: 3000,
    TRICK_WON: 600,
    DECLARATIONS_REVEALED: 4800,
    DEAL_SCORED: 0,
    GAME_OVER: 0,
}

export interface EventQueue {
    /** The event currently being shown, or null when the queue is idle. */
    active: GameEvent | null
    /** Still waiting behind `active` — the table dims interaction while > 0. */
    pending: number
}

/**
 * @param incoming append-only list from `useGameSocket` (ids are monotonic).
 * @param reducedMotion shorten physical movement while retaining readable pauses.
 */
export function useEventQueue(incoming: QueuedGameEvent[], reducedMotion = false): EventQueue {
    const queueRef = useRef<QueuedGameEvent[]>([])
    const cursorRef = useRef(-1)
    /**
     * Has this consumer looked at `incoming` yet?
     *
     * The socket is a module singleton (`gameConnection.ts`) whose event ring
     * buffer OUTLIVES the table page, so a player who walks out of the room
     * and back in mounts a fresh queue in front of a backlog of up to
     * `MAX_EVENTS` events. Replaying it is not a smaller version of the right
     * behaviour, it is the wrong table: those events describe tricks that are
     * already over, `DEALT` among them clears the felt, and for the ~25 s a
     * deal's worth of dwell takes the view — which carries the cards actually
     * lying in the current trick — is ignored, because the queue counts as
     * busy. That is the "rejoin and the bot's card is missing" bug.
     *
     * Anything already buffered on the first look therefore happened while
     * this table was not on screen: the cursor jumps past it and the very
     * first `game.state` of the (re)join is what the felt renders. Exactly
     * what `GameRoomPage`'s sound cursor already does for the same reason.
     */
    const startedRef = useRef(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const reducedRef = useRef(reducedMotion)
    reducedRef.current = reducedMotion

    const [active, setActive] = useState<GameEvent | null>(null)
    const [pending, setPending] = useState(0)

    // Explicitly typed because the body references `pump` recursively — an
    // inferred self-referential const is an implicit `any` under `strict`.
    const pump = useCallback<() => void>(() => {
        if (timerRef.current !== null) return
        const next = queueRef.current.shift()
        if (!next) {
            setActive(null)
            setPending(0)
            return
        }
        setActive(next.event)
        setPending(queueRef.current.length)
        const dwell = reducedRef.current
            ? REDUCED_DWELL_MS[next.event.type]
            : EVENT_DWELL_MS[next.event.type]
        timerRef.current = setTimeout(() => {
            timerRef.current = null
            pump()
        }, dwell)
    }, [])

    useEffect(() => {
        if (incoming.length === 0) {
            startedRef.current = true
            if (timerRef.current !== null) clearTimeout(timerRef.current)
            timerRef.current = null
            queueRef.current = []
            setActive(null)
            setPending(0)
            return
        }
        if (!startedRef.current) {
            // Backlog from before this consumer existed — see `startedRef`.
            startedRef.current = true
            cursorRef.current = incoming[incoming.length - 1].id
            return
        }
        let added = false
        for (const item of incoming) {
            // `incoming` is a bounded ring buffer, so ids already consumed can
            // still be in it after a re-render — the cursor, not the array, is
            // what says what has been played.
            if (item.id <= cursorRef.current) continue
            queueRef.current.push(item)
            cursorRef.current = item.id
            added = true
        }
        if (!added) return
        setPending(queueRef.current.length)
        pump()
    }, [incoming, pump])

    useEffect(() => () => {
        if (timerRef.current !== null) clearTimeout(timerRef.current)
        timerRef.current = null
    }, [])

    return { active, pending }
}
