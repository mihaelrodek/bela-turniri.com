import { useState } from "react"
import { Text, VStack } from "@chakra-ui/react"
import { useTranslation } from "../../../i18n"
import Examples from "../Examples"
import { LegalExample, LegalQuiz, type LegalPosition } from "../LegalViews"
import Tasks from "../Tasks"
import type { LessonProps } from "./types"

/* ──────────────────────────────────────────────────────────────────────────
   Lesson 5 — what you MUST play (2026-09-29; game/README.md §1.5).

   SHOWN FIRST — five positions on the table, one obligation each, in the
   order the rule itself asks its questions. In each the cards you may play
   are lit, the rest dimmed, and one line says why:
     1. you hold the led suit              → you must follow it;
     2. you hold a stronger card of it     → you must go over ("iber");
     3. no card of the suit, but a trump   → you must trump;
     4. a trump is already on the table    → a higher trump, if you have one;
     5. neither the suit nor a trump       → anything.
   ASKED AFTER — five OTHER positions, same five obligations: tap every card
   you may play.

   A position is only cards. Which of them are playable is decided by the
   engine when it is drawn, so if README §1.5 changes, both the examples and
   the tasks change with it.
   ────────────────────────────────────────────────────────────────────── */

const EXAMPLES: readonly LegalPosition[] = [
    {
        rule: "game.learn.follow.rule.suit",
        scenario: { trump: "TREF", trick: [{ seat: 3, card: "AHERC" }], hand: ["7HERC", "KHERC", "APIK", "9TREF", "10KARA"] },
    },
    {
        rule: "game.learn.follow.rule.over",
        scenario: {
            trump: "TREF",
            trick: [{ seat: 2, card: "9HERC" }, { seat: 3, card: "KHERC" }],
            hand: ["7HERC", "10HERC", "AHERC", "JPIK", "8TREF"],
        },
    },
    {
        rule: "game.learn.follow.rule.trump",
        scenario: { trump: "TREF", trick: [{ seat: 3, card: "10HERC" }], hand: ["7TREF", "QTREF", "APIK", "KPIK", "9KARA"] },
    },
    {
        rule: "game.learn.follow.rule.overtrump",
        scenario: {
            trump: "TREF",
            trick: [{ seat: 2, card: "KHERC" }, { seat: 3, card: "ATREF" }],
            hand: ["8TREF", "9TREF", "JTREF", "APIK", "10KARA"],
        },
    },
    {
        rule: "game.learn.follow.rule.free",
        scenario: { trump: "TREF", trick: [{ seat: 3, card: "AHERC" }], hand: ["7PIK", "KPIK", "9KARA", "AKARA"] },
    },
]

const TASKS: readonly LegalPosition[] = [
    {
        rule: "game.learn.follow.rule.suit",
        scenario: { trump: "KARA", trick: [{ seat: 3, card: "KPIK" }], hand: ["8PIK", "QPIK", "AHERC", "9KARA", "10TREF"] },
    },
    {
        rule: "game.learn.follow.rule.over",
        scenario: {
            trump: "KARA",
            trick: [{ seat: 2, card: "JTREF" }, { seat: 3, card: "QTREF" }],
            hand: ["9TREF", "KTREF", "ATREF", "7HERC", "8KARA"],
        },
    },
    {
        rule: "game.learn.follow.rule.trump",
        scenario: { trump: "KARA", trick: [{ seat: 3, card: "AHERC" }], hand: ["JKARA", "8KARA", "10PIK", "QPIK", "7TREF"] },
    },
    {
        rule: "game.learn.follow.rule.overtrump",
        scenario: {
            trump: "KARA",
            trick: [{ seat: 2, card: "APIK" }, { seat: 3, card: "QKARA" }],
            hand: ["7KARA", "KKARA", "10KARA", "8HERC", "9TREF"],
        },
    },
    {
        rule: "game.learn.follow.rule.free",
        scenario: { trump: "KARA", trick: [{ seat: 3, card: "10TREF" }], hand: ["7HERC", "AHERC", "9PIK", "KPIK"] },
    },
]

export default function FollowLesson({ onSolved, reducedMotion, cardSize }: LessonProps) {
    const { t } = useTranslation()
    const [asking, setAsking] = useState(false)

    if (asking) {
        return (
            <Tasks count={TASKS.length} reducedMotion={reducedMotion} onSolved={onSolved} onReview={() => setAsking(false)}>
                {(index, done) => (
                    <LegalQuiz position={TASKS[index] ?? TASKS[0]} size={cardSize} reducedMotion={reducedMotion} onDone={done} />
                )}
            </Tasks>
        )
    }

    return (
        <VStack gap="3" align="stretch">
            <Text textAlign="center" color="fg.muted">{t("game.learn.follow.intro")}</Text>
            <Examples count={EXAMPLES.length} reducedMotion={reducedMotion} onDone={() => setAsking(true)}>
                {(index) => (
                    <LegalExample position={EXAMPLES[index] ?? EXAMPLES[0]} size={cardSize} reducedMotion={reducedMotion} />
                )}
            </Examples>
        </VStack>
    )
}
