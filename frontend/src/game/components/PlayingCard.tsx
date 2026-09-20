import { Box, chakra } from "@chakra-ui/react"
import type { Card } from "@bela/protocol"
import type { Suit } from "@bela/engine"
import { useTranslation } from "../../i18n"
import type { CardSize, DeckStyle } from "../util/cards"
import {
    CARD_INK,
    CARD_METRICS,
    CARD_SHADOW,
    DEFAULT_DECK,
    MADJARICA_HEIGHT,
    MADJARICA_RADIUS,
    SUIT_IS_RED,
    SUIT_SYMBOL,
    cardAriaLabel,
    cardRank,
    cardSuit,
    deckHasImages,
    isHungarianDeck,
} from "../util/cards"
import { useGamePrefs } from "../hooks/useGamePrefs"
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion"
import { MadjaricaCard, cardBackImage, useDecodedImage } from "../cards/madjarice"
import DeckSuitIcon from "./DeckSuitIcon"

/* ──────────────────────────────────────────────────────────────────────────
   PlayingCard — one card, in whichever deck the player picked.

   Bela is played with **mađarice** (Hungarian, Tell pattern), so three of the
   four decks are mađarice and the artwork lives in `../cards/madjarice`
   (`klasicne` — the licensed tomasdrus set and the default, `moderne` — our
   own cleaned scans, `vektorske` — our inline SVG). All three share ONE box,
   one radius and one shadow; `MadjaricaCard` owns the paint. An image deck's
   file is transparent-cornered and drawn edge to edge with NO frame and no
   background behind it, so the card reads as a card and not as a white
   rectangle on the felt; a card without an image retains the inline SVG face.
   The French deck (`deck === "francuske"`) is the original CSS card — a rank
   and a pip glyph, two text nodes. See `../util/cards.ts` for the registry.

   Card ink is deliberately NOT theme-tokenised, in either deck. A playing
   card is a physical object: cream face, dark ink, red hearts, in a dark room
   or a bright one. The BACK, the table and every panel around it are on the
   brand palette and follow the theme (game/DESIGN.md §3).

   This component owns nothing but the card. Lift, dim, tilt, deal animations
   and fan geometry belong to `Hand` / `TrickArea`; the flags below are the
   whole contract.
   ────────────────────────────────────────────────────────────────────── */

