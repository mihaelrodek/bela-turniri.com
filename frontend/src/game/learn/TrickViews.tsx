import { useMemo, useState } from "react"
import { Text, VStack } from "@chakra-ui/react"
import { describeTrick } from "@bela/bots"
import { cardSuit } from "@bela/engine"
import type { Card, Suit, TrickCard } from "@bela/engine"
import { useTranslation } from "../../i18n"
import LessonFeedback, { type Feedback } from "./LessonFeedback"
import MiniTable, { type TableMark } from "./MiniTable"
import { useCardNames } from "./useCardNames"

/* ──────────────────────────────────────────────────────────────────────────
   A trick SHOWN and a trick ASKED, both on `MiniTable` (2026-09-29).

   `TrickExample` plays a trick out and rings the card that takes it, with
   one line of why. `TrickQuiz` lays the same kind of table down and asks the
   learner to tap the winning card.

   The winner and the reason are `describeTrick` (`@bela/bots` tutor.ts, on
   top of the engine's `trickWinner`). A wrong tap is explained by comparing
   the tapped card with the winner — a suit that was neither led nor trump,
   a plain card against a trump, or a weaker card of the winner's suit.
   ────────────────────────────────────────────────────────────────────── */

export interface TrickPosition {
    trump: Suit
    /** In play order. */
    trick: readonly TrickCard[]
}

function useVerdictLine(position: TrickPosition): string {
    const { t } = useTranslation()
    const { cardName, suitName } = useCardNames()
    const verdict = useMemo(() => describeTrick(position.trick, position.trump), [position])
    if (verdict === null) return ""
    const stray = position.trick.some((c) => cardSuit(c.card) !== verdict.lead && cardSuit(c.card) !== position.trump)
    const line = t(`game.learn.trickWhy.${verdict.reason}`, {
        card: cardName(verdict.winner.card),
        suit: suitName(verdict.lead),
    })
    // A card of a third suit was thrown in: say that it counts for nothing.
    return stray && verdict.reason === "highestOfLed" ? `${line} ${t("game.learn.trickWhy.stray")}` : line
}

export function TrickExample({ position, reducedMotion }: { position: TrickPosition; reducedMotion: boolean }) {
    const verdict = useMemo(() => describeTrick(position.trick, position.trump), [position])
    const line = useVerdictLine(position)
    return (
        <VStack gap="3" align="stretch">
            <MiniTable
                trick={position.trick}
                trump={position.trump}
                winner={verdict?.winner.seat ?? null}
                reducedMotion={reducedMotion}
            />
            <Text textAlign="center" fontWeight="semibold">{line}</Text>
        </VStack>
    )
}

export function TrickQuiz({ position, reducedMotion, onRight }: {
    position: TrickPosition
    reducedMotion: boolean
    onRight: () => void
}) {
    const { t } = useTranslation()
    const verdict = useMemo(() => describeTrick(position.trick, position.trump), [position])
    const line = useVerdictLine(position)
    const [marks, setMarks] = useState<Partial<Record<Card, TableMark>>>({})
    const [solved, setSolved] = useState(false)
    const [pulse, setPulse] = useState(0)
    const [feedback, setFeedback] = useState<Feedback | null>(null)

    const pick = (entry: TrickCard) => {
        if (solved || verdict === null) return
        setPulse((n) => n + 1)
        const winner = verdict.winner.card
        if (entry.card === winner) {
            setMarks((cur) => ({ ...cur, [entry.card]: "right" }))
            setSolved(true)
            setFeedback({ tone: "right", text: line })
            onRight()
            return
        }
        setMarks((cur) => ({ ...cur, [entry.card]: "wrong" }))
        const suit = cardSuit(entry.card)
        const key =
            suit !== verdict.lead && suit !== position.trump
                ? "game.learn.trick.wrongOffSuit"
                : cardSuit(winner) === position.trump && suit !== position.trump
                  ? "game.learn.trick.wrongTrumpWins"
                  : "game.learn.trick.wrongWeaker"
        setFeedback({ tone: "wrong", text: t(key) })
    }

    return (
        <VStack gap="3" align="stretch">
            <Text textAlign="center" fontSize="lg" fontWeight="bold">{t("game.learn.trick.task")}</Text>
            <MiniTable
                trick={position.trick}
                trump={position.trump}
                winner={solved ? (verdict?.winner.seat ?? null) : null}
                marks={marks}
                pulse={pulse}
                reducedMotion={reducedMotion}
                onPick={solved ? undefined : pick}
            />
            <LessonFeedback feedback={feedback} pulse={pulse} reducedMotion={reducedMotion} />
        </VStack>
    )
}
