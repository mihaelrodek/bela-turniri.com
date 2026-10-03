import { useMemo, useState } from "react"
import { Box, Button, Flex, HStack, SimpleGrid, Text, VStack, chakra } from "@chakra-ui/react"
import { compareDeclarations, findDeclarations, hasBela } from "@bela/engine"
import type { Card, Declaration, Suit } from "@bela/engine"
import { usePlural, useTranslation } from "../../../i18n"
import PlayingCard from "../../components/PlayingCard"
import { cardRank, cardSuit, sortHandForDisplay, type CardSize } from "../../util/cards"
import Examples from "../Examples"
import LessonCard from "../LessonCard"
import LessonFeedback, { type Feedback } from "../LessonFeedback"
import Tasks from "../Tasks"
import TrumpChip from "../TrumpChip"
import { useCardNames } from "../useCardNames"
import type { LessonProps } from "./types"

/* ──────────────────────────────────────────────────────────────────────────
   Lesson 7 — declarations, "zvanja" (2026-09-29; game/README.md §1.4).

   SHOWN FIRST — the table of what a declaration is worth, then five worked
   examples, the cards that make the declaration lifted out of the hand:
     1. a terca (three in a row)       2. a kvarta (four in a row)
     3. four of a kind                 4. a bela (king + queen of trump)
     5. two declarations side by side, the stronger one ringed, and why.
   ASKED AFTER — six tasks on OTHER hands: find the declaration (three
   times), pick the stronger of two (twice), find the bela.

   Nothing about a declaration is written down here except the hands. What a
   hand contains is the engine's `findDeclarations`, which of two is stronger
   is `compareDeclarations`, and a bela is `hasBela` — so the lesson cannot
   drift from how the table scores.
   ────────────────────────────────────────────────────────────────────── */

type Position =
    | { kind: "find"; hand: readonly Card[] }
    | { kind: "compare"; left: readonly Card[]; right: readonly Card[] }
    | { kind: "bela"; hand: readonly Card[]; trump: Suit }

const EXAMPLES: readonly Position[] = [
    { kind: "find", hand: ["JPIK", "QPIK", "KPIK", "7HERC", "9HERC", "AKARA", "8TREF", "10TREF"] },
    { kind: "find", hand: ["7KARA", "8KARA", "9KARA", "10KARA", "AHERC", "KPIK", "QTREF", "8TREF"] },
    { kind: "find", hand: ["9HERC", "9KARA", "9PIK", "9TREF", "APIK", "7HERC", "KTREF", "QKARA"] },
    { kind: "bela", trump: "HERC", hand: ["KHERC", "QHERC", "8HERC", "APIK", "10KARA", "9TREF", "7PIK", "JKARA"] },
    { kind: "compare", left: ["8TREF", "9TREF", "10TREF", "JTREF"], right: ["QHERC", "KHERC", "AHERC"] },
]

const TASKS: readonly Position[] = [
    { kind: "find", hand: ["7HERC", "8HERC", "9HERC", "KPIK", "10KARA", "AKARA", "8TREF", "JTREF"] },
    { kind: "find", hand: ["10PIK", "JPIK", "QPIK", "KPIK", "7HERC", "9KARA", "ATREF", "8TREF"] },
    { kind: "find", hand: ["JHERC", "JKARA", "JPIK", "JTREF", "7HERC", "9KARA", "APIK", "8TREF"] },
    { kind: "compare", left: ["7HERC", "8HERC", "9HERC"], right: ["JPIK", "QPIK", "KPIK"] },
    { kind: "compare", left: ["QHERC", "QKARA", "QPIK", "QTREF"], right: ["8KARA", "9KARA", "10KARA", "JKARA", "QKARA"] },
    { kind: "bela", trump: "KARA", hand: ["KKARA", "QKARA", "7KARA", "AHERC", "10PIK", "9PIK", "8TREF", "JHERC"] },
]

/** The reference table: label key → points (README §1.4). The examples and
 *  tasks are what actually show and check, against the engine. */
const VALUES: readonly { label: string; points: number }[] = [
    { label: "game.learn.decl.value.seq3", points: 20 },
    { label: "game.learn.decl.value.seq4", points: 50 },
    { label: "game.learn.decl.value.seq5", points: 100 },
    { label: "game.learn.decl.value.four", points: 100 },
    { label: "game.learn.decl.value.fourNines", points: 150 },
    { label: "game.learn.decl.value.fourJacks", points: 200 },
    { label: "game.learn.decl.value.bela", points: 20 },
]

function sameSet(a: readonly Card[], b: readonly Card[]): boolean {
    return a.length === b.length && a.every((card) => b.includes(card))
}

/** i18n key of a declaration's everyday name. */
function nameKey(declaration: Declaration): string {
    if (declaration.kind === "FOUR") return "game.learn.decl.name.four"
    return declaration.points === 20
        ? "game.learn.decl.name.seq3"
        : declaration.points === 50
          ? "game.learn.decl.name.seq4"
          : "game.learn.decl.name.seq5"
}

