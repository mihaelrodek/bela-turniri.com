import { useCallback, useRef } from "react"

/**
 * Prefetch a lazy route chunk via requestIdleCallback. Calling the returned
 * function tells the browser to load the route's JavaScript in the background
 * when idle, so a subsequent navigation feels instant.
 *
 * The promise is cached per route so multiple pointerenter/focus events on the
 * same link don't restart the download. Returns quickly; nothing blocks on it.
 */
export function usePrefetchRoute(
    factory: (() => Promise<unknown>) | undefined,
): () => void {
    const promiseRef = useRef<Promise<unknown> | null>(null)

    return useCallback(() => {
        if (!factory) return
        if (promiseRef.current) return // already prefetching
        if (typeof window.requestIdleCallback !== "function") {
            // Fallback: load it after 500ms of idle (browsers without rIC)
            const timeout = window.setTimeout(() => {
                factory().catch(() => {})
            }, 500)
            return () => window.clearTimeout(timeout)
        }
        const id = window.requestIdleCallback(
            () => {
                promiseRef.current = factory().catch(() => {})
            },
            { timeout: 3000 },
        )
        return () => window.cancelIdleCallback(id)
    }, [factory])
}
