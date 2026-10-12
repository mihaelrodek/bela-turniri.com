import { useSyncExternalStore } from "react"
import { SHORT_LANDSCAPE_QUERY } from "../utils/shortLandscape"

/* True while the viewport is a phone held sideways (`SHORT_LANDSCAPE_QUERY`,
   2026-10-12, owner). For layout that a `css` media block cannot express —
   a different component size or a different arrangement. Plain styling
   should prefer `css={{ [SHORT_LANDSCAPE]: … }}`, which needs no render. */

function subscribe(onChange: () => void): () => void {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {}
    const list = window.matchMedia(SHORT_LANDSCAPE_QUERY)
    list.addEventListener("change", onChange)
    return () => list.removeEventListener("change", onChange)
}

function snapshot(): boolean {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
    return window.matchMedia(SHORT_LANDSCAPE_QUERY).matches
}

function serverSnapshot(): boolean {
    return false
}

export function useShortLandscape(): boolean {
    return useSyncExternalStore(subscribe, snapshot, serverSnapshot)
}
