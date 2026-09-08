import { useRef } from "react"
import { Box, Flex, Text, useBreakpointValue } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"
import type { Card } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import { sortHandForDisplay, type CardSize } from "../util/cards"
import { useGamePrefs } from "../hooks/useGamePrefs"
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion"
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
   2. Legality controls interaction without recommending a move. Every card
      keeps the same full-colour resting appearance; only cards contained in
      `PlayerView.legalMoves` respond to a tap. The server validates the same
      engine result again, so an illegal play cannot bypass this UI.
   3. The row NEVER scrolls sideways. On a narrow screen the slots tighten
      and the cards overlap instead; the visible slice of each is its tap
      target and it never falls below ~42 px (a 360 px phone cannot fit eight
      44 px cards, and a card that has scrolled off-screen is worse than a
      slightly narrow one).
   4. It uses one fixed suit/rank order (`sortHandForDisplay`) in every deal.
      Trump never moves a suit, so shuffling cannot change the layout rule.
   ────────────────────────────────────────────────────────────────────── */

/** Card widths from CARD_METRICS. Slot maths must use the size actually drawn. */
const CARD_WIDTH: Record<"sm" | "md", number> = { sm: 56, md: 72 }

/* Fan geometry — purely a paint-time transform (rotate + a couple of px of
   translateY), never touches the slot's actual box size, so it cannot
   change a tap target or fight the "never re-flow" contract above. Cards
   read as a hand of real cards standing in a fan rather than a flat row of
   tiles touching edge to edge; the further a card sits from the centre, the
   more it tilts and the lower it sits, hinged from its own bottom edge. */
const FAN_ANGLE_STEP = 3.1
const FAN_ANGLE_MAX = 12
const FAN_ARC_STEP = 2.4

function fanTransform(index: number, count: number, compact: boolean): { angle: number; arc: number } {
    if (count <= 1) return { angle: 0, arc: 0 }
    const rel = index - (count - 1) / 2
    const angleStep = compact ? 1.7 : FAN_ANGLE_STEP
    const angleMax = compact ? 6 : FAN_ANGLE_MAX
    const arcStep = compact ? 1.4 : FAN_ARC_STEP
    const angle = Math.max(-angleMax, Math.min(angleMax, rel * angleStep))
    return { angle, arc: Math.abs(rel) * arcStep }
}

export default function Hand({
    cards,
    legal,
    disabled = false,
    onPlay,
}: {
    cards: Card[]
    /** `PlayerView.legalMoves` — empty when it is not our turn. */
    legal: Card[]
    /** True while an animation is playing or the connection is down. */
    disabled?: boolean
    onPlay: (card: Card) => void
}) {
    const { t } = useTranslation()
    const [prefs] = useGamePrefs()
    const reducedMotion = usePrefersReducedMotion() || prefs.reduceMotion
    const cardSize = (useBreakpointValue<CardSize>({ base: "sm", md: "md" }) ?? "sm") as "sm" | "md"
    const cardWidth = CARD_WIDTH[cardSize]
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
        : sortHandForDisplay(cards)
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
                    const { angle, arc } = fanTransform(index, count, cardSize === "sm")
                    const fanCss =
                        card !== null
                            ? {
                                  transform: `rotate(${angle}deg) translateY(${arc}px)`,
                                  transformOrigin: "bottom center",
                                  // Plays once, on this DOM node's first paint —
                                  // React keys slots by card id, so a card that
                                  // was already in the hand and just moved
                                  // position (a resort) keeps its element and
                                  // never replays this; only a genuinely new
                                  // card (the initial six, or the two dealt
                                  // after bidding) mounts fresh and deals in.
                                  ...(reducedMotion
                                      ? {}
                                      : {
                                            animation: `${keyframes({
                                                from: {
                                                    transform: `rotate(${angle}deg) translateY(${arc + 26}px) scale(0.85)`,
                                                    opacity: 0,
                                                },
                                                to: {
                                                    transform: `rotate(${angle}deg) translateY(${arc}px) scale(1)`,
                                                    opacity: 1,
                                                },
                                            })} 260ms cubic-bezier(0.16,1,0.3,1) backwards`,
                                            animationDelay: `${Math.min(index, 7) * 35}ms`,
                                        }),
                              }
                            : {}
                    return (
                        <Box
                            key={card ?? `empty-${index}`}
                            flexShrink={0}
                            // Every slot but the last one may tighten below
                            // the card's own width, which is what makes the
                            // cards overlap instead of the row scrolling.
                            css={{
                                width: isLast
                                    ? `${cardWidth}px`
                                    : `min(${cardWidth}px, calc((100% - ${cardWidth}px) / ${Math.max(1, count - 1)}))`,
                                ...fanCss,
                            }}
                            // Keep the natural fan order for every card. Legal
                            // cards used to jump above and visually separate
                            // from the rest, which looked like a recommendation.
                            zIndex={index}
                        >
                            {card === null ? (
                                // The gap a played card leaves. It keeps its
                                // BOX — that is the whole "never re-flow"
                                // contract above — but paints nothing: an
                                // outlined ghost of every card already played
                                // turns the tray into a row of empty boxes by
                                // the sixth trick, which is exactly the clutter
                                // the table is trying not to have.
                                <Box
                                    w={`${cardWidth}px`}
                                    h={cardSize === "sm" ? "93px" : "120px"}
                                    aria-hidden="true"
                                />
                            ) : (
                                <PlayingCard
                                    card={card}
                                    size={cardSize}
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
