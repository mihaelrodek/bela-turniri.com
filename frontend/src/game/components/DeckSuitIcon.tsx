import { Box, chakra } from "@chakra-ui/react"
import type { Suit } from "@bela/engine"
import {
    CARD_INK,
    SUIT_IS_RED,
    SUIT_SYMBOL,
    deckHasImages,
    isHungarianDeck,
    type CardSize,
    type DeckStyle,
} from "../util/cards"
import { MadjaricaSuitIcon, suitImage, useDecodedImage } from "../cards/madjarice"

/* ──────────────────────────────────────────────────────────────────────────
   DeckSuitIcon — one suit mark, in the deck the player is holding.

   THE one place that answers "what does a suit look like" (2026-09-20, user
   request: "kad se pozove adut koristi prikaz aduta vezan uz odabrane
   karte"). A called trump on the scoreboard, the medallion on the caller's
   avatar, `TrumpBadge`, the bidding buttons and the trump flash all come
   through here (mostly via `SuitIcon` / `SuitGlyph`, which only add the
   player's preference), so the suit in the panel is the suit printed on the
   cards in hand and never a second, unrelated drawing of it.

     klasicne   the deck's own printed suit mark (assets/klasicne/suits/*).
     moderne    ITS own printed mark too (assets/moderne/suits/*, 2026-09-20,
                user request: the vector glyph next to scanned cards looked
                like a different game). Cut out of the deck's Dečko cards by
                `frontend/scripts/extract-moderne-suits.py`.
     vektorske  our vector glyph, which is that deck's own artwork anyway.
     francuske  ♥ ♦ ♠ ♣, as before.

   The image is gated on decode exactly like a card face, and the vector glyph
   is what stands in meanwhile: same box, same place, one element each, both
   present in the DOM from the first render. So there is no layout shift, no
   flicker and nothing for a re-render to swap — the same contract the hand's
   cards live under.

   Decorative by default (`aria-hidden`), because nearly every call site puts
   the suit's NAME next to it. Pass `label` to make it the accessible name
   instead — an icon-only trump chip must not be silent.
   ────────────────────────────────────────────────────────────────────── */

/** Named sizes, so `<SuitIcon size="md" />` matches the card it sits beside;
 *  any CSS length also works for a glyph that has to line up with text. */
const ICON_SIZES: Record<CardSize, string> = { sm: "14px", md: "18px", ml: "21px", lg: "24px" }

function iconLength(size: CardSize | number | string): string {
    if (typeof size === "number") return `${size}px`
    if (size === "sm" || size === "md" || size === "ml" || size === "lg") return ICON_SIZES[size]
    return size
}

export default function DeckSuitIcon({
    suit,
    deck,
    size = "md",
    label,
}: {
    suit: Suit
    /** Always explicit here — the preference is read one level up, so this
     *  component stays pure and the settings sheet can force a deck. */
    deck: DeckStyle
    /** `"sm" | "md" | "ml" | "lg"` to match a card, or any CSS length / px. */
    size?: CardSize | number | string
    label?: string
}) {
    const box = iconLength(size)
    // Unconditional, before any branch: `ready` must never change the shape
    // of this component (see the hand-flicker note in `PlayingCard`).
    const src = deckHasImages(deck) ? suitImage(deck, suit) : undefined
    const { ready, imgRef, settle } = useDecodedImage(src)
    const a11y = label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": "true" as const }

    if (!isHungarianDeck(deck)) {
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
        <Box
            as="span"
            {...a11y}
            position="relative"
            display="inline-block"
            w={box}
            h={box}
            flexShrink={0}
            verticalAlign="-0.15em"
        >
            <Box
                position="absolute"
                inset="0"
                // Hidden rather than unmounted: the printed mark has
                // transparent edges, so a glyph left underneath would show
                // through them.
                visibility={ready ? "hidden" : "visible"}
            >
                <MadjaricaSuitIcon suit={suit} />
            </Box>
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
