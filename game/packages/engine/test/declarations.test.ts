import { describe, expect, it } from "vitest"
import type { Card, Declaration, Seat } from "../src/index"
import { compareDeclarations, findDeclarations, hasBela } from "../src/index"
import { declarationsScoringTeam } from "../src/declarations"

const four = (cards: Card[], points: 100 | 150 | 200): Declaration => ({
    kind: "FOUR",
    cards,
    points,
})
const seq = (cards: Card[], points: 20 | 50 | 100): Declaration => ({
    kind: "SEQUENCE",
    cards,
    points,
})

describe("findDeclarations — four of a kind (README §1.4)", () => {
    it("four jacks are 200", () => {
        const hand: Card[] = [
            "JHERC",
            "JKARA",
            "JPIK",
            "JTREF",
            "7HERC",
            "8KARA",
            "QPIK",
            "ATREF",
        ]
        expect(findDeclarations(hand)).toEqual([
            four(["JHERC", "JKARA", "JPIK", "JTREF"], 200),
        ])
    })

    it("four nines are 150", () => {
        const hand: Card[] = [
            "9HERC",
            "9KARA",
            "9PIK",
            "9TREF",
            "7HERC",
            "8KARA",
            "QPIK",
            "ATREF",
        ]
        expect(findDeclarations(hand)).toEqual([four(["9HERC", "9KARA", "9PIK", "9TREF"], 150)])
    })

    it("four aces, tens, kings and queens are 100 each", () => {
        const cases: [string, Card[]][] = [
            ["A", ["AHERC", "AKARA", "APIK", "ATREF"]],
            ["10", ["10HERC", "10KARA", "10PIK", "10TREF"]],
            ["K", ["KHERC", "KKARA", "KPIK", "KTREF"]],
            ["Q", ["QHERC", "QKARA", "QPIK", "QTREF"]],
        ]
        for (const [, quad] of cases) {
            const hand: Card[] = [...quad, "7HERC", "8KARA", "9PIK", "JTREF"]
            const found = findDeclarations(hand).filter((d) => d.kind === "FOUR")
            expect(found).toEqual([four(quad, 100)])
        }
    })

    it("four sevens or eights are worth nothing", () => {
        const sevens: Card[] = ["7HERC", "7KARA", "7PIK", "7TREF"]
        const eights: Card[] = ["8HERC", "8KARA", "8PIK", "8TREF"]
        expect(findDeclarations([...sevens, "AHERC", "AKARA", "QPIK", "JTREF"])).toEqual([])
        expect(findDeclarations([...eights, "AHERC", "AKARA", "QPIK", "JTREF"])).toEqual([])
    })

    it("lists the four cards in SUITS order", () => {
        const hand: Card[] = ["JTREF", "JPIK", "JKARA", "JHERC", "7HERC", "8KARA", "QPIK", "ATREF"]
        expect(findDeclarations(hand)[0]?.cards).toEqual(["JHERC", "JKARA", "JPIK", "JTREF"])
    })
})

describe("findDeclarations — sequences (README §1.4)", () => {
    it("a run of three is 20", () => {
        const hand: Card[] = ["7PIK", "8PIK", "9PIK", "AHERC", "KKARA", "QTREF", "JHERC", "7TREF"]
        expect(findDeclarations(hand)).toEqual([seq(["7PIK", "8PIK", "9PIK"], 20)])
    })

    it("a run of four is 50", () => {
        const hand: Card[] = ["7PIK", "8PIK", "9PIK", "10PIK", "AHERC", "KKARA", "QTREF", "7TREF"]
        expect(findDeclarations(hand)).toEqual([seq(["7PIK", "8PIK", "9PIK", "10PIK"], 50)])
    })

    it("a run of five is 100", () => {
        const hand: Card[] = ["7PIK", "8PIK", "9PIK", "10PIK", "JPIK", "AHERC", "KKARA", "7TREF"]
        expect(findDeclarations(hand)).toEqual([seq(["7PIK", "8PIK", "9PIK", "10PIK", "JPIK"], 100)])
    })

    it("a run of eight is a single declaration worth 100", () => {
        const hand: Card[] = [
            "7PIK",
            "8PIK",
            "9PIK",
            "10PIK",
            "JPIK",
            "QPIK",
            "KPIK",
            "APIK",
        ]
        const found = findDeclarations(hand)
        expect(found).toHaveLength(1)
        expect(found[0]?.points).toBe(100)
        expect(found[0]?.cards).toHaveLength(8)
    })

    it("uses the NATURAL order 7 8 9 10 J Q K A, not the trump order", () => {
        // 9-10-J is a run; J-9-A (adjacent in the trump order) is not.
        expect(findDeclarations(["9PIK", "10PIK", "JPIK"])).toEqual([
            seq(["9PIK", "10PIK", "JPIK"], 20),
        ])
        expect(findDeclarations(["JPIK", "9PIK", "APIK"])).toEqual([])
    })

    it("splits a suit into maximal non-overlapping runs", () => {
        const hand: Card[] = ["7PIK", "8PIK", "9PIK", "JPIK", "QPIK", "KPIK", "AHERC", "7TREF"]
        expect(findDeclarations(hand)).toEqual([
            seq(["7PIK", "8PIK", "9PIK"], 20),
            seq(["JPIK", "QPIK", "KPIK"], 20),
        ])
    })

    it("ignores runs shorter than three", () => {
        expect(findDeclarations(["7PIK", "8PIK", "10PIK", "AHERC"])).toEqual([])
    })

    it("finds runs in several suits, in SUITS order", () => {
        const hand: Card[] = [
            "QHERC",
            "KHERC",
            "AHERC",
            "7TREF",
            "8TREF",
            "9TREF",
            "7KARA",
            "APIK",
        ]
        expect(findDeclarations(hand)).toEqual([
            seq(["QHERC", "KHERC", "AHERC"], 20),
            seq(["7TREF", "8TREF", "9TREF"], 20),
        ])
    })
})

