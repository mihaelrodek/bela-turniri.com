import { useRef } from "react"
import { Box, Grid, Image, VisuallyHidden, useBreakpointValue } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"
import type { Card } from "@bela/protocol"
import type { Phase } from "@bela/engine"
import { useTranslation } from "../../i18n"
import { CARD_INK, CARD_METRICS, sortHandForDisplay, type CardSize } from "../util/cards"
import { useGamePrefs } from "../hooks/useGamePrefs"
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion"
import PlayingCard from "./PlayingCard"
import talonBackImage from "../cards/madjarice/assets/BACK.webp"
import { SHORT } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   Hand — my cards, in a dark tray docked at the bottom of the table.

   Four rules, all of them about not misplaying on a phone:

   1. FIXED SORTED SLOTS. The six cards dealt before bidding occupy the first
      six of eight places and two card backs finish the grid. When the talon
      arrives, all eight cards are sorted again so the new cards move into
      their suit and rank group. From that point on a played card leaves an
      empty slot. The grid therefore never jumps from two rows to one when the
      hand drops from five cards to four.
   2. Legality controls the result of a tap without recommending a move. Every
      card keeps the same full-colour resting appearance and every card is
      clickable during the player's turn. A legal card is played; an illegal
      one explains why it cannot be played. The server validates the same
      engine result again, so an illegal play cannot bypass this UI.
   3. The hand NEVER scrolls sideways. A phone gets four fixed columns in two
      rows; from 48em the same eight fixed slots lay out as ONE ROW (DESIGN
      §6). Eight `md` cards are 618 px and the column is 760 px there, so the
      row fits without shrinking a card — and it hands ~130 px of height back
      to the felt, which on a tablet was the difference between a table and a
      strip of green. The slots are the same eight either way: nothing about
      rule 1 changes, the grid just has a different shape.

      (A same-day 2026-09-18 attempt to widen these one step further —
      `sm`→`md`, `md`→`lg` — broke exactly this fit: eight `lg` cards are
      810 px against a 760-840 px cap, and on a phone the bigger `md` cards
      pushed the two-row hand past its tray. Reverted on user report — this
      is the sizing that actually fits every width it has to.)
   4. It uses one fixed suit/rank order (`sortHandForDisplay`) in every deal.
      Trump never moves a suit, so shuffling cannot change the layout rule.

   Legal and illegal cards deliberately have the same resting appearance.
   Rules are explained only after a player taps an illegal card; the hand
   never visually recommends which move to make.
   ────────────────────────────────────────────────────────────────────── */

/** Card widths from CARD_METRICS. Slot maths must use the size actually drawn. */
const CARD_WIDTH: Record<"sm" | "md", number> = { sm: 56, md: 72 }
/** The gap between two slots, in px. Used in the grid's own width sum. */
const SLOT_GAP = 6
const TALON_SLOT = Symbol("talon-slot")
type HandSlot = Card | typeof TALON_SLOT
type StableHandSlot = HandSlot | null

