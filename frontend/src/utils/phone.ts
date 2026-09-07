/* ──────────────────────────────────────────────────────────────────────────
   Phone country codes + the two helpers that go with them.

   The same six-entry array lived in four files (CreateTournamentPage,
   TournamentDetailsPage, FindPairPage, PublicProfilePage), each with its own
   comment claiming it was "kept in sync" with the others. It now lives here.

   Ordering is deliberate: Croatia first, then the neighbours our organisers
   actually get calls from. Add a country here and every phone selector in the
   app picks it up.
   ────────────────────────────────────────────────────────────────────── */

export type PhoneCountry = { value: string; label: string }

export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
    { value: "+385", label: "🇭🇷 +385" },
    { value: "+386", label: "🇸🇮 +386" },
    { value: "+43", label: "🇦🇹 +43" },
    { value: "+49", label: "🇩🇪 +49" },
    { value: "+387", label: "🇧🇦 +387" },
    { value: "+381", label: "🇷🇸 +381" },
]

/** The country used when a stored number carries no recognised dial code. */
export const DEFAULT_DIAL_CODE = "+385"

/**
 * Strip everything except digits and spaces. Spaces stay so users can type
 * "91 234 5678" for readability; the dial code lives in a separate select, so
 * a leading "+" or country digits are not expected in this field.
 */
export function sanitizePhone(raw: string): string {
    return raw.replace(/[^\d\s]/g, "")
}

/**
 * Split a stored "+385 91 234 5678" back into the select value and the local
 * part. An unrecognised prefix keeps the whole string as the local part and
 * defaults the country, so the select never renders an empty option.
 */
export function splitPhone(stored?: string | null): { country: string; local: string } {
    const s = (stored ?? "").trim()
    if (!s) return { country: DEFAULT_DIAL_CODE, local: "" }
    for (const c of PHONE_COUNTRIES) {
        if (s.startsWith(c.value)) {
            return { country: c.value, local: s.slice(c.value.length).trim() }
        }
    }
    return { country: DEFAULT_DIAL_CODE, local: s }
}

/** Recombine a select value + local part into the stored form, or null. */
export function joinPhone(country: string, local: string): string | null {
    const rest = local.trim()
    return rest ? `${country} ${rest}` : null
}
