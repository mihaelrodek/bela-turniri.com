import { useEffect, useRef } from "react"
import { useAuth } from "../auth/authContextValue"
import { useColorMode } from "../color-mode-hooks"
import { useMyProfile } from "../hooks/useMyProfile"

/**
 * Mounted once at the app root. Pulls the user's saved colorMode from
 * /user/me/profile after login and applies it via next-themes — so the
 * theme follows you across devices/browsers, not just localStorage on
 * one machine.
 *
 * Order of precedence:
 *   1. Server-side preference (this component, on every login)
 *   2. Local next-themes value (last picked on this device)
 *   3. App default ("light", from ColorModeProvider)
 *
 * Writes (when the user toggles the theme in Postavke) go in the other
 * direction — see updateColorMode in api/userMe.ts. ThemeSync is read-only.
 *
 * The profile itself comes from the shared `qk.profile` query (useMyProfile),
 * so mounting this component costs no extra request — NavBar and the pages
 * read the same cache entry.
 */
export default function ThemeSync() {
    const { user, loading } = useAuth()
    const { colorMode, setColorMode } = useColorMode()
    const { data: profile } = useMyProfile()
    // Apply the server value at most once per signed-in UID. Otherwise a
    // refetch (e.g. after an avatar upload invalidates the profile) would
    // fight the user's own toggle and snap the theme back.
    const lastAppliedUidRef = useRef<string | null>(null)

    useEffect(() => {
        if (loading) return
        const uid = user?.uid ?? null
        if (!uid) {
            lastAppliedUidRef.current = null
            return
        }
        if (!profile) return
        if (lastAppliedUidRef.current === uid) return
        lastAppliedUidRef.current = uid

        const serverMode = profile.colorMode
        if (serverMode === "light" || serverMode === "dark") {
            if (serverMode !== colorMode) setColorMode(serverMode)
        }
        // colorMode/setColorMode intentionally omitted — we don't want
        // this effect to re-fire when the user toggles locally.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.uid, loading, profile])

    return null
}
