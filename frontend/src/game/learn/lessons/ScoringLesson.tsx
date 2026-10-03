import { useMemo, useState, type ReactNode } from "react"
import { Box, Button, Flex, HStack, Text, VStack } from "@chakra-ui/react"
import { SUITS, cardPoints, fullDeck, scoreManualDeal } from "@bela/engine"
import type { ManualDealInput, RoundOutcome } from "@bela/engine"
import { useTranslation } from "../../../i18n"
import Examples from "../Examples"
import LessonFeedback, { type Feedback } from "../LessonFeedback"
import { MOVE_EASING, MOVE_MS, RISE } from "../motion"
import Tasks from "../Tasks"
import type { LessonProps } from "./types"

/* ──────────────────────────────────────────────────────────────────────────
   Lesson 8 — scoring a deal (2026-09-29; game/README.md §1.6).

   SHOWN FIRST — five worked counts, each line arriving after the one before:
     1. what a deal holds: the cards, +10 for the last trick;
     2. the calling pair has MORE than the other → it passes, both write
        down what they collected;
     3. 81 : 81 — equal is NOT more → it falls, and everything goes to the
        other pair;
     4. a declaration is added to the cards, and can save a call;
     5. štiglja — all eight tricks: the deal's points plus the bonus.
   ASKED AFTER — three OTHER deals: passed or fell (twice), and what is
   written down for a štiglja.

   The deals are INPUT only. What each of them pays is computed by the
   engine's `scoreManualDeal` — the same arithmetic the paper-scorepad screen
   uses — and the points in the cards are summed from `cardPoints` over the
   whole deck.

   The štiglja question asks what is WRITTEN DOWN, not "what the cards
   carry": the cards carry the deal's 162 and the štiglja adds its bonus on
   top (owner's correction of the first version, which asked about the cards
   and accepted 252).
   ────────────────────────────────────────────────────────────────────── */

/** +10 for the last trick (README §1.6). */
const LAST_TRICK = 10

/** Points in the 32 cards — the same whichever suit is trump. Summed once,
 *  from the engine's own card values. */
const CARD_POINTS = fullDeck().reduce((sum, card) => sum + cardPoints(card, SUITS[0]), 0)
/** What one deal is worth before declarations. */
const DEAL_POINTS = CARD_POINTS + LAST_TRICK

type Example =
    | { kind: "total" }
    | { kind: "deal"; line: string; deal: ManualDealInput }
    | { kind: "stiglja"; deal: ManualDealInput }

const STIGLJA: ManualDealInput = {
    caller: "us",
    cards: { us: 252, them: 0 },
    declarations: { us: [], them: [] },
    stiglja: "us",
}

const EXAMPLES: readonly Example[] = [
    { kind: "total" },
    {
        kind: "deal",
        line: "game.learn.score.ex.passed",
        deal: { caller: "us", cards: { us: 92, them: 70 }, declarations: { us: [], them: [] }, stiglja: null },
    },
    {
        kind: "deal",
        line: "game.learn.score.ex.equal",
        deal: { caller: "us", cards: { us: 81, them: 81 }, declarations: { us: [], them: [] }, stiglja: null },
    },
    {
        kind: "deal",
        line: "game.learn.score.ex.declaration",
        deal: { caller: "us", cards: { us: 74, them: 88 }, declarations: { us: [50], them: [] }, stiglja: null },
    },
    { kind: "stiglja", deal: STIGLJA },
]

type Question =
    | { kind: "verdict"; intro: string; deal: ManualDealInput }
    | { kind: "written"; intro: string; deal: ManualDealInput }

const QUESTIONS: readonly Question[] = [
    {
        kind: "verdict",
        intro: "game.learn.score.q.fall",
        deal: { caller: "us", cards: { us: 78, them: 84 }, declarations: { us: [], them: [] }, stiglja: null },
    },
    {
        kind: "verdict",
        intro: "game.learn.score.q.declaration",
        deal: { caller: "us", cards: { us: 76, them: 86 }, declarations: { us: [20], them: [] }, stiglja: null },
    },
    { kind: "written", intro: "game.learn.score.q.stiglja", deal: STIGLJA },
]

function Bar({ us, them, reducedMotion }: { us: number; them: number; reducedMotion: boolean }) {
    const total = us + them
    const share = total === 0 ? 50 : (us / total) * 100
    return (
        <Flex h="12px" rounded="full" overflow="hidden" bg="bg.muted" aria-hidden="true">
            <Box
                bg="brand.solid"
                style={{ width: `${share}%` }}
                transition={reducedMotion ? "none" : `width ${MOVE_MS}ms ${MOVE_EASING}`}
            />
            <Box flex="1" bg="tan" />
        </Flex>
    )
}

