import { useEffect, useState } from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

/**
 * True when the OS asks for reduced motion. Every animation on the table —
 * the card flying in, the trick sliding to its winner, the countdown ring —
 * checks this and either shortens or drops the transition rather than
 * relying on a CSS media query alone, because several of them are driven from
 * JS timers (see `useEventQueue`) which CSS cannot shorten.
 */
export function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(() => {
        try {
            return window.matchMedia(QUERY).matches
        } catch {
            return false
        }
    })

    useEffect(() => {
        let media: MediaQueryList
        try {
            media = window.matchMedia(QUERY)
        } catch {
            return
        }
        const onChange = () => setReduced(media.matches)
        setReduced(media.matches)
        media.addEventListener("change", onChange)
        return () => media.removeEventListener("change", onChange)
    }, [])

    return reduced
}
