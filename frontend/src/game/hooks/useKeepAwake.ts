import { useEffect } from "react"
import { useGamePrefs } from "./useGamePrefs"

/* ──────────────────────────────────────────────────────────────────────────
   useKeepAwake — hold the screen on while the player is at the table.

   The Screen Wake Lock API is a real web API, not a native-only one: Chrome
   and Edge have had it for years and Safari has it from iOS 16.4, which
   covers the installed PWA as well as the browser tab (2026-09-20, user
   question). Where it does not exist the hook is simply a no-op — there is
   no polyfill worth having, and the fake ones (a looping muted video) cost
   battery for a behaviour the platform deliberately withheld.

   Two rules the API imposes and this hook has to live with:

     1. The lock is released BY THE BROWSER whenever the page stops being
        visible, and it is not restored on the way back. So the lock is
        re-acquired on `visibilitychange` for as long as the caller still
        wants it.
     2. `request()` rejects rather than throwing (low battery, a policy, a
        browser that lists the API but refuses it in this context). Every
        failure is swallowed: keeping the screen on is a convenience, never
        something worth a message.

   Note that the lock keeps the screen ON; it does not keep it BRIGHT. iOS
   still dims an idle screen — it just will not lock it.
   ────────────────────────────────────────────────────────────────────── */

interface WakeLockSentinelLike {
    released: boolean
    release: () => Promise<void>
}

interface WakeLockLike {
    request: (type: "screen") => Promise<WakeLockSentinelLike>
}

function wakeLock(): WakeLockLike | null {
    if (typeof navigator === "undefined") return null
    const api = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock
    return api ?? null
}

/** True when this browser can hold a screen wake lock at all — used by the
 *  settings sheet to explain a switch that would otherwise do nothing. */
export function keepAwakeSupported(): boolean {
    return wakeLock() !== null
}

/**
 * @param active whether the caller currently wants the screen held on (e.g.
 *   only while a game is actually running, not while the lobby is open).
 */
export function useKeepAwake(active: boolean): void {
    const [prefs] = useGamePrefs()
    const wanted = active && prefs.keepAwake

    useEffect(() => {
        const api = wakeLock()
        if (!wanted || !api) return

        let cancelled = false
        let sentinel: WakeLockSentinelLike | null = null

        const acquire = async (): Promise<void> => {
            if (cancelled || document.visibilityState !== "visible") return
            if (sentinel && !sentinel.released) return
            try {
                sentinel = await api.request("screen")
            } catch {
                // Denied for this context (battery saver, policy, no
                // gesture yet). The next foreground return tries again.
            }
        }

        const onVisibility = (): void => {
            if (document.visibilityState === "visible") void acquire()
        }

        void acquire()
        document.addEventListener("visibilitychange", onVisibility)

        return () => {
            cancelled = true
            document.removeEventListener("visibilitychange", onVisibility)
            const held = sentinel
            sentinel = null
            if (held && !held.released) void held.release().catch(() => {})
        }
    }, [wanted])
}
