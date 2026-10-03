import { Box, HStack, Text } from "@chakra-ui/react"
import { FiCheckCircle, FiInfo, FiRotateCcw } from "react-icons/fi"
import { RISE } from "./motion"

/* ──────────────────────────────────────────────────────────────────────────
   LessonFeedback — the one line under a task that answers the last tap
   (2026-09-29). Right is teal (`ok`, the app's success colour), a wrong
   answer is the warm `live` orange with a "try again" mark rather than red:
   nothing here is an error, it is a lesson. The row keeps its height while
   empty, so the task above it never jumps when the first answer lands.
   ────────────────────────────────────────────────────────────────────── */

export type FeedbackTone = "right" | "wrong" | "info"

export interface Feedback {
    tone: FeedbackTone
    text: string
}

const SKIN: Record<FeedbackTone, { color: string; bg: string }> = {
    right: { color: "ok", bg: "ok.subtle" },
    wrong: { color: "live", bg: "live.subtle" },
    info: { color: "fg.muted", bg: "bg.subtle" },
}

export default function LessonFeedback({
    feedback,
    pulse = 0,
    reducedMotion,
}: {
    feedback: Feedback | null
    /** Bumped per answer so the same sentence twice still re-announces. */
    pulse?: number
    reducedMotion: boolean
}) {
    return (
        <Box minH="44px" display="flex" alignItems="center" justifyContent="center" aria-live="polite" aria-atomic="true">
            {feedback !== null && (
                <HStack
                    key={pulse}
                    gap="2"
                    px="3"
                    py="2"
                    rounded="l2"
                    bg={SKIN[feedback.tone].bg}
                    color={SKIN[feedback.tone].color}
                    maxW="100%"
                    css={reducedMotion ? undefined : { animation: `${RISE} 220ms ease-out` }}
                >
                    <Box flexShrink={0} display="inline-flex" fontSize="18px" aria-hidden="true">
                        {feedback.tone === "right" ? <FiCheckCircle /> : feedback.tone === "wrong" ? <FiRotateCcw /> : <FiInfo />}
                    </Box>
                    <Text fontSize="sm" fontWeight="semibold" color="fg" lineHeight="1.3">
                        {feedback.text}
                    </Text>
                </HStack>
            )}
        </Box>
    )
}
