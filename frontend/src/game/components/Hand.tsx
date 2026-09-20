import { useRef } from "react"
import { Box, Grid, VisuallyHidden, useBreakpointValue } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"
import type { Card } from "@bela/protocol"
import type { Phase } from "@bela/engine"
import { useTranslation } from "../../i18n"
import { CARD_METRICS, MADJARICA_HEIGHT, isHungarianDeck, sortHandForDisplay } from "../util/cards"
import { useGamePrefs } from "../hooks/useGamePrefs"
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion"
import PlayingCard, { CardBack } from "./PlayingCard"
import { SHORT } from "./tableStyles"
import { CARD_WIDTH, HAND_CARD_SIZE, SLOT_GAP, type HandCardSize } from "./handLayout"

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

/** The deal-in movement, created ONCE. `keyframes()` inside render returned a
 *  fresh object on every render; emotion hashes them to the same class so it
 *  never restarted an animation, but it made every hand re-serialise eight
 *  keyframe blocks for nothing. */
const DEAL_IN = keyframes({
    from: { transform: "translateY(26px) scale(0.85)", opacity: 0 },
    to: { transform: "translateY(0) scale(1)", opacity: 1 },
})
/** Stagger between two cards dealing in. */
const DEAL_STEP_MS = 35
const TALON_SLOT = Symbol("talon-slot")
type HandSlot = Card | typeof TALON_SLOT
type StableHandSlot = HandSlot | null

/* ─────────────────────── settled-layout persistence ───────────────────────
   `layoutRef` below is memory-only, so a refresh mid-deal loses it: the
   component remounts with only the REMAINING cards, sorts those, and packs
   them to the left — a card that was slot 7 before the refresh can land in
   slot 3 after it (user report, 2026-09-20). Fix: once per deal, at the
   moment the 8-slot layout is first settled (talon arrives, all 8 still
   held), stash the sorted 8-card order in sessionStorage under a key that
   names the room + deal + seat. A remount for the SAME deal reads it back
   and re-sorts THAT set — `sortHandForDisplay` is a pure function of the
   card SET, not of input order, so recovering the original 8 cards in any
   order and re-sorting reproduces the exact slots a client that never
   refreshed would show. A tab/device that never saw the pristine 8-card
   moment (no stored key, or a currently-held card missing from it) simply
   has nothing to recover and falls back to today's behaviour unchanged. */
const HAND_LAYOUT_PREFIX = "bela:game:hand:"

/** The stored settled order for this deal, or null on ANY miss — no key, a
 *  disabled/private-mode `sessionStorage`, or JSON that isn't a plain string
 *  array. Never throws. */
function readStoredLayout(layoutKey: string): Card[] | null {
    try {
        const raw = sessionStorage.getItem(HAND_LAYOUT_PREFIX + layoutKey)
        if (!raw) return null
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((c) => typeof c !== "string")) return null
        return parsed as Card[]
    } catch {
        return null
    }
}

/** Save this deal's settled order and drop every OTHER stored layout — only
 *  the current deal's key is ever useful again, and old ones (finished
 *  deals, rooms since left) would otherwise sit in `sessionStorage` forever.
 *  Storage failure (quota, private mode) just leaves today's in-memory-only
 *  behaviour in place; it never throws into render. */
function writeStoredLayout(layoutKey: string, order: readonly Card[]): void {
    try {
        const key = HAND_LAYOUT_PREFIX + layoutKey
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const existing = sessionStorage.key(i)
            if (existing && existing.startsWith(HAND_LAYOUT_PREFIX) && existing !== key) {
                sessionStorage.removeItem(existing)
            }
        }
        sessionStorage.setItem(key, JSON.stringify(order))
    } catch {
        // Private mode / quota / storage disabled: nothing to fall back to,
        // and nothing worse than today's behaviour either.
    }
}

