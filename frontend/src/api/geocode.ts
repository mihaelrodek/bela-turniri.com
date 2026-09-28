import { http } from "./http"

/**
 * Reverse geocode through the backend (Google Geocoding, server-side key).
 * Resolves `null` when the backend has no key configured or Google found
 * nothing (204) — the caller then falls back to Nominatim. Silent: a failure
 * here is never the user's problem, the fallback covers it.
 */
export async function reverseGeocodeViaBackend(lat: number, lng: number): Promise<string | null> {
    const res = await http.get<{ displayName?: string } | "">("/geocode/reverse", {
        params: { lat, lng },
        silent: true,
    })
    const name = res.status === 200 && res.data && typeof res.data === "object" ? res.data.displayName : undefined
    return name && name.trim().length > 0 ? name.trim() : null
}