function Side({ label, value, align }: { label: string; value: number; align: "start" | "end" }) {
    return (
        <VStack gap="0" align={align}>
            <Text fontSize="xs" fontWeight="bold" color="fg.muted" textTransform="uppercase" letterSpacing="wide">{label}</Text>
            <Text fontSize="2xl" lineHeight="1.1" fontFamily="mono" fontWeight="black" fontVariantNumeric="tabular-nums">{value}</Text>
        </VStack>
    )
}

/** One line of a worked count: a label and a number, arriving in turn. */
function Line({ label, value, index, strong = false, reducedMotion }: {
    label: string
    value: string
    index: number
    strong?: boolean
    reducedMotion: boolean
}) {
    return (
        <HStack
            justify="space-between"
            gap="3"
            borderTopWidth={strong ? "1px" : "0"}
            borderColor="border.emphasized"
            pt={strong ? "1.5" : "0"}
            css={reducedMotion ? undefined : { animation: `${RISE} 320ms ease-out backwards`, animationDelay: `${index * 380}ms` }}
        >
            <Text fontSize="sm" fontWeight={strong ? "bold" : "normal"}>{label}</Text>
            <Text fontFamily="mono" fontWeight={strong ? "black" : "semibold"} fontVariantNumeric="tabular-nums">{value}</Text>
        </HStack>
    )
}

function Panel({ children }: { children: ReactNode }) {
    return (
        <VStack align="stretch" gap="1.5" rounded="l3" bg="bg.subtle" borderWidth="1px" borderColor="border.subtle"
            px="4" py="3" maxW="420px" w="100%" mx="auto">
            {children}
        </VStack>
    )
}

/** The pair of totals a deal is judged on, and what is written down. */
function useDeal(deal: ManualDealInput): { outcome: RoundOutcome; collected: { us: number; them: number } } {
    return useMemo(() => {
        const outcome = scoreManualDeal(deal)
        return {
            outcome,
            collected: {
                us: deal.cards.us + outcome.declarations.us,
                them: deal.cards.them + outcome.declarations.them,
            },
        }
    }, [deal])
}

function DealExample({ line, deal, reducedMotion }: { line: string; deal: ManualDealInput; reducedMotion: boolean }) {
    const { t } = useTranslation()
    const { outcome, collected } = useDeal(deal)
    const declared = outcome.declarations.us
    // Rows arrive one after another; the declaration row is not always there.
    const after = declared > 0 ? 1 : 0
    return (
        <VStack gap="3" align="stretch">
            <Text textAlign="center" fontSize="sm" color="fg.muted">{t("game.learn.score.weCalled")}</Text>
            <Panel>
                <Line index={0} reducedMotion={reducedMotion} label={t("game.learn.score.row.cards")}
                    value={`${deal.cards.us} : ${deal.cards.them}`} />
                {declared > 0 && (
                    <Line index={1} reducedMotion={reducedMotion} label={t("game.learn.score.row.declaration")}
                        value={`+${declared}`} />
                )}
                <Line index={1 + after} reducedMotion={reducedMotion} strong label={t("game.learn.score.row.collected")}
                    value={`${collected.us} : ${collected.them}`} />
                <Line index={2 + after} reducedMotion={reducedMotion} strong
                    label={t(outcome.fell ? "game.deal.weFell" : "game.deal.wePassed")}
                    value={`${outcome.total.us} : ${outcome.total.them}`} />
            </Panel>
            <Text textAlign="center" fontWeight="semibold">
                {t(line, { us: collected.us, them: collected.them, total: outcome.total.us + outcome.total.them })}
            </Text>
        </VStack>
    )
}

function Shown({ example, reducedMotion }: { example: Example; reducedMotion: boolean }) {
    const { t } = useTranslation()
    const cards = CARD_POINTS
    const deal = DEAL_POINTS

    if (example.kind === "deal") return <DealExample line={example.line} deal={example.deal} reducedMotion={reducedMotion} />

    if (example.kind === "total") {
        return (
            <VStack gap="3" align="stretch">
                <Panel>
                    <Line index={0} reducedMotion={reducedMotion} label={t("game.learn.score.row.allCards")} value={String(cards)} />
                    <Line index={1} reducedMotion={reducedMotion} label={t("game.learn.score.row.lastTrick")} value={`+${LAST_TRICK}`} />
                    <Line index={2} reducedMotion={reducedMotion} strong label={t("game.learn.score.row.deal")} value={String(deal)} />
                </Panel>
                <Text textAlign="center" fontWeight="semibold">{t("game.learn.score.ex.total", { total: deal })}</Text>
            </VStack>
        )
    }

    const written = scoreManualDeal(example.deal).total.us
    return (
        <VStack gap="3" align="stretch">
            <Panel>
                <Line index={0} reducedMotion={reducedMotion} label={t("game.learn.score.row.deal")} value={String(deal)} />
                <Line index={1} reducedMotion={reducedMotion} label={t("game.learn.score.row.stiglja")} value={`+${written - deal}`} />
                <Line index={2} reducedMotion={reducedMotion} strong label={t("game.learn.score.row.written")} value={String(written)} />
            </Panel>
            <Text textAlign="center" fontWeight="semibold">
                {t("game.learn.score.ex.stiglja", { deal, bonus: written - deal, total: written })}
            </Text>
        </VStack>
    )
}

