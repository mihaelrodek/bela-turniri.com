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
            gameStats: null,
            // `karma` is the sixth field since 2026-09-20; a body without it
            // reads as null ("the backend did not say"), never as a full 10.
            karma: null,
            // `reliability` (2026-09-21): a body with none of `recentAbandons`
            // / `recentGames` / `totalAbandons` reads as null too — the
            // "older backend" case, see the dedicated test below.
            reliability: null,
        })
        expect(second).toEqual(first)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
        expect(url).toBe("http://backend.test/api/internal/profiles/firebase-uid-1")
        expect((init.headers as Record<string, string>)["X-Internal-Token"]).toBe("secret")
    })

    it("carries overall and per-target records into the room user", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
            gameStats: {
                global: { games: 9, wins: 5, losses: 4, winRate: 0.556 },
                byTargetScore: { "501": { games: 4, wins: 3, losses: 1, winRate: 0.75 } },
            },
        }), { status: 200, headers: { "Content-Type": "application/json" } })))

        const profile = await createProfileLookup(cfg()).get("firebase-uid-1")
        const user = withAppProfile(CLAIMS_USER, profile)
        expect(user.gameStats?.global).toMatchObject({ wins: 5, losses: 4 })
        expect(user.gameStats?.byTargetScore["501"]).toMatchObject({ wins: 3, losses: 1 })
    })

    it("carries the reliability breakdown beside karma into the room user", async () => {
        // `karma`/`reliability` alone would look EMPTY to `parseProfile` (they
        // are deliberately kept out of the emptiness test, see its comment),
        // so — like every other test here — this body needs a real profile
        // field too; `displayName` stands in for whatever the account row has.
        vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
            displayName: "Mihael",
            karma: 8,
            recentAbandons: 2,
            recentGames: 14,
            totalAbandons: 5,
            windowDays: 30,
        }), { status: 200, headers: { "Content-Type": "application/json" } })))

        const profile = await createProfileLookup(cfg()).get("firebase-uid-1")
        expect(profile?.reliability).toEqual({ recentAbandons: 2, recentGames: 14, totalAbandons: 5, windowDays: 30 })
        const user = withAppProfile(CLAIMS_USER, profile)
        expect(user.karma).toBe(8)
        expect(user.reliability).toEqual({ recentAbandons: 2, recentGames: 14, totalAbandons: 5, windowDays: 30 })
    })

    it("parses reliability defensively: negative/fractional counts clamp, missing windowDays defaults to 30", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
            displayName: "Mihael",
            karma: 9,
            recentAbandons: -3,
            recentGames: 4.6,
            totalAbandons: 1.2,
            // windowDays intentionally absent
        }), { status: 200, headers: { "Content-Type": "application/json" } })))

        const profile = await createProfileLookup(cfg()).get("firebase-uid-1")
        expect(profile?.reliability).toEqual({ recentAbandons: 0, recentGames: 5, totalAbandons: 1, windowDays: 30 })
    })

    it("older backend sends no reliability fields: reliability is null, karma still passes", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response(
            JSON.stringify({ displayName: "Mihael", karma: 10 }),
            { status: 200, headers: { "Content-Type": "application/json" } },
        )))

        const profile = await createProfileLookup(cfg()).get("firebase-uid-1")
        expect(profile?.karma).toBe(10)
        expect(profile?.reliability).toBeNull()

        const user = withAppProfile(CLAIMS_USER, profile)
        expect(user.karma).toBe(10)
        // Omitted entirely, same "never send a null the client has to skip"
        // rule as `avatarPreset`/`gameStats`/`karma` itself.
        expect(user).not.toHaveProperty("reliability")
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

    it("parses the backend's ISO next-change instant", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response(
            JSON.stringify({ gameName: "Ivan", nextChangeAt: "2026-09-16T10:00:00Z" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
        )))

        const lookup = createProfileLookup(cfg())
        expect(await lookup.setGameName("firebase-uid-1", "Ivan"))
            .toEqual({ ok: true, name: "Ivan", nextChangeAt: Date.parse("2026-09-16T10:00:00Z") })
    })

    it("renames synthetic dev users without calling the backend", async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal("fetch", fetchMock)
        const lookup = createProfileLookup(loadConfig({ GAME_DEV_ALLOW_ANON: "1" }))

        expect(await lookup.setGameName("dev:mihael", "Testko"))
            .toEqual({ ok: true, name: "Testko", nextChangeAt: 0 })
        expect(fetchMock).not.toHaveBeenCalled()
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
