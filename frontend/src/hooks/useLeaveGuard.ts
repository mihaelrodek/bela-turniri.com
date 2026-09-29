import { useContext, useEffect, useRef, useState } from "react"
import { UNSAFE_NavigationContext } from "react-router-dom"

/**
 * Holds every in-app navigation while `when` is true and asks first.
 *
 * <p>The app runs on `<BrowserRouter>`, where react-router's `useBlocker`
 * does not work (it needs a data router), so this wraps the router's own
 * navigator: `<Link>`, `navigate()` and section switches all go through its
 * `push` / `replace`, so one wrapper catches every one of them. A held
 * navigation is parked in `pending`; `confirm()` runs it, `cancel()` drops
 * it. Browser Back and reload / tab close are not held here — `beforeunload`
 * covers the last two with the browser's own prompt.
 */
export function useLeaveGuard(when: boolean) {
    const { navigator } = useContext(UNSAFE_NavigationContext)
    const [pending, setPending] = useState<(() => void) | null>(null)
    // Lets the parked navigation through even if the guard is still armed
    // when it runs (state updates from confirm() have not rendered yet).
    const bypassRef = useRef(false)

    useEffect(() => {
        if (!when) return
        const nav = navigator as typeof navigator & {
            push: (...args: unknown[]) => void
            replace: (...args: unknown[]) => void
        }
        const origPush = nav.push
        const origReplace = nav.replace
        const hold = (orig: (...args: unknown[]) => void) => (...args: unknown[]) => {
            if (bypassRef.current) {
                orig.apply(nav, args)
                return
            }
            setPending(() => () => orig.apply(nav, args))
        }
        nav.push = hold(origPush)
        nav.replace = hold(origReplace)
        return () => {
            nav.push = origPush
            nav.replace = origReplace
        }
    }, [navigator, when])

    useEffect(() => {
        if (!when) return
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            // Older Chromium / Safari still need returnValue set.
            e.returnValue = ""
        }
        window.addEventListener("beforeunload", onBeforeUnload)
        return () => window.removeEventListener("beforeunload", onBeforeUnload)
    }, [when])

    return {
        /** True while a navigation waits for the user's answer. */
        blocked: pending != null,
        /** Runs the held navigation. Call after discarding the edits. */
        confirm: () => {
            const go = pending
            setPending(null)
            if (!go) return
            bypassRef.current = true
            try {
                go()
            } finally {
                bypassRef.current = false
            }
        },
        cancel: () => setPending(null),
    }
}
