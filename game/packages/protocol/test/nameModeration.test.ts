import { describe, expect, it } from "vitest"
import { hasUsableContent, isOffensiveName, validatePlayerName } from "../src/nameModeration.js"

describe("isOffensiveName", () => {
    it("catches diacritics, leetspeak, spacing/punctuation evasion and repeated letters", () => {
        const variants = [
            "pička", "Pička", "PIČKA",
            "p1cka", "p!cka", "p.i.c.k.a", "p i c k a", "piiička",
            "kurac", "kur4c", "k.u.r.a.c",
            "jebem ti", "jeb3m",
            "pizda", "p1zd@",
            "kurva",
            "peder",
            "ustasa", "ustaša",
            "cetnik", "četnik",
            "zadomspremni", "za dom spremni",
            "fuck",
        ]
        for (const name of variants) {
            expect(isOffensiveName(name), `expected "${name}" to be offensive`).toBe(true)
        }
    })

    it("catches a short ambiguous stem typed as a whole word (no evasion needed)", () => {
        // "cig" is not a full BLOCKED_SUBSTRINGS entry (too short/ambiguous to
        // match anywhere) — this is caught by the whole-token stem check.
        expect(isOffensiveName("cigan")).toBe(true)
        expect(isOffensiveName("kur")).toBe(true)
    })

    it("catches Cyrillic look-alike glyphs used to spell a blocked word", () => {
        // Cyrillic а (U+0430) standing in for the Latin "a" in "kurac".
        expect(isOffensiveName("kurаc")).toBe(true)
        // Cyrillic р (U+0440, visually ~ Latin p) standing in for the leading
        // "p" of "pizda".
        expect(isOffensiveName("рizda")).toBe(true)
    })

    it("passes real Croatian/Slovenian first names, surnames, places and card-game words", () => {
        const legit = [
            "Marko", "Ivan", "Ana", "Petra", "Luka", "Ema", "Filip", "Tin",
            "Nina", "Karlo", "Sara", "Toni", "Dora", "Mia", "Marin", "Klara",
            "Kurtović", "Kurtovic", "Kurjak", "Kuret", "Kurbalija",
            "Picula", "Pićan", "Pico",
            "Jerković", "Jelena",
            "pik", "herc", "kara", "tref", "adut", "bela", "štiglja", "dama", "kec",
            "Marko Kurtović", "Ivo Picula",
        ]
        for (const name of legit) {
            expect(isOffensiveName(name), `expected "${name}" to pass`).toBe(false)
        }
    })

    it("does not flag an ambiguous stem sitting in the middle of an unrelated word", () => {
        // "kur" is matched only as a whole-token PREFIX, never as a mid-word
        // substring — this is what keeps "Kurtović"/"Picula"-shaped names safe
        // by construction, not only via the allowlist. ("sokuric" is a made-up
        // token for this test, not a claim about a real surname.)
        expect(isOffensiveName("sokuric")).toBe(false)
    })

    it("still catches a full blocked word wherever it sits, via the substring list", () => {
        expect(isOffensiveName("xkuracx")).toBe(true)
    })
})

describe("hasUsableContent / validatePlayerName", () => {
    it("rejects empty, whitespace-only and punctuation/emoji-only names", () => {
        expect(hasUsableContent("")).toBe(false)
        expect(hasUsableContent("   ")).toBe(false)
        expect(hasUsableContent("...")).toBe(false)
        expect(hasUsableContent("😀😀")).toBe(false)
        expect(hasUsableContent("!!!")).toBe(false)

        expect(validatePlayerName("   ")).toEqual({ ok: false, reason: "EMPTY" })
        expect(validatePlayerName("😀😀")).toEqual({ ok: false, reason: "EMPTY" })
    })

    it("strips control characters and trims before validating", () => {
        const result = validatePlayerName("\u0000​ Marko ‮")
        expect(result).toEqual({ ok: true, name: "Marko" })
    })

    it("rejects an offensive name with a distinct reason from an empty one", () => {
        expect(validatePlayerName("pička")).toEqual({ ok: false, reason: "OFFENSIVE" })
    })

    it("accepts an ordinary name unchanged (after trim)", () => {
        expect(validatePlayerName("  Ana  ")).toEqual({ ok: true, name: "Ana" })
    })
})
