import { useState } from "react"
import { Button, Flex, Text, VStack } from "@chakra-ui/react"
import { SUITS, makeCard } from "@bela/engine"
import type { Suit } from "@bela/engine"
import { useTranslation } from "../../../i18n"
import LessonCard from "../LessonCard"
import LessonFeedback, { type Feedback } from "../LessonFeedback"
import { useCardNames } from "../useCardNames"
import type { LessonProps } from "./types"

/* ──────────────────────────────────────────────────────────────────────────
   Lesson 1 — the four suits (2026-09-29).

   SHOWN FIRST — the four suits, each with BOTH its names under it ("Herc
   ili srce", "Kara ili bundeva", "Pik ili zelje", "Tref ili žir"): the same
   suit is called either at a real table, so the lesson teaches both.
   ASKED AFTER — the names go away and the learner is asked for one suit at a
   time, in a shuffled order. A right tap puts the names back under that card
   for good, a wrong one says which suit was tapped.
   ────────────────────────────────────────────────────────────────────── */

function shuffled<T>(items: readonly T[]): T[] {
    const out = items.slice()
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const a = out[i] as T
        out[i] = out[j] as T
        out[j] = a
    }
    return out
}

export default function SuitsLesson({ onSolved, reducedMotion, cardSize }: LessonProps) {
    const { t } = useTranslation()
    const { suitBoth } = useCardNames()
    const [started, setStarted] = useState(false)
    const [targets] = useState<Suit[]>(() => shuffled(SUITS))
    const [found, setFound] = useState<Suit[]>([])
    const [wrong, setWrong] = useState<Suit | null>(null)
    const [pulse, setPulse] = useState(0)
    const [feedback, setFeedback] = useState<Feedback | null>(null)

    const target = targets[found.length] ?? null
    const done = started && target === null

    const tap = (suit: Suit) => {
        if (!started || target === null || found.includes(suit)) return
        setPulse((n) => n + 1)
        if (suit === target) {
            const next = [...found, suit]
            setFound(next)
            setWrong(null)
            if (next.length === targets.length) {
                setFeedback({ tone: "right", text: t("game.learn.suits.done") })
                onSolved()
            } else {
                setFeedback({ tone: "right", text: t("game.learn.suits.right", { suit: suitBoth(suit) }) })
            }
            return
        }
        setWrong(suit)
        setFeedback({
            tone: "wrong",
            text: t("game.learn.suits.wrong", { tapped: suitBoth(suit), target: suitBoth(target) }),
        })
    }

    return (
        <VStack gap="4" align="stretch">
            <Text textAlign="center" color="fg.muted">{t("game.learn.suits.intro")}</Text>

            <Flex justify="center" gap={{ base: "2", md: "4" }} wrap="wrap">
                {SUITS.map((suit) => (
                    <LessonCard
                        key={suit}
                        card={makeCard("10", suit)}
                        size={cardSize}
                        reducedMotion={reducedMotion}
                        pulse={pulse}
                        mark={found.includes(suit) ? "right" : wrong === suit ? "wrong" : null}
                        // The name is the answer: shown before the task, and
                        // again under every suit already found.
                        caption={!started || found.includes(suit) ? suitBoth(suit) : ""}
                        onSelect={started && !done ? () => tap(suit) : undefined}
                    />
                ))}
            </Flex>

            {!started ? (
                <Button alignSelf="center" colorPalette="brand" onClick={() => setStarted(true)}>
                    {t("game.learn.suits.start")}
                </Button>
            ) : (
                <Text textAlign="center" fontSize="lg" fontWeight="bold" minH="28px">
                    {target !== null ? t("game.learn.suits.task", { suit: suitBoth(target) }) : ""}
                </Text>
            )}

            <LessonFeedback feedback={feedback} pulse={pulse} reducedMotion={reducedMotion} />
        </VStack>
    )
}