/** WHY one declaration beats another, read off the two themselves. */
function whyKey(left: Declaration, right: Declaration): string {
    return left.points !== right.points
        ? "game.learn.decl.why.points"
        : left.kind !== right.kind
          ? "game.learn.decl.why.four"
          : "game.learn.decl.why.higher"
}

/** The king and the queen of trump, when the hand holds both. */
function belaCards(hand: readonly Card[], trump: Suit): Card[] {
    if (!hasBela(hand, trump)) return []
    return hand.filter((card) => cardSuit(card) === trump && (cardRank(card) === "K" || cardRank(card) === "Q"))
}

function useDeclarationLine(): (declaration: Declaration) => string {
    const { t } = useTranslation()
    const plural = usePlural()
    return (declaration) =>
        t("game.learn.decl.found", {
            name: t(nameKey(declaration)),
            points: plural("game.learn.points", declaration.points),
        })
}

function Group({ cards, tone, onPick, label }: {
    cards: readonly Card[]
    tone: "right" | "wrong" | null
    onPick?: () => void
    label: string
}) {
    return (
        <chakra.button
            type="button"
            aria-label={label}
            onClick={onPick}
            disabled={onPick === undefined}
            cursor={onPick ? "pointer" : "default"}
            rounded="l3"
            px="3"
            py="3"
            bg="bg.subtle"
            borderWidth="2px"
            borderColor={tone === "right" ? "gold" : tone === "wrong" ? "live" : "border.subtle"}
            _hover={onPick ? { borderColor: "brand.emphasized" } : undefined}
            _focusVisible={{ outline: "2px solid", outlineColor: "brand.500", outlineOffset: "2px" }}
        >
            <HStack gap="0" justify="center">
                {cards.map((card, i) => (
                    <Box key={card} ml={i === 0 ? "0" : "-22px"}>
                        <PlayingCard card={card} size="sm" />
                    </Box>
                ))}
            </HStack>
            <Text mt="1.5" fontSize="xs" fontWeight="bold" color="fg.muted">{label}</Text>
        </chakra.button>
    )
}

function Shown({ position, size, reducedMotion }: { position: Position; size: CardSize; reducedMotion: boolean }) {
    const { t } = useTranslation()
    const { rankParams } = useCardNames()
    const line = useDeclarationLine()

    if (position.kind === "compare") {
        const left = findDeclarations(position.left)[0]
        const right = findDeclarations(position.right)[0]
        if (left === undefined || right === undefined) return null
        const leftWins = compareDeclarations(left, right) > 0
        return (
            <VStack gap="3" align="stretch">
                <Flex justify="center" gap="3" wrap="wrap">
                    <Group cards={position.left} label={line(left)} tone={leftWins ? "right" : null} />
                    <Group cards={position.right} label={line(right)} tone={leftWins ? null : "right"} />
                </Flex>
                <Text textAlign="center" fontWeight="semibold">{t(whyKey(left, right))}</Text>
            </VStack>
        )
    }

    const declaration = position.kind === "find" ? findDeclarations(position.hand)[0] : undefined
    const lit = position.kind === "find" ? (declaration?.cards ?? []) : belaCards(position.hand, position.trump)
    return (
        <VStack gap="3" align="stretch">
            {position.kind === "bela" && <TrumpChip trump={position.trump} />}
            <Flex justify="center" gap={{ base: "2", md: "3" }} wrap="wrap" pt="3">
                {sortHandForDisplay(position.hand).map((card) => (
                    <LessonCard
                        key={card}
                        card={card}
                        size={size}
                        reducedMotion={reducedMotion}
                        raised={lit.includes(card)}
                        selected={lit.includes(card)}
                        dimmed={!lit.includes(card)}
                    />
                ))}
            </Flex>
            <Text textAlign="center" fontWeight="semibold">
                {declaration !== undefined ? line(declaration) : t("game.learn.decl.belaFound", rankParams)}
            </Text>
        </VStack>
    )
}

