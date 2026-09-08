import { useEffect, useState } from "react"

/* ──────────────────────────────────────────────────────────────────────────
   The seat-hold countdown, shared by the reconnect strip over the table and
   the lobby's "imaš aktivnu igru" card.

   The server reports a hold as an ABSOLUTE epoch ms (`holdUntil`,
   README §3 "Timeri"), never as a duration, so the number shown here is a
   pure function of the wall clock: a suspended tab shows the truth the
   instant it wakes and no drift can accumulate over two minutes of ticking.
   ────────────────────────────────────────────────────────────────────── */

/** `1:47`, or `0:09`. Bare seconds past a minute would read as a page count. */
export function formatCountdown(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000))
    const minutes = Math.floor(total / 60)
    const seconds = total % 60
    return `${minutes}:${String(seconds).padStart(2, "0")}`
}

/**
 * Remaining ms until `deadline`, re-rendered once a second while it lasts.
 * Returns null when there is no deadline at all, and 0 once it has passed.
 */
export function useHoldCountdown(deadline: number | null | undefined): number | null {
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        if (typeof deadline !== "number") return
        setNow(Date.now())
        const id = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(id)
    }, [deadline])

    if (typeof deadline !== "number") return null
    return deadline > now ? deadline - now : 0
}