export default function Hand({
    cards,
    legal,
    phase,
    layoutKey,
    disabled = false,
    onPlay,
    onInvalidPlay,
}: {
    cards: Card[]
    /** `PlayerView.legalMoves` — empty when it is not our turn. */
    legal: Card[]
    phase: Phase
    /** `${room.id}:${view.dealNo}:${mySeat}` — identifies this deal's slot
     *  layout for sessionStorage. Null for a spectator (no hand of their own
     *  to persist). See the persistence helpers above `Hand`. */
    layoutKey: string | null
    /** True while an animation is playing or the connection is down. */
    disabled?: boolean
    onPlay: (card: Card) => void
    onInvalidPlay: (card: Card) => void
}) {
    const { t } = useTranslation()
    const [prefs] = useGamePrefs()
    const reducedMotion = usePrefersReducedMotion() || prefs.reduceMotion
    const cardSize: HandCardSize = useBreakpointValue<HandCardSize>(HAND_CARD_SIZE) ?? "xs"
    const cardWidth = CARD_WIDTH[cardSize]
    // One row from the same breakpoint that grows the cards, so the tray only
    // ever has two shapes and they change together.
    // Two rows of four on a phone (`xs`/`sm`), one row of eight above it.
    const columns = cardSize === "xs" || cardSize === "sm" ? 4 : 8
    const legalSet = new Set(legal)
    const myTurn = legal.length > 0 && !disabled

    /* The deal-in delay a card was given when it FIRST appeared. It used to be
       `index * 35` read live, so the talon resort — which moves the six cards
       already on the table into their new suit groups — silently rewrote the
       delay of a finished animation on every one of them. Pinning it per card
       means nothing about a settled card's animation ever changes again. */
    const dealDelayRef = useRef(new Map<Card, number>())
    const dealDelay = (card: Card, index: number): number => {
        const known = dealDelayRef.current.get(card)
        if (known !== undefined) return known
        const delay = Math.min(index, 7) * DEAL_STEP_MS
        dealDelayRef.current.set(card, delay)
        return delay
    }

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
        // A NEW deal starts the stagger over: the pinned delays above belong
        // to the cards of the deal that just ended.
        if (introducesCards) dealDelayRef.current.clear()
        slots = [
            ...sortHandForDisplay(cards),
            ...Array.from(
                { length: Math.max(0, 8 - cards.length) },
                (): typeof TALON_SLOT => TALON_SLOT,
            ),
        ].slice(0, 8)
    } else if (layoutRef.current.bidding || layoutRef.current.slots.length !== 8 || introducesCards) {
        // The one moment per deal the 8-slot layout is decided. Try to
        // recover the FULL 8-card set this deal started with — from
        // sessionStorage, in case this is a post-refresh remount that only
        // received the cards still in hand — before falling back to sorting
        // whatever `cards` holds right now (today's behaviour).
        const held = new Set(cards)
        const stored = layoutKey !== null ? readStoredLayout(layoutKey) : null
        const storedCoversHeld = stored !== null && cards.every((card) => stored.includes(card))
        const fullDeal = storedCoversHeld ? sortHandForDisplay(stored) : sortHandForDisplay(cards)
        slots = [
            ...fullDeal,
            ...Array.from({ length: Math.max(0, 8 - fullDeal.length) }, (): null => null),
        ]
            .slice(0, 8)
            .map((slot) => (slot !== null && !held.has(slot) ? null : slot))
        // Only a genuinely pristine hand — all 8 still held, nothing played
        // yet — is worth saving: it is the one point this deal's full card
        // set is known for certain, and the only thing a later refresh needs
        // to find again.
        if (layoutKey !== null && cards.length === 8) {
            writeStoredLayout(layoutKey, slots.filter((slot): slot is Card => slot !== null))
        }
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
            // Room above for the raised/hover lift. NOTHING for the iPhone
            // home indicator: `env(safe-area-inset-bottom)` used to be added
            // here AND on both wrappers below the hand in GameRoomPage, so an
            // installed PWA opened ~70 px of dead space between the cards and
            // the reactions row (reported 2026-09-20). The inset is applied
            // exactly once now, on the LAST element of the column — the
            // reactions/bidding slot.
            pt={{ base: "2", md: "4" }}
            px="2"
            css={{
                paddingBottom: "2px",
                [SHORT]: { paddingTop: "8px" },
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
                                            animation: `${DEAL_IN} 260ms cubic-bezier(0.16,1,0.3,1) backwards`,
                                            animationDelay: `${dealDelay(card, index)}ms`,
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
                                // All three mađarice decks share the taller
                                // 363×585 box; only the French card is short.
                                height: isHungarianDeck(prefs.deck)
                                    ? MADJARICA_HEIGHT[cardSize]
                                    : CARD_METRICS[cardSize].h,
                                borderRadius: "10px",
                                ...dealCss,
                            }}
                            zIndex={index}
                        >
                            {slot === TALON_SLOT ? (
                                // `CardBack` starts CSS-painted and only uses
                                // BACK.webp once that file is decoded, so a
                                // new deal can never show white rectangles
                                // while a raster is being fetched on a phone.
                                <CardBack size={cardSize} deck={prefs.deck} />
                            ) : slot !== null ? (
                                <PlayingCard
                                    card={slot}
                                    size={cardSize}
                                    // ONE element for this card's whole life:
                                    // see `stableRoot` in PlayingCard. Without
                                    // it the hand remounted — and re-faded its
                                    // artwork — on every turn change.
                                    stableRoot
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
