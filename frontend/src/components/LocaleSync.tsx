import { useEffect, useRef } from "react"
import { useAuth } from "../auth/authContextValue"
import { useMyProfile } from "../hooks/useMyProfile"
import { getLocale, isLocale, setLocale, useLocale, type Locale } from "../i18n"
import { updateLocale } from "../api/userMe"

/**
 * Mounted once at the app root, next to ThemeSync and following the same
 * pattern — with one addition: ThemeSync is read-only (the theme toggle writes
 * from Postavke), whereas the language switcher lives in the navbar and has no
 * good place of its own to write from, so this component owns BOTH directions.
 *
 * Read  — on login, apply `profile.locale` from /user/me/profile, so a pick
 *         made on one device follows the account to the next one.
 * Write — while signed in, persist any later change (the navbar picker) back
 *         to the profile, fire-and-forget.
 *
 * Order of precedence (see the header comment in `src/i18n/index.ts`):
 *   1. Server-side preference (this component, on every login)
 *   2. Local choice for this device (localStorage, from a prior pick)
 *   3. The browser's own languages
 *   4. "hr"
 *
 * The profile comes from the shared `qk.profile` query (useMyProfile), so
 * mounting this costs no extra request — NavBar and ThemeSync read the same
 * cache entry.
 */
export default function LocaleSync() {
    const { user, loading } = useAuth()
    const { data: profile } = useMyProfile()
    const locale = useLocale()

    // Apply the server value at most once per signed-in UID. Otherwise any
    // refetch (an avatar upload invalidates qk.profile) would race the user's
    // own pick and snap the language back — the same reasoning as ThemeSync.
    const appliedUidRef = useRef<string | null>(null)
    // Last value we know the server holds, so the write effect below fires
    // only for a genuine user-initiated change, never to echo what we just read.
    const serverLocaleRef = useRef<Locale | null>(null)

    useEffect(() => {
        if (loading) return
        const uid = user?.uid ?? null
        if (!uid) {
            appliedUidRef.current = null
            serverLocaleRef.current = null
            return
        }
        if (!profile) return
        if (appliedUidRef.current === uid) return
        appliedUidRef.current = uid

        const stored = profile.locale
        if (isLocale(stored)) {
            serverLocaleRef.current = stored
            if (stored !== getLocale()) setLocale(stored)
        } else {
            // No stored preference yet. Treat whatever this device resolved to
            // as the value to push up on the first change, and let the write
            // effect below seed the column.
            serverLocaleRef.current = null
        }
    }, [user?.uid, loading, profile])

    useEffect(() => {
        if (loading || !user) return
        // Don't write before the read has happened — otherwise the local
        // (browser-detected) value would overwrite the stored one on every login.
        if (appliedUidRef.current !== user.uid) return
        if (serverLocaleRef.current === locale) return
        serverLocaleRef.current = locale
        updateLocale(locale).catch(() => {
            // Best-effort: the switch already applied locally and is in
            // localStorage. Allow a retry on the next change.
            serverLocaleRef.current = null
        })
    }, [locale, user, loading])

    return null
}
