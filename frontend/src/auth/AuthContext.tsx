import React, { useEffect, useMemo, useRef, useState } from "react"
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut as fbSignOut,
    updateProfile,
    type User as FirebaseUser,
} from "firebase/auth"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { auth, googleProvider } from "../firebase"
import { syncProfile } from "../api/userMe"
import { qk } from "../queryClient"
import { persister } from "../persister"
import { AuthContext as Ctx, type AuthValue } from "./authContextValue"

/**
 * Wipe every trace of the previous session's data: the in-memory query cache
 * AND the localStorage snapshot the persister keeps. Clearing only the client
 * would leave the old user's tournaments, pair board and profile on disk, ready
 * to be rehydrated on the next cold load by whoever opens the app next.
 */
async function purgePersistedCache(client: QueryClient) {
    client.clear()
    try {
        await persister?.removeClient()
    } catch {
        // Storage unavailable — nothing persisted, nothing to remove.
    }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<FirebaseUser | null>(null)
    const [loading, setLoading] = useState(true)
    const [claims, setClaims] = useState<Record<string, unknown>>({})
    const [mySlug, setMySlug] = useState<string | null>(null)
    const queryClient = useQueryClient()
    // Which UID the cache currently holds data for. `undefined` means "we
    // haven't seen an auth state yet", which is NOT a transition — the very
    // first callback on a cold load must not throw away the snapshot the
    // persister just restored.
    const cachedUidRef = useRef<string | null | undefined>(undefined)

    useEffect(() => {
        // Fires once with the persisted user on load, then again on every change.
        // For each user we also pull the parsed token, so we know their role.
        const unsub = onAuthStateChanged(auth, async (u) => {
            const prevUid = cachedUidRef.current
            const nextUid = u?.uid ?? null
            const identityChanged = prevUid !== undefined && prevUid !== nextUid
            cachedUidRef.current = nextUid

            setUser(u)
            if (u) {
                // Signing IN (or switching accounts): everything already in the
                // cache was fetched anonymously or as someone else. Many reads
                // vary by caller (tournament details widen for the organiser,
                // the pair board grows owner actions), so mark it all stale and
                // let the mounted pages refetch with the bearer attached.
                if (identityChanged) {
                    if (prevUid !== null) await purgePersistedCache(queryClient)
                    else queryClient.invalidateQueries()
                }
                try {
                    const result = await u.getIdTokenResult()
                    setClaims(result.claims as Record<string, unknown>)
                } catch {
                    setClaims({})
                }
                // Fire-and-forget profile sync — pushes the Firebase displayName
                // up so the backend can persist it + assign a public slug. We
                // don't await this in the auth-state path because it's not
                // critical to the user being able to use the app.
                syncProfile(u.displayName ?? null)
                    .then((p) => {
                        setMySlug(p.slug ?? null)
                        // /user/me/sync returns the full profile, so seed the
                        // shared qk.profile entry with it. NavBar, ThemeSync and
                        // the pages that read useMyProfile then have their data
                        // before they even mount — no separate GET on login.
                        queryClient.setQueryData(qk.profile, p)
                    })
                    .catch(() => { /* best-effort — ignore */ })
            } else {
                setClaims({})
                setMySlug(null)
                // Signed out: drop the whole cache, in memory and on disk. The
                // next person on this device must never see the previous one's
                // profile, pair board or organiser-only tournament fields.
                if (identityChanged) await purgePersistedCache(queryClient)
                else queryClient.removeQueries({ queryKey: qk.profile })
            }
            setLoading(false)
        })
        return () => unsub()
    }, [queryClient])

    const isAdmin = claims["role"] === "admin"

    const value = useMemo<AuthValue>(
        () => ({
            user,
            loading,
            claims,
            isAdmin,
            mySlug,
            async signIn(email, password) {
                await signInWithEmailAndPassword(auth, email, password)
            },
            async signUp(email, password, displayName) {
                const cred = await createUserWithEmailAndPassword(auth, email, password)
                if (displayName && displayName.trim()) {
                    await updateProfile(cred.user, { displayName: displayName.trim() })
                }
            },
            async signInWithGoogle() {
                await signInWithPopup(auth, googleProvider)
            },
            async signOut() {
                await fbSignOut(auth)
                // The onAuthStateChanged branch above also purges, but do it
                // here too: an explicit sign-out must leave nothing behind even
                // if the listener is torn down mid-navigation.
                await purgePersistedCache(queryClient)
            },
        }),
        [user, loading, claims, isAdmin, mySlug, queryClient],
    )

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
