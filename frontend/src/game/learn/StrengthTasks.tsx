import { useState } from "react"
import { Button, Flex, HStack, Text, VStack } from "@chakra-ui/react"
import { cardPoints, cardRank, cardStrength } from "@bela/engine"
import type { Card, Suit } from "@bela/engine"
import { usePlural, useTranslation } from "../../i18n"
import PlayingCard from "../components/PlayingCard"
import type { CardSize } from "../util/cards"
import LessonCard from "./LessonCard"
import LessonFeedback, { type Feedback } from "./LessonFeedback"
import { RISE } from "./motion"
import { useCardNames } from "./useCardNames"

/* ──────────────────────────────────────────────────────────────────────────
   What the STRENGTH lessons show and ask (2026-09-29).

   These two lessons come before the learner has heard of a trick, so they
   never show one (the first version asked "which card takes the trick?"
   here — about something not yet taught). They deal in exactly what they
   teach: which of two cards OF ONE SUIT is stronger, and what a card is
   worth.

     Comparison   shown: two cards with "›" between them, the stronger first,
                  and their points;
     PairTask     asked: two cards, tap the stronger;
     PointsTask   asked: one card, pick its points.

   Every answer is the engine's: `cardStrength` and `cardPoints`, read with
   the lesson's trump.
   ────────────────────────────────────────────────────────────────────── */

export function Comparison({ a, b, trump, index, reducedMotion }: {
    a: Card
    b: Card
    trump: Suit
    /** Position in the list, for the stagger. */
    index: number
    reducedMotion: boolean
}) {
    const { t } = useTranslation()
    const { rankName } = useCardNames()
    const [strong, weak] = cardStrength(a, trump) >= cardStrength(b, trump) ? [a, b] : [b, a]
    const rankOf = (card: Card) => rankName(cardRank(card))
    return (
        <HStack
            gap="3"
            justify="center"
            css={reducedMotion ? undefined : { animation: `${RISE} 320ms ease-out backwards`, animationDelay: `${index * 260}ms` }}
        >
            <PlayingCard card={strong} size="sm" />
            <Text fontSize="2xl" fontWeight="black" color="fg.muted" aria-hidden="true">›</Text>
            <PlayingCard card={weak} size="sm" />
            <Text fontSize="sm" maxW="150px" lineHeight="1.3">
                {t("game.learn.compare.line", {
                    strong: rankOf(strong),
                    weak: rankOf(weak),
                    strongPoints: cardPoints(strong, trump),
                    weakPoints: cardPoints(weak, trump),
                })}
            </Text>
        </HStack>
    )
}

export function PairTask({ a, b, trump, size, reducedMotion, onRight }: {
    a: Card
    b: Card
    trump: Suit
    size: CardSize
    reducedMotion: boolean
    onRight: () => void
}) {
    const { t } = useTranslation()
    const { cardName } = useCardNames()
    const [picked, setPicked] = useState<Card | null>(null)
    const [pulse, setPulse] = useState(0)
    const [feedback, setFeedback] = useState<Feedback | null>(null)
    const strong = cardStrength(a, trump) >= cardStrength(b, trump) ? a : b
    const solved = picked === strong

    const tap = (card: Card) => {
        if (solved) return
        setPicked(card)
        setPulse((n) => n + 1)
        const text = t("game.learn.pair.answer", { card: cardName(strong) })
        setFeedback({ tone: card === strong ? "right" : "wrong", text })
        if (card === strong) onRight()
    }

    return (
        <VStack gap="3" align="stretch">
            <Text textAlign="center" fontSize="lg" fontWeight="bold">{t("game.learn.pair.task")}</Text>
            <Flex justify="center" gap="6">
                {[a, b].map((card) => (
                    <LessonCard
                        key={card}
                        card={card}
                        size={size}
                        reducedMotion={reducedMotion}
                        pulse={pulse}
                        mark={picked === card ? (card === strong ? "right" : "wrong") : null}
                        onSelect={solved ? undefined : tap}
                    />
                ))}
            </Flex>
            <LessonFeedback feedback={feedback} pulse={pulse} reducedMotion={reducedMotion} />
        </VStack>
    )
}

export function PointsTask({ card, trump, choices, size, reducedMotion, onRight }: {
    card: Card
    trump: Suit
    choices: readonly number[]
    size: CardSize
    reducedMotion: boolean
    onRight: () => void
}) {
    const { t } = useTranslation()
    const plural = usePlural()
    const { cardName } = useCardNames()
    const [solved, setSolved] = useState(false)
    const [pulse, setPulse] = useState(0)
    const [feedback, setFeedback] = useState<Feedback | null>(null)
    const worth = cardPoints(card, trump)

    const answer = (value: number) => {
        if (solved) return
        setPulse((n) => n + 1)
        if (value === worth) {
            setSolved(true)
            setFeedback({
                tone: "right",
                text: t("game.learn.worth.right", { card: cardName(card), points: plural("game.learn.points", worth) }),
            })
            onRight()
            return
        }
        setFeedback({ tone: "wrong", text: t(value > worth ? "game.learn.worth.less" : "game.learn.worth.more") })
    }

    return (
        <VStack gap="3" align="stretch">
            <Text textAlign="center" fontSize="lg" fontWeight="bold">{t("game.learn.worth.task")}</Text>
            <Flex justify="center"><PlayingCard card={card} size={size} /></Flex>
            <HStack justify="center" gap="2" wrap="wrap">
                {choices.map((value) => (
                    <Button key={value} variant="outline" colorPalette="brand" fontFamily="mono" minW="56px"
                        disabled={solved} onClick={() => answer(value)}>
                        {value}
                    </Button>
                ))}
            </HStack>
            <LessonFeedback feedback={feedback} pulse={pulse} reducedMotion={reducedMotion} />
        </VStack>
    )
}
