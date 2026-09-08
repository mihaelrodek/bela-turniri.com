import { Button, Grid } from "@chakra-ui/react"
import { FiDelete } from "react-icons/fi"

/* ──────────────────────────────────────────────────────────────────────────
   Keypad — the blok's own 0-9 + Očisti + ⌫ pad (BLOK.md §3.2).

   Deliberately NOT an `<input inputMode="numeric">`. The system keyboard on a
   phone eats half the viewport and resizes it, which would push the two side
   cards — the whole reason this sheet exists, since the player is checking
   the number before writing it down — off the screen exactly while it is
   being typed. A fixed pad keeps the layout still and the targets big.

   Keys are 56 px tall: well over the 44 px tap-target floor, because this is
   used one-handed, at a table, with cards in the other hand.

   Bottom row is Očisti / 0 / ⌫. `onClear` wipes the WHOLE sheet, not just the
   digits, which is why it is the one key `disabled` does not reach: `disabled`
   means "a štiglja fixed the card points, there is nothing to type", and the
   štiglja is one of the things Očisti has to be able to take back off.

   Digits label themselves, so they need no aria-label. Backspace is a glyph
   and gets one from the caller, and so does the group as a whole — the sheet
   owns the dictionary lookups so this file stays a dumb pad.
   ────────────────────────────────────────────────────────────────────── */

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const

/* Key height as a CSS variable rather than a Chakra prop, because the thing
   that has to change it is the VIEWPORT HEIGHT and the theme's breakpoints
   are all widths. Four rows at 56 px plus the header, the two side cards and
   the action row do not fit on a 568 px-tall phone (an SE lying next to the
   cards is exactly the target device), and the part that must not be squeezed
   is the cards. 46 px still clears the 44 px tap-target floor. */
const KEY_HEIGHT_CSS = {
    "--blok-key-h": "56px",
    "@media (max-height: 700px)": { "--blok-key-h": "46px" },
} as const

const KEY_STYLE = {
    /* The fallback is the full 56 px, so if the variable ever failed to land
       the pad degrades to its intended size rather than to `height: auto`. */
    h: "var(--blok-key-h, 56px)",
    rounded: "l2",
    variant: "outline" as const,
    bg: "bg.subtle",
    color: "fg.ink",
    borderColor: "border.subtle",
    fontSize: "2xl",
    fontWeight: "bold",
    fontVariantNumeric: "tabular-nums",
    _hover: { bg: "bg.muted" },
    _active: { bg: "bg.emphasized" },
}

export default function Keypad({
    onDigit,
    onBackspace,
    onClear,
    disabled = false,
    label,
    clearLabel,
    backspaceLabel,
}: {
    onDigit: (digit: string) => void
    onBackspace: () => void
    /** Reset the entire sheet — see `handleClear` in RoundEntrySheet. */
    onClear: () => void
    /** Štiglja forces the card points, so there is nothing left to type.
     *  Does NOT reach Očisti: that key is how the štiglja comes back off. */
    disabled?: boolean
    /** Accessible name for the pad as a whole ("bodovi iz karata"), which the
     *  sheet no longer prints as a visible caption above it. */
    label: string
    /** Visible text AND accessible name of the clear key. */
    clearLabel: string
    /** Accessible name for ⌫ — the sheet resolves it from the dictionary. */
    backspaceLabel: string
}) {
    return (
        <Grid templateColumns="repeat(3, 1fr)" gap="2" css={KEY_HEIGHT_CSS} role="group" aria-label={label}>
            {DIGITS.map((digit) => (
                <Button key={digit} {...KEY_STYLE} disabled={disabled} onClick={() => onDigit(digit)}>
                    {digit}
                </Button>
            ))}
            <Button
                {...KEY_STYLE}
                /* Word, not a glyph, and set in the muted foreground at text
                   size: it must not read as a fourth column of digits, and it
                   must not compete with 0 for the thumb's default target. */
                fontSize="sm"
                color="fg.muted"
                onClick={onClear}
            >
                {clearLabel}
            </Button>
            <Button {...KEY_STYLE} disabled={disabled} onClick={() => onDigit("0")}>
                0
            </Button>
            <Button {...KEY_STYLE} fontSize="xl" disabled={disabled} aria-label={backspaceLabel} onClick={onBackspace}>
                <FiDelete />
            </Button>
        </Grid>
    )
}
