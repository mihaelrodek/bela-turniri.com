import { useMemo, useState } from "react"
import { Button, Text, VStack } from "@chakra-ui/react"
import { RANKS, cardPoints, cardStrength, makeCard } from "@bela/engine"
import type { Card, Rank, Suit } from "@bela/engine"
import { useTranslation } from "../../../i18n"
import { Comparison, PairTask, PointsTask } from "../StrengthTasks"
import StrengthRow from "../StrengthRow"
import Tasks from "../Tasks"
import TrumpChip from "../TrumpChip"
import { useCardNames } from "../useCardNames"
import type { LessonProps } from "./types"

/* ──────────────────────────────────────────────────────────────────────────
   StrengthLesson — the body shared by lesson 2 (an ordinary suit) and
   lesson 3 (the trump suit) (2026-09-29).

   SHOWN FIRST, in this order:
     1. the eight cards of one suit in a starting order;
     2. one tap re-orders them by strength — the cards slide to their places,
        and in trump the jack and the nine jump to the front — with each
        card's points under it;
     3. three comparisons, two cards each, the stronger first.
   ASKED AFTER: which of two cards is stronger, and what a card is worth.

   No trick appears anywhere: tricks are the next lesson.

   Order and points are the engine's `cardStrength` / `cardPoints`, read with
   `trump` — the lesson's own suit in lesson 3, any other suit in lesson 2.
   ────────────────────────────────────────────────────────────────────── */

export type StrengthTask =
    | { kind: "pair"; a: Rank; b: Rank }
    | { kind: "points"; rank: Rank; choices: readonly number[] }

export interface StrengthConfig {
    suit: Suit
    /** The suit read as trump for strength and points. */
    trump: Suit
    /** How the row is ordered before the tap: by number, or as a plain suit. */
    start: "natural" | Suit
    intro: string
    startLabel: string
    button: string
    ordered: string
    comparisons: readonly (readonly [Rank, Rank])[]
    tasks: readonly StrengthTask[]
}

function byStrength(cards: readonly Card[], trump: Suit): Card[] {
    return cards.slice().sort((a, b) => cardStrength(b, trump) - cardStrength(a, trump))
}

export default function StrengthLesson({ config, onSolved, reducedMotion, cardSize }: LessonProps & { config: StrengthConfig }) {
    const { t } = useTranslation()
    const { rankParams } = useCardNames()
    const { suit, trump } = config
    const [ordered, setOrdered] = useState(false)
    const [asking, setAsking] = useState(false)

    const cards = useMemo<Card[]>(() => RANKS.map((rank) => makeCard(rank, suit)), [suit])
    const startOrder = useMemo(
        () => (config.start === "natural" ? cards : byStrength(cards, config.start)),
        [cards, config.start],
    )
    const finalOrder = useMemo(() => byStrength(cards, trump), [cards, trump])
    const points = useMemo(() => {
        const out: Record<string, number> = {}
        for (const card of cards) out[card] = cardPoints(card, trump)
        return out
    }, [cards, trump])
    /** Before the tap: no points yet (by number), or the ordinary suit's. */
    const startPoints = useMemo(() => {
        if (config.start === "natural") return null
        const out: Record<string, number> = {}
        for (const card of cards) out[card] = cardPoints(card, config.start)
        return out
    }, [cards, config.start])
    /** The cards that move FORWARD — worked out, not listed. */
    const movers = useMemo(
        () => (config.start === "natural" ? [] : cards.filter((card) => finalOrder.indexOf(card) < startOrder.indexOf(card))),
        [cards, config.start, finalOrder, startOrder],
    )
    const params = {
        ...rankParams,
        jackPoints: points[makeCard("J", suit)] ?? 0,
        ninePoints: points[makeCard("9", suit)] ?? 0,
        acePoints: points[makeCard("A", suit)] ?? 0,
        tenPoints: points[makeCard("10", suit)] ?? 0,
    }

    if (asking) {
        return (
            <Tasks count={config.tasks.length} reducedMotion={reducedMotion} onSolved={onSolved} onReview={() => setAsking(false)}>
                {(index, done) => {
                    const task = config.tasks[index] ?? config.tasks[0]
                    return (
                        <VStack gap="3" align="stretch">
                            {suit === trump && <TrumpChip trump={trump} />}
                            {task.kind === "pair" ? (
                                <PairTask a={makeCard(task.a, suit)} b={makeCard(task.b, suit)} trump={trump}
                                    size={cardSize} reducedMotion={reducedMotion} onRight={done} />
                            ) : (
                                <PointsTask card={makeCard(task.rank, suit)} trump={trump} choices={task.choices}
                                    size={cardSize} reducedMotion={reducedMotion} onRight={done} />
                            )}
                        </VStack>
                    )
                }}
            </Tasks>
        )
    }

    return (
        <VStack gap="4" align="stretch">
            <Text textAlign="center" color="fg.muted">{t(ordered ? config.ordered : config.intro, params)}</Text>
            {ordered && suit === trump ? (
                <TrumpChip trump={trump} />
            ) : (
                <Text textAlign="center" fontSize="xs" color="fg.subtle" textTransform="uppercase" letterSpacing="wider">
                    {t(ordered ? "game.learn.strongestFirst" : config.startLabel)}
                </Text>
            )}
            <StrengthRow
                order={ordered ? finalOrder : startOrder}
                points={ordered ? points : startPoints}
                jumping={ordered ? movers : []}
                size={cardSize}
                reducedMotion={reducedMotion}
                ariaLabel={t("game.learn.strongestFirst")}
            />
            {!ordered ? (
                <Button alignSelf="center" colorPalette="brand" onClick={() => setOrdered(true)}>
                    {t(config.button)}
                </Button>
            ) : (
                <>
                    <VStack gap="3" align="stretch" rounded="l3" bg="bg.subtle" borderWidth="1px" borderColor="border.subtle" px="3" py="3">
                        {config.comparisons.map(([a, b], index) => (
                            <Comparison key={`${a}-${b}`} a={makeCard(a, suit)} b={makeCard(b, suit)} trump={trump}
                                index={index} reducedMotion={reducedMotion} />
                        ))}
                    </VStack>
                    <Button alignSelf="center" colorPalette="brand" onClick={() => setAsking(true)}>
                        {t("game.learn.toTasks")}
                    </Button>
                </>
            )}
        </VStack>
    )
}
