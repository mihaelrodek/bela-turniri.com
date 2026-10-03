import { useState, type ComponentType } from "react"
import { Link } from "react-router-dom"
import { Box, Button, Flex, HStack, Heading, Text, VStack, useBreakpointValue } from "@chakra-ui/react"
import { FiArrowLeft, FiArrowRight, FiPlay, FiX } from "react-icons/fi"
import { useDocumentHead } from "../../hooks/useDocumentHead"
import { useTranslation } from "../../i18n"
import { gameLobbyPath } from "../../site"
import BiddingLesson from "./lessons/BiddingLesson"
import DeclarationsLesson from "./lessons/DeclarationsLesson"
import FollowLesson from "./lessons/FollowLesson"
import PlainStrengthLesson from "./lessons/PlainStrengthLesson"
import ScoringLesson from "./lessons/ScoringLesson"
import SuitsLesson from "./lessons/SuitsLesson"
import TrickLesson from "./lessons/TrickLesson"
import TrumpStrengthLesson from "./lessons/TrumpStrengthLesson"
import type { LessonProps } from "./lessons/types"
import { RISE, useLearnReducedMotion } from "./motion"
import PracticeGame from "./PracticeGame"

/* ──────────────────────────────────────────────────────────────────────────
   GameLearnPage (/igra/ucenje) — "Nauči kartati belu" (2026-09-29, owner
   request).

   Eight short lessons, one screen each, then one practice game against
   three bots. Reached from the first-run question in the lobby
   (`LearnPromptDialog`) and from "Nauči kartati belu" in the game settings.

   Everything runs in the browser: no socket is opened, no room is created
   and nothing is recorded — the page works with the game server down, and
   offline once its chunk is cached. That is also why it sits behind the
   game's kill switch (`GameFeatureGate`) but NOT behind the identity gate:
   there is nobody to identify to.

   EVERY LESSON SHOWS BEFORE IT ASKS (owner's rule, 2026-09-29): worked
   examples first (`Examples`), tasks only after the last of them (`Tasks`),
   and never a question about something not yet shown. Text stays at one or
   two short sentences. "Dalje" is always available — nobody is
   held on a lesson they already know — and turns solid once the lesson's
   last task is answered. "Preskoči na partiju" goes straight to the table.
   ────────────────────────────────────────────────────────────────────── */

const LESSONS: readonly { id: string; Lesson: ComponentType<LessonProps> }[] = [
    { id: "suits", Lesson: SuitsLesson },
    { id: "plain", Lesson: PlainStrengthLesson },
    { id: "trump", Lesson: TrumpStrengthLesson },
    { id: "trick", Lesson: TrickLesson },
    { id: "follow", Lesson: FollowLesson },
    { id: "bid", Lesson: BiddingLesson },
    { id: "decl", Lesson: DeclarationsLesson },
    { id: "score", Lesson: ScoringLesson },
]