export default function PlayingCard({
    card,
    size = "md",
    faceDown = false,
    dimmed = false,
    raised = false,
    selected = false,
    disabled = false,
    onSelect,
    deck,
    actionHint,
    stableRoot = false,
}: {
    /** Omit together with `faceDown` for an anonymous back (another seat's hand). */
    card?: Card
    size?: CardSize
    faceDown?: boolean
    /** Illegal right now — greyed and non-interactive, but still visible. */
    dimmed?: boolean
    /** Legal right now — lifted out of the fan so it reads as tappable. */
    raised?: boolean
    selected?: boolean
    disabled?: boolean
    onSelect?: (card: Card) => void
    /** Force a deck instead of following the player's preference — for the
     *  settings sheet's four sample cards. Omit everywhere else. */
    deck?: DeckStyle
    /** Extra spoken guidance, used for a card that remains tappable so it can
     * explain why the rules reject it. */
    actionHint?: string
    /** Keep this card on a <button> even while it is not interactive — see
     *  the note on `Root` below. The hand passes it; the trick does not. */
    stableRoot?: boolean
}) {
    const { t } = useTranslation()
    const [prefs] = useGamePrefs()
    const reducedMotion = usePrefersReducedMotion() || prefs.reduceMotion
    const style = deck ?? prefs.deck
    const metrics = CARD_METRICS[size]
    const height = isHungarianDeck(style) ? MADJARICA_HEIGHT[size] : metrics.h
    const interactive = !!onSelect && !disabled && !faceDown && !!card

    if (faceDown || !card) return <CardBack size={size} deck={style} />

    const suit = cardSuit(card)
    const rank = cardRank(card)
    const label = cardAriaLabel(t, card, style)

    // A tappable card is a real <button> (keyboard, focus ring, screen-reader
    // role) and a card sitting in the trick is a <div>. `chakra.button` rather
    // than `<Box as="button">` because Box's props are typed for a div and
    // would reject `type` / `disabled`.
    //
    // `stableRoot` (2026-09-20): a card in MY HAND must keep ONE element for
    // its whole life. `interactive` flips for all eight cards every time the
    // turn reaches or leaves me, and changing the element TYPE remounts the
    // subtree — which resets `useDecodedImage`'s `ready`, so every card fell
    // back to its SVG face and swapped the artwork back in again. That was
    // the visible flicker/ghosting of the whole hand on every turn change.
    // Not interactive then means `aria-disabled` rather than a different
    // element: still focusable and announced, but it does nothing. (A real
    // `disabled` attribute would also do, but it drops the card out of the
    // tab order the instant somebody else is on turn.)
    const asButton = stableRoot || interactive
    const Root = asButton ? chakra.button : Box
    const hungarian = isHungarianDeck(style)

    return (
        <Root
            {...(asButton
                ? {
                      type: "button" as const,
                      ...(interactive
                          ? { onClick: () => onSelect?.(card) }
                          : { "aria-disabled": true, onClick: undefined }),
                  }
                : {})}
            aria-label={actionHint ? `${label}. ${actionHint}` : label}
            position="relative"
            display="block"
            w={metrics.w}
            h={height}
            flexShrink={0}
            // The Hungarian card's radius is the ARTWORK's own (6 % of the
            // width); the French one is still a CSS face, so it keeps the
            // Chakra token.
            rounded={hungarian ? MADJARICA_RADIUS[size] : metrics.radius}
            // …and no white frame behind it (2026-09-20, user request): the
            // image carries the whole card, so a background would show as a
            // border and fill in the transparent corners.
            bg={hungarian ? "transparent" : CARD_INK.faceFrench}
            color={SUIT_IS_RED[suit] ? CARD_INK.red : CARD_INK.ink}
            borderWidth="0"
            boxShadow="none"
            opacity={dimmed ? 0.42 : 1}
            // A borderless card needs a shadow to separate from the felt and
            // from its neighbour in the fan — an alpha-following drop-shadow,
            // never a box-shadow (see CARD_SHADOW).
            filter={[hungarian ? CARD_SHADOW : null, dimmed ? "saturate(0.4)" : null]
                .filter(Boolean)
                .join(" ") || undefined}
            cursor={interactive ? "pointer" : "default"}
            transform={raised ? "translateY(-10px)" : undefined}
            transition={reducedMotion ? "none" : "transform 0.14s ease, opacity 0.14s ease"}
            _hover={
                interactive
                    ? {
                          transform: "translateY(-16px)",
                      }
                    : undefined
            }
            _focusVisible={{
                outline: "2px solid",
                outlineColor: "brand.500",
                outlineOffset: "2px",
            }}
            outline={selected ? "2px solid" : undefined}
            outlineColor={selected ? "brand.500" : undefined}
            // `visible` for the Hungarian deck so the drop-shadow is not
            // clipped by the root; nothing inside it overflows anyway (the
            // image is `contain` inside the exact same box).
            overflow={hungarian ? "visible" : "hidden"}
            userSelect="none"
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
            css={{
                // Long-pressing a card must remain a game gesture. In
                // particular, iOS must not expose the image's Share/Save
                // callout over the live table.
                touchAction: "manipulation",
                WebkitTouchCallout: "none",
                WebkitUserSelect: "none",
                WebkitUserDrag: "none",
            }}
        >
            {hungarian ? (
                <MadjaricaCard rank={rank} suit={suit} size={size} deck={style} />
            ) : (
                <FrenchFace suit={suit} rankLabel={t(`game.rankShort.${rank}`)} size={size} />
            )}
        </Root>
    )
}

/* ─────────────────────────── the French face ─────────────────────────── */

/** The original CSS card, unchanged: corner rank + pip, top-left and
 *  bottom-right, with a big centre pip. Kept as a settings option. */
