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

        expect(first).toEqual({ displayName: "Mihael", avatarUrl: "/api/resources/7/image" })
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

    it("never throws when the backend is down, and does not touch it for dev/guest uids", async () => {
        const fetchMock = vi.fn(async () => { throw new Error("ECONNREFUSED") })
        vi.stubGlobal("fetch", fetchMock)

        const lookup = createProfileLookup(cfg())
        await expect(lookup.get("firebase-uid-1")).resolves.toBeNull()

        await expect(lookup.get("dev:mihael")).resolves.toBeNull()
        await expect(lookup.get("guest:abc")).resolves.toBeNull()
        // Only the real uid reached the network.
        expect(fetchMock).toHaveBeenCalledTimes(1)
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
