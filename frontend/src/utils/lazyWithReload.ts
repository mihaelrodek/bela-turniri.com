import { lazy, type ComponentType } from "react"

/** sessionStorage flag so the recovery reload happens at most once per tab. */
const KEY = "chunk-reload-once"

/**
 * Wrap a lazy import so a FAILED dynamic import — almost always a stale chunk
 * after a new deploy (the old hashed /assets file no longer exists) — triggers
 * ONE full reload to pull the fresh build manifest, instead of white-screening.
 * If it still fails right after that reload, the error propagates to the
 * top-level ErrorBoundary (which shows a friendly "Osvježi stranicu" screen).
 *
 * Lives in utils rather than App.tsx so any module that lazily loads a heavy
 * component (e.g. the avatar cropper on the profile page) gets the same
 * stale-chunk recovery for free.
 */
export function lazyWithReload<P extends object = Record<string, unknown>>(
    factory: () => Promise<{ default: ComponentType<P> }>,
) {
    return lazy(async () => {
        try {
            const mod = await factory()
            sessionStorage.removeItem(KEY) // fresh build loaded fine
            return mod
        } catch (err) {
            if (!sessionStorage.getItem(KEY)) {
                sessionStorage.setItem(KEY, "1")
                window.location.reload()
                // Hold the Suspense fallback until the reload takes over.
                return new Promise<never>(() => {})
            }
            throw err // already reloaded once → let the ErrorBoundary catch it
        }
    })
}

export default lazyWithReload
