import { useLayoutEffect, useRef } from "react"
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
import { CARD_WIDTH, FAN_EXPOSURE, FAN_HANG, FAN_PAD_TOP, HAND_CARD_SIZE, SLOT_GAP, type HandCardSize } from "./handLayout"

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

   THE FAN (`layout="fan"`, 2026-10-12, owner — the landscape table). The
   same eight slots, the same rules 1, 2 and 4, a different shape: one row
   whose grid cells are `FAN_EXPOSURE` of a card wide, so each card overlaps
   the next and only its left strip shows; the slots lean −6°…+6° about
   their bottom edge and sink on a shallow curve toward the ends, like a hand
   actually held — flatter and wider since the fourth pass (2026-10-12,
   owner: the first cut was "strongly curved" and the cards "narrow"), and
   since the eighth pass (2026-10-12, owner: "hard to tap") nearly straight,
   each card's strip 85 % of it, and sunk `FAN_HANG` px past the bottom
   edge of the screen — only the cards' feet, never the rank and suit in
   their top corners. Drawn at `sm` and zoomed by `--hand-k` like the phone
   grid.
   Rule 2 holds here too (2026-10-12, owner, second pass): a legal card
   looks exactly like the others — the first cut lifted it and that was a
   recommendation. The fan's lean lives on a wrapper OUTSIDE the slot that
   animates, so the deal-in and the FLIP never fight the resting angle.

   Legal and illegal cards deliberately have the same resting appearance.
   Rules are explained only after a player taps an illegal card; the hand
   never visually recommends which move to make.
   ────────────────────────────────────────────────────────────────────── */

/** The deal-in movement, created ONCE. `keyframes()` inside render returned a
 *  fresh object on every render; emotion hashes them to the same class so it
 *  never restarted an animation, but it made every hand re-serialise eight
 *  keyframe blocks for nothing. */
const DEAL_IN = keyframes({
    // Slid up from below the tray with a slight tilt, a hair past its place and
    // back (2026-09-21, user request: the old 26 px / 260 ms rise was over
    // before anybody saw it and the hand read as static). Still one movement.
    "0%": { transform: "translateY(44px) rotate(-5deg) scale(0.9)", opacity: 0 },
    "70%": { transform: "translateY(-4px) rotate(0.6deg) scale(1.01)", opacity: 1 },
    "100%": { transform: "translateY(0) rotate(0deg) scale(1)", opacity: 1 },
})
/** Stagger between two cards dealing in. */
const DEAL_STEP_MS = 60
const DEAL_MS = 420

/** The two TALON cards turning face up (2026-09-21): lifted a little, turned
 *  over about their own vertical axis, then set down into the slot the sort
 *  gave them. The gold ring fades with it so the eye finds the NEW cards among
 *  eight — without it the resort hides which two arrived. Resting style equals
 *  the last frame, as every keyframe in this app must. */
const TALON_IN = keyframes({
    "0%": { transform: "perspective(700px) translateY(-16px) rotateY(88deg) scale(1.05)", opacity: 0.35 },
    "55%": { transform: "perspective(700px) translateY(-12px) rotateY(0deg) scale(1.05)", opacity: 1 },
    "100%": { transform: "perspective(700px) translateY(0) rotateY(0deg) scale(1)", opacity: 1 },
})
const TALON_RING = keyframes({
    "0%": { boxShadow: "0 0 0 0 transparent" },
    "35%": { boxShadow: "0 0 0 2px var(--chakra-colors-gold), 0 6px 18px color-mix(in srgb, var(--chakra-colors-gold) 35%, transparent)" },
    "100%": { boxShadow: "0 0 0 0 transparent" },
})
const TALON_MS = 520
/** The cards already in hand start sliding first; the talon lands after them. */
const TALON_DELAY_MS = 140
const TALON_STEP_MS = 110
/** A card moving to another slot when the hand is re-sorted around the talon. */
const MOVE_MS = 380
const MOVE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)"
/** The fan (landscape): how much of a card shows beside the next one —
 *  `FAN_EXPOSURE` in handLayout.ts, shared with `L_FAN_W` in
 *  hooks/useTableScale.ts. The lean of the outermost slot, in degrees
 *  (linear across the eight), and the sink of the ends (× offset², so
 *  ~1.8 px at the outermost slot). Eighth pass (2026-10-12, owner: the
 *  cards were hard to tap): nearly a straight row — 6° → 2.5°, sink
 *  0.5 → 0.15 — with each strip wider (52 % → 75 % of a card). */
const FAN_MAX_DEG = 2.5
const FAN_SINK_PX = 0.15

