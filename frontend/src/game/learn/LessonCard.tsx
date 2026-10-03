import { Box, Text } from "@chakra-ui/react"
import { FiCheck, FiX } from "react-icons/fi"
import type { Card } from "@bela/engine"
import PlayingCard from "../components/PlayingCard"
import type { CardSize } from "../util/cards"
import { HINT_GLOW, POP, POP_MS, RISE, SHAKE, SHAKE_MS } from "./motion"

/* ──────────────────────────────────────────────────────────────────────────
   LessonCard — the table's own `PlayingCard` with what a lesson adds around
   it (2026-09-29): a right/wrong mark, a pop or a shake, the coach's gold
   ring, and an optional caption underneath.

   The card itself is untouched, so what a learner taps here is drawn by the
   same component, in the same deck, as the card they will hold at the table.
   ────────────────────────────────────────────────────────────────────── */

export type LessonMark = "right" | "wrong" | null

export default function LessonCard({
    card,
    size = "sm",
    mark = null,
    pulse = 0,
    hinted = false,
    selected = false,
    dimmed = false,
    raised = false,
    caption,
    actionHint,
    stableRoot = false,
    disabled = false,
    reducedMotion,
    onSelect,
}: {
    card: Card
    size?: CardSize
    mark?: LessonMark
    /** Bumped by the parent on every answer, so a second wrong tap on the
     *  same card shakes again instead of reusing the finished animation. */
    pulse?: number
    /** The coach's suggestion. */
    hinted?: boolean
    selected?: boolean
    dimmed?: boolean
    raised?: boolean
    caption?: string
    actionHint?: string
    /** Passed through to `PlayingCard` — the practice hand keeps one element
     *  per card for its whole life, exactly as the table's hand does. */
    stableRoot?: boolean
    disabled?: boolean
    reducedMotion: boolean
    onSelect?: (card: Card) => void
}) {
    const animation =
        reducedMotion || mark === null
            ? undefined
            : mark === "right"
              ? `${POP} ${POP_MS}ms ease-out`
              : `${SHAKE} ${SHAKE_MS}ms ease-in-out`

    return (
        <Box display="flex" flexDirection="column" alignItems="center" gap="1" flexShrink={0}>
            <Box key={`${mark ?? "idle"}-${pulse}`} position="relative" css={{ animation }}>
                <Box
                    rounded="md"
                    // The suggested card is lifted HERE, ring and all —
                    // `PlayingCard`'s own `raised` would move the card out
                    // from under the ring.
                    transform={hinted ? "translateY(-8px)" : undefined}
                    transition={reducedMotion ? "none" : "transform 0.14s ease"}
                    css={
                        hinted
                            ? reducedMotion
                                ? { boxShadow: "0 0 0 2px var(--chakra-colors-gold)" }
                                : { animation: `${HINT_GLOW} 1600ms ease-in-out infinite` }
                            : undefined
                    }
                >
                    <PlayingCard
                        card={card}
                        size={size}
                        selected={selected}
                        dimmed={dimmed}
                        raised={raised}
                        actionHint={actionHint}
                        stableRoot={stableRoot}
                        disabled={disabled}
                        onSelect={onSelect}
                    />
                </Box>
                {mark !== null && (
                    <Box
                        aria-hidden="true"
                        position="absolute"
                        top="-6px"
                        right="-6px"
                        boxSize="22px"
                        rounded="full"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        bg={mark === "right" ? "ok" : "danger"}
                        color="bg.panel"
                        fontSize="14px"
                        borderWidth="2px"
                        borderColor="bg.panel"
                        pointerEvents="none"
                        css={reducedMotion ? undefined : { animation: `${RISE} 180ms ease-out` }}
                    >
                        {mark === "right" ? <FiCheck /> : <FiX />}
                    </Box>
                )}
            </Box>
            {caption !== undefined && (
                <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    color="fg.muted"
                    textAlign="center"
                    lineHeight="1.2"
                    minH="15px"
                    // Wide enough for "Kara ili bundeva" on two lines, narrow
                    // enough that four captions still fit a phone's width.
                    maxW="76px"
                >
                    {caption}
                </Text>
            )}
        </Box>
    )
}
