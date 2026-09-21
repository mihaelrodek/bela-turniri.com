/* ──────────────────────────────────────────────────────────────────────────
   Firebase ID token verification (README §3 "Auth").

   Tokens are RS256, signed with Google's rotating secure-token keys:
     JWKS   https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com
     iss    https://securetoken.google.com/<FIREBASE_PROJECT_ID>
     aud    <FIREBASE_PROJECT_ID>

   In dev (`GAME_DEV_ALLOW_ANON=1`) a `hello { devName }` without a token yields
   a synthetic `dev:<slug>` user so the UI can be exercised without Firebase.

   The claims are only the STARTING point for a signed-in player: `name` and
   `picture` come from Google, so a player who uploaded an avatar here would
   otherwise sit down wearing their Google photo. After verification the
   user is enriched from this app's own profile (see `profiles.ts`), which
   never blocks or fails a login — if the backend is unreachable the claims
   stand as they are.
   ────────────────────────────────────────────────────────────────────── */

import { createRemoteJWKSet, jwtVerify } from "jose"
import { createHash } from "node:crypto"
import { LIMITS, isAvatarPreset, isOffensiveName, validatePlayerName } from "@bela/protocol"
import type { UserInfo } from "@bela/protocol"
import { avatarPresetForUid } from "./avatars.js"
import type { Config } from "./config.js"
import { ProtocolError } from "./errors.js"
import { createProfileLookup } from "./profiles.js"
import type { ProfileLookup } from "./profiles.js"

const JWKS_URL =
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"

export const FALLBACK_NAME = "Igrač"

/**
 * FNV-1a, 32-bit — same tiny non-cryptographic hash `avatars.ts` uses to pick
 * a stable face for a uid, reused here so a name derived from a source the
 * player did NOT just type (a Firebase claim, an old profile row) that turns
 * out unusable gets a stable, harmless stand-in instead of a login failure.
 */
function hash32(input: string): number {
    let h = 0x811c9dc5
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i)
        h = Math.imul(h, 0x01000193)
    }
    return h >>> 0
}

/**
 * "Igrač 4821" — a neutral stand-in for a name that arrived from somewhere
 * other than the player typing it just now (a Firebase display name, an old
 * `gameName`/`displayName` row written before this filter existed) and turned
 * out empty or offensive under `isOffensiveName`.
 *
 * MUST NEVER fail a login (README §4 "Auth" / moderation task, 2026-09-20):
 * unlike `profile.setName` and a guest's typed `hello`, there is no form here
 * for the player to fix and resubmit, so the only honest options are "let a
 * bad name through" or "replace it" — this is the replace. Deterministic per
 * uid (same 4-digit tag every time, same style as `avatarPresetForUid`) so a
 * given player is not renamed on every reconnect.
 */
export function fallbackPlayerName(uid: string): string {
    const digits = String(hash32(uid) % 10_000).padStart(4, "0")
    return `${FALLBACK_NAME} ${digits}`
}

/** A name resolved from a source the player did not just type — replaced
 *  with a stable, neutral stand-in when it is empty/unusable (blank,
 *  punctuation/emoji only) or offensive, since there is nobody to hand a
 *  rejection to at this point. `validatePlayerName` also trims/strips
 *  control characters, which is a free extra guard against old data written
 *  before either rule existed. */
function safeResolvedName(name: string, uid: string): string {
    const result = validatePlayerName(name)
    return result.ok ? result.name : fallbackPlayerName(uid)
}

export interface HelloCredentials {
    guest?: { name: string; secret: string; avatarPreset?: string | undefined } | undefined
    token?: string | undefined
    devName?: string | undefined
}

export interface Authenticator {
    /** Resolves the caller for a `hello`, or throws `ProtocolError("UNAUTHENTICATED")`. */
    authenticate(creds: HelloCredentials): Promise<UserInfo>
}