describe("findDeclarations — overlap", () => {
    it("counts a card in both a four and a sequence", () => {
        const hand: Card[] = [
            "JHERC",
            "JKARA",
            "JTREF",
            "9PIK",
            "10PIK",
            "JPIK",
            "QPIK",
            "7HERC",
        ]
        expect(findDeclarations(hand)).toEqual([
            four(["JHERC", "JKARA", "JPIK", "JTREF"], 200),
            seq(["9PIK", "10PIK", "JPIK", "QPIK"], 50),
        ])
    })

    it("returns an empty list for a hand with nothing", () => {
        expect(findDeclarations(["7HERC", "10KARA", "QPIK", "ATREF"])).toEqual([])
    })

    it("does not mutate its input", () => {
        const hand: Card[] = ["7PIK", "8PIK", "9PIK"]
        const snapshot = structuredClone(hand)
        findDeclarations(hand)
        expect(hand).toEqual(snapshot)
    })
})

describe("compareDeclarations (README §1.4)", () => {
    it("ranks by points first", () => {
        expect(
            compareDeclarations(
                four(["JHERC", "JKARA", "JPIK", "JTREF"], 200),
                four(["9HERC", "9KARA", "9PIK", "9TREF"], 150),
            ),
        ).toBeGreaterThan(0)
        expect(
            compareDeclarations(seq(["7PIK", "8PIK", "9PIK"], 20), seq(["7PIK", "8PIK", "9PIK", "10PIK"], 50)),
        ).toBeLessThan(0)
    })

    it("a four beats a sequence of the same 100", () => {
        const quad = four(["AHERC", "AKARA", "APIK", "ATREF"], 100)
        const run = seq(["7PIK", "8PIK", "9PIK", "10PIK", "JPIK"], 100)
        expect(compareDeclarations(quad, run)).toBeGreaterThan(0)
        expect(compareDeclarations(run, quad)).toBeLessThan(0)
    })

    it("on equal points and kind, the higher top card wins", () => {
        const low = seq(["7PIK", "8PIK", "9PIK"], 20)
        const high = seq(["QHERC", "KHERC", "AHERC"], 20)
        expect(compareDeclarations(high, low)).toBeGreaterThan(0)
        expect(compareDeclarations(low, high)).toBeLessThan(0)
    })

    it("four aces beat four kings beat four queens", () => {
        const aces = four(["AHERC", "AKARA", "APIK", "ATREF"], 100)
        const kings = four(["KHERC", "KKARA", "KPIK", "KTREF"], 100)
        const queens = four(["QHERC", "QKARA", "QPIK", "QTREF"], 100)
        expect(compareDeclarations(aces, kings)).toBeGreaterThan(0)
        expect(compareDeclarations(kings, queens)).toBeGreaterThan(0)
    })

    it("is 0 for indistinguishable declarations", () => {
        const a = seq(["7PIK", "8PIK", "9PIK"], 20)
        const b = seq(["7TREF", "8TREF", "9TREF"], 20)
        expect(compareDeclarations(a, b)).toBe(0)
    })
})

describe("declarationsScoringTeam (README §1.4)", () => {
    const empty = (): Record<Seat, Declaration[]> => ({ 0: [], 1: [], 2: [], 3: [] })

    it("is null when nobody declared anything", () => {
        expect(declarationsScoringTeam(empty(), 3)).toBeNull()
    })

    it("gives everything to the team with the strongest single declaration", () => {
        const perSeat = empty()
        perSeat[0] = [seq(["7PIK", "8PIK", "9PIK"], 20), seq(["7TREF", "8TREF", "9TREF"], 20)]
        perSeat[1] = [seq(["7HERC", "8HERC", "9HERC", "10HERC"], 50)]
        expect(declarationsScoringTeam(perSeat, 3)).toBe("B")
    })

    it("breaks an exact tie in favour of the seat closer to next(dealer)", () => {
        const perSeat = empty()
        perSeat[1] = [seq(["7PIK", "8PIK", "9PIK"], 20)]
        perSeat[2] = [seq(["7TREF", "8TREF", "9TREF"], 20)]
        // dealer 0 → order starts at seat 1, so seat 1 (team B) is closer.
        expect(declarationsScoringTeam(perSeat, 0)).toBe("B")
        // dealer 1 → order starts at seat 2, so seat 2 (team A) is closer.
        expect(declarationsScoringTeam(perSeat, 1)).toBe("A")
    })

    it("a four wins the tie against a 100-point sequence regardless of seat order", () => {
        const perSeat = empty()
        perSeat[1] = [seq(["7PIK", "8PIK", "9PIK", "10PIK", "JPIK"], 100)]
        perSeat[2] = [four(["QHERC", "QKARA", "QPIK", "QTREF"], 100)]
        expect(declarationsScoringTeam(perSeat, 0)).toBe("A")
    })
})

describe("hasBela", () => {
    it("needs both the king and the queen of trump", () => {
        expect(hasBela(["KHERC", "QHERC", "APIK"], "HERC")).toBe(true)
        expect(hasBela(["KHERC", "APIK"], "HERC")).toBe(false)
        expect(hasBela(["QHERC", "APIK"], "HERC")).toBe(false)
        expect(hasBela(["KPIK", "QPIK"], "HERC")).toBe(false)
        expect(hasBela(["KPIK", "QPIK"], "PIK")).toBe(true)
    })
})
