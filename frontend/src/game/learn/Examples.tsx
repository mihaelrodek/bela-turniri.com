import { useState, type ReactNode } from "react"
import { Box, Button, HStack, Text, VStack } from "@chakra-ui/react"
import { FiArrowLeft, FiArrowRight } from "react-icons/fi"
import { useTranslation } from "../../i18n"
import { RISE } from "./motion"

/* ──────────────────────────────────────────────────────────────────────────
   Examples — the part of a lesson that SHOWS (2026-09-29, owner's rule after
   trying the first version: "the tutorial asks before it teaches").

   Every lesson opens with worked examples — real cards, who played what,
   which card takes it, one short line of why — stepped through one at a
   time. Only the button after the last example leads to the tasks, so a
   learner is never asked about something they have not been shown.

   `StepDots` is the same row of numbers the tasks use, so "example 2 of 3"
   and "task 2 of 3" read alike.
   ────────────────────────────────────────────────────────────────────── */

export function StepDots({ count, index }: { count: number; index: number }) {
    return (
        <HStack justify="center" gap="1.5" aria-hidden="true">
            {Array.from({ length: count }, (_, i) => (
                <Text key={i} fontSize="xs" fontFamily="mono" fontWeight="bold"
                    color={i === index ? "brand.fg" : i < index ? "ok" : "fg.subtle"}>
                    {i + 1}
                </Text>
            ))}
        </HStack>
    )
}

/** The badge that says which half of the lesson this is. */
export function PhaseLabel({ kind, index, count }: { kind: "example" | "task"; index: number; count: number }) {
    const { t } = useTranslation()
    return (
        <Text
            textAlign="center"
            fontSize="xs"
            fontWeight="bold"
            textTransform="uppercase"
            letterSpacing="wider"
            color={kind === "example" ? "gold" : "brand.fg"}
        >
            {t(kind === "example" ? "game.learn.exampleOf" : "game.learn.taskOf", { n: index + 1, total: count })}
        </Text>
    )
}

export default function Examples({
    count,
    reducedMotion,
    onDone,
    children,
}: {
    count: number
    reducedMotion: boolean
    /** The learner has seen the last example and asks for the tasks. */
    onDone: () => void
    /** Renders example `index`. */
    children: (index: number) => ReactNode
}) {
    const { t } = useTranslation()
    const [index, setIndex] = useState(0)
    const last = index === count - 1

    return (
        <VStack gap="3" align="stretch">
            <PhaseLabel kind="example" index={index} count={count} />
            <Box key={index} css={reducedMotion ? undefined : { animation: `${RISE} 240ms ease-out` }}>
                {children(index)}
            </Box>
            <HStack justify="center" gap="2">
                {index > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setIndex(index - 1)}>
                        <FiArrowLeft /> {t("game.learn.prevExample")}
                    </Button>
                )}
                <Button
                    size="sm"
                    colorPalette="brand"
                    variant={last ? "solid" : "outline"}
                    onClick={() => (last ? onDone() : setIndex(index + 1))}
                >
                    {t(last ? "game.learn.toTasks" : "game.learn.nextExample")} <FiArrowRight />
                </Button>
            </HStack>
        </VStack>
    )
}
