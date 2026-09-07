import { statusFallback } from "../toaster"

/**
 * Localised message for a caught request error.
 *
 * Prefers the backend's own body text, then the status-derived copy from
 * `toaster.ts` (which is itself dictionary-backed), then the caller's own
 * line. Replaces the `e?.message ?? "English string"` pattern, which leaked
 * axios's English text ("Network Error", "Request failed with status code
 * 409") into an otherwise fully translated UI.
 *
 * Lived twice — once in `TournamentDetailsPage` and once in
 * `PublicProfilePage`, byte-for-byte identical. This is that one copy; the
 * signature is unchanged so both call sites can simply import it.
 */
export function errorMessage(e: unknown, fallback?: string): string {
    const err = e as { response?: { status?: number; data?: unknown } } | null
    const data = err?.response?.data
    if (typeof data === "string" && data.trim()) return data.trim()
    if (data && typeof data === "object") {
        const msg = (data as Record<string, unknown>).message
        if (typeof msg === "string" && msg.trim()) return msg.trim()
    }
    const status = err?.response?.status
    if (status) return statusFallback(status)
    return fallback ?? statusFallback(undefined)
}

export default errorMessage
