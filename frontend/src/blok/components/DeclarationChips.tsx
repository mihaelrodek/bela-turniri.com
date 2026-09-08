import { Box, Button, chakra, Grid, Text, VStack } from "@chakra-ui/react"
import { FiX } from "react-icons/fi"
import { useTranslation, usePlural } from "../../i18n"
import { DECLARATION_VALUES, declarationCap } from "../types"

/* ──────────────────────────────────────────────────────────────────────────
   DeclarationChips — the zvanja block of the round-entry sheet (BLOK.md §3.2).

   Everything here writes into the sheet's ACTIVE side; this component never
   knows which side that is, it is handed that side's list and reports back
   "add this value" / "take one of this value back".

   ── The remove gesture — REVISED 2026-09-08 ───────────────────────────────
   Both directions now live ON the value's own button: tap the body to add,
   tap the ✕ in the TOP-LEFT corner to take one back, with the `×N` counter
   mirroring it in the top-right. The separate undo row that used to sit
   below is gone — with a ✕ per value it was a second control for the same
   job, and on a phone it cost a whole line of the sheet that the two side
   cards and the pad need more.

   Long-press is still refused for the same reasons as before: invisible, it
   fights iOS's own long-press menu, and it has no keyboard or screen-reader
   equivalent. The ✕ is a real focusable <button> with `blok.entry.clearChip`
   as its name, so Tab reaches it.

   ── Why the ✕ is a SIBLING of the add button, not a child ─────────────────
   A <button> inside a <button> is invalid HTML and browsers un-nest it, so
   the pair sits inside a `position="relative"` Box: the add button fills the
   cell, the ✕ is absolutely positioned over its corner. That layout is also
   what makes the hit areas safe — a tap on the ✕ is a tap on a DIFFERENT
   element, so it can never also fire the add button, no matter what happens
   to the event. (`stopPropagation` below is belt-and-braces for the day
   someone puts a handler on the wrapper.) Both badges have a fixed pixel box
   rather than padding-derived size, so the amount of the button body they
   cover is a known rectangle in the corner and not a function of the font.

   ── Badges must not meet across the gap — FIXED 2026-09-08 ────────────────
   The first phone build pulled BOTH badges 8 px out of their corners while
   the grid gap was also 8 px, so the ✕ on the top-LEFT of one button and the
   ×N on the top-RIGHT of its left-hand neighbour each filled the whole gap
   and landed on top of each other ("50"'s ✕ over "20"'s ×1). The fix keeps
   the ✕ at its full 28 px — shrinking the one real TARGET here to buy
   clearance would be the wrong trade — and splits the offset per axis
   instead: horizontally the badges are FLUSH with their own button's edge
   (`BADGE_EDGE`, zero outward pull), so the entire column gap is always
   clear no matter how wide the sheet renders the 3-column grid; vertically
   they still rise into the ROW gap (`BADGE_RISE`), which is widened to 12 px
   so a row-2 badge no longer touches the button above it. Choosing "inset
   horizontally" over "widen the column gap" is deliberate: clearance then
   does not depend on a gap value that a future layout tweak could shrink.

   ── How many of one value fit in a deal — ADDED 2026-09-08 ────────────────
   200 and 150 once, 100 twice, 50 four times, 20 six times (BLOK.md §3.2,
   `DECLARATION_MAX_PER_DEAL`). At its cap the button is DISABLED, never
   hidden: a control that vanishes reads as a bug, and its ✕ and its `×N` have
   to stay reachable so the player can take one back. The cap is counted across
   BOTH SIDES of the deal (`dealAdded`), not per side, because there is one
   deck — four jacks exist once, so a 200 can happen once in a deal no matter
   who is holding it, and per-side counting would happily accept two.

   Consequence, and it is the honest one: when the OTHER side already holds the
   only 200, this side's 200 is disabled with no ✕ of its own — the entry lives
   on the other card and is removed there. That is what "one deck" means.

   This lives on the BUTTONS, deliberately not in `scoreManualDeal` (BLOK.md
   §1.1): the engine does not referee house rules and already accepts values
   outside these five. A deal loaded from storage that exceeds a cap still
   renders and still edits — it just cannot grow.

   ── Štiglja | Belot are ONE CELL of the grid — REVISED 2026-09-08 ─────────
   A belot (eight cards of one suit) ends the game outright, so it belongs
   beside the other whole-deal fact rather than among the values you tap once
   per sequence. The pair now occupies the SIXTH cell of the same 3 × 2 grid,
   split down the middle, so the whole block is `20 · 50 · 100` over
   `150 · 200 · [Štiglja|Belot]` — user request, and it buys back the row the
   pair used to take from a sheet that also has to hold two side cards and a
   keypad.

   THE PRICE IS THE TYPE SIZE, AND IT IS PAID EXPLICITLY. At 320 px the sheet's
   body is 288 px wide (`Drawer.Body px="4"`), so a cell is (288 − 2 × 8) / 3 ≈
   90 px and a half of one, minus the 4 px between them, is ≈ 43 px. "Štiglja"
   does not fit there at the `sm` type the buttons used to carry; it fits at
   `2xs`. So the pair — and only the pair — steps its type down on the narrowest
   phones and returns to `xs`/`sm` as soon as there is room (`PAIR_FONT`), with
   `px="0"`, `minW="0"` and `nowrap` so every one of those 43 px is available to
   the word. What is NOT done is the thing the values do: no ellipsis, no
   clamp — a truncated "Štigl…" on a control that decides a whole deal is worse
   than a small word, and BLOK.md §3.1.1 already settles that trade for names.

   Both halves keep everything that made them readable as controls: they are
   `aria-pressed` toggles, and a pressed one is a SOLID fill of the active
   side's colour against an outlined unpressed one — a filled block reads at
   half width exactly as well as at full.

   The two are MUTUALLY EXCLUSIVE — a deal that was never played cannot also
   have had all eight of its tricks taken — and the parent enforces that by
   clearing one when the other is switched on; `scoreManualDeal` refuses a
   round carrying both (BLOK.md §1.1).

   NO PER-DEAL CAP for belot, unlike the five values: it is a toggle naming a
   side, not a value that can be tapped twice, so "at most one per deal" is
   already true by construction. Nothing to count.

   While a belot is on, the five value buttons are DISABLED (`lockedByBelot`)
   for the same reason the keypad is: the award is the game's target and
   nothing entered here can move it, so a button that still accepted taps
   would be adding numbers to a total that ignores them. Their ✕ stays live,
   so a value tapped before the belot can still be taken back.

   The list is still the RAW sequence (`[20, 20, 50]`), not a summary:
   `BlokRound.declarations` stores what was called, not how much. Removing by
   VALUE (the parent drops the last entry of it) rather than by index is what
   this layout can express — the corner ✕ belongs to a value, not to a
   position, and the entries of one value are genuinely interchangeable.
   ────────────────────────────────────────────────────────────────────── */