function Asked({ position, size, reducedMotion, onDone }: {
    position: Position
    size: CardSize
    reducedMotion: boolean
    onDone: () => void
}) {
    const { t } = useTranslation()
    const plural = usePlural()
    const { rankParams } = useCardNames()
    const line = useDeclarationLine()
    const [done, setDone] = useState(false)
    const [selected, setSelected] = useState<Card[]>([])
    const [side, setSide] = useState<"left" | "right" | null>(null)
    const [pulse, setPulse] = useState(0)
    const [feedback, setFeedback] = useState<Feedback | null>(null)

    const hand = useMemo(() => (position.kind === "compare" ? [] : sortHandForDisplay(position.hand)), [position])
    const declarations = useMemo(() => (position.kind === "find" ? findDeclarations(position.hand) : []), [position])
    const wanted = useMemo(() => declarations.flatMap((d) => d.cards), [declarations])

    const finish = (text: string) => {
        setFeedback({ tone: "right", text })
        setDone(true)
        onDone()
    }

    const toggle = (card: Card) => {
        if (done) return
        setSelected((cur) => (cur.includes(card) ? cur.filter((c) => c !== card) : [...cur, card]))
    }

    const check = () => {
        setPulse((n) => n + 1)
        if (position.kind === "find") {
            const best = declarations[0]
            if (best !== undefined && sameSet(selected, wanted)) {
                finish(line(best))
                return
            }
            setFeedback({
                tone: "wrong",
                text: best?.kind === "FOUR"
                    ? t("game.learn.decl.hintFour")
                    : plural("game.learn.decl.hintSeq", wanted.length),
            })
            return
        }
        if (position.kind === "bela") {
            if (selected.length === 2 && hasBela(selected, position.trump)) {
                finish(t("game.learn.decl.belaFound", rankParams))
                return
            }
            setFeedback({ tone: "wrong", text: t("game.learn.decl.belaHint", rankParams) })
        }
    }

    const pick = (choice: "left" | "right") => {
        if (done || position.kind !== "compare") return
        setPulse((n) => n + 1)
        setSide(choice)
        const left = findDeclarations(position.left)[0]
        const right = findDeclarations(position.right)[0]
        if (left === undefined || right === undefined) return
        const stronger = compareDeclarations(left, right) > 0 ? "left" : "right"
        const why = t(whyKey(left, right))
        if (choice === stronger) finish(why)
        else setFeedback({ tone: "wrong", text: why })
    }

    return (
        <VStack gap="3" align="stretch">
            {position.kind === "bela" && <TrumpChip trump={position.trump} />}
            <Text textAlign="center" fontSize="lg" fontWeight="bold">
                {t(`game.learn.decl.task.${position.kind}`, rankParams)}
            </Text>

            {position.kind === "compare" ? (
                <Flex justify="center" gap="3" wrap="wrap">
                    {(["left", "right"] as const).map((which) => {
                        const cards = which === "left" ? position.left : position.right
                        const declaration = findDeclarations(cards)[0]
                        return (
                            <Group
                                key={which}
                                cards={cards}
                                label={declaration !== undefined ? line(declaration) : ""}
                                tone={side === which ? (done ? "right" : "wrong") : null}
                                onPick={done ? undefined : () => pick(which)}
                            />
                        )
                    })}
                </Flex>
            ) : (
                <>
                    <Flex justify="center" gap={{ base: "2", md: "3" }} wrap="wrap" pt="3" role="group" aria-label={t("game.hand.ariaLabel")}>
                        {hand.map((card) => (
                            <LessonCard
                                key={card}
                                card={card}
                                size={size}
                                reducedMotion={reducedMotion}
                                pulse={pulse}
                                selected={selected.includes(card)}
                                raised={selected.includes(card)}
                                mark={done && selected.includes(card) ? "right" : null}
                                onSelect={done ? undefined : toggle}
                            />
                        ))}
                    </Flex>
                    {!done && (
                        <Button alignSelf="center" colorPalette="brand" disabled={selected.length === 0} onClick={check}>
                            {t("game.learn.check")}
                        </Button>
                    )}
                </>
            )}

            <LessonFeedback feedback={feedback} pulse={pulse} reducedMotion={reducedMotion} />
        </VStack>
    )
}

export default function DeclarationsLesson({ onSolved, reducedMotion, cardSize }: LessonProps) {
    const { t } = useTranslation()
    const { rankParams } = useCardNames()
    const [asking, setAsking] = useState(false)

    if (asking) {
        return (
            <Tasks count={TASKS.length} reducedMotion={reducedMotion} onSolved={onSolved} onReview={() => setAsking(false)}>
                {(index, done) => (
                    <Asked position={TASKS[index] ?? TASKS[0]} size={cardSize} reducedMotion={reducedMotion} onDone={done} />
                )}
            </Tasks>
        )
    }

    return (
        <VStack gap="3" align="stretch">
            <Text textAlign="center" color="fg.muted">{t("game.learn.decl.intro", rankParams)}</Text>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="1.5" rounded="l3" bg="bg.subtle" borderWidth="1px" borderColor="border.subtle" px="3" py="2">
                {VALUES.map((row) => (
                    <HStack key={row.label} justify="space-between" gap="3">
                        <Text fontSize="sm">{t(row.label, rankParams)}</Text>
                        <Text fontSize="sm" fontFamily="mono" fontWeight="bold" color="gold" fontVariantNumeric="tabular-nums">
                            {row.points}
                        </Text>
                    </HStack>
                ))}
            </SimpleGrid>
            <Examples count={EXAMPLES.length} reducedMotion={reducedMotion} onDone={() => setAsking(true)}>
                {(index) => <Shown position={EXAMPLES[index] ?? EXAMPLES[0]} size={cardSize} reducedMotion={reducedMotion} />}
            </Examples>
        </VStack>
    )
}
