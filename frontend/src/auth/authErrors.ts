import { t } from "../i18n"

/*
 * Error mapping shared by LoginPage and RegisterPage.
 *
 * Both pages keep their own switch for the codes only they can hit (wrong
 * password on login, email-already-in-use on register). What lives here is
 * everything the Google/Apple buttons can throw, because those buttons are on
 * BOTH pages and the failure modes are identical — plus the native-cancel
 * detection, which has no Firebase error code at all.
 *
 * Everything here is a PURE function over `error.code` strings — no
 * `instanceof FirebaseError`, and therefore no runtime import of
 * `firebase/app`. That keeps this module (imported by both auth pages) off the
 * Firebase chunk's dependency graph; see `src/firebase.ts` for why the SDK is
 * loaded lazily. A `FirebaseError` is duck-typed by its `code` property, which
 * is all any switch below ever looked at.
 */

/**
 * The `auth/...` code carried by a Firebase error, or "" for anything else.
 *
 * Reads the property rather than testing the class: the SDK sets `code` on
 * every `FirebaseError` it throws, and no other error in this app carries an
 * `auth/`-prefixed one.
 */
export function firebaseErrorCode(err: unknown): string {
    const code = (err as { code?: unknown } | null | undefined)?.code
    return typeof code === "string" ? code : ""
}

/**
 * True when the user simply backed out of a native sign-in sheet.
 *
 * The Capacitor plugin forwards the platform SDK's error verbatim, so there is
 * no `auth/...` code to switch on: iOS Apple gives ASAuthorizationError 1001
 * ("The user canceled the authorization attempt."), iOS Google a "canceled"
 * message, Android Google status code 12501. A dismissed sheet is not an
 * error the user needs to read about, so every caller treats this as a no-op.
 */
export function isCancelledSignIn(err: unknown): boolean {
    const code = firebaseErrorCode(err)
    if (code === "1001" || code === "12501") return true
    const message = err instanceof Error ? err.message : ""
    return /cancell?ed/i.test(message) || /cancell?ed/i.test(code)
}

/**
 * Maps the social-sign-in failures a user can realistically hit.
 *
 * Returns `""` for "handled, but say nothing" (a cancellation), a translated
 * string for a mapped failure, and `null` when the calling page's own switch
 * should decide.
 */
export function socialAuthErrorMessage(err: unknown): string | null {
    if (isCancelledSignIn(err)) return ""
    const code = firebaseErrorCode(err)
    switch (code) {
        case "auth/popup-closed-by-user":
        case "auth/cancelled-popup-request":
        case "auth/user-cancelled":
            return ""
        case "auth/popup-blocked":
            return t("forms.auth.error.popupBlocked")
        case "auth/account-exists-with-different-credential":
            return t("forms.auth.error.accountExistsDifferentCredential")
        case "auth/operation-not-allowed":
            return t("forms.auth.error.providerNotEnabled")
        case "auth/network-request-failed":
            return t("forms.auth.error.network")
        default:
            return null
    }
}
