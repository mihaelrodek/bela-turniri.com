import { useState, type ReactNode } from "react"
import { Box, Button, VStack } from "@chakra-ui/react"
import { FiArrowRight } from "react-icons/fi"
import { useTranslation } from "../../i18n"
import { PhaseLabel } from "./Examples"
import { RISE } from "./motion"

/* ──────────────────────────────────────────────────────────────────────────
   Tasks — the part of a lesson that ASKS, after `Examples` has shown
   (2026-09-29). One task at a time; "Sljedeći zadatak" appears once the
   current one is answered, and the last answer reports the lesson solved.
   ────────────────────────────────────────────────────────────────────── */

export default function Tasks({
    count,
    reducedMotion,
    onSolved,
    onReview,
    children,
}: {
    count: number
    reducedMotion: boolean
    /** The last task was answered. */
    onSolved: () => void
    /** Back to the examples — always offered, nobody is stuck on a task. */
    onReview: () => void
    /** Renders task `index`; call `done` when it is answered. */
    children: (index: number, done: () => void) => ReactNode
}) {
    const { t } = useTranslation()
    const [index, setIndex] = useState(0)
    const [answered, setAnswered] = useState(false)
    const last = index === count - 1

    return (
        <VStack gap="3" align="stretch">
            <PhaseLabel kind="task" index={index} count={count} />
            <Box key={index} css={reducedMotion ? undefined : { animation: `${RISE} 240ms ease-out` }}>
                {children(index, () => {
                    setAnswered(true)
                    if (last) onSolved()
                })}
            </Box>
            <VStack gap="1">
                {answered && !last && (
                    <Button
                        size="sm"
                        colorPalette="brand"
                        onClick={() => {
                            setAnswered(false)
                            setIndex(index + 1)
                        }}
                    >
                        {t("game.learn.nextTask")} <FiArrowRight />
                    </Button>
                )}
                <Button size="xs" variant="ghost" color="fg.muted" onClick={onReview}>
                    {t("game.learn.review")}
                </Button>
            </VStack>
        </VStack>
    )
}
