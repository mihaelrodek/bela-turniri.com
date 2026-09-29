import { useEffect } from "react"
import { isNative } from "../../platform"
import { nativeKeepAwake } from "../../platform/native"
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

   Native apps take a different road: Android WebView and WKWebView do not
   reliably expose `navigator.wakeLock`, so inside the Capacitor shells the
   `@capacitor-community/keep-awake` plugin holds the screen instead
   (`FLAG_KEEP_SCREEN_ON` on the Activity window / `isIdleTimerDisabled`).
   Neither needs the visibility dance above: both are properties of a window
   that only matter while it is on screen, so backgrounding the app cannot
   "lose" them and returning cannot need them re-applied. The flag is lifted
   on unmount, when the game ends, or when the player turns the pref off.
   ────────────────────────────────────────────────────────────────────── */

/* Native calls go through one promise chain so a quick off→on→off (a phase
   flip, StrictMode's double effect) reaches the plugin in the order React
   asked for it — two independent `await`s could land keepAwake() after the
   allowSleep() that was meant to follow it and leave the screen on for
   good. Failures are swallowed for the same reason as on the web. */
let nativeQueue: Promise<void> = Promise.resolve()

function nativeSetAwake(on: boolean): void {
    nativeQueue = nativeQueue
        .then(async () => {
            const KeepAwake = await nativeKeepAwake()
            await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep())
        })
        .catch(() => {})
}

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
    return isNative || wakeLock() !== null
}

/**
 * @param active whether the caller currently wants the screen held on (e.g.
 *   only while a game is actually running, not while the lobby is open).
 */
export function useKeepAwake(active: boolean): void {
    const [prefs] = useGamePrefs()
    const wanted = active && prefs.keepAwake

    useEffect(() => {
        if (!wanted) return
        if (isNative) {
            nativeSetAwake(true)
            return () => nativeSetAwake(false)
        }

        const api = wakeLock()
        if (!api) return

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