/** Lowercase ASCII slug; Croatian diacritics folded, everything else → "-". */
export function slugify(input: string): string {
    const folded = input
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
    const slug = folded
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40)
    return slug.length > 0 ? slug : "anon"
}

function str(v: unknown): string | null {
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null
}

/** Firebase claims → the only user shape the protocol knows about. */
export function userFromClaims(claims: Record<string, unknown>): UserInfo {
    const uid = str(claims["sub"]) ?? str(claims["user_id"])
    if (!uid) throw new ProtocolError("UNAUTHENTICATED", "Token nema korisnički identifikator.")
    const email = str(claims["email"])
    const localPart = email ? (email.split("@")[0] ?? null) : null
    const name = str(claims["name"]) ?? str(localPart) ?? FALLBACK_NAME
    return {
        uid,
        // `name` is Google's own claim (or the email local-part) — never
        // something the player just typed into this app — so an
        // empty/offensive value is swapped for a neutral fallback rather than
        // failing the sign-in (moderation task, 2026-09-20).
        name: safeResolvedName(name, uid).slice(0, LIMITS.playerNameMax),
        avatarUrl: str(claims["picture"]),
    }
}

export function devUser(devName: string): UserInfo {
    const trimmed = devName.trim().slice(0, 60)
    const name = (trimmed.length > 0 ? trimmed : FALLBACK_NAME).slice(0, LIMITS.playerNameMax)
    const uid = `dev:${slugify(name)}`
    // Dev-only anonymous login (`GAME_DEV_ALLOW_ANON`), never reachable in
    // production — still filtered defensively so a dev build never becomes
    // the one place an unfiltered name reaches a seat.
    return { uid, name: safeResolvedName(name, uid).slice(0, LIMITS.playerNameMax), avatarUrl: null }
}

/**
 * Overlay the app's own profile on top of the token's claims. Only the fields
 * the user actually set here win — a profile with no avatar must not blank out
 * the Google one, which is still better than no picture at all.
 */
export function withAppProfile(
    user: UserInfo,
    profile: {
        displayName: string | null
        avatarUrl: string | null
        gameName?: string | null
        avatarPreset?: string | null
        gameStats?: UserInfo["gameStats"]
        karma?: UserInfo["karma"]
    } | null,
): UserInfo {
    if (!profile) return user
    return {
        ...user,
        // Same "only what they actually set here wins" rule as the avatar URL:
        // a profile that carries no preset must not wipe the one the caller
        // already resolved (a guest's own pick, or the one derived from their
        // uid). The key is omitted entirely when there is nothing to say, so
        // a `UserInfo` on the wire never carries a null field the client would
        // only have to skip — every seat frame pays for this one.
        ...((profile.avatarPreset ?? user.avatarPreset)
            ? { avatarPreset: profile.avatarPreset ?? user.avatarPreset }
            : {}),
        ...(profile.gameStats ? { gameStats: profile.gameStats } : {}),
        // Same "omit rather than send null" rule as `avatarPreset`: every seat
        // frame carries this, and a client that gets no karma shows no chip.
        ...(typeof profile.karma === "number" ? { karma: profile.karma } : {}),
        // The IN-GAME name wins over the account name, which wins over the
        // token's (2026-09-09). A player who typed a name for the card table
        // meant it for the card table; the account name is what the rest of
        // the app calls them.
        //
        // Neither `gameName` nor `displayName` was just typed INTO THIS
        // CONNECTION: `gameName` is a stored row that may predate the
        // offensive-name filter (`profile.setName` only started rejecting new
        // writes 2026-09-20), and `displayName` is synced from the Firebase
        // SDK and was never checked at all. So this is a `safeResolvedName`
        // fallback, same as the token claim, not a rejection.
        name: safeResolvedName(profile.gameName ?? profile.displayName ?? user.name, user.uid)
            .slice(0, LIMITS.playerNameMax),
        avatarUrl: profile.avatarUrl ?? user.avatarUrl,
    }
}

