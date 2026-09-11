import { afterEach, describe, expect, it, vi } from "vitest"
import type { UserInfo } from "@bela/protocol"
import { withAppProfile } from "../src/auth.js"
import { createProfileLookup } from "../src/profiles.js"
import { loadConfig } from "../src/config.js"

/* The app's own name/avatar beat the Firebase token's claims — see
   `profiles.ts` for why this exists at all (Google's `picture` claim was
   showing up at the card table instead of the uploaded avatar). */

const CLAIMS_USER: UserInfo = {
    uid: "firebase-uid-1",
    name: "Google Name",
    avatarUrl: "https://lh3.googleusercontent.com/photo",
}

function cfg(overrides: Record<string, string> = {}) {
    return loadConfig({
        GAME_RESULTS_TOKEN: "secret",
        BACKEND_INTERNAL_URL: "http://backend.test/api",
        ...overrides,
    })
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("withAppProfile", () => {
    it("prefers the app profile's name and avatar", () => {
        expect(withAppProfile(CLAIMS_USER, { displayName: "Mihael", avatarUrl: "/api/resources/7/image" }))
            .toEqual({ uid: "firebase-uid-1", name: "Mihael", avatarUrl: "/api/resources/7/image" })
    })

    it("keeps the claims where the profile has nothing", () => {
        // A profile with no uploaded avatar must NOT blank out the Google
        // one — some picture beats no picture.
        expect(withAppProfile(CLAIMS_USER, { displayName: "Mihael", avatarUrl: null }))
            .toEqual({ ...CLAIMS_USER, name: "Mihael" })
        expect(withAppProfile(CLAIMS_USER, null)).toEqual(CLAIMS_USER)
    })
})

describe("createProfileLookup", () => {
    it("asks the backend once per uid and caches the hit", async () => {
        const fetchMock = vi.fn(async () => new Response(
            JSON.stringify({ displayName: "Mihael", avatarUrl: "/api/resources/7/image" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
        ))
        vi.stubGlobal("fetch", fetchMock)

        const lookup = createProfileLookup(cfg())
        const first = await lookup.get("firebase-uid-1")
        const second = await lookup.get("firebase-uid-1")

        // `gameName` is the third field since 2026-09-09 and `avatarPreset`
        // the fourth since 2026-09-11; absent from the body means the player
        // never set an in-game name / never picked a drawn face. `AppProfile`
        // normalises both to null so a caller never has to tell "missing"
        // apart from "cleared".
        expect(first).toEqual({
            displayName: "Mihael",
            avatarUrl: "/api/resources/7/image",
            gameName: null,
            avatarPreset: null,
        })
        expect(second).toEqual(first)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
        expect(url).toBe("http://backend.test/api/internal/profiles/firebase-uid-1")
        expect((init.headers as Record<string, string>)["X-Internal-Token"]).toBe("secret")
    })

    it("coalesces concurrent lookups for the same uid", async () => {
        const fetchMock = vi.fn(async () => new Response(
            JSON.stringify({ displayName: "Mihael", avatarUrl: null }),
            { status: 200, headers: { "Content-Type": "application/json" } },
        ))
        vi.stubGlobal("fetch", fetchMock)

        const lookup = createProfileLookup(cfg())
        await Promise.all([lookup.get("uid-x"), lookup.get("uid-x"), lookup.get("uid-x")])
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("never throws when the backend is down, and does not touch it for dev uids", async () => {
        const fetchMock = vi.fn(async () => { throw new Error("ECONNREFUSED") })
        vi.stubGlobal("fetch", fetchMock)

        const lookup = createProfileLookup(cfg())
        await expect(lookup.get("firebase-uid-1")).resolves.toBeNull()

        await expect(lookup.get("dev:mihael")).resolves.toBeNull()
        // GUESTS ARE ASKED NOW (2026-09-09): they can have no profile, but they
        // CAN have an in-game name, stored against this very uid so the
        // once-a-week limit has a stable key. `dev:` uids stay out — nothing
        // exists behind them.
        await expect(lookup.get("guest:abc")).resolves.toBeNull()
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("writes the in-game name and drops the cached profile behind it", async () => {
        const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
            if (init?.method === "PUT") {
                return new Response(
                    JSON.stringify({ gameName: "Ivan", nextChangeAt: "1757000000000" }),
                    { status: 200, headers: { "Content-Type": "application/json" } },
                )
            }
            return new Response(
                JSON.stringify({ displayName: "Mihael", avatarUrl: null }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            )
        })
        vi.stubGlobal("fetch", fetchMock)

        const lookup = createProfileLookup(cfg())
        await lookup.get("firebase-uid-1")
        expect(await lookup.setGameName("firebase-uid-1", "Ivan"))
            .toEqual({ ok: true, name: "Ivan", nextChangeAt: 1757000000000 })

        // The cached profile named the wrong player, so the next read goes
        // back to the backend rather than replaying it.
        await lookup.get("firebase-uid-1")
        expect(fetchMock.mock.calls.filter(([, i]) => (i as RequestInit | undefined)?.method !== "PUT"))
            .toHaveLength(2)
    })

    it("reports the once-a-week refusal with the instant it may next change", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response(
            JSON.stringify({
                code: "GAME_NAME_RATE_LIMITED",
                details: { nextChangeAt: ["2026-09-16T10:00:00Z", "1757000000000"] },
            }),
            { status: 409, headers: { "Content-Type": "application/json" } },
        )))

        const lookup = createProfileLookup(cfg())
        expect(await lookup.setGameName("firebase-uid-1", "Ivan"))
            .toEqual({ ok: false, error: "RATE_LIMITED", nextChangeAt: 1757000000000 })
    })

    it("never throws when the write fails", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED") }))
        const lookup = createProfileLookup(cfg())
        expect(await lookup.setGameName("firebase-uid-1", "Ivan"))
            .toEqual({ ok: false, error: "UNAVAILABLE" })
    })

    it("stays quiet when no internal token is configured", async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal("fetch", fetchMock)

        const lookup = createProfileLookup(cfg({ GAME_RESULTS_TOKEN: "" }))
        await expect(lookup.get("firebase-uid-1")).resolves.toBeNull()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("treats a non-2xx answer as unknown", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })))
        const lookup = createProfileLookup(cfg())
        await expect(lookup.get("firebase-uid-1")).resolves.toBeNull()
    })
})