export default function GameLearnPage() {
    const { t } = useTranslation()
    const reducedMotion = useLearnReducedMotion()
    const cardSize = useBreakpointValue<"sm" | "md">({ base: "sm", md: "md" }) ?? "sm"
    const [step, setStep] = useState(0)
    const [practice, setPractice] = useState(false)
    const [solved, setSolved] = useState<readonly string[]>([])
    /** Bumped to restart the lessons from a clean slate. */
    const [run, setRun] = useState(0)

    useDocumentHead({ title: t("game.learn.metaTitle"), description: t("game.learn.metaDescription") })

    const current = LESSONS[step] ?? LESSONS[0]
    const isSolved = solved.includes(current.id)
    const isLast = step === LESSONS.length - 1
    const Lesson = current.Lesson

    const startPractice = () => {
        setPractice(true)
        window.scrollTo({ top: 0 })
    }
    const go = (to: number) => {
        setStep(to)
        window.scrollTo({ top: 0 })
    }

    /* The practice game is a table, not a page: it sizes itself to the
       viewport and brings its own way out (see `PracticeGame`). */
    if (practice) {
        return (
            <PracticeGame
                reducedMotion={reducedMotion}
                onLessons={() => {
                    setPractice(false)
                    setSolved([])
                    setRun((n) => n + 1)
                    go(0)
                }}
            />
        )
    }

    return (
        // No tab bar on this route (MobileTabBar hides), so only the safe
        // area is left to clear at the bottom.
        <Box maxW="820px" mx="auto" css={{ paddingBottom: "calc(16px + var(--safe-bottom))" }}>
            <VStack gap="3" align="stretch">
                <HStack justify="space-between" gap="2">
                    <Heading as="h1" size={{ base: "md", md: "lg" }} fontFamily="heading" minW="0" lineClamp={1}>
                        {t("game.learn.title")}
                    </Heading>
                    <HStack gap="1" flexShrink={0}>
                        <Button size="sm" variant="ghost" onClick={startPractice}>
                            <FiPlay /> {t("game.learn.skipToPractice")}
                        </Button>
                        <Button asChild size="sm" variant="ghost" aria-label={t("game.learn.exit")} title={t("game.learn.exit")} px="2">
                            <Link to={gameLobbyPath}><FiX /></Link>
                        </Button>
                    </HStack>
                </HStack>

                <>
                        {/* Progress: one segment per lesson. A number says
                            where you are, the segments say how far it is. */}
                        <Box>
                            <HStack
                                gap="1"
                                role="progressbar"
                                aria-valuemin={1}
                                aria-valuemax={LESSONS.length}
                                aria-valuenow={step + 1}
                                aria-label={t("game.learn.progress", { n: step + 1, total: LESSONS.length })}
                            >
                                {LESSONS.map((lesson, i) => (
                                    <Box
                                        key={lesson.id}
                                        flex="1"
                                        h="6px"
                                        rounded="full"
                                        bg={i < step || solved.includes(lesson.id) ? "brand.solid" : i === step ? "brand.emphasized" : "bg.muted"}
                                        transition={reducedMotion ? "none" : "background 240ms ease"}
                                    />
                                ))}
                            </HStack>
                            <Text mt="1" fontSize="xs" color="fg.muted">
                                {t("game.learn.progress", { n: step + 1, total: LESSONS.length })}
                            </Text>
                        </Box>

                        <Box
                            // A new lesson is a new subtree: its tasks start
                            // over, and the panel rises in.
                            key={`${run}-${current.id}`}
                            rounded="l3"
                            bg="bg.panel"
                            borderWidth="1px"
                            borderColor="border.subtle"
                            shadow="card"
                            px={{ base: "3", md: "6" }}
                            py={{ base: "4", md: "5" }}
                            css={reducedMotion ? undefined : { animation: `${RISE} 260ms ease-out` }}
                        >
                            <Heading as="h2" size={{ base: "lg", md: "xl" }} fontFamily="heading" textAlign="center" mb="3">
                                {t(`game.learn.${current.id}.title`)}
                            </Heading>
                            <Lesson
                                reducedMotion={reducedMotion}
                                cardSize={cardSize}
                                onSolved={() => setSolved((cur) => (cur.includes(current.id) ? cur : [...cur, current.id]))}
                            />
                        </Box>

                        <Flex justify="space-between" gap="2">
                            <Button variant="outline" disabled={step === 0} onClick={() => go(step - 1)}>
                                <FiArrowLeft /> {t("game.learn.back")}
                            </Button>
                            <Button
                                colorPalette="brand"
                                variant={isSolved ? "solid" : "outline"}
                                onClick={() => (isLast ? startPractice() : go(step + 1))}
                            >
                                {isLast ? t("game.learn.toPractice") : t("game.learn.next")} <FiArrowRight />
                            </Button>
                        </Flex>
                </>
            </VStack>
        </Box>
    )
}
