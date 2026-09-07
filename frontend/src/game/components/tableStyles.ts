/* ──────────────────────────────────────────────────────────────────────────
   The table's surface language, in one place (game/DESIGN.md §2.2).

   The felt is ALWAYS dark — in both themes. A card table is a physical
   object with its own colour; only the chrome around it (navbar, dialogs)
   follows the light/dark preference. That is why nothing here reads a
   semantic token like `bg.panel`, which flips to near-white in light mode:
   the panels that float on the felt are painted from the brand ramp itself
   with an alpha modifier (`brand.950/62` → `color-mix`), so they are the
   same dark glass whatever the theme says.

   Every value is a brand-ramp token. The only literal colours in the game UI
   are the card faces, which are not ours (see PlayingCard.tsx).

   These are spread onto components as PROPS (`<Box {...GLASS} />`), so they
   are deliberately left un-annotated: a `SystemStyleObject` annotation would
   widen `direction` and friends to every CSS value and collide with Flex's
   own `direction` prop. The blur lives under `css` because the `-webkit-`
   prefix (iOS < 18) is not a Chakra style prop — a call site that needs its
   own `css` merges `...GLASS.css` into it.
   ────────────────────────────────────────────────────────────────────── */

const BLUR = {
    backdropFilter: "saturate(150%) blur(12px)",
    WebkitBackdropFilter: "saturate(150%) blur(12px)",
} as const

const BLUR_STRONG = {
    backdropFilter: "saturate(150%) blur(16px)",
    WebkitBackdropFilter: "saturate(150%) blur(16px)",
} as const

/** Deep felt: brand.900 in the middle falling to brand.950 at the edges. */
export const FELT = {
    bg: "brand.950",
    backgroundImage:
        "radial-gradient(ellipse 125% 80% at 50% 36%, var(--chakra-colors-brand-900) 0%, var(--chakra-colors-brand-950) 72%)",
}

/** Dark glass — scoreboard, hand tray, bidding panel. */
export const GLASS = {
    bg: "brand.950/62",
    borderWidth: "1px",
    borderColor: "brand.700/70",
    css: BLUR,
}

/** A denser version for overlays that carry a block of text over the trick. */
export const GLASS_STRONG = {
    bg: "brand.950/88",
    borderWidth: "1px",
    borderColor: "brand.600/80",
    css: BLUR_STRONG,
}

/** Text on the felt. `INK_MUTED` is the pale end of the brand ramp rather
 *  than a grey, so secondary text still belongs to the table. */
export const INK = "white"
export const INK_MUTED = "brand.100/72"

/** A landscape phone (and any very short window): the table has to give the
 *  hand its 68 px and take the difference out of padding. */
export const SHORT = "@media (max-height: 560px)"
