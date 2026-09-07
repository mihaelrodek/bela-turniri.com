import { createContext, useContext } from "react"
import type { User as FirebaseUser } from "firebase/auth"

/*
 * Split out of AuthContext.tsx so that file only exports the `AuthProvider`
 * component — react-refresh/only-export-components flags a file that mixes
 * a component export with non-component exports (this context, the hook,
 * the type), since it breaks Fast Refresh's ability to hot-swap the
 * component in isolation.
 */

export type AuthValue = {
    /** Currently signed-in Firebase user (null when signed out, undefined while loading). */
    user: FirebaseUser | null
    /** True only during the initial auth-state probe on app load. */
    loading: boolean
    /** Custom claims attached to the user (server-set via Firebase Admin SDK). */
    claims: Record<string, unknown>
    /** Convenience flag — true when the `role` custom claim equals `"admin"`. */
    isAdmin: boolean
    /** Slug returned by the backend after /user/me/sync — null until first sync. */
    mySlug: string | null
    /** Email + password sign-in. */
    signIn: (email: string, password: string) => Promise<void>
    /** Email + password registration. Optional displayName is set on the user profile. */
    signUp: (email: string, password: string, displayName?: string) => Promise<void>
    /** Google OAuth sign-in (popup on desktop; SDK handles redirect fallback). */
    signInWithGoogle: () => Promise<void>
    /** Sign out the current user. */
    signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
    const v = useContext(AuthContext)
    if (!v) throw new Error("useAuth must be used inside <AuthProvider>")
    return v
}
