import StrengthLesson, { type StrengthConfig } from "./StrengthLesson"
import type { LessonProps } from "./types"

/* Lesson 3 — the same eight cards when their suit is TRUMP (2026-09-29).
   The row starts in the ordinary order lesson 2 ended on, points included;
   "Ovo je adut" re-reads both with this suit as trump, and the jack and the
   nine jump to the front (J 20, 9 14). */

const CONFIG: StrengthConfig = {
    suit: "TREF",
    trump: "TREF",
    // Read as an ordinary suit until the tap.
    start: "HERC",
    intro: "game.learn.trump.intro",
    startLabel: "game.learn.trump.asPlain",
    button: "game.learn.trump.makeTrump",
    ordered: "game.learn.trump.ordered",
    comparisons: [["J", "9"], ["9", "A"], ["A", "10"]],
    tasks: [
        { kind: "pair", a: "A", b: "J" },
        { kind: "pair", a: "9", b: "K" },
        { kind: "points", rank: "J", choices: [2, 11, 14, 20] },
        { kind: "points", rank: "9", choices: [0, 10, 14, 20] },
    ],
}

export default function TrumpStrengthLesson(props: LessonProps) {
    return <StrengthLesson {...props} config={CONFIG} />
}