export default function Hand({
    cards,
    legal,
    phase,
    disabled = false,
    onPlay,
    onInvalidPlay,
}: {
    cards: Card[]
    /** `PlayerView.legalMoves` — empty when it is not our turn. */
    legal: Card[]
    phase: Phase
    /** True while an animation is playing or the connection is down. */
    disabled?: boolean
    onPlay: (card: Card) => void
    onInvalidPlay: (card: Card) => void
}) {
    const { t } = useTranslation()
    const [prefs] = useGamePrefs()
    const reducedMotion = usePrefersReducedMotion() || prefs.reduceMotion
    const cardSize = (useBreakpointValue<CardSize>({ base: "sm", md: "md" }) ?? "sm") as "sm" | "md"
    const cardWidth = CARD_WIDTH[cardSize]
    // One row from the same breakpoint that grows the cards, so the tray only
    // ever has two shapes and they change together.
    const columns = cardSize === "md" ? 8 : 4
    const legalSet = new Set(legal)
    const myTurn = legal.length > 0 && !disabled

    /* Keep the same eight DOM positions throughout play. The only intentional
       rebuild is when bidding ends and the two talon cards become real cards,
       or when a reconnect/new deal introduces cards this layout has never
       seen. Deriving this before paint prevents the intermediate one-row hand
       that an effect-based implementation would briefly render. */
    const layoutRef = useRef<{ bidding: boolean; slots: StableHandSlot[] }>({
        bidding: phase === "BIDDING",
        slots: [],
    })
    const bidding = phase === "BIDDING"
    const previousCards = layoutRef.current.slots.filter(
        (slot): slot is Card => slot !== null && slot !== TALON_SLOT,
    )
    const introducesCards = cards.some((card) => !previousCards.includes(card))
    let slots: StableHandSlot[]

    if (bidding) {
        slots = [
            ...sortHandForDisplay(cards),
            ...Array.from(
                { length: Math.max(0, 8 - cards.length) },
                (): typeof TALON_SLOT => TALON_SLOT,
            ),
        ].slice(0, 8)
    } else if (layoutRef.current.bidding || layoutRef.current.slots.length !== 8 || introducesCards) {
        slots = [
            ...sortHandForDisplay(cards),
            ...Array.from({ length: Math.max(0, 8 - cards.length) }, () => null),
        ].slice(0, 8)
    } else {
        const held = new Set(cards)
        slots = layoutRef.current.slots.map((slot) =>
            slot !== null && slot !== TALON_SLOT && held.has(slot) ? slot : null,
        )
    }
    layoutRef.current = { bidding, slots }

    return (
        <Box
            className="fold-game-hand"
            role="group"
            aria-label={t("game.hand.ariaLabel")}
            bg="transparent"
            rounded="l3"
            borderBottomRadius="0"
            borderBottomWidth="0"
            // Room above for the raised/hover lift, room below for the
            // iPhone home indicator.
            pt="4"
            px="2"
            css={{
                paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
                [SHORT]: { paddingTop: "10px" },
            }}
        >
            {cards.length === 0 && <VisuallyHidden>{t("game.hand.empty")}</VisuallyHidden>}
            <Grid
                className="fold-game-hand-grid"
                templateColumns={`repeat(${columns}, ${cardWidth}px)`}
                alignItems="end"
                gap={`${SLOT_GAP}px`}
                mx="auto"
                css={{
                    width: `${cardWidth * columns + SLOT_GAP * (columns - 1)}px`,
                    maxWidth: "100%",
                }}
            >
                {slots.map((slot, index) => {
                    const card = slot !== TALON_SLOT ? slot : null
                    const isLegal = card !== null && legalSet.has(card)
                    const dealCss =
                        card !== null
                            ? {
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
                                                    transform: "translateY(26px) scale(0.85)",
                                                    opacity: 0,
                                                },
                                                to: {
                                                    transform: "translateY(0) scale(1)",
                                                    opacity: 1,
                                                },
                                            })} 260ms cubic-bezier(0.16,1,0.3,1) backwards`,
                                            animationDelay: `${Math.min(index, 7) * 35}ms`,
                                        }),
                              }
                            : {}
                    return (
                        <Box
                            key={card ?? (slot === TALON_SLOT ? `talon-${index}` : `empty-${index}`)}
                            flexShrink={0}
                            // Every card owns the same full-width slot in the
                            // fixed grid — four columns on a phone, eight from
                            // 48em, the same eight slots either way.
                            css={{
                                width: `${cardWidth}px`,
                                height: prefs.deck === "madjarice" ? "93px" : "84px",
                                "@media (min-width: 48em)": {
                                    height: prefs.deck === "madjarice" ? "120px" : "108px",
                                },
                                borderRadius: "10px",
                                ...dealCss,
                            }}
                            zIndex={index}
                        >
                            {slot === TALON_SLOT ? (
                                <Box
                                    w={`${cardWidth}px`}
                                    h="100%"
                                    rounded={CARD_METRICS[cardSize].radius}
                                    overflow="hidden"
                                    bg={CARD_INK.frame}
                                    borderWidth="0"
                                    p={cardSize === "sm" ? "2px" : "3px"}
                                    aria-hidden="true"
                                >
                                    <Image
                                        src={talonBackImage}
                                        alt=""
                                        w="100%"
                                        h="100%"
                                        display="block"
                                        objectFit="cover"
                                        draggable={false}
                                    />
                                </Box>
                            ) : slot !== null ? (
                                <PlayingCard
                                    card={slot}
                                    size={cardSize}
                                    // During our turn every card is a real
                                    // button. The engine-provided legal set
                                    // decides whether the tap plays it or
                                    // explains why it cannot be played.
                                    disabled={!myTurn}
                                    actionHint={myTurn && !isLegal ? t("game.hand.illegalPlay") : undefined}
                                    onSelect={myTurn ? (isLegal ? onPlay : onInvalidPlay) : undefined}
                                />
                            ) : (
                                <Box
                                    w={`${cardWidth}px`}
                                    h="100%"
                                    rounded={CARD_METRICS[cardSize].radius}
                                    borderWidth="1.5px"
                                    borderColor="rgba(127, 127, 127, 0.55)"
                                    bg="transparent"
                                    aria-hidden="true"
                                />
                            )}
                        </Box>
                    )
                })}
            </Grid>
        </Box>
    )
}
