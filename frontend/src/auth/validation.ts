/*
 * Shared, pure validators for the sign-in / sign-up forms (LoginPage,
 * RegisterPage). Every function is synchronous and side-effect free; a
 * result carries an i18n message KEY, never text, so the caller translates
 * it with `t()` in the active locale (see CLAUDE.md's i18n section) — a key
 * that exists in `hr/forms.ts` must also exist in `sl/forms.ts` or `tsc`
 * fails by design.
 *
 * ── Limits, and why (2026-09-21) ────────────────────────────────────────
 *
 * Email — max 254. There is no backend column to agree with: Firebase Auth
 * owns the account, not a DTO (`UserProfileDto`/`SyncProfileRequest` never
 * carry an email — the backend gets it from the verified ID token's `email`
 * claim). 254 is RFC 5321's own ceiling on a full address and Firebase's own
 * practical limit, so this is a client-side sanity guard, not a number that
 * could ever be looser than a server that doesn't validate this field at
 * all. The shape check is deliberately loose — `something@something.tld`,
 * no whitespace — never a strict RFC regex: it must not reject a real
 * address (`+tags`, IDN, new TLDs). Firebase does the authoritative
 * validation server-side and the pages already map `auth/invalid-email`.
 *
 * Name ("Ime", RegisterPage — optional, becomes the Firebase displayName and
 * then `UserProfile.displayName`). Backend ceiling:
 * `SyncProfileRequest.displayName` is `@Size(max = 200)`
 * (`backend/.../dtos/SyncProfileRequest.java`), matching the
 * `user_profiles.display_name varchar(200)` column
 * (`db/changelog/user_profiles_slug.xml`). The client caps at 50 —
 * comfortably inside 200, so never looser than the server, and a legal name
 * over 50 characters is not a realistic input. Letters of any script
 * (`\p{L}`, so č ć đ š ž, Cyrillic, Greek, … all pass) plus the punctuation a
 * real name can contain — space, hyphen, apostrophe, period — are allowed
 * ("Jean-Luc", "O'Brien", "Ivan ml."); digits-only or emoji-only input is
 * rejected because neither matches `\p{L}`. No forced capitalisation, no
 * script allowlist.
 *
 * Password — Firebase Auth's own floor is 6 characters (`auth/weak-password`
 * below that); both pages already enforced 6 and keep doing so, so client
 * and server (Firebase, which is the actual authority here — the backend
 * never sees a password) agree. 8+ is recommended with a gentle, static
 * hint rather than a live strength meter or a hard gate. 128 is a sanity
 * ceiling only — Firebase documents no maximum, but nothing legitimate needs
 * more and it keeps the request bounded. Never trimmed (a trailing space is
 * a character the user chose), paste is never blocked, no composition rules
 * (no forced digit/symbol/case mix).
 */

export type ValidationResult = { ok: true } | { ok: false; key: string }

export const EMAIL_MAX = 254
export const NAME_MAX = 50
export const PASSWORD_MIN = 6
export const PASSWORD_RECOMMENDED_MIN = 8
export const PASSWORD_MAX = 128

/** Trim only. Never lowercases what the user typed — the local part of an
 *  address can be case-sensitive, and Firebase doesn't normalize it either. */
export function normalizeEmail(raw: string): string {
    return raw.trim()
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Pragmatic shape check, not an RFC validator — see the module comment. */
export function validateEmail(raw: string): ValidationResult {
    const email = normalizeEmail(raw)
    if (email.length === 0) return { ok: false, key: "forms.auth.validation.emailRequired" }
    if (email.length > EMAIL_MAX || !EMAIL_SHAPE.test(email)) {
        return { ok: false, key: "forms.auth.invalidEmail" }
    }
    return { ok: true }
}

/** Trim + collapse interior whitespace runs to a single space. */
export function normalizeName(raw: string): string {
    return raw.trim().replace(/\s+/g, " ")
}

// Letters of any script (incl. combining marks, so precomposed AND combining
// forms both pass) plus the punctuation a real legal name can contain.
// `\p{L}` alone already excludes digits and emoji, so "1234" or an
// emoji-only string fail without a separate check.
const NAME_SHAPE = /^[\p{L}\p{M}][\p{L}\p{M} '.-]*$/u

/** RegisterPage's name field is optional — blank passes; the caller decides
 *  whether the field is required. */
export function validateName(raw: string): ValidationResult {
    const name = normalizeName(raw)
    if (name.length === 0) return { ok: true }
    if (name.length > NAME_MAX || !NAME_SHAPE.test(name)) {
        return { ok: false, key: "forms.auth.validation.nameInvalid" }
    }
    return { ok: true }
}

/** RegisterPage only — LoginPage just checks non-empty against whatever the
 *  account's real password is. Never trims; paste is never intercepted. */
export function validatePassword(raw: string): ValidationResult {
    if (raw.length < PASSWORD_MIN) return { ok: false, key: "forms.register.validation.weakPassword" }
    if (raw.length > PASSWORD_MAX) return { ok: false, key: "forms.auth.validation.passwordTooLong" }
    return { ok: true }
}
