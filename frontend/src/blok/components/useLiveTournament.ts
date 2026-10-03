import { useEffect, useState } from "react"
import { fetchTournaments } from "../../api/tournaments"

/**
 * Is any tournament running right now (status STARTED)? Drives the "uživo"
 * link button on the blok's score card (2026-10-03, owner): the button is the
 * sign that a tournament is live AND that the blok can be tied to a table, so
 * it only shows while one is. Quiet by design — a silent request, no toast,
 * nothing shown on failure — because the blok is an offline scorepad first;
 * re-checked every two minutes while the page is open.
 */
export function useLiveTournament(enabled: boolean): boolean {
    const [live, setLive] = useState(false)
    useEffect(() => {
        if (!enabled) {
            setLive(false)
            return
        }
        let cancelled = false
        const check = () => {
            if (typeof navigator !== "undefined" && navigator.onLine === false) return
            fetchTournaments("upcoming", { silent: true })
                .then((items) => {
                    if (!cancelled) setLive(items.some((item) => item.status === "STARTED"))
                })
                .catch(() => {
                    /* keep the last answer; nothing to tell the player */
                })
        }
        check()
        const id = window.setInterval(check, 120_000)
        return () => {
            cancelled = true
            window.clearInterval(id)
        }
    }, [enabled])
    return live
}