export type HandLayout = "grid" | "fan"

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
    hiddenCards,
    onPlay,
    onInvalidPlay,
    layout = "grid",
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
    /** Cards that are OUT of the hand for the moment, their slots kept
     *  (2026-10-11): my declared cards while they lie on the felt during
     *  the reveal, with `CardFlight` carrying a clone there and back. The
     *  slot stays in the grid at full size, invisible — exactly like the
     *  empty slot a played card leaves, so nothing reflows and the page can
     *  still measure where the card belongs (`data-card` on the slot). */
    hiddenCards?: ReadonlySet<Card>
    onPlay: (card: Card) => void
    onInvalidPlay: (card: Card) => void
    /** `grid` (default): 4 × 2 on a phone, 1 × 8 from 48em. `fan`: the
     *  overlapped, arched row of the landscape table (see the header). */
    layout?: HandLayout
}) {
    const { t } = useTranslation()
    const [prefs] = useGamePrefs()
    const reducedMotion = usePrefersReducedMotion() || prefs.reduceMotion
    const fan = layout === "fan"
    const breakpointSize: HandCardSize = useBreakpointValue<HandCardSize>(HAND_CARD_SIZE) ?? "sm"
    // The fan is drawn at `sm` and zoomed (`--hand-k`), whatever the width.
    const cardSize: HandCardSize = fan ? "sm" : breakpointSize
    const cardWidth = CARD_WIDTH[cardSize]
    // One row from the same breakpoint that grows the cards, so the tray only
    // ever has two shapes and they change together.
    const columns = fan ? 8 : cardSize === "sm" ? 4 : 8
    // A fan's grid cell is only the exposed strip; the card overflows it.
    const cellWidth = fan ? Math.round(cardWidth * FAN_EXPOSURE) : cardWidth
    const gap = fan ? 0 : SLOT_GAP
    const gridWidth = cellWidth * (columns - 1) + cardWidth + gap * (columns - 1)
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
    /* Which cards came out of the TALON this deal — they turn face up
       (`TALON_IN`) instead of dealing in from below. Decided at the one render
       where bidding ends, remembered for the node's lifetime, and cleared with
       the next deal. */
    const talonCardsRef = useRef(new Map<Card, number>())
    const bidding = phase === "BIDDING"
    const previousCards = layoutRef.current.slots.filter(
        (slot): slot is Card => slot !== null && slot !== TALON_SLOT,
    )
    const introducesCards = cards.some((card) => !previousCards.includes(card))
    let slots: StableHandSlot[]

    if (bidding) {
        // A NEW deal starts the stagger over: the pinned delays above belong
        // to the cards of the deal that just ended.
        if (introducesCards) {
            dealDelayRef.current.clear()
            talonCardsRef.current.clear()
        }
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
        // Bidding just ended with six cards on the table: whatever is new is
        // the talon. (A reconnect or a refresh has no six to compare with, so
        // nothing is marked and the whole hand simply deals in.)
        if (layoutRef.current.bidding && previousCards.length > 0) {
            let order = 0
            for (const card of sortHandForDisplay(cards)) {
                if (!previousCards.includes(card) && !talonCardsRef.current.has(card)) {
                    talonCardsRef.current.set(card, order++)
                }
            }
        }
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

    /* The re-sort around the talon MOVES the six cards already in hand, and a
       grid does that in one frame — they teleported (2026-09-21, user request:
       "previše statično"). FLIP: every card's wrapper is measured after each
       render; one whose SLOT INDEX changed is put back where it was with a
       transform and released, so it slides to its new place. Keyed on the
       index, not on the rectangle, so a resize, a breakpoint change or the
       `--hand-k` zoom settling never sets the hand sliding. The distance is
       divided by the grid's `zoom`, because a transform inside a zoomed box is
       in unzoomed pixels while the rectangles are not. */
    const gridRef = useRef<HTMLDivElement | null>(null)
    const cardNodes = useRef(new Map<Card, HTMLElement>())
    const lastPlace = useRef(new Map<Card, { index: number; x: number; y: number }>())
    useLayoutEffect(() => {
        const grid = gridRef.current
        if (!grid) return
        const origin = grid.getBoundingClientRect()
        const zoom = Number.parseFloat(getComputedStyle(grid).zoom) || 1
        const next = new Map<Card, { index: number; x: number; y: number }>()
        slots.forEach((slot, index) => {
            if (slot === null || slot === TALON_SLOT) return
            const node = cardNodes.current.get(slot)
            if (!node) return
            const rect = node.getBoundingClientRect()
            const place = { index, x: rect.left - origin.left, y: rect.top - origin.top }
            next.set(slot, place)
            const before = lastPlace.current.get(slot)
            if (!before || before.index === index || reducedMotion) return
            const dx = (before.x - place.x) / zoom
            const dy = (before.y - place.y) / zoom
            if (dx === 0 && dy === 0) return
            node.animate(
                [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
                { duration: MOVE_MS, easing: MOVE_EASING },
            )
        })
        lastPlace.current = next
    })

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
            pt={fan ? "0" : { base: "2", md: "4" }}
            // The grid is centred on the PAGE (2026-09-20, user request — a
            // grid centred in the space right of my avatar read as "sve je
            // previse udesno"). `useTableScale` keeps it narrow enough that
            // the centred grid still clears the avatar docked on the left.
            px="2"
            css={{
                paddingBottom: "2px",
                // The fan has its own room above for the lift; SHORT and
                // the landscape table never meet on one element.
                ...(fan ? { paddingTop: `${FAN_PAD_TOP}px` } : { [SHORT]: { paddingTop: "8px" } }),
            }}
        >
            {cards.length === 0 && <VisuallyHidden>{t("game.hand.empty")}</VisuallyHidden>}
            <Grid
                ref={gridRef}
                className="fold-game-hand-grid"
                templateColumns={`repeat(${columns}, ${cellWidth}px)`}
                alignItems="end"
                gap={`${gap}px`}
                mx="auto"
                css={{
                    width: `${gridWidth}px`,
                    maxWidth: fan ? undefined : "100%",
                    // The phone hand is DRAWN at `sm` and shown at `--hand-k`
                    // (2026-09-20): `zoom`, not `transform`, because the grid
                    // has to take up its scaled size in the layout. A browser
                    // without `zoom` simply keeps the `sm` hand.
                    zoom: columns === 4 || fan ? "var(--hand-k, 1)" : undefined,
                    // The fan's feet hang off the bottom edge (eighth pass,
                    // 2026-10-12): a negative margin INSIDE the zoom, so it
                    // is `FAN_HANG` × `--hand-k` on screen; the felt root's
                    // `overflow: hidden` clips what hangs.
                    marginBottom: fan && FAN_HANG > 0 ? `-${FAN_HANG}px` : undefined,
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
                                      : talonCardsRef.current.has(card)
                                        ? {
                                              animation: `${TALON_IN} ${TALON_MS}ms cubic-bezier(0.22,1,0.36,1) backwards, ${TALON_RING} 1100ms ease-out backwards`,
                                              animationDelay: `${TALON_DELAY_MS + (talonCardsRef.current.get(card) ?? 0) * TALON_STEP_MS}ms`,
                                          }
                                        : {
                                              animation: `${DEAL_IN} ${DEAL_MS}ms cubic-bezier(0.22,1,0.36,1) backwards`,
                                              animationDelay: `${dealDelay(card, index)}ms`,
                                          }),
                              }
                            : {}
                    // The fan's resting pose for this slot: lean about the
                    // bottom edge, sink toward the ends. The same for every
                    // card, legal or not (rule 2).
                    const fanPose = fan
                        ? (() => {
                            const offset = index - (slots.length - 1) / 2
                            const lean = (offset / ((slots.length - 1) / 2)) * FAN_MAX_DEG
                            const sink = offset * offset * FAN_SINK_PX
                            return {
                                transform: `translateY(${sink}px) rotate(${lean}deg)`,
                                transformOrigin: "bottom center",
                            }
                        })()
                        : undefined
                    return (
                        <Box
                            key={card ?? (slot === TALON_SLOT ? `talon-${index}` : `empty-${index}`)}
                            // The page finds a card's slot by this to measure
                            // a flight's take-off and landing (`hiddenCards`).
                            data-card={card ?? undefined}
                            // EVERY slot, cards, talon backs and empty ones
                            // alike: the landscape table measures the fan's
                            // real box from these (`useFanRect`, 2026-10-12).
                            data-hand-slot=""
                            visibility={card !== null && hiddenCards?.has(card) ? "hidden" : undefined}
                            flexShrink={0}
                            // Every card owns the same full-width slot in the
                            // fixed grid — four columns on a phone, eight from
                            // 48em, the same eight slots either way. In the
                            // fan the slot overflows its narrower cell.
                            css={{
                                width: `${cardWidth}px`,
                                ...fanPose,
                            }}
                            zIndex={index}
                        >
                        <Box
                            ref={(node: HTMLElement | null) => {
                                if (card === null) return
                                if (node) cardNodes.current.set(card, node)
                                else cardNodes.current.delete(card)
                            }}
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
                                    borderColor="border.emphasized"
                                    bg="transparent"
                                    // An empty slot in the fan is invisible: a
                                    // row of outlines under a held hand reads
                                    // as cards that are missing, not as room.
                                    visibility={fan ? "hidden" : undefined}
                                    aria-hidden="true"
                                />
                            )}
                        </Box>
                        </Box>
                    )
                })}
            </Grid>
        </Box>
    )
}