function FrenchFace({ suit, rankLabel, size }: { suit: Suit; rankLabel: string; size: CardSize }) {
    const metrics = CARD_METRICS[size]
    const corner = (
        <>
            {rankLabel}
            <Box fontSize={metrics.cornerFont} lineHeight="1">
                {SUIT_SYMBOL[suit]}
            </Box>
        </>
    )
    return (
        <Box aria-hidden="true" position="absolute" inset="0">
            <Box
                position="absolute"
                top="2px"
                left="4px"
                lineHeight="1"
                fontWeight="bold"
                fontSize={metrics.rankFont}
                fontVariantNumeric="tabular-nums"
            >
                {corner}
            </Box>
            <Box
                position="absolute"
                inset="0"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontSize={metrics.pipFont}
                lineHeight="1"
            >
                {SUIT_SYMBOL[suit]}
            </Box>
            <Box
                position="absolute"
                bottom="2px"
                right="4px"
                lineHeight="1"
                fontWeight="bold"
                fontSize={metrics.rankFont}
                fontVariantNumeric="tabular-nums"
                transform="rotate(180deg)"
                textAlign="left"
            >
                {corner}
            </Box>
        </Box>
    )
}

/* ────────────────────────────── the back ────────────────────────────── */

/**
 * The face-down card.
 *
 * The CSS back — a brand-green woven diagonal with a lighter inner panel — is
 * the one that is ALWAYS available, and it stays the French deck's back and
 * the universal fallback. It exists because a new deal must never paint white
 * rectangles while a raster is still being fetched.
 *
 * The two image decks (`klasicne`, `moderne`) ship their own `BACK.webp`, so
 * once that file is decoded in this document it replaces the CSS back
 * (2026-09-20). Never before: the decoded check is the same one the faces
 * use, so the swap can only ever go from "a real back" to "a real back".
 * `vektorske` has no back file and keeps the CSS one — it is a card back, not
 * a stand-in.
 */
export function CardBack({ size = "md", deck = DEFAULT_DECK }: { size?: CardSize; deck?: DeckStyle }) {
    const metrics = CARD_METRICS[size]
    const hungarian = isHungarianDeck(deck)
    const src = deckHasImages(deck) ? cardBackImage(deck) : undefined
    const { ready, imgRef, settle } = useDecodedImage(src)
    return (
        <Box
            aria-hidden="true"
            w={metrics.w}
            h={hungarian ? MADJARICA_HEIGHT[size] : metrics.h}
            flexShrink={0}
            rounded={hungarian ? MADJARICA_RADIUS[size] : metrics.radius}
            // Transparent only once the artwork is up — its corners are
            // transparent too, and the CSS back underneath would show through.
            bg={ready ? "transparent" : CARD_INK.frame}
            borderWidth="0"
            boxShadow="none"
            filter={hungarian ? CARD_SHADOW : undefined}
            position="relative"
            overflow={hungarian ? "visible" : "hidden"}
        >
            <Box
                position="absolute"
                inset="3px"
                rounded="sm"
                borderWidth="1px"
                borderColor="whiteAlpha.400"
                backgroundImage="repeating-linear-gradient(-45deg, var(--chakra-colors-brand-500) 0 3px, var(--chakra-colors-brand-700) 3px 6px)"
                visibility={ready ? "hidden" : "visible"}
            />
            {src && (
                <chakra.img
                    ref={imgRef}
                    src={src}
                    alt=""
                    draggable={false}
                    decoding="async"
                    onLoad={settle}
                    position="absolute"
                    inset="0"
                    w="100%"
                    h="100%"
                    objectFit="contain"
                    pointerEvents="none"
                    opacity={ready ? 1 : 0}
                />
            )}
        </Box>
    )
}

/* ────────────────────────────── suit icon ────────────────────────────── */

/**
 * The suit on its own — for the bidding buttons, the trump indicator and the
 * scoreboard. Follows the player's deck, like the cards; pass `style` to force
 * one (the settings sheet's samples).
 *
 * All the drawing lives in `DeckSuitIcon`, which is the ONE component that
 * knows what a suit looks like in each deck — including `klasicne`'s own
 * printed suit marks. This is only the preference read, kept here so the
 * dozens of existing `<SuitIcon />` call sites stay exactly as they were.
 */
export function SuitIcon({
    suit,
    size = "md",
    style,
    label,
}: {
    suit: Suit
    /** `"sm" | "md" | "ml" | "lg"` to match a card, or any CSS length / px number. */
    size?: CardSize | number | string
    /** Force a deck; omit to follow the player's preference. */
    style?: DeckStyle
    label?: string
}) {
    const [prefs] = useGamePrefs()
    return <DeckSuitIcon suit={suit} deck={style ?? prefs.deck} size={size} label={label} />
}
