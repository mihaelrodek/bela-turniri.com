import { useMemo, useState } from "react"
import { Flex, Text, VStack } from "@chakra-ui/react"
import { LEARNER_SEAT, scenarioLegalMoves, scenarioView, whyIllegal } from "@bela/bots"
import type { Scenario } from "@bela/bots"
import type { Card } from "@bela/engine"
import { useTranslation } from "../../i18n"
import { sortHandForDisplay, type CardSize } from "../util/cards"
import LessonCard from "./LessonCard"
import LessonFeedback, { type Feedback } from "./LessonFeedback"
import MiniTable from "./MiniTable"

/* ──────────────────────────────────────────────────────────────────────────
   "Što smiješ odigrati" — SHOWN and ASKED (2026-09-29).

   Both halves draw the same picture: the table with what has been played
   (`MiniTable`: who led, the led suit by name, trump, and an empty "?" place
   where the learner's card will go) and the learner's hand under it.

     LegalExample   the cards the rules allow are lit, the rest are dimmed,
                    and one line says which obligation is at work;
     LegalQuiz      nothing is lit; the learner taps cards. An allowed card
                    gets a tick, a forbidden one a cross and the obligation
                    it breaks. Finished when every allowed card is found.

   WHICH cards are allowed is the engine's `legalMoves` run on the position
   (`scenarioLegalMoves`), and the obligation is `whyIllegal` — the same two
   functions the practice game uses. No rule is restated here.
   ────────────────────────────────────────────────────────────────────── */

export interface LegalPosition {
    /** The one-sentence rule this position shows. */
    rule: string
    scenario: Scenario
}

export function LegalExample({ position, size, reducedMotion }: {
    position: LegalPosition
    size: CardSize
    reducedMotion: boolean
}) {
    const { t } = useTranslation()
    const legal = useMemo(() => scenarioLegalMoves(position.scenario), [position])
    const hand = useMemo(() => sortHandForDisplay(position.scenario.hand), [position])
    return (
        <VStack gap="3" align="stretch">
            <MiniTable
                trick={position.scenario.trick}
                trump={position.scenario.trump}
                pending={LEARNER_SEAT}
                reducedMotion={reducedMotion}
            />
            <Text textAlign="center" fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wider">
                {t("game.learn.legal.yourHand")}
            </Text>
            <Flex justify="center" gap={{ base: "2", md: "3" }} wrap="wrap" role="group" aria-label={t("game.hand.ariaLabel")}>
                {hand.map((card) => (
                    <LessonCard
                        key={card}
                        card={card}
                        size={size}
                        reducedMotion={reducedMotion}
                        dimmed={!legal.includes(card)}
                        mark={legal.includes(card) ? "right" : null}
                    />
                ))}
            </Flex>
            <Text textAlign="center" fontWeight="semibold">{t(position.rule)}</Text>
        </VStack>
    )
}

export function LegalQuiz({ position, size, reducedMotion, onDone }: {
    position: LegalPosition
    size: CardSize
    reducedMotion: boolean
    onDone: () => void
}) {
    const { t } = useTranslation()
    const { scenario } = position
    const legal = useMemo(() => scenarioLegalMoves(scenario), [scenario])
    const view = useMemo(() => scenarioView(scenario), [scenario])
    const hand = useMemo(() => sortHandForDisplay(scenario.hand), [scenario])
    const [tapped, setTapped] = useState<Card[]>([])
    const [pulse, setPulse] = useState(0)
    const [feedback, setFeedback] = useState<Feedback | null>(null)

    const done = tapped.filter((card) => legal.includes(card)).length === legal.length

    const tap = (card: Card) => {
        if (done) return
        setPulse((n) => n + 1)
        const next = tapped.includes(card) ? tapped : [...tapped, card]
        setTapped(next)
        if (!legal.includes(card)) {
            const why = whyIllegal(view, card)
            setFeedback({ tone: "wrong", text: t(why !== null ? `game.learn.illegal.${why}` : "game.hand.illegalPlay") })
            return
        }
        if (next.filter((c) => legal.includes(c)).length === legal.length) {
            setFeedback({ tone: "right", text: t(position.rule) })
            onDone()
        } else {
            setFeedback({ tone: "info", text: t("game.learn.legal.more") })
        }
    }

    return (
        <VStack gap="3" align="stretch">
            <MiniTable
                trick={scenario.trick}
                trump={scenario.trump}
                pending={LEARNER_SEAT}
                animate={false}
                reducedMotion={reducedMotion}
            />
            <Text textAlign="center" fontSize="lg" fontWeight="bold">{t("game.learn.legal.task")}</Text>
            <Flex justify="center" gap={{ base: "2", md: "3" }} wrap="wrap" role="group" aria-label={t("game.hand.ariaLabel")}>
                {hand.map((card) => {
                    const wasTapped = tapped.includes(card)
                    const isLegal = legal.includes(card)
                    return (
                        <LessonCard
                            key={card}
                            card={card}
                            size={size}
                            reducedMotion={reducedMotion}
                            pulse={pulse}
                            mark={wasTapped ? (isLegal ? "right" : "wrong") : null}
                            dimmed={(wasTapped || done) && !isLegal}
                            onSelect={done ? undefined : tap}
                        />
                    )
                })}
            </Flex>
            <LessonFeedback feedback={feedback} pulse={pulse} reducedMotion={reducedMotion} />
        </VStack>
    )
}
