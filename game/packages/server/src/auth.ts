/* ──────────────────────────────────────────────────────────────────────────
   Firebase ID token verification (README §3 "Auth").

   Tokens are RS256, signed with Google's rotating secure-token keys:
     JWKS   https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com
     iss    https://securetoken.google.com/<FIREBASE_PROJECT_ID>
     aud    <FIREBASE_PROJECT_ID>

   In dev (`GAME_DEV_ALLOW_ANON=1`) a `hello { devName }` without a token yields
   a synthetic `dev:<slug>` user so the UI can be exercised without Firebase.
   ────────────────────────────────────────────────────────────────────── */

import { createRemoteJWKSet, jwtVerify } from "jose"
import type { UserInfo } from "@bela/protocol"
import type { Config } from "./config.js"
import { ProtocolError } from "./errors.js"

const JWKS_URL =
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"

export const FALLBACK_NAME = "Igrač"

export interface HelloCredentials {
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
        name: name.slice(0, 60),
        avatarUrl: str(claims["picture"]),
    }
}

export function devUser(devName: string): UserInfo {
    const trimmed = devName.trim().slice(0, 60)
    const name = trimmed.length > 0 ? trimmed : FALLBACK_NAME
    return { uid: `dev:${slugify(name)}`, name, avatarUrl: null }
}

export function createAuthenticator(cfg: Config): Authenticator {
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
                return userFromClaims(payload as unknown as Record<string, unknown>)
            } catch (e) {
                if (e instanceof ProtocolError) throw e
                throw new ProtocolError("UNAUTHENTICATED", "Neispravan ili istekao token.")
            }
        },
    }
}