/** Same 56 px thumb target as the keypad, so the two blocks feel like one pad. */
const BUTTON_H = "52px"

/** The two corner badges. The ✕ is bigger than the counter because one is a
 *  TARGET and the other is a label — 28 px is under the 44 px floor a primary
 *  control would need, but this is a corner affordance on a 52 px button and
 *  the alternative (an invisible padded hit ring) is exactly the thing that
 *  would start swallowing taps meant for the body. */
const CLEAR_SIZE = "28px"
const COUNT_SIZE = "24px"
/** Vertical pull: each badge rises out of the top of its button into the ROW
 *  gap, which is 12 px (`rowGap="3"`), so 6 px of it hangs free and it never
 *  reaches the button on the row above. */
const BADGE_RISE = "-6px"
/** Horizontal placement: FLUSH with the button's own edge, i.e. no outward
 *  pull at all. This is what guarantees the whole COLUMN gap stays empty, so
 *  the ✕ of one button can never meet the ×N of its neighbour — at any width
 *  the 3-column grid happens to take. See the header note. */
const BADGE_EDGE = "0"

/** Type for the Štiglja | Belot pair only. Half a grid cell is ≈ 43 px at
 *  320 px (see the header note), which "Štiglja" needs `2xs` to clear; from the
 *  first breakpoint up there is room for the size the block used to use. The
 *  five value buttons are untouched — their labels are three digits. */
const PAIR_FONT = { base: "2xs", sm: "xs", md: "sm" }

