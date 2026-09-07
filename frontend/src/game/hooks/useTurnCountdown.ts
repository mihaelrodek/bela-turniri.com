import { useEffect, useState } from "react"

/** 4 Hz: enough for a ring that visibly drains, cheap enough to leave running. */
const TICK_MS = 250

export interface TurnCountdown {
    /** Milliseconds left, never negative. */
    remainingMs: number
    /** Whole seconds left — what the seat prints. */
    seconds: number
    /** 1 → full, 0 → expired. Drives the countdown ring's conic gradient. */
    fraction: number
    /** Under a quarter left: the ring turns red and the seat pulses. */
    urgent: boolean
}

const IDLE: TurnCountdown = { remainingMs: 0, seconds: 0, fraction: 0, urgent: false }

/**
 * Turns the server's absolute `turnDeadline` (epoch ms) into a ticking
 * countdown. Absolute rather than a duration on purpose: a tab that was
 * backgrounded, a socket that reconnected mid-turn and a client whose timers
 * were throttled all still agree with the server on when the turn runs out.
 *
 * @param deadline epoch ms from `game.state`, or null when nobody is on turn.
 * @param totalMs the room's `turnTimeoutMs`, i.e. what a full ring means.
 */
export function useTurnCountdown(deadline: number | null, totalMs: number): TurnCountdown {
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        if (deadline === null) return
        setNow(Date.now())
        const id = setInterval(() => setNow(Date.now()), TICK_MS)
        return () => clearInterval(id)
    }, [deadline])

    if (deadline === null || totalMs <= 0) return IDLE

    const remainingMs = Math.max(0, deadline - now)
    const fraction = Math.max(0, Math.min(1, remainingMs / totalMs))
    return {
        remainingMs,
        seconds: Math.ceil(remainingMs / 1000),
        fraction,
        urgent: fraction <= 0.25,
    }
}
