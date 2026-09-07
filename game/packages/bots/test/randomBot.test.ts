import { describe, expect, it } from "vitest"
import type { Card } from "@bela/engine"
import { randomBot } from "../src/randomBot"
import { view } from "./helpers"

describe("randomBot (lako)", () => {
    it("always returns a legal card, uniformly across the rng range", () => {
        const legal: Card[] = ["7HERC", "JHERC", "APIK"]
        const v = view({ seat: 0, hand: legal })
        expect(randomBot.chooseCard(v, legal, () => 0)).toBe("7HERC")
        expect(randomBot.chooseCard(v, legal, () => 0.3)).toBe("7HERC")
        expect(randomBot.chooseCard(v, legal, () => 0.4)).toBe("JHERC")
        expect(randomBot.chooseCard(v, legal, () => 0.99999)).toBe("APIK")
    })

    it("passes whenever it can", () => {
        const v = view({ seat: 0, hand: ["JHERC", "9HERC", "APIK"] })
        expect(
            randomBot.chooseBid(v, { canPass: true, suits: ["HERC", "KARA", "PIK", "TREF"] }, () => 0),
        ).toBe("PASS")
    })

    it("calls the strongest suit when forced (mus), never passing", () => {
        const v = view({ seat: 3, hand: ["JHERC", "9HERC", "7PIK", "8PIK", "7TREF", "8TREF"] })
        expect(
            randomBot.chooseBid(v, { canPass: false, suits: ["HERC", "KARA", "PIK", "TREF"] }, () => 0),
        ).toBe("HERC")
    })
})