export function createAuthenticator(cfg: Config, profiles: ProfileLookup = createProfileLookup(cfg)): Authenticator {
    // Lazily created: no network call happens unless a real token shows up.
    let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
    const getJwks = (): ReturnType<typeof createRemoteJWKSet> => {
        jwks ??= createRemoteJWKSet(new URL(JWKS_URL))
        return jwks
    }

    return {
        async authenticate(creds: HelloCredentials): Promise<UserInfo> {
            const token = str(creds.token)
            if (!token) {
                if (creds.guest !== undefined) {
                    const guest = creds.guest
                    if (!guest || typeof guest.name !== "string" || !guest.name.trim() || guest.name.trim().length > 60 || typeof guest.secret !== "string" || !/^[a-f0-9]{64}$/.test(guest.secret)) {
                        throw new ProtocolError("UNAUTHENTICATED", "Unesite ime igrača.")
                    }
                    // This name WAS just typed, on the identity screen
                    // (`GameIdentityGate.tsx`) — unlike a claim or a stored
                    // row, there is a form right here to send it back to, so
                    // it is rejected rather than quietly swapped for a
                    // fallback (moderation task, 2026-09-20). The client
                    // validates the same way before it ever sends this, so a
                    // well-behaved client never sees this refusal — it exists
                    // for a client that skipped or bypassed that check.
                    if (isOffensiveName(guest.name)) {
                        throw new ProtocolError("BAD_REQUEST", "Ime igrača sadrži neprikladan sadržaj. Odaberi drugo ime.")
                    }
                    // The secret is a per-device random, so its hash is a
                    // stable uid — which is the only thing a guest has to hang
                    // an in-game name off. Ask for one: a guest who renamed
                    // themselves keeps that name even after clearing the name
                    // out of localStorage, which is what makes the once-a-week
                    // limit mean anything for them (2026-09-09).
                    const uid = `guest:${createHash("sha256").update(guest.secret).digest("hex")}`
                    const guestUser: UserInfo = {
                        uid,
                        name: guest.name.trim().slice(0, LIMITS.playerNameMax),
                        avatarUrl: null,
                        // The face the guest picked on the identity screen, or
                        // — when they have none, or sent something that is not
                        // one of the 16 — a stable one derived from this uid.
                        // Never null: a guest cannot store a face anywhere but
                        // their own browser, and a seat without a face reads as
                        // an empty chair.
                        avatarPreset: isAvatarPreset(guest.avatarPreset)
                            ? guest.avatarPreset
                            : avatarPresetForUid(uid),
                        guest: true,
                    }
                    return withAppProfile(guestUser, await profiles.get(uid))
                }
                if (cfg.devAllowAnon) {
                    const devName = str(creds.devName)
                    if (devName) return devUser(devName)
                }
                throw new ProtocolError("UNAUTHENTICATED", "Nedostaje token za prijavu.")
            }
            const projectId = cfg.firebaseProjectId
            if (!projectId) {
                throw new ProtocolError(
                    "UNAUTHENTICATED",
                    "Poslužitelj nije konfiguriran za prijavu.",
                )
            }
            try {
                const { payload } = await jwtVerify(token, getJwks(), {
                    issuer: `https://securetoken.google.com/${projectId}`,
                    audience: projectId,
                    algorithms: ["RS256"],
                })
                const user = userFromClaims(payload as unknown as Record<string, unknown>)
                const merged = withAppProfile(user, await profiles.get(user.uid))
                // The profile lookup can come back empty (backend cold,
                // timed out, profile not synced yet). Without a face the
                // client would fall through to the Google `picture`
                // hotlink, which fails often enough to paint a broken-image
                // glyph at the table — so hand out the same uid-derived
                // face a guest gets rather than gamble on that URL.
                return merged.avatarPreset ? merged : { ...merged, avatarPreset: avatarPresetForUid(merged.uid) }
            } catch (e) {
                if (e instanceof ProtocolError) throw e
                throw new ProtocolError("UNAUTHENTICATED", "Neispravan ili istekao token.")
            }
        },
    }
}
