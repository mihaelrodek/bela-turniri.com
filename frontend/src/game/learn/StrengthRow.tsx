import { Box, Text, useBreakpointValue } from "@chakra-ui/react"
import type { Card } from "@bela/engine"
import PlayingCard from "../components/PlayingCard"
import { CARD_METRICS, MADJARICA_HEIGHT, isHungarianDeck, type CardSize } from "../util/cards"
import { useGamePrefs } from "../hooks/useGamePrefs"
import { JUMP, JUMP_MS, MOVE_EASING, MOVE_MS } from "./motion"

/* ──────────────────────────────────────────────────────────────────────────
   StrengthRow — the eight cards of one suit, laid out strongest first, that
   RE-ORDER THEMSELVES when the order changes (2026-09-29).

   Every card is absolutely placed by a transform computed from its index in
   `order`, and the transform has a transition — so handing the row a new
   order makes each card slide to its new place. That is the whole lesson of
   "in trump the jack and the nine jump to the top": the learner watches
   those two cards leave the middle of the row.

   A phone shows two rows of four, 48em and up one row of eight — the same
   two shapes as the hand tray, for the same reason (eight cards do not fit
   a phone's width).

   `jumping` cards also hop (`JUMP`). The hop is on an INNER box: the slide is
   a transform on the outer one, and two transforms on one element would
   fight.
   ────────────────────────────────────────────────────────────────────── */

const GAP = 8
const LABEL_H = 26

export default function StrengthRow({
    order,
    points,
    jumping = [],
    size,
    reducedMotion,
    ariaLabel,
}: {
    /** The cards, in the order to show them. Same set every render. */
    order: readonly Card[]
    /** Points under each card, or null to show none yet. */
    points: Readonly<Record<string, number>> | null
    jumping?: readonly Card[]
    size: CardSize
    reducedMotion: boolean
    ariaLabel: string
}) {
    const [prefs] = useGamePrefs()
    const columns = useBreakpointValue({ base: 4, md: 8 }) ?? 4
    const cardW = Number.parseInt(CARD_METRICS[size].w, 10)
    const cardH = Number.parseInt(isHungarianDeck(prefs.deck) ? MADJARICA_HEIGHT[size] : CARD_METRICS[size].h, 10)
    const rows = Math.ceil(order.length / columns)
    const width = columns * cardW + (columns - 1) * GAP
    const height = rows * (cardH + LABEL_H) + (rows - 1) * GAP

    // Rendered in a STABLE order (by card id) so React never moves a node:
    // only the transform changes, and that is what the transition animates.
    const stable = order.slice().sort()

    return (
        <Box role="list" aria-label={ariaLabel} position="relative" mx="auto" style={{ width, height }}>
            {stable.map((card) => {
                const index = order.indexOf(card)
                const x = (index % columns) * (cardW + GAP)
                const y = Math.floor(index / columns) * (cardH + LABEL_H + GAP)
                const hops = jumping.includes(card) && !reducedMotion
                return (
                    <Box
                        key={card}
                        role="listitem"
                        // Read in strength order by a screen reader, whatever
                        // the DOM order is.
                        aria-posinset={index + 1}
                        aria-setsize={order.length}
                        position="absolute"
                        top="0"
                        left="0"
                        zIndex={hops ? 2 : 1}
                        style={{ transform: `translate(${x}px, ${y}px)` }}
                        transition={reducedMotion ? "none" : `transform ${MOVE_MS}ms ${MOVE_EASING}`}
                    >
                        <Box css={hops ? { animation: `${JUMP} ${JUMP_MS}ms ease-out` } : undefined}>
                            <PlayingCard card={card} size={size} />
                        </Box>
                        <Text
                            h={`${LABEL_H}px`}
                            lineHeight={`${LABEL_H}px`}
                            textAlign="center"
                            fontFamily="mono"
                            fontWeight="bold"
                            fontSize="sm"
                            fontVariantNumeric="tabular-nums"
                            color={points !== null && (points[card] ?? 0) > 0 ? "fg" : "fg.subtle"}
                        >
                            {points !== null ? (points[card] ?? 0) : ""}
                        </Text>
                    </Box>
                )
            })}
        </Box>
    )
}
