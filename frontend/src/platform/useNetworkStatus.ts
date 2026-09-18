import { useEffect, useState } from "react"
import { isNative } from "./index"
import { nativeNetwork } from "./nativeIo"

/* ──────────────────────────────────────────────────────────────────────────
   Whether the device currently has a network connection.

   `navigator.onLine` (and the `online`/`offline` window events it fires) is
   what the web app has always used, and that stays exactly as it is — this
   module only adds a native branch. It matters because a WebView's
   `navigator.onLine` is unreliable on Android: some OEM WebViews report
   `true` while genuinely offline (device connectivity is a native-OS
   concept the WebView does not always mirror faithfully), which would leave
   `requireOnlineFor` gates green when a structural write (round draw, round
   finish, …) is about to fail anyway. `@capacitor/network` asks the OS
   directly instead.

   `useOfflineQueue.ts`'s own `online` flag is NOT switched to this — that
   flag drives the queue's actual retry loop, and the task that added native
   support was explicit that the queue's retry logic must not change. This
   hook is for the OTHER consumers that read online state to decide whether
   to even attempt an action (`useCanManageTournament.requireOnlineFor`) or
   how to react to a failure (`lazyWithReload`'s offline-chunk check).
   ────────────────────────────────────────────────────────────────────── */

/** Reactive hook for use inside components/other hooks. */
export function useNetworkStatus(): boolean {
    const [online, setOnline] = useState<boolean>(() => (
        typeof navigator === "undefined" ? true : navigator.onLine
    ))

    useEffect(() => {
        if (isNative) {
            let cancelled = false
            let handle: { remove: () => void } | null = null
            void (async () => {
                const Network = await nativeNetwork()
                const status = await Network.getStatus()
                if (cancelled) return
                setOnline(status.connected)
                handle = await Network.addListener("networkStatusChange", (s) => setOnline(s.connected))
            })()
            return () => {
                cancelled = true
                handle?.remove()
            }
        }
        // Web: exactly what the rest of the app already relies on.
        const onOnline = () => setOnline(true)
        const onOffline = () => setOnline(false)
        window.addEventListener("online", onOnline)
        window.addEventListener("offline", onOffline)
        return () => {
            window.removeEventListener("online", onOnline)
            window.removeEventListener("offline", onOffline)
        }
    }, [])

    return online
}

/**
 * One-off check for call sites outside React — `lazyWithReload`'s chunk-load
 * failure handler runs inside a `lazy()` factory, not a component. Mirrors
 * `useNetworkStatus`'s per-platform source; on the web this is the same
 * `navigator.onLine === false` test the code used before this module
 * existed.
 */
export async function isOffline(): Promise<boolean> {
    const browserSaysOffline = typeof navigator !== "undefined" && navigator.onLine === false
    if (isNative) {
        // Never let this reject. Its most important caller is lazyWithReload's
        // chunk-failure handler, and asking the native plugin is itself a
        // dynamic import plus a bridge call — if either fails, a rejection
        // here would replace the OFFLINE_CHUNK_ERROR classification with an
        // unrelated error and send the user to the generic error screen
        // instead of OfflineNotice. The browser's own flag is the fallback.
        try {
            const Network = await nativeNetwork()
            const status = await Network.getStatus()
            return !status.connected
        } catch {
            return browserSaysOffline
        }
    }
    return browserSaysOffline
}

export default useNetworkStatus
