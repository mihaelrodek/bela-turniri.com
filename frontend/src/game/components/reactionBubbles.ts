import { useEffect, useMemo, useRef, useState } from "react"
import type { Seat } from "@bela/protocol"
import type { SeatReaction } from "../hooks/useGameSocket"

/* ──────────────────────────────────────────────────────────────────────────
   Which seat is showing which emoji right now.

   `useGameSocket` keeps the last few `chat.reaction` frames; this turns them
   into "seat 2 is showing 🔥" for the two seconds the bubble lives, and then
   stops ticking. A separate module from `ReactionsBar.tsx` on purpose: that
   file exports a component and nothing else, which is what keeps fast
   refresh working on it.
   ────────────────────────────────────────────────────────────────────── */

/** How long a bubble floats next to its seat (game/DESIGN.md §1 "Stol"). */
export const BUBBLE_MS = 2000

/**
 * A later reaction from the same seat replaces the earlier one — only the
 * last word counts. A spectator's reaction (`seat === null`) has no seat to
 * float over and is dropped.
 */
export function useReactionBubbles(reactions: SeatReaction[]): Partial<Record<Seat, string>> {
    const [now, setNow] = useState(() => Date.now())
    const newest = reactions.length === 0 ? -1 : reactions[reactions.length - 1].id
    const latestRef = useRef(reactions)
    latestRef.current = reactions

    useEffect(() => {
        if (newest < 0) return
        setNow(Date.now())
        // Ticks only while a bubble can still be on screen, then stops by
        // itself — an idle table must not hold a 4 Hz timer for the whole game.
        const id = setInterval(() => {
            const at = Date.now()
            setNow(at)
            const items = latestRef.current
            const last = items.length === 0 ? 0 : items[items.length - 1].at
            if (at - last > BUBBLE_MS + 500) clearInterval(id)
        }, 250)
        return () => clearInterval(id)
    }, [newest])

    return useMemo(() => {
        const active: Partial<Record<Seat, string>> = {}
        for (const item of reactions) {
            if (item.seat === null) continue
            if (now - item.at > BUBBLE_MS) continue
            active[item.seat] = item.reaction
        }
        return active
    }, [reactions, now])
}
