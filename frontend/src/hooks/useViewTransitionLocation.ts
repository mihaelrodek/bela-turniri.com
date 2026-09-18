import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { useLocation, type Location } from "react-router-dom"

/* ──────────────────────────────────────────────────────────────────────────
   Route changes as a cross-fade instead of a hard cut.

   The View Transitions API takes a screenshot of the page, lets us swap the
   DOM, then animates old → new (a 250 ms cross-fade by default). Routing
   through it means "list → detail" no longer flickers through a blank frame
   and a skeleton; the old page fades into the new one.

   How it plugs into the router: `<Routes location={displayed}>` renders the
   location THIS hook hands back, not the live one. On a navigation we keep
   showing the old location for one more frame, ask the browser to snapshot
   it, and only then commit the new location — synchronously, with
   `flushSync`, because the browser needs the DOM swap to be finished when
   the callback resolves. That is the documented pattern for React.

   Everything else is opt-out:
     - no `document.startViewTransition` (Firefox < 144, older Safari) → the
       location is applied at once, exactly as before;
     - `prefers-reduced-motion` → same, no animation;
     - a navigation while a transition is still running skips the running one
       first, so a fast double-click cannot queue up two fades and lag.

   Pages read `useLocation()` from the router, so for that one frame a page
   can see a `search` string one step newer than the route it was matched
   for. Harmless: nothing renders off `search` alone without also being
   remounted by the route change.
   ────────────────────────────────────────────────────────────────────── */

type ViewTransitionDocument = Document & {
    startViewTransition?: (update: () => void | Promise<void>) => { skipTransition(): void }
}

function canAnimate(): boolean {
    if (typeof document === "undefined") return false
    if (typeof (document as ViewTransitionDocument).startViewTransition !== "function") return false
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function useViewTransitionLocation(): Location {
    const location = useLocation()
    const [displayed, setDisplayed] = useState(location)
    const running = useRef<{ skipTransition(): void } | null>(null)

    useEffect(() => {
        if (location === displayed) return
        if (!canAnimate()) {
            setDisplayed(location)
            return
        }
        running.current?.skipTransition()
        const transition = (document as ViewTransitionDocument).startViewTransition!(() => {
            flushSync(() => setDisplayed(location))
        })
        running.current = transition
        // Intentionally only on `location`: `displayed` catching up is the
        // effect's own doing, not a reason to run again.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location])

    return displayed
}
