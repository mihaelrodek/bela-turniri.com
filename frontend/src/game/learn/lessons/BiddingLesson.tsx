import { useMemo, useState } from "react"
import { Badge, Box, Flex, Text, VStack } from "@chakra-ui/react"
import { biddingState, hintForBid, LEARNER_SEAT } from "@bela/bots"
import { viewFor } from "@bela/engine"
import type { Card, Seat, Suit } from "@bela/engine"
import { useTranslation } from "../../../i18n"
import BiddingPanel from "../../components/BiddingPanel"
import PlayingCard from "../../components/PlayingCard"
import SuitGlyph from "../../components/SuitGlyph"
import { sortHandForDisplay } from "../../util/cards"
import { useBidAdvice } from "../coachText"
import Examples from "../Examples"
import LessonFeedback, { type Feedback } from "../LessonFeedback"
import Tasks from "../Tasks"
import type { LessonProps } from "./types"

/* ──────────────────────────────────────────────────────────────────────────
   Lesson 6 — calling trump (2026-09-29; game/README.md §1.2).

   SHOWN FIRST — what a call rests on, then four hands of SIX cards (trump is
   called before the last two are dealt), each with its verdict and one line
   of why:
     1. jack and nine of one suit     → call it;
     2. the jack and length behind it → call it;
     3. no jack, no nine              → "dalje";
     4. "mus": everybody passed and you deal → you must call.
   ASKED AFTER — three OTHER hands, answered on the table's own
   `BiddingPanel`; the third is a mus, where the engine's `legalBids` refuses
   the pass and the panel shows "Moraš zvati" where the button was.

   The verdict of EVERY hand, shown or asked, is what the heuristic bot does
   with those six cards (`hintForBid`), and the line beside it is built from
   the facts that function returns. A different call is not called wrong —
   bidding is a judgement — it is answered with the suggestion and can be
   tried again.
   ────────────────────────────────────────────────────────────────────── */

interface BidPosition {
    hand: readonly Card[]
    passed: 0 | 1 | 2 | 3
}

const EXAMPLES: readonly BidPosition[] = [
    { hand: ["JKARA", "9KARA", "KKARA", "APIK", "8HERC", "7TREF"], passed: 0 },
    { hand: ["JTREF", "QTREF", "8TREF", "7TREF", "AKARA", "9HERC"], passed: 0 },
    { hand: ["7HERC", "QHERC", "8PIK", "KPIK", "10KARA", "8TREF"], passed: 1 },
    { hand: ["9HERC", "KHERC", "8HERC", "7PIK", "QKARA", "7TREF"], passed: 3 },
]

const TASKS: readonly (BidPosition & { intro: string })[] = [
    { intro: "game.learn.bid.step.first", hand: ["JHERC", "9HERC", "AHERC", "7PIK", "8KARA", "7TREF"], passed: 0 },
    { intro: "game.learn.bid.step.weak", hand: ["7HERC", "8HERC", "7PIK", "QKARA", "8TREF", "KTREF"], passed: 1 },
    { intro: "game.learn.bid.step.forced", hand: ["JPIK", "8PIK", "7PIK", "8HERC", "QKARA", "7TREF"], passed: 3 },
]

const SEAT_LABEL: Record<Seat, string> = {
    0: "game.learn.seat.you",
    1: "game.learn.seat.right",
    2: "game.learn.seat.partner",
    3: "game.learn.seat.left",
}

function useBidPosition(position: BidPosition) {
    const state = useMemo(() => biddingState(position.hand, position.passed), [position])
    const view = useMemo(() => viewFor(state, LEARNER_SEAT), [state])
    // Asked once per position: the bot may break a tie at random, and the
    // verdict must not change between two looks at the same hand.
    const hint = useMemo(() => hintForBid(view, Math.random), [view])
    const hand = useMemo(() => sortHandForDisplay(position.hand), [position])
    return { state, view, hint, hand }
}

function Passes({ seats }: { seats: readonly Seat[] }) {
    const { t } = useTranslation()
    return (
        <Flex justify="center" gap="2" wrap="wrap" minH="24px">
            {seats.map((seat) => (
                <Badge key={seat} variant="subtle" colorPalette="gray" rounded="full" px="2">
                    {t(SEAT_LABEL[seat])}: {t("game.bidding.pass")}
                </Badge>
            ))}
        </Flex>
    )
}

