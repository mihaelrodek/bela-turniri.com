import { useRef } from "react"
import { Box, Flex, Text } from "@chakra-ui/react"
import type { Card, Suit } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import { sortHandForDisplay } from "../util/cards"
import PlayingCard from "./PlayingCard"
import { GLASS, INK_MUTED, SHORT } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   Hand — my cards, in a dark tray docked at the bottom of the table.

   Four rules, all of them about not misplaying on a phone:

   1. FIXED SLOTS. The layout is decided when a hand is dealt (and again when
      the last two cards arrive after the bidding) and never re-flows: a card
      you play leaves an EMPTY SLOT behind. Cards that shuffle themselves
      left after every trick are how a player's thumb lands on the wrong one
      — muscle memory over tidiness (game/DESIGN.md §2.4).
   2. Legality is VISUAL, not a rejection. Legal cards sit raised and are
      tappable; illegal ones stay in place, dimmed and inert — you can still
      see what you hold (which matters for planning) but you cannot throw a
      card the server would bounce. `legal` comes straight from
      `PlayerView.legalMoves`, so the client never re-derives the rules.
   3. The row NEVER scrolls sideways. On a narrow screen the slots tighten
      and the cards overlap instead; the visible slice of each is its tap
      target and it never falls below ~42 px (a 360 px phone cannot fit eight
      44 px cards, and a card that has scrolled off-screen is worse than a
      slightly narrow one).
   4. It is sorted by suit with trump first (`sortHandForDisplay`) and never
      re-sorted mid-deal.
   ────────────────────────────────────────────────────────────────────── */

/** Card width at `size="md"` — the slot maths has to agree with it. */
const CARD_W = 48

export default function Hand({
    cards,
    legal,
    trump,
    disabled = false,
    onPlay,
}: {
    cards: Card[]
    /** `PlayerView.legalMoves` — empty when it is not our turn. */
    legal: Card[]
    trump: Suit | null
    /** True while an animation is playing or the connection is down. */
    disabled?: boolean
    onPlay: (card: Card) => void
}) {
    const { t } = useTranslation()
    const legalSet = new Set(legal)
    const myTurn = legal.length > 0 && !disabled

    /* The slot layout, derived during render from the previous one.
       Cheaper and less racy than an effect: while the hand is a SUBSET of
       what the layout already holds, played cards simply become gaps; the
       moment a card appears that the layout does not know (a new deal, or
       the two cards dealt after the bidding) the whole thing is rebuilt
       sorted. Idempotent, so StrictMode's double render is a no-op. */
    const layoutRef = useRef<(Card | null)[]>([])
    const held = new Set(cards)
    const kept = layoutRef.current.filter((c): c is Card => c !== null)
    const known = kept.length > 0 && cards.every((card) => kept.includes(card))
    const slots = known
        ? layoutRef.current.map((card) => (card !== null && held.has(card) ? card : null))
        : sortHandForDisplay(cards, trump)
    layoutRef.current = slots

    if (cards.length === 0) {
        return (
            <Flex justify="center" align="center" minH="56px" px="4">
                <Text fontSize="xs" color={INK_MUTED}>{t("game.hand.empty")}</Text>
            </Flex>
        )
    }

    const count = slots.length

    return (
        <Box
            role="group"
            aria-label={t("game.hand.ariaLabel")}
            {...GLASS}
            rounded="l3"
            borderBottomRadius="0"
            borderBottomWidth="0"
            // Room above for the raised/hover lift, room below for the
            // iPhone home indicator.
            pt="4"
            px="2"
            css={{
                ...GLASS.css,
                paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
                [SHORT]: { paddingTop: "10px" },
            }}
        >
            <Flex justify="center" align="flex-end">
                {slots.map((card, index) => {
                    const isLegal = card !== null && legalSet.has(card)
                    const isLast = index === count - 1
                    return (
                        <Box
                            key={card ?? `empty-${index}`}
                            flexShrink={0}
                            // Every slot but the last one may tighten below
                            // the card's own width, which is what makes the
                            // cards overlap instead of the row scrolling.
                            css={{
                                width: isLast
                                    ? `${CARD_W}px`
                                    : `min(${CARD_W}px, calc((100% - ${CARD_W}px) / ${Math.max(1, count - 1)}))`,
                            }}
                            zIndex={isLegal ? count + index : index}
                        >
                            {card === null ? (
                                // The gap a played card leaves: a faint
                                // outline, so the hand keeps its shape and
                                // you can see how far through the deal you
                                // are without counting.
                                <Box
                                    w={`${CARD_W}px`}
                                    h="68px"
                                    rounded="md"
                                    borderWidth="1px"
                                    borderStyle="dashed"
                                    borderColor="brand.700/70"
                                    opacity={0.5}
                                    aria-hidden="true"
                                />
                            ) : (
                                <PlayingCard
                                    card={card}
                                    size="md"
                                    raised={myTurn && isLegal}
                                    dimmed={myTurn && !isLegal}
                                    disabled={!myTurn || !isLegal}
                                    onSelect={myTurn && isLegal ? onPlay : undefined}
                                />
                            )}
                        </Box>
                    )
                })}
            </Flex>
        </Box>
    )
}
