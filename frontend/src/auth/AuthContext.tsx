import React, { useEffect, useMemo, useRef, useState } from "react"
import type { User as FirebaseUser } from "firebase/auth"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { loadFirebaseAuth } from "../firebase"
import { revalidateSeedForUser } from "../shell/seed"
import { isNative } from "../platform"
import { nativeAuth } from "../platform/nativeAuth"
import { syncProfileTolerant } from "../api/userMe"
import { qk } from "../queryClient"
import { persister } from "../persister"
import { toaster } from "../toaster"
import { t } from "../i18n"
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

/**
 * Sign out of the plugin's native session too.
 *
 * Natively there are two sessions: the JS SDK's and the native Firebase SDK's
 * (the plugin keeps `skipNativeAuth` false — see `signInWithApple`), plus the
 * Google/Apple account the OS picker remembered. Without this the next
 * sign-in would silently reuse the account the user just left.
 */
async function nativeSignOut() {
    if (!isNative) return
    try {
        const FirebaseAuthentication = await nativeAuth()
        await FirebaseAuthentication.signOut()
    } catch {
        // Native layer already signed out or unavailable — the JS SDK
        // sign-out is what the app actually reacts to.
    }
}

/**
 * End a session whose profile no longer exists.
 *
 * A Firebase user can outlive its anonymised profile: account deletion
 * anonymises server-side first and the Admin-SDK delete of the Firebase user
 * can fail on its own, leaving a signed-in session with nothing behind it.
 * Left alone that session renders an empty profile forever and only fails on
 * the next authenticated write, so end it here and say why once.
 */