function SixCards({ hand, lit }: { hand: readonly Card[]; lit: Suit | null }) {
    const { t } = useTranslation()
    return (
        <Flex justify="center" gap={{ base: "1.5", md: "3" }} wrap="wrap" role="group" aria-label={t("game.hand.ariaLabel")}>
            {hand.map((card) => (
                <PlayingCard key={card} card={card} size="sm" raised={lit !== null && card.endsWith(lit)} />
            ))}
        </Flex>
    )
}

function BidExample({ position }: { position: BidPosition }) {
    const { t } = useTranslation()
    const advise = useBidAdvice()
    const { state, hint, hand } = useBidPosition(position)
    if (hint === null) return null
    const suit = hint.choice === "PASS" ? null : hint.choice
    return (
        <VStack gap="3" align="stretch">
            <Passes seats={state.bidding.passes} />
            <SixCards hand={hand} lit={suit} />
            <Flex justify="center" align="center" gap="2">
                <Badge size="lg" variant="solid" colorPalette={suit === null ? "gray" : "brand"} rounded="full" px="3" py="1">
                    {suit !== null && <SuitGlyph suit={suit} size={18} />}
                    {suit === null ? t("game.bidding.pass") : t("game.learn.bid.call")}
                </Badge>
            </Flex>
            <Text textAlign="center" fontWeight="semibold">{advise(hint)}</Text>
        </VStack>
    )
}

function BidTask({ position, reducedMotion, onDone }: {
    position: BidPosition & { intro: string }
    reducedMotion: boolean
    onDone: () => void
}) {
    const { t } = useTranslation()
    const advise = useBidAdvice()
    const { state, view, hint, hand } = useBidPosition(position)
    const [done, setDone] = useState(false)
    const [pulse, setPulse] = useState(0)
    const [feedback, setFeedback] = useState<Feedback | null>(null)

    const answer = (choice: Suit | "PASS") => {
        if (done || hint === null) return
        setPulse((n) => n + 1)
        const advice = advise(hint)
        // "Mus" teaches that a call is compulsory, so any call completes it.
        if (choice === hint.choice || (hint.forced && choice !== "PASS")) {
            setFeedback({
                tone: "right",
                text: choice === hint.choice ? advice : t("game.learn.bid.forcedAny", { advice }),
            })
            setDone(true)
            onDone()
            return
        }
        setFeedback({ tone: "wrong", text: t("game.learn.bid.other", { advice }) })
    }

    return (
        <VStack gap="3" align="stretch">
            <Text textAlign="center" color="fg.muted">{t(position.intro)}</Text>
            <Passes seats={state.bidding.passes} />
            <SixCards hand={hand} lit={null} />
            <Text textAlign="center" fontSize="lg" fontWeight="bold">{t("game.learn.bid.task")}</Text>
            <Box>
                <BiddingPanel view={view} busy={done} onBid={answer} onPass={() => answer("PASS")} />
            </Box>
            <LessonFeedback feedback={feedback} pulse={pulse} reducedMotion={reducedMotion} />
        </VStack>
    )
}

export default function BiddingLesson({ onSolved, reducedMotion }: LessonProps) {
    const { t } = useTranslation()
    const [asking, setAsking] = useState(false)

    if (asking) {
        return (
            <Tasks count={TASKS.length} reducedMotion={reducedMotion} onSolved={onSolved} onReview={() => setAsking(false)}>
                {(index, done) => (
                    <BidTask position={TASKS[index] ?? TASKS[0]} reducedMotion={reducedMotion} onDone={done} />
                )}
            </Tasks>
        )
    }

    return (
        <VStack gap="3" align="stretch">
            <Text textAlign="center" color="fg.muted">{t("game.learn.bid.intro")}</Text>
            <Text textAlign="center" fontSize="sm" color="fg.muted">{t("game.learn.bid.whatToCall")}</Text>
            <Examples count={EXAMPLES.length} reducedMotion={reducedMotion} onDone={() => setAsking(true)}>
                {(index) => <BidExample position={EXAMPLES[index] ?? EXAMPLES[0]} />}
            </Examples>
        </VStack>
    )
}
