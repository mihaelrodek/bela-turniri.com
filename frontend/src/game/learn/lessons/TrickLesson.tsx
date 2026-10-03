import { useState } from "react"
import { Text, VStack } from "@chakra-ui/react"
import { useTranslation } from "../../../i18n"
import Examples from "../Examples"
import Tasks from "../Tasks"
import { TrickExample, TrickQuiz, type TrickPosition } from "../TrickViews"
import type { LessonProps } from "./types"

/* ──────────────────────────────────────────────────────────────────────────
   Lesson 4 — the trick, "štih" (2026-09-29).

   New in the rework: the first version asked "which card takes the trick?"
   inside the strength lessons, before anybody had said what a trick is.

   SHOWN FIRST — three tricks played out on the table, each with the led
   suit named and the winning card ringed:
     1. everybody follows suit          → the strongest card of the led suit;
     2. somebody throws in another suit → it counts for nothing, however big;
     3. somebody trumps                 → a trump beats every other suit.
   ASKED AFTER — four other tricks: tap the card that takes it.

   A position is only cards; the winner and the reason are computed
   (`describeTrick` over the engine's `trickWinner`).
   ────────────────────────────────────────────────────────────────────── */

const EXAMPLES: readonly TrickPosition[] = [
    {
        trump: "PIK",
        trick: [
            { seat: 1, card: "KHERC" },
            { seat: 2, card: "8HERC" },
            { seat: 3, card: "AHERC" },
            { seat: 0, card: "10HERC" },
        ],
    },
    {
        trump: "TREF",
        trick: [
            { seat: 3, card: "QKARA" },
            { seat: 0, card: "9KARA" },
            { seat: 1, card: "APIK" },
            { seat: 2, card: "KKARA" },
        ],
    },
    {
        trump: "TREF",
        trick: [
            { seat: 2, card: "APIK" },
            { seat: 3, card: "10PIK" },
            { seat: 0, card: "KPIK" },
            { seat: 1, card: "7TREF" },
        ],
    },
]

const TASKS: readonly TrickPosition[] = [
    {
        trump: "TREF",
        trick: [
            { seat: 1, card: "KPIK" },
            { seat: 2, card: "10PIK" },
            { seat: 3, card: "JPIK" },
            { seat: 0, card: "9PIK" },
        ],
    },
    {
        trump: "TREF",
        trick: [
            { seat: 3, card: "10HERC" },
            { seat: 0, card: "AKARA" },
            { seat: 1, card: "QHERC" },
            { seat: 2, card: "KHERC" },
        ],
    },
    {
        trump: "PIK",
        trick: [
            { seat: 0, card: "AHERC" },
            { seat: 1, card: "7PIK" },
            { seat: 2, card: "KHERC" },
            { seat: 3, card: "9PIK" },
        ],
    },
    {
        trump: "TREF",
        trick: [
            { seat: 2, card: "ATREF" },
            { seat: 3, card: "9TREF" },
            { seat: 0, card: "10TREF" },
            { seat: 1, card: "JTREF" },
        ],
    },
]

export default function TrickLesson({ onSolved, reducedMotion }: LessonProps) {
    const { t } = useTranslation()
    const [asking, setAsking] = useState(false)

    if (asking) {
        return (
            <Tasks count={TASKS.length} reducedMotion={reducedMotion} onSolved={onSolved} onReview={() => setAsking(false)}>
                {(index, done) => (
                    <TrickQuiz position={TASKS[index] ?? TASKS[0]} reducedMotion={reducedMotion} onRight={done} />
                )}
            </Tasks>
        )
    }

    return (
        <VStack gap="3" align="stretch">
            <Text textAlign="center" color="fg.muted">{t("game.learn.trick.intro")}</Text>
            <Examples count={EXAMPLES.length} reducedMotion={reducedMotion} onDone={() => setAsking(true)}>
                {(index) => <TrickExample position={EXAMPLES[index] ?? EXAMPLES[0]} reducedMotion={reducedMotion} />}
            </Examples>
        </VStack>
    )
}
