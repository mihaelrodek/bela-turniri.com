import { Box, chakra } from "@chakra-ui/react"
import type { Card } from "@bela/protocol"
import type { Suit } from "@bela/engine"
import { useTranslation } from "../../i18n"
import type { CardSize, DeckStyle } from "../util/cards"
import {
    CARD_INK,
    CARD_METRICS,
    SUIT_IS_RED,
    SUIT_SYMBOL,
    cardAriaLabel,
    cardRank,
    cardSuit,
} from "../util/cards"
import { useGamePrefs } from "../hooks/useGamePrefs"
import { MadjaricaCard, MadjaricaSuitIcon } from "../cards/madjarice"

/* ──────────────────────────────────────────────────────────────────────────
   PlayingCard — one card, in whichever deck the player picked.

   Bela is played with **mađarice** (Hungarian, Tell pattern), so that is the
   default and the artwork lives in `../cards/madjarice` as flat inline SVG:
   32 faces built from four suit glyphs, three court figures and four season
   vignettes, so the whole pack is a few kB of shared paths rather than 32
   images to download, cache-bust and serve at 2×. The French deck stays as a
   setting (`useGamePrefs().deck === "francuske"`) and is the original CSS
   card — a rank and a pip glyph, two text nodes.

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
     *  settings sheet's two sample cards. Omit everywhere else. */
    deck?: DeckStyle
}) {
    const { t } = useTranslation()
    const [prefs] = useGamePrefs()
    const style = deck ?? prefs.deck
    const metrics = CARD_METRICS[size]
    const interactive = !!onSelect && !disabled && !faceDown && !!card

    if (faceDown || !card) return <CardBack size={size} />

    const suit = cardSuit(card)
    const rank = cardRank(card)
    const label = cardAriaLabel(t, card, style)

    // A tappable card is a real <button> (keyboard, focus ring, screen-reader
    // role) and a card sitting in the trick is a <div>. `chakra.button` rather
    // than `<Box as="button">` because Box's props are typed for a div and
    // would reject `type` / `disabled`.
    const Root = interactive ? chakra.button : Box

    return (
        <Root
            {...(interactive ? { type: "button" as const, disabled, onClick: () => onSelect?.(card) } : {})}
            aria-label={label}
            title={label}
            position="relative"
            display="block"
            w={metrics.w}
            h={metrics.h}
            flexShrink={0}
            rounded={metrics.radius}
            bg={style === "madjarice" ? CARD_INK.face : CARD_INK.faceFrench}
            color={SUIT_IS_RED[suit] ? CARD_INK.red : CARD_INK.ink}
            borderWidth={style === "madjarice" ? "0" : "1px"}
            borderColor={selected ? "brand.500" : "border.emphasized"}
            boxShadow={selected ? "md" : "sm"}
            opacity={dimmed ? 0.42 : 1}
            filter={dimmed ? "saturate(0.4)" : undefined}
            cursor={interactive ? "pointer" : "default"}
            transform={raised ? "translateY(-10px)" : undefined}
            transition="transform 0.14s ease, box-shadow 0.14s ease, opacity 0.14s ease"
            _hover={interactive ? { transform: "translateY(-16px)", boxShadow: "md" } : undefined}
            _focusVisible={{
                outline: "2px solid",
                outlineColor: "brand.500",
                outlineOffset: "2px",
            }}
            outline={selected ? "2px solid" : undefined}
            outlineColor={selected ? "brand.500" : undefined}
            overflow="hidden"
            userSelect="none"
        >
            {style === "madjarice" ? (
                <MadjaricaCard rank={rank} suit={suit} />
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
 * One back for both decks: a brand-green woven diagonal with a lighter inner
 * panel, so a face-down card reads as OURS rather than as a generic grey
 * rectangle. Theme-following on purpose — it is the one part of a card that
 * belongs to the table rather than to the pack.
 */
export function CardBack({ size = "md" }: { size?: CardSize }) {
    const metrics = CARD_METRICS[size]
    return (
        <Box
            aria-hidden="true"
            w={metrics.w}
            h={metrics.h}
            flexShrink={0}
            rounded={metrics.radius}
            bg="brand.700"
            borderWidth="2px"
            borderColor="brand.900"
            boxShadow="sm"
            position="relative"
            overflow="hidden"
            backgroundImage="repeating-linear-gradient(45deg, var(--chakra-colors-brand-600) 0 4px, var(--chakra-colors-brand-800) 4px 8px)"
        >
            <Box
                position="absolute"
                inset="12%"
                rounded="sm"
                borderWidth="1px"
                borderColor="whiteAlpha.400"
                backgroundImage="repeating-linear-gradient(-45deg, var(--chakra-colors-brand-500) 0 3px, var(--chakra-colors-brand-700) 3px 6px)"
            />
        </Box>
    )
}

/* ────────────────────────────── suit icon ────────────────────────────── */

/** Named sizes, so `<SuitIcon size="md" />` matches the card it sits beside;
 *  any CSS length also works for a glyph that has to line up with text. */
const ICON_SIZES: Record<CardSize, string> = { sm: "14px", md: "18px", lg: "24px" }

function iconLength(size: CardSize | number | string): string {
    if (typeof size === "number") return `${size}px`
    if (size === "sm" || size === "md" || size === "lg") return ICON_SIZES[size]
    return size
}

/**
 * The suit on its own — for the bidding buttons, the trump indicator and the
 * scoreboard. Hungarian by default, like the cards; pass `style="francuske"`
 * for the ♥♦♠♣ glyph.
 *
 * Decorative by default (`aria-hidden`), because every call site so far puts
 * the suit's NAME next to it. Pass `label` to make it the accessible name
 * instead — an icon-only trump chip must not be silent.
 */
export function SuitIcon({
    suit,
    size = "md",
    style,
    label,
}: {
    suit: Suit
    /** `"sm" | "md" | "lg"` to match a card, or any CSS length / px number. */
    size?: CardSize | number | string
    /** Force a deck; omit to follow the player's preference. */
    style?: DeckStyle
    label?: string
}) {
    const [prefs] = useGamePrefs()
    const deck = style ?? prefs.deck
    const box = iconLength(size)
    const a11y = label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": "true" as const }

    if (deck === "francuske") {
        return (
            <Box
                as="span"
                {...a11y}
                display="inline-flex"
                alignItems="center"
                justifyContent="center"
                lineHeight="1"
                fontSize={box}
                color={SUIT_IS_RED[suit] ? CARD_INK.red : CARD_INK.ink}
            >
                {SUIT_SYMBOL[suit]}
            </Box>
        )
    }

    return (
        <Box as="span" {...a11y} display="inline-block" w={box} h={box} flexShrink={0} verticalAlign="-0.15em">
            <MadjaricaSuitIcon suit={suit} />
        </Box>
    )
}
