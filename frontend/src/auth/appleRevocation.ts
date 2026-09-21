/* ──────────────────────────────────────────────────────────────────────────
   Sign in with Apple — token revocation on account deletion.

   App Store Review Guideline 5.1.1(v) is not satisfied by deleting the
   account: an app that offers Sign in with Apple must also call Apple's
   revocation endpoint, so the account disappears from the user's
   "Sign in with Apple" list in iOS Settings instead of lingering there.
   Reviewers test exactly this, and a delete that leaves the grant alive is
   the classic second-round rejection.
     https://developer.apple.com/news/?id=12m75xbj
     https://developer.apple.com/app-store/review/guidelines/#5.1.1

   Firebase does NOT keep the Apple token from the original sign-in, so the
   token has to be minted again right before it is thrown away. That is the
   whole shape of this module:

     web     reauthenticateWithPopup(user, apple) → OAuthProvider
             .credentialFromResult(result).accessToken → revokeAccessToken()
             (https://firebase.google.com/docs/auth/web/apple)

     native  @capacitor-firebase/authentication has no reauthenticate call,
             so the Apple sheet is re-run with `skipNativeAuth: true` — that
             flag makes the plugin hand back the credential WITHOUT signing
             the native Firebase SDK in again, i.e. the current session is
             left exactly as it was. The plugin's `revokeAccessToken` maps to
             `Auth.revokeToken(withAuthorizationCode:)` on iOS and
             `FirebaseAuth.revokeAccessToken` on Android, so the field to
             hand it is `authorizationCode` first and `accessToken` as the
             fallback — which is also the right order for a web-flow Apple
             credential on Android.

   ORDERING, and why it is revoke-then-delete.

   Revocation needs a live account and a user who can still be asked to
   re-authenticate; both are gone once the server has anonymised. Revoking
   first also solves `auth/requires-recent-login` for free, because the
   re-authentication it performs is exactly what `deleteUser()` wants.

   And the two failure directions are not symmetric:

     revoke ✓ / delete ✗   harmless. Revocation only withdraws the OAuth
                           grant; the Firebase account is untouched and the
                           user simply sees Apple's consent sheet again next
                           time they sign in.
     delete ✓ / revoke ✗   the bad one: the data is gone, the user cannot
                           re-authenticate to revoke anything, and the grant
                           survives — the state Apple rejects for.

   So revocation goes first. But it is BEST-EFFORT: a cancelled sheet, a
   popup blocker or an Apple outage must never be able to trap someone in an
   account they asked to delete, because being unable to delete is itself a
   5.1.1(v) violation and the stronger obligation of the two. The caller
   therefore proceeds on `false` and only tells the user what did not happen.
   ────────────────────────────────────────────────────────────────────── */

import type { User as FirebaseUser } from "firebase/auth"
import { loadFirebaseAuth } from "../firebase"
import { isNative } from "../platform"
import { nativeAuth } from "../platform/nativeAuth"

export const APPLE_PROVIDER_ID = "apple.com"

/** True when this account can sign in with Apple, i.e. revocation applies. */
export function hasAppleProvider(user: FirebaseUser | null | undefined): boolean {
    return !!user?.providerData.some((p) => p.providerId === APPLE_PROVIDER_ID)
}

/**
 * What one revocation attempt ended up doing. Three outcomes rather than a
 * boolean, because "this account never had Apple on it" and "we tried and
 * Apple said no" must not produce the same message.
 */
export type RevokeOutcome = "not-applicable" | "revoked" | "failed"

/**
 * Re-authenticate with Apple and revoke the resulting token.
 *
 * Never throws — every path resolves to a {@link RevokeOutcome}. Returns
 * `"not-applicable"` immediately for an account with no Apple provider, so
 * callers can invoke it unconditionally.
 */
export async function revokeAppleToken(user: FirebaseUser): Promise<RevokeOutcome> {
    if (!hasAppleProvider(user)) return "not-applicable"
    try {
        return isNative ? await revokeNative() : await revokeWeb(user)
    } catch {
        // Cancelled sheet, blocked popup, network, or a Firebase project with
        // no Apple service key configured. All of them are the same decision
        // for the caller: say so and carry on with the deletion.
        return "failed"
    }
}

async function revokeWeb(user: FirebaseUser): Promise<RevokeOutcome> {
    const fb = await loadFirebaseAuth()
    const result = await fb.reauthenticateWithPopup(user, fb.appleProvider)
    // `credentialFromResult` is a static on the provider CLASS, not on the
    // configured instance — `fb.appleProvider` is the instance and has no
    // such method.
    const credential = fb.OAuthProvider.credentialFromResult(result)
    const token = credential?.accessToken
    if (!token) return "failed"
    await fb.revokeAccessToken(fb.auth, token)
    return "revoked"
}

async function revokeNative(): Promise<RevokeOutcome> {
    const FirebaseAuthentication = await nativeAuth()
    // `skipNativeAuth: true` — see the header. We want Apple's authorisation
    // artefacts, not a second sign-in; the JS SDK session that the rest of
    // the deletion runs on must survive this call untouched.
    const result = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true })
    const token = result.credential?.authorizationCode ?? result.credential?.accessToken
    if (!token) return "failed"
    await FirebaseAuthentication.revokeAccessToken({ token })
    return "revoked"
}
