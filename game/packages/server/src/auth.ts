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
import { LIMITS } from "@bela/protocol"
import type { UserInfo } from "@bela/protocol"
import type { Config } from "./config.js"
import { ProtocolError } from "./errors.js"
import { createProfileLookup } from "./profiles.js"
import type { ProfileLookup } from "./profiles.js"

const JWKS_URL =
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"

export const FALLBACK_NAME = "Igrač"

export interface HelloCredentials {
    guest?: { name: string; secret: string } | undefined
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
        name: name.slice(0, LIMITS.playerNameMax),
        avatarUrl: str(claims["picture"]),
    }
}

export function devUser(devName: string): UserInfo {
    const trimmed = devName.trim().slice(0, 60)
    const name = (trimmed.length > 0 ? trimmed : FALLBACK_NAME).slice(0, LIMITS.playerNameMax)
    return { uid: `dev:${slugify(name)}`, name, avatarUrl: null }
}

/**
 * Overlay the app's own profile on top of the token's claims. Only the fields
 * the user actually set here win — a profile with no avatar must not blank out
 * the Google one, which is still better than no picture at all.
 */
export function withAppProfile(
    user: UserInfo,
    profile: { displayName: string | null; avatarUrl: string | null; gameName?: string | null } | null,
): UserInfo {
    if (!profile) return user
    return {
        ...user,
        // The IN-GAME name wins over the account name, which wins over the
        // token's (2026-09-09). A player who typed a name for the card table
        // meant it for the card table; the account name is what the rest of
        // the app calls them.
        name: (profile.gameName ?? profile.displayName ?? user.name).slice(0, LIMITS.playerNameMax),
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
                return withAppProfile(user, await profiles.get(user.uid))
            } catch (e) {
                if (e instanceof ProtocolError) throw e
                throw new ProtocolError("UNAUTHENTICATED", "Neispravan ili istekao token.")
            }
        },
    }
}
