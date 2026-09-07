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
 * Zero means "nothing to animate, the `PlayerView` already says it" — a bid,
 * a pass and a played card are all visible in `view.bidding` / `view.trick`,
 * so holding the queue for them would only add lag between a tap and the
 * card appearing.
 */
export const EVENT_DWELL_MS: Record<GameEvent["type"], number> = {
    /** Cards leaving the dealer — the deal animation runs off `view.handSizes`. */
    DEALT: 250,
    BID: 0,
    PASS: 0,
    /** Long enough to read the "X zove herc" banner. */
    TRUMP_SET: 700,
    HAND_COMPLETED: 200,
    CARD_PLAYED: 0,
    /** The "Bela!" flash. */
    BELA: 900,
    /** 700 ms holding the four cards (TRICK_HOLD_MS in GameRoomPage) plus the
     *  400 ms they take to slide to the winner and fade. Shorter than the sum
     *  and the next card is dealt over a trick still leaving the table. */
    TRICK_WON: 1150,
    /** The declarations overlay after the first trick — 3 s, or a tap
     *  (game/DESIGN.md §2.7). */
    DECLARATIONS_REVEALED: 3000,
    /** The deal summary is a dialog the player dismisses; no dwell. */
    DEAL_SCORED: 0,
    GAME_OVER: 0,
}

/** With reduced motion every dwell collapses to this — the information still
 *  needs a beat on screen, it just doesn't slide. */
const REDUCED_DWELL_MS = 150

export interface EventQueue {
    /** The event currently being shown, or null when the queue is idle. */
    active: GameEvent | null
    /** Still waiting behind `active` — the table dims interaction while > 0. */
    pending: number
}

/**
 * @param incoming append-only list from `useGameSocket` (ids are monotonic).
 * @param reducedMotion collapse every dwell (`prefers-reduced-motion`).
 */
export function useEventQueue(incoming: QueuedGameEvent[], reducedMotion = false): EventQueue {
    const queueRef = useRef<QueuedGameEvent[]>([])
    const cursorRef = useRef(-1)
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
            ? Math.min(EVENT_DWELL_MS[next.event.type], REDUCED_DWELL_MS)
            : EVENT_DWELL_MS[next.event.type]
        timerRef.current = setTimeout(() => {
            timerRef.current = null
            pump()
        }, dwell)
    }, [])

    useEffect(() => {
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
