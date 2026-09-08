import { lazy, type ComponentType } from "react"

/** sessionStorage flag so the recovery reload happens at most once per tab. */
const KEY = "chunk-reload-once"

/**
 * The `name` an offline chunk failure is thrown under, so the top-level
 * ErrorBoundary can tell "this device does not have this page" apart from "this
 * page crashed" and say the honest thing about each.
 *
 * A string on `Error.name` rather than a subclass: the boundary receives the
 * error through React, which gives no guarantees about identity across chunk
 * boundaries, and `instanceof` over a lazily-loaded module is exactly the kind
 * of check that quietly stops matching.
 */
export const OFFLINE_CHUNK_ERROR = "BelaOfflineChunkError"

function isOffline(): boolean {
    return typeof navigator !== "undefined" && navigator.onLine === false
}

/**
 * Wrap a lazy import so a FAILED dynamic import — almost always a stale chunk
 * after a new deploy (the old hashed /assets file no longer exists) — triggers
 * ONE full reload to pull the fresh build manifest, instead of white-screening.
 * If it still fails right after that reload, the error propagates to the
 * top-level ErrorBoundary (which shows a friendly "Osvježi stranicu" screen).
 *
 * OFFLINE IS THE ONE CASE THAT MUST NOT RELOAD. With no network the import did
 * not fail because the build moved — it failed because this chunk was never
 * precached onto this device (`public/sw.js` precaches the shell and /blok, not
 * every route). Reloading then costs a full teardown to arrive at the same
 * missing file, and lands the player on "Osvježi stranicu", which is advice
 * that cannot work in a tunnel. The failure is thrown straight through under
 * `OFFLINE_CHUNK_ERROR` instead, and the boundary shows the offline screen —
 * which is the one place that can point at the scorepad, the part of the app
 * that does work with no signal.
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
            // Checked BEFORE the reload branch and again after it: the first
            // attempt and the post-reload attempt are both "the file is not
            // here", and a device that went offline between them must not be
            // told to refresh either.
            if (isOffline()) {
                const offline = new Error(OFFLINE_CHUNK_ERROR)
                offline.name = OFFLINE_CHUNK_ERROR
                throw offline
            }
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
