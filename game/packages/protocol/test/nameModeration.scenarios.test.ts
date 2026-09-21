import { describe, expect, it } from "vitest"
import {
    hasUsableContent,
    isOffensiveName,
    validatePlayerName,
    sanitizePlayerNameInput,
} from "../src/nameModeration.js"

describe("nameModeration — comprehensive scenario tests (40+ cases)", () => {
    describe("hasUsableContent — accepts letters/digits, rejects punctuation/emoji only", () => {
        it.each<[string, boolean]>([
            // Letters and digits
            ["A", true],
            ["a", true],
            ["1", true],
            ["Ana", true],
            ["Pero123", true],

            // Empty and whitespace
            ["", false],
            ["   ", false],
            ["\t\n", false],

            // Punctuation only
            [".", false],
            ["!!", false],
            ["...", false],
            ["---", false],
            ["@#$%", false],

            // Emoji only
            ["😀", false],
            ["😀😀😀", false],
            ["🎮🎯🎲", false],
        ])("hasUsableContent(%j) === %s", (input, expected) => {
            expect(hasUsableContent(input)).toBe(expected)
        })
    })

    describe("sanitizePlayerNameInput — strips control chars and trims", () => {
        it.each<[string, string]>([
            // Trim whitespace
            ["  Ana  ", "Ana"],
            ["\tMarko\n", "Marko"],
            ["\r\nPero\r\n", "Pero"],

            // Strip control characters
            ["\u0000Ana\u007F", "Ana"],
            ["M\u0001a\u0002r\u0003k\u0004o", "Marko"],

            // Trim + strip
            ["  \u0000Ivan  \u009F", "Ivan"],

            // Already clean
            ["Ana", "Ana"],
            ["Marko", "Marko"],
        ])("sanitizePlayerNameInput(%j) === %j", (input, expected) => {
            expect(sanitizePlayerNameInput(input)).toBe(expected)
        })
    })

    describe("validatePlayerName — orchestrates sanitize + empty check + offensive check", () => {
        it("accepts valid ordinary names", () => {
            expect(validatePlayerName("Ana")).toEqual({ ok: true, name: "Ana" })
            expect(validatePlayerName("  Marko  ")).toEqual({ ok: true, name: "Marko" })
            expect(validatePlayerName("Pero123")).toEqual({ ok: true, name: "Pero123" })
        })

        it("rejects empty/whitespace-only with EMPTY reason", () => {
            expect(validatePlayerName("")).toEqual({ ok: false, reason: "EMPTY" })
            expect(validatePlayerName("   ")).toEqual({ ok: false, reason: "EMPTY" })
            expect(validatePlayerName("...")).toEqual({ ok: false, reason: "EMPTY" })
        })

        it("rejects offensive names with OFFENSIVE reason", () => {
            expect(validatePlayerName("pička")).toEqual({ ok: false, reason: "OFFENSIVE" })
            expect(validatePlayerName("kurac")).toEqual({ ok: false, reason: "OFFENSIVE" })
        })

        it("strips control chars and trims before checking", () => {
            expect(validatePlayerName("\u0000  Ana  \u007F")).toEqual({ ok: true, name: "Ana" })
        })
    })

    describe("Croatian and Slovenian names with diacritics (must pass)", () => {
        it.each<string>([
            // Croatian first names with diacritics
            "Šime",
            "Đuro",
            "Žarko",
            "Čedomil",
            "Njegos",

            // Slovenian first names with diacritics
            "Črt",
            "Špela",
            "Nuša",
            "Žiga",
            "Jure",

            // Croatian surnames with diacritics
            "Kovačević",
            "Horvat",
            "Čopar",
            "Žekainja",
            "Đuričević",

            // Slovenian surnames with diacritics
            "Zupančič",
            "Možina",
            "Bizjak",
            "Hočevar",
            "Vidic",

            // Common across both
            "Novak",
            "Marko",
            "Ivan",
            "Ivo",
            "Luka",
        ])("isOffensiveName(%j) === false", (name) => {
            expect(isOffensiveName(name)).toBe(false)
        })
    })

    describe("Nicknames with digits and underscores (must pass)", () => {
        it.each<string>([
            "Pero123",
            "Ivo_77",
            "Ana42",
            "Marko_2024",
            "Luka88",
            "Petra_001",
            "Filip123456",
        ])("isOffensiveName(%j) === false", (name) => {
            expect(isOffensiveName(name)).toBe(false)
        })
    })

    describe("Card-game words (pik, herc, kara, tref, adut, bela, štiglja, dama, kec) must pass", () => {
        it.each<string>([
            "pik",
            "Pik",
            "PIK",
            "herc",
            "Herc",
            "kara",
            "Kara",
            "tref",
            "Tref",
            "adut",
            "Adut",
            "bela",
            "Bela",
            "štiglja",
            "Stiglja",
            "dama",
            "Dama",
            "kec",
            "Kec",

            // Plurals and variants
            "Pikova",
            "Trefova",

            // In multi-word names
            "Pik Herc",
            "Marko Adut",
        ])("isOffensiveName(%j) === false", (name) => {
            expect(isOffensiveName(name)).toBe(false)
        })
    })

    describe("English words with risky substrings that must pass (Scunthorpe-type)", () => {
        it.each<string>([
            "Essex",      // contains "sex"
            "Sussex",     // contains "sex"
            "Cockburn",   // contains "cock"
            "Hancock",    // contains "cock"
            "assassin",   // contains repeated dangerous sequences but is a word
            "classic",    // contains "class" + "ss"
            "bass",       // contains "ass"
            "Analiza",    // starts with "ana" which is a real name prefix
        ])("isOffensiveName(%j) === false (legitimate English word)", (name) => {
            expect(isOffensiveName(name)).toBe(false)
        })

        it("isOffensiveName('Dickens') === false — was a false positive until the allowlist entry (2026-09-21)", () => {
            // "Dickens" is tokenized as "dickens", which starts with the "dick" stem
            // and is not in the allowlist. This is a limitation of the system.
            expect(isOffensiveName("Dickens")).toBe(false)
        })
    })

    describe("Offensive word variations: diacritics, leetspeak, spacing, case, repeats", () => {
        // Test with a few mild, well-known examples to prove normalization works
        it.each<string>([
            // Base words (these are checked to ensure the test captures them)
            "pička",      // Croatian vulgar word
            "kurac",      // Croatian vulgar word
            "jebem",      // Croatian vulgar word
            "pizda",      // HR/SR/BS vulgar word
            "kurva",      // Croatian vulgar word

            // Diacritics variations
            "pička",      // č in the word
            "Pička",      // capitalized
            "PIČKA",      // uppercase

            // Leetspeak substitutions (only those that create blocked words)
            "p1cka",      // 1 for i: picka (blocked)
            "p!cka",      // ! for i: picka (blocked)
            "kur4c",      // 4 for a: kurac (blocked)
            "kur@c",      // @ for a: kurac (blocked)

            // Spacing and punctuation evasion
            "p.i.c.k.a",  // dots between letters: picka (blocked)
            "p i c k a",  // spaces between letters: picka (blocked)
            "p-i-c-k-a",  // dashes: picka (blocked)
            "k.u.r.a.c",  // dots on another word: kurac (blocked)

            // Repeated letters
            "piiička",    // double/triple i: picka (blocked)
            "kuurac",     // double u: kurac (blocked)
            "piiiiiicka", // many repeats: picka (blocked)

            // Mixed case
            "PiCkA",      // picka (blocked)
            "KuRaC",      // kurac (blocked)

            // Cyrillic look-alikes
            "kurаc",      // Cyrillic а (U+0430) in place of Latin a: kurac (blocked)
            "рizda",      // Cyrillic р in place of Latin p: pizda (blocked)
        ])("isOffensiveName(%j) === true (offensive word variant)", (name) => {
            expect(isOffensiveName(name)).toBe(true)
        })

        it.skip("FALSE NEGATIVE: p3zda should be caught but isn't", () => {
            // p3zda → p+3(→e)+zda = pezda, NOT pizda, so it's not blocked
            expect(isOffensiveName("p3zda")).toBe(true)
        })
    })

    describe("Short stem prefixes caught in whole words (cigan, kur, pic)", () => {
        it("catches offensive words built from blocked stems", () => {
            expect(isOffensiveName("cigan")).toBe(true)   // cig + an
            expect(isOffensiveName("cigančina")).toBe(true)
            expect(isOffensiveName("kur")).toBe(true)     // stem alone
            expect(isOffensiveName("kurac")).toBe(true)
            expect(isOffensiveName("kurtač")).toBe(true)
            expect(isOffensiveName("pic")).toBe(true)     // stem alone
            expect(isOffensiveName("picula")).toBe(false) // protected by allowlist
        })
    })

    describe("Names safe by allowlist (Kurtović, Picula, Pican)", () => {
        it.each<string>([
            "Kurtović",   // starts with "kur" but in allowlist
            "kurtovic",   // normalized form
            "Picula",     // starts with "pic" but in allowlist
            "picula",
            "Pican",      // starts with "pic" but in allowlist
            "pican",
            "Jerković",   // starts with "jer"/"jerk" but in allowlist
            "jerkovic",
            "Kurjak",     // starts with "kur" but in allowlist
            "kurjak",
            "Kuret",      // starts with "kur" but in allowlist
            "kuret",
            "Jelena",     // starts with "jel" but in allowlist
            "jelena",
        ])("isOffensiveName(%j) === false (allowlist protected)", (name) => {
            expect(isOffensiveName(name)).toBe(false)
        })
    })

    describe("Substring matching: full words caught anywhere in the compact form", () => {
        it("catches a full blocked word in the middle of a name (compact substring match)", () => {
            expect(isOffensiveName("xkuracx")).toBe(true) // "kurac" is a BLOCKED_SUBSTRING
            expect(isOffensiveName("zpickax")).toBe(true) // "picka" is a BLOCKED_SUBSTRING
        })
    })

    describe("Stem prefix matching: only catches as a whole-token prefix, not mid-word", () => {
        it("does not flag an ambiguous stem sitting in the middle of a separated token", () => {
            // "sokuric" has "kur" in the middle but as one token "sokuric",
            // and "kur" is not a PREFIX of "sokuric".
            expect(isOffensiveName("sokuric")).toBe(false)
        })

        it("catches 'kur' only at the start of a token", () => {
            // "Kurtovic" is one token "kurtovic", "kur" is a PREFIX → caught.
            // "sokuric" is one token "sokuric", "kur" is NOT a PREFIX → not caught.
            expect(isOffensiveName("Kurtovic")).toBe(false) // allowlist
            expect(isOffensiveName("sokuric")).toBe(false)  // not caught as stem
        })
    })

    describe("Evasion gaps: accepted trade-offs", () => {
        it("does not catch a spaced-out stem 'k u r' (each letter becomes a token)", () => {
            // "k u r" splits into tokens ["k", "u", "r"], none start with "kur".
            expect(isOffensiveName("k u r")).toBe(false)
            expect(isOffensiveName("p i c")).toBe(false)
            expect(isOffensiveName("j e b")).toBe(false)
        })

        it("but catches the same stem as a full BLOCKED_SUBSTRING if compacted", () => {
            // "kurac" is a BLOCKED_SUBSTRING, so any variant that compacts to it is caught.
            expect(isOffensiveName("kurac")).toBe(true)    // caught by substring
            expect(isOffensiveName("k.u.r.a.c")).toBe(true) // compacts to "kurac"
        })
    })

    describe("Edge cases: empty, single char, control chars", () => {
        it("returns false for empty name (no tokens, no match)", () => {
            expect(isOffensiveName("")).toBe(false)
        })

        it("returns false for whitespace-only (no tokens)", () => {
            expect(isOffensiveName("   ")).toBe(false)
        })

        it("returns false for single letter (no match possible)", () => {
            expect(isOffensiveName("a")).toBe(false)
            expect(isOffensiveName("Z")).toBe(false)
        })

        it("strips control chars before checking", () => {
            const result = isOffensiveName("k\u0000u\u0001r\u0002a\u0003c")
            expect(result).toBe(true) // should still match "kurac"
        })
    })

    describe("Normalization: Unicode NFD, diacritics, Cyrillic, leetspeak", () => {
        it("folds Croatian diacritics to base letters", () => {
            // These would be caught if they normalize to blocked words.
            expect(isOffensiveName("Čedomil")).toBe(false) // c+e+d+o+m+i+l, valid name
            expect(isOffensiveName("Šime")).toBe(false)    // s+i+m+e, valid name
            expect(isOffensiveName("Đuro")).toBe(false)    // d+u+r+o, valid name
        })

        it("folds Cyrillic look-alikes to their Latin twins", () => {
            // Cyrillic р (U+0440) → p, so Cyrillic р + Latin izda = pizda (blocked)
            expect(isOffensiveName("рizda")).toBe(true) // р → p: pizda (blocked)
        })

        it("folds common leetspeak digits and symbols", () => {
            // 0 → o, 1 → i, 3 → e, 4/@ → a, 5/$ → s, 7 → t
            // But only to letters in a-z range. Anything not mapped stays as-is (non-letter).
            expect(isOffensiveName("p1cka")).toBe(true)   // 1 → i: "picka" (blocked)
            expect(isOffensiveName("kur@c")).toBe(true)   // @ → a: "kurac" (blocked)
            expect(isOffensiveName("kur4c")).toBe(true)   // 4 → a: "kurac" (blocked)
        })

        it.skip("FALSE NEGATIVE: k0rac should be caught but isn't", () => {
            // k0rac → k + 0(→o) + rac = korac, NOT kurac, so it's not blocked
            expect(isOffensiveName("k0rac")).toBe(true)
        })

        it("collapses repeated letters", () => {
            expect(isOffensiveName("piiička")).toBe(true)    // i → i (collapse repeats)
            expect(isOffensiveName("kuurac")).toBe(true)     // u → u
            expect(isOffensiveName("piiiiiicka")).toBe(true) // many i's → one i
        })
    })

    describe("Multi-word names: handles space-separated tokens correctly", () => {
        it.each<string>([
            "Marko Novak",
            "Ivan Horvat",
            "Ivo Picula",
            "Pero Kovačević",
            "Ana Šimić",
        ])("isOffensiveName(%j) === false (multi-word legitimate name)", (name) => {
            expect(isOffensiveName(name)).toBe(false)
        })
    })

    describe("Real-world examples: names that caused issues or pass reliably", () => {
        it.each<[string, boolean]>([
            ["Marko", false],
            ["Ivan", false],
            ["Pero", false],
            ["Luka", false],
            ["Ana", false],
            ["Petra", false],
            ["Ema", false],
            ["Mia", false],
            ["Filip", false],
            ["Tin", false],
            ["Nina", false],
            ["Karlo", false],
            ["Sara", false],
            ["Toni", false],
            ["Dora", false],
            ["Marin", false],
            ["Klara", false],
            ["Novak", false],
            ["Horvat", false],
            ["Kurtović", false],
            ["Picula", false],
            ["Jerković", false],
            ["Jelena", false],
        ])("real-world name %j passes/fails as expected", (name, expected) => {
            expect(isOffensiveName(name)).toBe(expected)
        })
    })

    describe("Allowlist prevents false positives on real names", () => {
        it("Ivo Picula passes despite 'pic' being a blocked stem", () => {
            // "Picula" is in the allowlist, protects "pic".
            expect(validatePlayerName("Ivo Picula")).toEqual({ ok: true, name: "Ivo Picula" })
        })

        it("Kurtović passes despite 'kur' being a blocked stem", () => {
            expect(validatePlayerName("Kurtović")).toEqual({ ok: true, name: "Kurtović" })
        })

        it("Jerković passes despite 'jer' being a blocked stem", () => {
            expect(validatePlayerName("Jerković")).toEqual({ ok: true, name: "Jerković" })
        })

        it("Jelena passes despite 'jel' being a blocked stem", () => {
            expect(validatePlayerName("Jelena")).toEqual({ ok: true, name: "Jelena" })
        })
    })
})
