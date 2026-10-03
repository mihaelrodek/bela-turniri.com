import { Box, Grid, useBreakpointValue } from "@chakra-ui/react"
import type { Card, PlayerView } from "@bela/engine"
import { useTranslation } from "../../i18n"
import { CardBack } from "../components/PlayingCard"
import { CARD_WIDTH, HAND_CARD_SIZE, SLOT_GAP, type HandCardSize } from "../components/handLayout"
import { SHORT } from "../components/tableStyles"
import { useGamePrefs } from "../hooks/useGamePrefs"
import { CARD_METRICS, MADJARICA_HEIGHT, isHungarianDeck, sortHandForDisplay } from "../util/cards"
import LessonCard from "./LessonCard"
import { RISE } from "./motion"
import type { IllegalTap } from "./usePracticeGame"

/* ──────────────────────────────────────────────────────────────────────────
   PracticeHand — the learner's cards at the practice table (2026-09-29).

   The table's own `Hand` deliberately shows every card the same and never
   recommends a move (see its header): at a real table nobody is told what
   they may play. A learner is, so this is a second hand built from the SAME
   card component with the two things a lesson adds:

     • on the learner's turn the cards the rules forbid are DIMMED — and
       still tappable, because tapping one is how you find out why;
     • the coach's suggestion wears a gold ring.

   ITS GEOMETRY IS `Hand`'s, number for number, from the same module
   (`handLayout.ts`): the card size per breakpoint (`HAND_CARD_SIZE`), the
   slot gap, eight fixed slots in one suit/rank order, four columns in two
   rows on a phone and one row of eight from 48em — and on a phone the grid
   is drawn at `sm` and shown at `--hand-k`, the factor `useTableScale`
   works out from the real screen. So the practice hand is exactly as big as
   the real one on the same device, and it fits for the same reason.

   The eight slots are derived from the view alone: the cards still held
   plus the ones this seat already threw (the completed tricks and the
   current one), sorted.
   ────────────────────────────────────────────────────────────────────── */

export default function PracticeHand({
    view,
    myTurn,
    hinted,
    illegal,
    reducedMotion,
    onPlay,
}: {
    view: PlayerView
    myTurn: boolean
    /** The coach's suggested card, once asked for. */
    hinted: Card | null
    illegal: IllegalTap | null
    reducedMotion: boolean
    onPlay: (card: Card) => void
}) {
    const { t } = useTranslation()
    const [prefs] = useGamePrefs()
    const size: HandCardSize = useBreakpointValue<HandCardSize>(HAND_CARD_SIZE) ?? "sm"
    const columns = size === "sm" ? 4 : 8
    const cardW = CARD_WIDTH[size]
    const cardH = isHungarianDeck(prefs.deck) ? MADJARICA_HEIGHT[size] : CARD_METRICS[size].h

    const seat = view.seat
    const thrown: Card[] = []
    for (const trick of view.trickHistory ?? []) {
        for (const play of trick.plays) if (play.seat === seat) thrown.push(play.card)
    }
    for (const play of view.trick.cards) if (play.seat === seat) thrown.push(play.card)

    const held = new Set(view.hand)
    const bidding = view.phase === "BIDDING"
    const playing = view.phase === "PLAYING"
    const dealt = sortHandForDisplay([...view.hand, ...thrown.filter((card) => !held.has(card))])
    const slots: (Card | "talon" | null)[] = dealt.map((card) => (held.has(card) ? card : null))
    while (slots.length < 8) slots.push(bidding ? "talon" : null)

    const legal = new Set(view.legalMoves)
    const choosing = myTurn && playing

    return (
        <Box
            className="fold-game-hand"
            role="group"
            aria-label={t("game.hand.ariaLabel")}
            // The same paddings as `Hand`: room above for the lifted card,
            // nothing below — the slot under the hand pays for the safe area.
            pt={{ base: "2", md: "4" }}
            px="2"
            css={{ paddingBottom: "2px", [SHORT]: { paddingTop: "8px" } }}
        >
            <Grid
                className="fold-game-hand-grid"
                templateColumns={`repeat(${columns}, ${cardW}px)`}
                gap={`${SLOT_GAP}px`}
                mx="auto"
                alignItems="end"
                css={{
                    width: `${cardW * columns + SLOT_GAP * (columns - 1)}px`,
                    maxWidth: "100%",
                    zoom: columns === 4 ? "var(--hand-k, 1)" : undefined,
                }}
            >
                {slots.slice(0, 8).map((slot, index) => (
                    <Box
                        key={slot === null ? `empty-${index}` : slot === "talon" ? `talon-${index}` : `${view.dealNo}-${slot}`}
                        h={cardH}
                        css={
                            slot === null || slot === "talon" || reducedMotion
                                ? undefined
                                : { animation: `${RISE} 320ms ease-out backwards`, animationDelay: `${index * 45}ms` }
                        }
                    >
                        {slot === "talon" ? (
                            <CardBack size={size} deck={prefs.deck} />
                        ) : slot !== null ? (
                            <LessonCard
                                card={slot}
                                size={size}
                                stableRoot
                                reducedMotion={reducedMotion}
                                disabled={!choosing}
                                dimmed={choosing && !legal.has(slot)}
                                hinted={choosing && hinted === slot}
                                mark={choosing && illegal?.card === slot ? "wrong" : null}
                                pulse={illegal?.n ?? 0}
                                actionHint={choosing && !legal.has(slot) ? t("game.hand.illegalPlay") : undefined}
                                onSelect={choosing ? onPlay : undefined}
                            />
                        ) : (
                            <Box
                                w={`${cardW}px`}
                                h="100%"
                                rounded={CARD_METRICS[size].radius}
                                borderWidth="1.5px"
                                borderColor="border.emphasized"
                                bg="transparent"
                                aria-hidden="true"
                            />
                        )}
                    </Box>
                ))}
            </Grid>
        </Box>
    )
}