async function abandonDeletedAccount(client: QueryClient) {
    toaster.create({
        id: "account-deleted",
        type: "error",
        title: t("common.account.deleted"),
    })
    const fb = await loadFirebaseAuth()
    await fb.signOut(fb.auth)
    await nativeSignOut()
    await purgePersistedCache(client)
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

    /* The ONE place the Firebase SDK is pulled in (see src/firebase.ts).
       Running it from an effect rather than at module scope means the download
       starts right after the first paint instead of before it: the shell and
       the seeded tournament list are on screen while the ~38 kB gzip of auth
       JS is still in flight. `loading` stays true until the module has landed
       AND `onAuthStateChanged` has fired once, so nothing downstream can read
       `user === null` as "signed out" in the meantime. */
    useEffect(() => {
        let cancelled = false
        let unsub: (() => void) | undefined

        // Fires once with the persisted user on load, then again on every change.
        // For each user we also pull the parsed token, so we know their role.
        const onUser = async (u: FirebaseUser | null) => {
            const prevUid = cachedUidRef.current
            const nextUid = u?.uid ?? null
            const identityChanged = prevUid !== undefined && prevUid !== nextUid
            const firstCallback = prevUid === undefined
            cachedUidRef.current = nextUid

            // First-screen seed revalidation. The seed in the query cache is
            // ANONYMOUS by construction; only a signed-in caller can see a
            // different answer (blocked organisers filtered out, own-tournament
            // affordances), so a guest keeps it until the normal staleTime and
            // only a signed-in session pays for the refetch. See shell/seed.ts.
            if (firstCallback) revalidateSeedForUser(queryClient, u !== null)

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
                // Tolerant variant: a 410 ACCOUNT_DELETED resolves instead of
                // throwing, so the deleted-account case is a branch here
                // rather than an indistinguishable network failure.
                syncProfileTolerant(u.displayName ?? null)
                    .then(({ profile, deleted }) => {
                        if (deleted) {
                            void abandonDeletedAccount(queryClient)
                            return
                        }
                        if (!profile) return
                        setMySlug(profile.slug ?? null)
                        // /user/me/sync returns the full profile, so seed the
                        // shared qk.profile entry with it. NavBar, ThemeSync and
                        // the pages that read useMyProfile then have their data
                        // before they even mount — no separate GET on login.
                        queryClient.setQueryData(qk.profile, profile)
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
        }

        void loadFirebaseAuth().then((fb) => {
            if (cancelled) return
            unsub = fb.onAuthStateChanged(fb.auth, onUser)
        }).catch(() => {
            // The auth chunk could not be fetched (offline cold start). Treat
            // the session as anonymous rather than hanging every consumer on
            // `loading` forever — `loadFirebaseAuth` clears its memo on
            // failure, so the next sign-in attempt retries the download.
            if (cancelled) return
            void onUser(null)
        })

        return () => {
            cancelled = true
            unsub?.()
        }
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
                const fb = await loadFirebaseAuth()
                await fb.signInWithEmailAndPassword(fb.auth, email, password)
            },
            async signUp(email, password, displayName) {
                const fb = await loadFirebaseAuth()
                const cred = await fb.createUserWithEmailAndPassword(fb.auth, email, password)
                if (displayName && displayName.trim()) {
                    await fb.updateProfile(cred.user, { displayName: displayName.trim() })
                }
            },
            async signInWithGoogle() {
                // The native branch needs the JS `auth` instance too (it hands
                // the platform credential to `signInWithCredential`), so the
                // loader is awaited before the isNative fork, not inside it.
                const fb = await loadFirebaseAuth()
                if (!isNative) {
                    await fb.signInWithPopup(fb.auth, fb.googleProvider)
                    return
                }
                // WKWebView / Android WebView block `signInWithPopup` (no
                // opener, and Google refuses OAuth in an embedded webview), so
                // the native shells run the platform's own account picker
                // through the Capacitor plugin and hand the resulting OAuth
                // credential to the JS SDK. See the note on the plugin's
                // `skipNativeAuth` below `signInWithApple`.
                const FirebaseAuthentication = await nativeAuth()
                const result = await FirebaseAuthentication.signInWithGoogle()
                const credential = fb.GoogleAuthProvider.credential(
                    result.credential?.idToken ?? null,
                    result.credential?.accessToken ?? undefined,
                )
                await fb.signInWithCredential(fb.auth, credential)
            },
            async signInWithApple() {
                const fb = await loadFirebaseAuth()
                if (!isNative) {
                    await fb.signInWithPopup(fb.auth, fb.appleProvider)
                    return
                }
                // `skipNativeAuth` is deliberately left at its default (false)
                // and passed explicitly so nobody "tidies" it away: with it
                // false the plugin signs the NATIVE Firebase SDK in as well,
                // which is what `@capacitor-firebase/messaging` needs to
                // associate the FCM token with the right account. The JS SDK
                // is then signed in a second time with the same credential
                // below, so `onAuthStateChanged`, `getIdToken()` and every
                // REST call downstream keep working exactly as on the web.
                // (Setting it to true would skip the native sign-in entirely
                // and leave the native layer without a user.)
                const FirebaseAuthentication = await nativeAuth()
                const result = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: false })
                // Apple's id token is bound to a nonce the plugin generated;
                // Firebase needs the RAW nonce (Apple saw its SHA-256) or it
                // rejects the credential.
                const credential = new fb.OAuthProvider("apple.com").credential({
                    idToken: result.credential?.idToken,
                    rawNonce: result.credential?.nonce,
                })
                const cred = await fb.signInWithCredential(fb.auth, credential)
                // Apple releases the user's name on the FIRST authorisation
                // only — never again, not even after a reinstall. If we don't
                // persist it now the account stays nameless forever, so copy
                // it onto the Firebase user and push it to the backend (the
                // onAuthStateChanged sync above has already fired with an
                // empty displayName by the time we get here).
                const appleName = result.user?.displayName?.trim()
                if (appleName && !cred.user.displayName) {
                    await fb.updateProfile(cred.user, { displayName: appleName })
                    syncProfileTolerant(appleName)
                        .then(({ profile, deleted }) => {
                            if (deleted) {
                                void abandonDeletedAccount(queryClient)
                                return
                            }
                            if (!profile) return
                            setMySlug(profile.slug ?? null)
                            queryClient.setQueryData(qk.profile, profile)
                        })
                        .catch(() => { /* best-effort — ignore */ })
                }
            },
            async signOut() {
                const fb = await loadFirebaseAuth()
                await fb.signOut(fb.auth)
                await nativeSignOut()
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
