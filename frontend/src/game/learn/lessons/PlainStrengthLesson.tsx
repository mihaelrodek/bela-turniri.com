import StrengthLesson, { type StrengthConfig } from "./StrengthLesson"
import type { LessonProps } from "./types"

/* Lesson 2 — card strength in an ORDINARY suit (2026-09-29): by number
   first, then A 10 K Q J 9 8 7 with the points of each. It says up front
   that the trump suit is ordered differently — that is lesson 3. */

const CONFIG: StrengthConfig = {
    suit: "HERC",
    // Any suit but HERC: this lesson's cards must all be plain.
    trump: "TREF",
    start: "natural",
    intro: "game.learn.plain.intro",
    startLabel: "game.learn.plain.natural",
    button: "game.learn.plain.sort",
    ordered: "game.learn.plain.ordered",
    comparisons: [["A", "10"], ["10", "K"], ["Q", "J"]],
    tasks: [
        { kind: "pair", a: "K", b: "Q" },
        { kind: "pair", a: "9", b: "J" },
        { kind: "points", rank: "10", choices: [0, 4, 10, 11] },
        { kind: "points", rank: "9", choices: [0, 2, 9, 14] },
    ],
}

export default function PlainStrengthLesson(props: LessonProps) {
    return <StrengthLesson {...props} config={CONFIG} />
}