export default function DeclarationChips({
    added,
    dealAdded,
    onAdd,
    onRemove,
    stiglja,
    onToggleStiglja,
    belot,
    dealBelot,
    onToggleBelot,
    palette,
}: {
    /** The active side's declarations, in the order they were entered. Drives
     *  the `×N` badge and the ✕ — both belong to the side being typed into. */
    added: number[]
    /**
     * EVERY declaration in the deal, both sides together. Only the per-deal
     * caps read this: one deck, so "how many 200s exist here" is a question
     * about the deal, not about a side. See the header note.
     */
    dealAdded: number[]
    onAdd: (value: number) => void
    /** Take ONE entry of `value` back. The parent decides which one (it drops
     *  the last), because from here the entries of a value are identical. */
    onRemove: (value: number) => void
    /** True when the ACTIVE side is the one holding the štiglja. */
    stiglja: boolean
    onToggleStiglja: () => void
    /**
     * Whether EITHER side showed a belot, and whether it was the active one.
     *
     * Two flags for the same reason `added` and `dealAdded` are two: the
     * button's pressed state belongs to the side being typed into, while
     * "there is a belot in this deal" is a fact about the deal — and it is the
     * deal-level one that locks the five values, because a belot on the
     * opponents' card makes this side's declarations just as unscorable.
     */
    belot: boolean
    dealBelot: boolean
    /** Turn the belot on for the active side, or off. The parent clears any
     *  štiglja in the same move — the two cannot coexist. */
    onToggleBelot: () => void
    /** The ACTIVE side's colour (`blokSide.ts`). Everything filled in here
     *  belongs to that side, so it wears the same hue the header and the deal
     *  rows already give it — that is the fastest possible answer to "which
     *  side am I typing into". Set once on the root; `colorPalette` is a CSS
     *  variable cascade, so the buttons below just read `colorPalette.*`. */
    palette: "green" | "red"
}) {
    const { t } = useTranslation()
    /* Croatian has three plural categories and Slovenian four (it kept the
       dual), so "how many of this zvanje are in" is a plural family, never a
       ternary — root CLAUDE.md. */
    const plural = usePlural()

    return (
        <VStack align="stretch" gap="2" colorPalette={palette}>
            <Text fontSize="xs" fontWeight="bold" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
                {t("blok.entry.declarations")}
            </Text>

            {/* `mt="2"` is headroom for the row-1 badges, which hang 6 px above
                their buttons and would otherwise crowd the label. The column
                gap stays 8 px (it lines the block up with the rest of the
                sheet); only the ROW gap grows, because that is the axis the
                badges actually stick out into. */}
            <Grid templateColumns="repeat(3, 1fr)" columnGap="2" rowGap="3" mt="2">
                {DECLARATION_VALUES.map((value) => {
                    const count = added.filter((entry) => entry === value).length
                    // Across the whole deal, not just this side — one deck.
                    const inDeal = dealAdded.filter((entry) => entry === value).length
                    const cap = declarationCap(value)
                    // Two different reasons to refuse a tap, one appearance:
                    // the deck has no more of this value, or the deal was
                    // decided by a belot and no declaration can change it.
                    const atCap = dealBelot || (cap !== null && inDeal >= cap)
                    const name = `${t("blok.entry.declarations")} ${value}`
                    return (
                        <Box key={value} position="relative">
                            <Button
                                w="full"
                                h={BUTTON_H}
                                rounded="l2"
                                variant="outline"
                                bg={count > 0 ? "colorPalette.subtle" : "bg.subtle"}
                                color={count > 0 ? "colorPalette.fg" : "fg.ink"}
                                borderColor={count > 0 ? "colorPalette.emphasized" : "border.subtle"}
                                fontSize="lg"
                                fontWeight="bold"
                                fontVariantNumeric="tabular-nums"
                                /* Explicitly inert at the cap: whether a
                                   recipe's hover selector excludes `:disabled`
                                   is not something to assume, and a button
                                   that lights up under the finger while
                                   refusing the tap is worse than one that does
                                   not move. */
                                _hover={
                                    atCap
                                        ? {}
                                        : { bg: count > 0 ? "colorPalette.muted" : "bg.muted" }
                                }
                                /* The count is spoken as part of the button's
                                   name because the badge that shows it is a
                                   glyph ("×2") and the undo row that used to
                                   carry this information for a screen reader
                                   is gone. */
                                aria-label={count > 0 ? `${name}, ${plural("blok.entry.added", count)}` : name}
                                disabled={atCap}
                                /* Readable, not faded out of existence: the
                                   value and its `×N` are still what the player
                                   checks before saving, and the ✕ beside them
                                   is still live. Chakra's default disabled
                                   opacity would drop this below the point
                                   where the number can be read across a table
                                   in a bar. */
                                _disabled={{ opacity: 0.85, cursor: "default" }}
                                onClick={() => onAdd(value)}
                            >
                                {value}
                                {count > 0 && (
                                    /* Decoration only — the button's own name
                                       already says the count in words, so this
                                       must not be read out again as a stray
                                       "×2" after it. */
                                    <Box
                                        as="span"
                                        aria-hidden="true"
                                        position="absolute"
                                        top={BADGE_RISE}
                                        insetEnd={BADGE_EDGE}
                                        minW={COUNT_SIZE}
                                        px="1"
                                        rounded="full"
                                        bg="colorPalette.solid"
                                        color="colorPalette.contrast"
                                        fontSize="2xs"
                                        fontWeight="bold"
                                        lineHeight={COUNT_SIZE}
                                        textAlign="center"
                                    >
                                        ×{count}
                                    </Box>
                                )}
                            </Button>

                            {count > 0 && (
                                <chakra.button
                                    /* `chakra.button`, not `<Box as="button">`:
                                       `as` does not retype props in Chakra v3,
                                       so the Box form has no `type` and would
                                       default to `submit` inside any form. */
                                    type="button"
                                    aria-label={t("blok.entry.clearChip", { value })}
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        onRemove(value)
                                    }}
                                    position="absolute"
                                    zIndex="1"
                                    top={BADGE_RISE}
                                    insetStart={BADGE_EDGE}
                                    boxSize={CLEAR_SIZE}
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                    rounded="full"
                                    borderWidth="1px"
                                    /* Neutral, not red: this sits on a card
                                       whose own side colour may already BE red
                                       (`blokSide.ts`), where a red badge would
                                       disappear. `bg.emphasized` + a border is
                                       legible against both side palettes and
                                       in both themes. */
                                    bg="bg.emphasized"
                                    borderColor="border.emphasized"
                                    color="fg.ink"
                                    _hover={{ bg: "bg.muted", borderColor: "border.emphasized" }}
                                    _focusVisible={{
                                        outline: "2px solid",
                                        outlineColor: "colorPalette.focusRing",
                                        outlineOffset: "1px",
                                    }}
                                >
                                    <FiX aria-hidden="true" size={16} />
                                </chakra.button>
                            )}
                        </Box>
                    )
                })}

                {/* THE SIXTH CELL: the two whole-deal facts, split down the
                    middle of one cell of this same grid. Both are toggles
                    naming the ACTIVE side, both are exclusive of each other
                    (the parent clears one when the other goes on), and neither
                    can be entered twice — so neither carries a counter or a ✕,
                    which is also why they can afford to share a cell the value
                    buttons could not.

                    `gap="1"` rather than the grid's own `2`: those 4 px are
                    four of the ~43 px each half gets on a 320 px phone, and the
                    two halves are one control cut in two — a wide moat between
                    them would say the opposite. */}
                <Grid templateColumns="repeat(2, 1fr)" gap="1">
                    <Button
                        h={BUTTON_H}
                        rounded="l2"
                        variant="outline"
                        aria-pressed={stiglja}
                        bg={stiglja ? "colorPalette.solid" : "bg.subtle"}
                        color={stiglja ? "colorPalette.contrast" : "fg.ink"}
                        borderColor={stiglja ? "colorPalette.solid" : "border.subtle"}
                        fontSize={PAIR_FONT}
                        fontWeight="bold"
                        /* Every pixel of the half goes to the word: Chakra's
                           button recipe reserves horizontal padding and a
                           `minW`, and at this width both are the difference
                           between a whole word and an overflowing one. */
                        px="0"
                        minW="0"
                        whiteSpace="nowrap"
                        _hover={{ bg: stiglja ? "colorPalette.solid" : "bg.muted" }}
                        onClick={onToggleStiglja}
                    >
                        {t("blok.entry.stiglja")}
                    </Button>
                    <Button
                        h={BUTTON_H}
                        rounded="l2"
                        variant="outline"
                        aria-pressed={belot}
                        bg={belot ? "colorPalette.solid" : "bg.subtle"}
                        color={belot ? "colorPalette.contrast" : "fg.ink"}
                        borderColor={belot ? "colorPalette.solid" : "border.subtle"}
                        fontSize={PAIR_FONT}
                        fontWeight="bold"
                        px="0"
                        minW="0"
                        whiteSpace="nowrap"
                        /* The word alone would leave the strongest thing in the
                           blok looking like a sixth declaration button, so the
                           button says what it does in its accessible name — the
                           visible label stays one word because the cell is half
                           a cell wide. */
                        aria-label={`${t("blok.entry.belot")} — ${t("blok.entry.belotHint")}`}
                        _hover={{ bg: belot ? "colorPalette.solid" : "bg.muted" }}
                        onClick={onToggleBelot}
                    >
                        {t("blok.entry.belot")}
                    </Button>
                </Grid>
            </Grid>
        </VStack>
    )
}
