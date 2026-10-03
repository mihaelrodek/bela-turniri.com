import { useEffect, useState } from "react"
import type { GameConnectionStatus } from "../types"

/**
 * A socket may technically still be online while its handshake/reconnect is
 * taking long enough that the player needs an explanation. This is purposely
 * time-based rather than relying on Chromium-only `navigator.connection`, so
 * iPhone PWAs and browsers report the same useful state.
 */
export function useSlowConnection(status: GameConnectionStatus, delayMs = 2500): boolean {
    const [slow, setSlow] = useState(false)

    // Keyed on "open or not", not on the status itself: a reconnect loop
    // flips connecting ↔ closed every attempt, and restarting the timer on
    // each flip made the page alternate between messages (2026-09-29).
    const open = status === "open"
    useEffect(() => {
        setSlow(false)
        if (open) return
        const id = window.setTimeout(() => setSlow(true), delayMs)
        return () => window.clearTimeout(id)
    }, [open, delayMs])

    return slow
}
