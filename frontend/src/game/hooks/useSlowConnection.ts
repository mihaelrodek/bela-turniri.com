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

    useEffect(() => {
        if (status === "open") {
            setSlow(false)
            return
        }
        setSlow(false)
        const id = window.setTimeout(() => setSlow(true), delayMs)
        return () => window.clearTimeout(id)
    }, [status, delayMs])

    return slow
}
