import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getProfile, type UserProfile } from "../api/userMe"
import { useAuth } from "../auth/authContextValue"
import { qk } from "../queryClient"

/**
 * The signed-in user's own profile (/user/me/profile), shared by every
 * consumer through ONE react-query entry.
 *
 * Before this hook the same endpoint was hit three-plus times on a cold load —
 * NavBar (avatar), ThemeSync (saved colour mode) and whichever page needed the
 * saved phone number all called `getProfile()` from their own effect. They now
 * share `qk.profile`, so it's a single request that every consumer reads from
 * cache.
 *
 * The query is disabled while signed out (the endpoint 401s for guests) and
 * NOT persisted to localStorage — see NON_PERSISTED_KEY_ROOTS in queryClient.ts
 * for why auth-scoped data must never be restored from disk.
 */
export function useMyProfile() {
    const { user } = useAuth()
    return useQuery<UserProfile>({
        queryKey: qk.profile,
        queryFn: getProfile,
        enabled: !!user,
        // The profile changes only through this app's own mutations, which
        // invalidate the key explicitly — no need to re-poll it on navigation.
        staleTime: 5 * 60_000,
    })
}

/**
 * Invalidate the shared profile entry after a mutation that changes it
 * (avatar upload/delete, contact details, theme). Every consumer — navbar
 * avatar included — repaints from the one refetch.
 */
export function useInvalidateMyProfile() {
    const queryClient = useQueryClient()
    // Stable identity so callers can list it in an effect's dep array.
    return useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk.profile }),
        [queryClient],
    )
}