function Asked({ question, reducedMotion, onDone }: { question: Question; reducedMotion: boolean; onDone: () => void }) {
    const { t } = useTranslation()
    const { outcome, collected } = useDeal(question.deal)
    const deal = DEAL_POINTS
    const [done, setDone] = useState(false)
    const [pulse, setPulse] = useState(0)
    const [feedback, setFeedback] = useState<Feedback | null>(null)
    const declared = outcome.declarations.us + outcome.declarations.them
    const written = outcome.total.us

    // Before the answer: what each side COLLECTED. After it: what is written
    // down — which is where a fall shows as 0 against everything.
    const shown = done ? outcome.total : question.kind === "written" ? { us: deal, them: 0 } : collected

    const finish = (text: string) => {
        setFeedback({ tone: "right", text })
        setDone(true)
        onDone()
    }

    const answerVerdict = (fell: boolean) => {
        if (done) return
        setPulse((n) => n + 1)
        const explain = outcome.fell
            ? t("game.learn.score.fell", { us: collected.us, them: collected.them, total: outcome.total.them })
            : t("game.learn.score.passed", { us: outcome.total.us, them: outcome.total.them })
        if (fell === outcome.fell) finish(explain)
        else setFeedback({ tone: "wrong", text: t("game.learn.score.compare") })
    }

    const answerWritten = (value: number) => {
        if (done) return
        setPulse((n) => n + 1)
        if (value === written) finish(t("game.learn.score.ex.stiglja", { deal, bonus: written - deal, total: written }))
        else setFeedback({ tone: "wrong", text: t("game.learn.score.stigljaHint", { deal }) })
    }

    return (
        <VStack gap="3" align="stretch">
            <Box rounded="l3" bg="bg.subtle" borderWidth="1px" borderColor="border.subtle" px="4" py="3">
                <Text fontSize="sm" color="fg.muted" textAlign="center" mb="2">{t(question.intro)}</Text>
                <HStack justify="space-between" mb="2">
                    <Side label={t("game.score.us")} value={shown.us} align="start" />
                    {declared > 0 && !done && (
                        <Text fontSize="xs" fontWeight="bold" color="gold">
                            {t("game.learn.score.withDeclaration", { cards: question.deal.cards.us, points: declared })}
                        </Text>
                    )}
                    <Side label={t("game.score.them")} value={shown.them} align="end" />
                </HStack>
                <Bar us={shown.us} them={shown.them} reducedMotion={reducedMotion} />
            </Box>

            <Text textAlign="center" fontSize="lg" fontWeight="bold">
                {t(question.kind === "verdict" ? "game.learn.score.task.verdict" : "game.learn.score.task.written")}
            </Text>

            <HStack justify="center" gap="2" wrap="wrap">
                {question.kind === "verdict" ? (
                    <>
                        <Button variant="outline" colorPalette="brand" disabled={done} onClick={() => answerVerdict(false)}>
                            {t("game.deal.wePassed")}
                        </Button>
                        <Button variant="outline" colorPalette="brand" disabled={done} onClick={() => answerVerdict(true)}>
                            {t("game.deal.weFell")}
                        </Button>
                    </>
                ) : (
                    // The deal alone, the deal plus the last trick counted
                    // twice, and the deal plus the štiglja bonus.
                    [deal, deal + LAST_TRICK, written].map((value) => (
                        <Button key={value} variant="outline" colorPalette="brand" fontFamily="mono" disabled={done}
                            onClick={() => answerWritten(value)}>
                            {value}
                        </Button>
                    ))
                )}
            </HStack>

            <LessonFeedback feedback={feedback} pulse={pulse} reducedMotion={reducedMotion} />
        </VStack>
    )
}

export default function ScoringLesson({ onSolved, reducedMotion }: LessonProps) {
    const { t } = useTranslation()
    const [asking, setAsking] = useState(false)

    if (asking) {
        return (
            <Tasks count={QUESTIONS.length} reducedMotion={reducedMotion} onSolved={onSolved} onReview={() => setAsking(false)}>
                {(index, done) => (
                    <Asked question={QUESTIONS[index] ?? QUESTIONS[0]} reducedMotion={reducedMotion} onDone={done} />
                )}
            </Tasks>
        )
    }

    return (
        <VStack gap="3" align="stretch">
            <Text textAlign="center" color="fg.muted">{t("game.learn.score.intro")}</Text>
            <Examples count={EXAMPLES.length} reducedMotion={reducedMotion} onDone={() => setAsking(true)}>
                {(index) => <Shown example={EXAMPLES[index] ?? EXAMPLES[0]} reducedMotion={reducedMotion} />}
            </Examples>
        </VStack>
    )
}
