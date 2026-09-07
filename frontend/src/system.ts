import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"
import type { SystemStyleObject } from "@chakra-ui/react"
import { dialogAnatomy, menuAnatomy, popoverAnatomy } from "@chakra-ui/react/anatomy"

/** The `@supports` guard both glass surfaces fall back through. Written out
 *  once because getting it subtly different in two places is how a fallback
 *  quietly stops firing. `-webkit-` is in the test even though Chakra's style
 *  types won't let us EMIT the prefixed property (see GLASS_CONTENT below), so
 *  a browser that only speaks the prefixed form still takes the blur branch
 *  from any layer style that does emit it. */
const NO_BACKDROP_FILTER =
    "@supports not ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px)))"

/** Glass for floating material — the shared body of the `dialog`, `menu` and
 *  `popover` slot-recipe overrides below.
 *
 *  No `WebkitBackdropFilter` here, unlike `layerStyles.glass.*`: a slot
 *  recipe's styles are typed as `SystemStyleObject`, which only admits
 *  properties Chakra generates, and vendor prefixes aren't among them.
 *  Browsers that support only the prefixed property (iOS Safari before 18)
 *  therefore take the `@supports not` branch and get the opaque `bg.panel` —
 *  a solid dialog at full contrast, which is the correct degradation anyway. */
const GLASS_CONTENT: SystemStyleObject = {
    bg: "bg.glassPanel",
    backdropFilter: "saturate(180%) blur(24px)",
    [NO_BACKDROP_FILTER]: { bg: "bg.panel" },
}

/* ──────────────────────────────────────────────────────────────────────────
   bela-turniri.com design system.

   Built as `createSystem(defaultConfig, config)` — a MERGE on top of Chakra's
   own preset, not a replacement. Every default token (`gray.500`, `blue.fg`,
   `bg.subtle`, `fg.muted`, `border.emphasized`, the whole `colorPalette`
   machinery …) stays valid; this file only ADDS names and tightens the dark
   half of a few existing ones.

   What it adds
   ────────────
   • `brand.50…950` — the app's primary green, a card-table felt derived from
     the logo: `brand.800` is #0a4f20 and `brand.950` is #052b12, the two exact
     greens `public/bela-turniri-logo.svg` paints its suits and wordmark with.
     Addressable by name, so a future rebrand is one ramp, not 130 call sites.
   • `colorPalette="brand"` semantics (solid / contrast / fg / muted / subtle /
     emphasized / focusRing) shaped exactly like Chakra's own ramp semantics,
     plus the same semantics for `blue` (an alias of brand — see "One green")
     and `green` (re-pointed to teal so success survives a green brand).
   • Surface + text + border ladders with explicit `_light`/`_dark` twins:
     `bg.canvas`, `bg.panel`, `bg.subtle`, `bg.muted`, `bg.emphasized`,
     `fg.ink`, `fg.soft`, `fg.muted`, `fg.subtle`, `border`, `border.subtle`,
     `border.emphasized`, `border.strong`.
   • `textStyles` (title / heading / body / caption / mono) and a small
     elevation scale (`shadows.card` / `raised` / `overlay` / `sticky`).
   • A `radii` scale + the `l1`/`l2`/`l3` semantic radii Chakra's own recipes
     read, so corners are a THEME decision (see "Corners" below).
   • Translucent `bg.glass*` surfaces and the `glass.bar` / `glass.panel`
     layer styles that pair them with a backdrop blur (see "Gloss" below).

   ── One green ─────────────────────────────────────────────────────────────
   The app is a BELOT app; its identity colour is the felt of a card table,
   taken straight off the logo (#0a4f20 / #052b12) rather than invented. It
   used to be blue — an earlier pass had already collapsed two competing blues
   (#3182ce and Chakra's stock #3b82f6) into a single `brand` ramp; this pass
   moves that one ramp from blue to green, which is why there is not a single
   call-site edit here.

   That only works because the name "blue" is still, deliberately, an ALIAS.
   130-odd call sites say `colorPalette="blue"` or reference `blue.fg` /
   `blue.subtle` / `blue.solid` directly, and rewriting them (only to re-open
   the same drift the next time someone types "blue") buys nothing. Chakra's
   stock `blue` ramp and its semantics are therefore RE-POINTED at the brand
   ramp below, step for step: `colorPalette="blue"` and `colorPalette="brand"`
   are the same colour by construction. It reads oddly in a call site and is
   the reason the whole rebrand is two token blocks — a `blue.*` reference is
   worth renaming when you are already editing that line, never on its own.

   `*.solid` — the fill under white button text — is brand.600 (#227342), not
   brand.500. #2f8f52 measures 4.06:1 against white, which fails WCAG AA for
   normal-size text; #227342 measures 5.83:1 and is still unmistakably the same
   felt green. brand.500 is instead the FOCUS RING, where the bar is 3:1 and it
   clears it against both canvases (4.06:1 on white, 4.65:1 on gray.950) — a
   ring drawn in the darker 600 would disappear into the dark theme.

   The ramp is anchored on the logo at the dark end (800 = #0a4f20, 950 =
   #052b12) and lightened through it, so the pale steps stay in the same
   yellow-leaning green rather than drifting to mint. `theme-color` in
   index.html and the map-pin SVGs are OUTSIDE this file and must be moved by
   hand — a green app with a blue browser bar is the exact drift this section
   exists to prevent.

   ── Green brand vs green "success" ─────────────────────────────────────────
   41 call sites paint success/paid/synced with Chakra's stock `green`
   (SyncIndicator, the paid badges, the map's "this week" pins). Against a
   green BRAND those stop being two colours: measured CIEDE2000 between the
   two ramps is 4.2 at the subtle-chip step and 5.1 at the light `fg` step —
   under the ~10 where two fills read as different colours at all. A paid chip
   and a brand chip side by side would have been the same pale mint rectangle.

   So the `green` SEMANTICS (not the numeric ramp — nothing references
   `green.500` and friends) are re-pointed at Chakra's `teal` steps: ΔE 12.1
   at the light `fg` step, 15.1 at the dark chip, 18.4 at `solid`. Success is
   now a cool blue-green against the warm felt, distinguishable at a glance
   and still obviously "positive". Call sites keep saying `green`; only what
   the name resolves to moved. `teal` itself is untouched and now aliases the
   same colour, which is harmless.

   ── Corners ───────────────────────────────────────────────────────────────
   Chakra v3's component recipes do not read `radii.md` directly; they read the
   SEMANTIC radii `l1`/`l2`/`l3`, which by default alias xs/sm/md (2/4/6px).
   Redefining those three plus the raw scale rounds every Button, Input, Card,
   Dialog, Menu, Popover, Select, Tag and Tabs trigger in the app at once —
   which is why there is not one `rounded="xl"` added at a call site here. The
   196 `rounded=` props that already exist ride the same scale up.

   ── Gloss ─────────────────────────────────────────────────────────────────
   The brief was "~90% opacity for a glossy effect". Literal `opacity` on an
   element ALSO fades its text and lets whatever is behind it bleed through, so
   the effect is built the way the platform actually does it: a translucent
   background token plus `backdrop-filter: blur()`, with the content on top at
   full opacity. It is applied only to MATERIAL surfaces — things that float
   over other content and therefore have something worth blurring: the sticky
   header, the mobile tab bar, dialogs, menus and popovers. It is deliberately
   NOT applied to cards, list rows or panels in the page flow: those tile and
   overlap, so translucency there reads as a rendering bug, and there is
   nothing behind them but the canvas anyway.

   Both layer styles carry an `@supports not` fallback to the opaque
   `bg.panel`, so a browser without `backdrop-filter` gets a solid surface at
   full contrast rather than a washed-out one.

   ── Why `_light` is spelled out next to `base` ─────────────────────────────
   Chakra's own defaults key their light value under `_light`, not `base`.
   `createSystem` DEEP-MERGES the two `value` objects, so overriding a token
   Chakra already defines (bg.panel, fg.muted, border.*, …) leaves Chakra's
   `_light` in place next to our `base`, and the emitted CSS puts them on
   different selectors:

       base    -> &:where(html, .chakra-theme)
       _light  -> :root &, .light &            ← higher specificity

   …so a `base`-only override silently loses in light mode. Tokens we own
   outright (bg.canvas, fg.ink, brand.*) have no `_light` sibling to fight and
   work with `base` alone — they still get one for symmetry.

   ── Light mode is almost unchanged ─────────────────────────────────────────
   Every light value below resolves to what Chakra already emitted, with two
   deliberate exceptions: `fg.subtle` is gray.500 (Chakra: gray.400 — under
   4.5:1 on white, so captions failed contrast) and `border.subtle` is gray.100
   (Chakra: gray.50 — invisible on a white card).

   The dark half is lifted one step off pure black (canvas gray.950, panels
   gray.900, borders gray.800) because Chakra's defaults paint the body black
   and the panels gray.950 — a 2% difference that made every card edge
   disappear. Lifting the panels forces the whole surface-fill ladder up with
   them, so `bg.subtle`/`bg.muted`/`bg.emphasized` are re-pinned to
   gray.800/700/600: leaving Chakra's 950/900/800 would have made `subtle`
   invisible on a panel and collided `muted` with `emphasized`.

   Keyframes, if any are ever needed, belong in `src/index.css` — Chakra v3's
   `globalCss` type rejects raw `@keyframes` blocks.
   ────────────────────────────────────────────────────────────────────── */

const config = defineConfig({
    globalCss: {
        /* ── App-wide background art ──────────────────────────────────────
           The four bela suit cards (Zima/Proljeće/Ljeto/Jesen), faint,
           behind the whole app. `bg-cards-faded.png` is a pre-processed copy
           of the source art — rotated 90° counter-clockwise (portrait photo
           → landscape, so it actually fits a screen) and its own alpha
           channel scaled to 10% (see the `python3`/Pillow one-liner in the
           commit that added it) — layered directly as `body`'s own
           `background-image`, not a separate `opacity`-ed element or
           pseudo. That was the first attempt (`body::before`,
           `position: fixed`, `z-index: -1`) and it never painted: this
           app's `body` carries `position: relative` (Chakra's own base
           layer), and a negative-z-index pseudo of a positioned element
           paints BELOW that element's own background-color, not above it —
           confirmed live in Chrome devtools (computed styles were all
           correct; forcing `z-index: 99999` painted it, `-1` never did, at
           any opacity). A background-image is just part of `body`'s own
           box, so it has no stacking question to get wrong — every real
           card/panel in the app is opaque by design (see the glass-surfaces
           note above) and simply paints over it in normal flow; it only
           shows through the gaps: page margins, empty canvas.
           `backgroundSize` is a fraction, not `cover`: `cover` crops a
           four-card fan down to whichever slice fills the viewport, which
           on a normal-width screen showed maybe one and a half cards
           zoomed in — the point was the whole fan being recognisable.
           It's a RESPONSIVE fraction, not a flat one: the percentage is of
           the viewport's own width, so the same "55%" that reads fine on a
           desktop shrinks to a barely-visible sliver on a 390px phone —
           phones need a much bigger fraction of their own (much smaller)
           screen for the fan to read as four actual cards rather than a
           smudge.
           `background-attachment: fixed` keeps it from scrolling with the
           page (degrades gracefully to scrolling-with-content on older iOS
           Safari, which never supported fixed backgrounds — not worth a
           second image just for that). */
        "html, body": {
            backgroundColor: "bg.canvas",
            backgroundImage: "url(/bg-cards-faded.png)",
            backgroundSize: { base: "95%", md: "70%", lg: "55%" },
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundAttachment: "fixed",
            color: "fg.ink",
        },
        "::selection": {
            bg: "brand.subtle",
            color: "brand.fg",
        },

        /* ── Leaflet in dark mode ──────────────────────────────────────────
           The basemap tiles are a fixed light raster from CARTO, so on the
           dark theme the map was a bright rectangle punched into a dark page.
           Filtering the tile PANE rather than each tile avoids seams between
           tiles, and markers and popups live in sibling panes so they keep
           their real colours. sepia() colourises the near-grey tiles,
           hue-rotate() swings that warm cast round to blue, saturate() gives
           it body, brightness() lifts it off pure black.

           next-themes puts `class="dark"` on <html>, so all of this is
           dark-only. */
        ".dark .leaflet-tile-pane": {
            filter: "sepia(1) hue-rotate(182deg) saturate(1.9) brightness(1.32)",
        },

        /* Leaflet's own chrome — zoom buttons, popup bubble, attribution bar —
           ships hardcoded white, which left three bright holes in the dark map,
           and the popup's Chakra content (fg.ink, light in dark mode) rendered
           white on white.

           `!important` is load-bearing, not decoration: Chakra emits globalCss
           inside `@layer base` while leaflet.css is unlayered, and unlayered
           author styles beat layered ones however specific the layered selector
           is. Marking these important reverses that precedence. */
        ".dark .leaflet-bar a": {
            background: "var(--chakra-colors-bg-panel) !important",
            color: "var(--chakra-colors-fg-ink) !important",
            borderBottomColor: "var(--chakra-colors-border) !important",
        },
        ".dark .leaflet-bar a:hover": {
            background: "var(--chakra-colors-bg-muted) !important",
        },
        ".dark .leaflet-bar a.leaflet-disabled": {
            background: "var(--chakra-colors-bg-muted) !important",
            color: "var(--chakra-colors-fg-subtle) !important",
        },
        ".dark .leaflet-popup-content-wrapper, .dark .leaflet-popup-tip": {
            background: "var(--chakra-colors-bg-panel) !important",
            color: "var(--chakra-colors-fg-ink) !important",
            boxShadow: "0 6px 24px rgba(0, 0, 0, 0.5) !important",
        },
        ".dark .leaflet-popup-close-button": {
            color: "var(--chakra-colors-fg-muted) !important",
        },
        ".dark .leaflet-control-attribution": {
            background: "rgba(9, 9, 11, 0.78) !important",
            color: "var(--chakra-colors-fg-muted) !important",
        },
        ".dark .leaflet-control-attribution a": {
            color: "var(--chakra-colors-brand-fg) !important",
        },
    },
    theme: {
        tokens: {
            colors: {
                /* The card-table felt. 800 (#0a4f20) and 950 (#052b12) are
                   lifted verbatim off `public/bela-turniri-logo.svg`; the rest
                   of the ramp is that hue carried up to a usable set of tints,
                   kept yellow-leaning at the top so `brand.100` reads as felt
                   gone pale rather than as mint. Each step earns its place:
                   600 is the AA-safe solid, 500 the focus ring, 300 the dark
                   theme's text colour, 700 the light theme's. See "One green"
                   at the top of the file for the measurements. */
                brand: {
                    50: { value: "#edf7f0" },
                    100: { value: "#d5ecdc" },
                    200: { value: "#aedbbc" },
                    300: { value: "#7fc496" },
                    400: { value: "#4faa6f" },
                    500: { value: "#2f8f52" },
                    600: { value: "#227342" },
                    700: { value: "#1a5d36" },
                    800: { value: "#0a4f20" },
                    900: { value: "#0a3d1c" },
                    950: { value: "#052b12" },
                },
                /* Re-points Chakra's stock blue at the brand ramp so the app
                   has exactly one primary colour — see "One green" above. The
                   name is now a pure legacy alias: it says "blue" and paints
                   felt green, which is the price of not touching 130 call
                   sites. Kept as a FULL ramp, not just the semantics, because
                   `blue.500` and friends are referenced directly in a handful
                   of places and a half-aliased ramp would leave those blue. */
                blue: {
                    50: { value: "#edf7f0" },
                    100: { value: "#d5ecdc" },
                    200: { value: "#aedbbc" },
                    300: { value: "#7fc496" },
                    400: { value: "#4faa6f" },
                    500: { value: "#2f8f52" },
                    600: { value: "#227342" },
                    700: { value: "#1a5d36" },
                    800: { value: "#0a4f20" },
                    900: { value: "#0a3d1c" },
                    950: { value: "#052b12" },
                },
            },
            /* Chakra's stock scale tops out at 6px for a card and 4px for a
               button, which is what made the app read as "default Chakra".
               Everything below is roughly double, matched to the sibling app
               so the two feel like one family. The names are unchanged, so the
               existing `rounded="md"` / `rounded="xl"` props keep working and
               simply land on rounder values. */
            radii: {
                none: { value: "0" },
                "2xs": { value: "3px" },
                xs: { value: "5px" },
                sm: { value: "8px" },
                md: { value: "10px" },
                lg: { value: "12px" },
                xl: { value: "16px" },
                "2xl": { value: "20px" },
                "3xl": { value: "26px" },
                "4xl": { value: "32px" },
                full: { value: "9999px" },
            },
        },
        textStyles: {
            /* Page-level h1 — the tournament name, a profile's display name. */
            title: {
                value: {
                    fontWeight: "bold",
                    fontSize: { base: "2xl", md: "3xl" },
                    lineHeight: "1.15",
                    letterSpacing: "-0.02em",
                },
            },
            /* Section headings inside a page ("Runde", "Cjenik", "Parovi"). */
            heading: {
                value: {
                    fontWeight: "semibold",
                    fontSize: "md",
                    lineHeight: "1.3",
                    letterSpacing: "-0.01em",
                },
            },
            /* Default running text. */
            body: {
                value: {
                    fontWeight: "normal",
                    fontSize: "sm",
                    lineHeight: "1.55",
                },
            },
            /* Muted metadata under a value — dates, hints, helper text. */
            caption: {
                value: {
                    fontWeight: "medium",
                    fontSize: "xs",
                    lineHeight: "1.4",
                    letterSpacing: "0.01em",
                },
            },
            /* Scores, prices and any digits that must line up in a column. */
            mono: {
                value: {
                    fontFamily: "mono",
                    fontWeight: "semibold",
                    fontSize: "sm",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.01em",
                },
            },
        },
        semanticTokens: {
            colors: {
                bg: {
                    /* The unqualified `bg`. Chakra's dark value is pure BLACK,
                       which is darker than this app's canvas (gray.950) and
                       two steps below its panels (gray.900) — so every control
                       that fills from it rendered as a hole punched in the
                       card it sat on. That is not a niche token: Chakra's own
                       checkmark, radiomark, native-select, segment-group,
                       tabs, code-block and qr-code recipes all paint from it,
                       and eight call sites in this app say `bg="bg"` directly
                       (the autocomplete dropdown, the map picker's floating
                       label, the avatar preview…).

                       Pinned to the panel colour, which is what all of those
                       actually want: a control surface sitting ON a card.
                       The page background is `bg.canvas`, below. */
                    DEFAULT: {
                        value: { base: "{colors.white}", _light: "{colors.white}", _dark: "{colors.gray.900}" },
                    },
                    /* The page itself, behind every panel. New token — Chakra
                       paints the body from `bg`, which we leave alone so any
                       component still reading it is unaffected.

                       Light was stock white until 2026-09-06: a page of pure
                       white cards on a pure white floor read as "no theme at
                       all" rather than as this app's identity. #dae7de is
                       the brand hue (~140°) carried up to an ~88% lightness
                       greige — a first pass at #f0f5f1 read as too close to
                       `gray.50` and was pushed darker on request. Still
                       distinct enough from `gray.50` (#fafafa, the neutral
                       ladder below) that a translucent `bg.panel` card
                       visibly lifts off the canvas (composited panel ≈
                       #f1f6f2, 1.17:1 over this canvas), and pale enough
                       that `fg.ink` (black) still clears 16.4:1 — AA/AAA are
                       unaffected. `bg.subtle/muted/emphasized` stay plain
                       gray on purpose: they are recessed fills INSIDE a
                       panel, not a second canvas, so nothing here needed to
                       move to keep the ladder legible. Dark is untouched —
                       this is a light-theme-only accent. */
                    canvas: {
                        value: { base: "#dae7de", _light: "#dae7de", _dark: "{colors.gray.950}" },
                    },
                    /* Cards, dialogs, the navbar — one step above the canvas.
                       Translucent (61%) — actually past `glass`'s own 72% at
                       this point, on purpose: 85% barely showed the page
                       background through a normal (unblurred) card, so this
                       was pushed further than the "chrome that floats over
                       content and leans on blur" tier below was ever meant
                       to go, until it read clearly on an ordinary card. */
                    panel: {
                        value: {
                            base: "rgba(255, 255, 255, 0.61)",
                            _light: "rgba(255, 255, 255, 0.61)",
                            _dark: "rgba(24, 24, 27, 0.61)",
                        },
                    },
                    /* Quiet fills: table stripes, inactive chips, code blocks.
                       Dark is gray.800, NOT gray.900 — a stripe painted the
                       same colour as the panel it sits on is no stripe.

                       Deliberately NEUTRAL, not felt-tinted. A faint green wash
                       here (#f6faf7, ΔE 2.8 off gray.50) was tried and dropped:
                       this token is the app's "no state" fill — code blocks,
                       inactive chips, disabled rows — and any green on it reads
                       as a success state next to the teal `green.subtle` chips
                       it sits beside. Tinting only the light half would also
                       have made the two themes disagree, since the dark ladder
                       has to stay a neutral gray to keep four surfaces apart.
                       Selected/active rows carry the brand through
                       `brand.subtle`, which is the token that should. */
                    subtle: {
                        value: { base: "{colors.gray.50}", _light: "{colors.gray.50}", _dark: "{colors.gray.800}" },
                    },
                    /* Hover/pressed fills, one step louder than `subtle`. */
                    muted: {
                        value: { base: "{colors.gray.100}", _light: "{colors.gray.100}", _dark: "{colors.gray.700}" },
                    },
                    /* Loudest surface fill — selected rows, active chips.
                       Chakra's dark default is gray.800, which our `subtle`
                       now occupies, so the whole dark ladder is shifted one
                       step up to keep all four surfaces distinguishable:
                       canvas 950 → panel 900 → subtle 800 → muted 700 →
                       emphasized 600. Light is left exactly as Chakra has it. */
                    emphasized: {
                        value: { base: "{colors.gray.200}", _light: "{colors.gray.200}", _dark: "{colors.gray.600}" },
                    },
                    /* ── Glass surfaces ──────────────────────────────────────
                       Translucent twins of `bg.panel`, for material that
                       floats over page content. Never used on their own: they
                       only make sense paired with the backdrop blur in the
                       `glass.*` layer styles below, which also carry the
                       opaque fallback. Values are the RGB of white / gray.900
                       so the tint stays in the same family as `bg.panel`. */
                    glass: {
                        value: {
                            base: "rgba(255, 255, 255, 0.72)",
                            _light: "rgba(255, 255, 255, 0.72)",
                            _dark: "rgba(24, 24, 27, 0.72)",
                        },
                    },
                    /* Denser than `glass` because a dialog carries dense body
                       text over an arbitrary, possibly busy page. */
                    glassPanel: {
                        value: {
                            base: "rgba(255, 255, 255, 0.88)",
                            _light: "rgba(255, 255, 255, 0.88)",
                            _dark: "rgba(24, 24, 27, 0.90)",
                        },
                    },
                },
                fg: {
                    /* Primary text. Matches Chakra's `fg` exactly — it exists as
                       a named token so call sites read as intent, not default. */
                    ink: {
                        value: { base: "{colors.black}", _light: "{colors.black}", _dark: "{colors.gray.50}" },
                    },
                    /* Secondary text that must still be comfortably readable —
                       one notch quieter than `ink`, louder than `muted`. */
                    soft: {
                        value: { base: "{colors.gray.700}", _light: "{colors.gray.700}", _dark: "{colors.gray.300}" },
                    },
                    muted: {
                        value: { base: "{colors.gray.600}", _light: "{colors.gray.600}", _dark: "{colors.gray.400}" },
                    },
                    /* Light is gray.500 (Chakra ships gray.400, which is under
                       4.5:1 on white). Dark used the SAME gray.500, which is
                       the mirror-image of the same bug: measured against
                       bg.panel it is 3.67:1, and against bg.subtle worse.
                       That is not a decorative tier — `fg.subtle` paints the
                       INACTIVE LABELS in the mobile tab bar, the "optional"
                       markers on the create wizard and the review card's
                       placeholder headings, all of which are real text.

                       #91919a sits between gray.500 and gray.400: 5.50:1 on
                       bg.panel and 4.74:1 on bg.subtle, while staying visibly
                       quieter than `fg.muted` (gray.400) so the four-step text
                       ladder survives. A literal rather than a ramp step
                       because Chakra's zinc jumps straight from 113 to 161
                       and the passing value is in between. */
                    subtle: {
                        value: { base: "{colors.gray.500}", _light: "{colors.gray.500}", _dark: "#91919a" },
                    },
                },
                border: {
                    DEFAULT: {
                        value: { base: "{colors.gray.200}", _light: "{colors.gray.200}", _dark: "{colors.gray.800}" },
                    },
                    /* Chakra's dark `border.subtle` is gray.950 — invisible on a
                       gray.900 panel. Pinned to gray.800 so hairlines survive. */
                    subtle: {
                        value: { base: "{colors.gray.100}", _light: "{colors.gray.100}", _dark: "{colors.gray.800}" },
                    },
                    emphasized: {
                        value: { base: "{colors.gray.300}", _light: "{colors.gray.300}", _dark: "{colors.gray.700}" },
                    },
                    /* Loudest divider — focused fields, the active tab underline. */
                    strong: {
                        value: { base: "{colors.gray.400}", _light: "{colors.gray.400}", _dark: "{colors.gray.600}" },
                    },
                    /* Hairline for a glass surface. A solid `border` token on a
                       translucent bar reads as a hard line floating in front of
                       the blur; a translucent one sits in it. */
                    glass: {
                        value: {
                            base: "rgba(0, 0, 0, 0.08)",
                            _light: "rgba(0, 0, 0, 0.08)",
                            _dark: "rgba(255, 255, 255, 0.10)",
                        },
                    },
                },
                /* ── The default focus ring ──────────────────────────────────
                   Chakra's `focusVisibleRing` reads `colors.colorPalette.
                   focusRing`, and the ROOT `colorPalette` is `gray` (set in
                   Chakra's own globalCss), not blue/brand — so every control
                   that doesn't carry an explicit `colorPalette` prop focused
                   in gray.400. That is most Inputs, Textareas and Selects in
                   the app: the keyboard-focus affordance, the one piece of
                   chrome that should say "this app" loudest, was the only
                   interactive colour that never became the brand.

                   Overriding `gray.focusRing` rather than the root
                   `colorPalette` is deliberate: pointing the root at `brand`
                   would turn every unstyled Button, Badge and Tabs trigger
                   green too, which is a call-site decision, not a theme one.
                   Nothing but the ring reads this token, so the blast radius
                   is exactly the ring. brand.500 clears the 3:1 non-text bar
                   on both canvases (4.06:1 on white, 4.65:1 on gray.950). */
                gray: {
                    focusRing: { value: { base: "{colors.brand.500}", _light: "{colors.brand.500}", _dark: "{colors.brand.500}" } },
                },
                /* Makes `colorPalette="brand"` fully wired. Shaped exactly like
                   Chakra's own ramp semantics so swapping a `colorPalette` from
                   "blue" to "brand" is visually a no-op today and a single edit
                   here on the day the brand hue changes.

                   Every pairing below was measured against the real surfaces
                   (light canvas #fff, dark canvas gray.950, and the TRANSLUCENT
                   bg.panel composited over each — dark panel resolves to about
                   #151517, not gray.900). Text tiers clear 4.5:1 and the ring
                   clears 3:1 in both modes. The one pairing that does not is
                   `fg` on `emphasized` (3.84:1) — that is Chakra's hover step
                   for the subtle variant, the old blue ramp measured 3.49:1 in
                   exactly the same place, and pulling the ramp apart far enough
                   to fix it would cost the felt hue. Left at parity, knowingly. */
                brand: {
                    contrast: { value: { base: "white", _light: "white", _dark: "white" } },
                    fg: { value: { base: "{colors.brand.700}", _light: "{colors.brand.700}", _dark: "{colors.brand.300}" } },
                    subtle: { value: { base: "{colors.brand.100}", _light: "{colors.brand.100}", _dark: "{colors.brand.900}" } },
                    muted: { value: { base: "{colors.brand.200}", _light: "{colors.brand.200}", _dark: "{colors.brand.800}" } },
                    emphasized: { value: { base: "{colors.brand.300}", _light: "{colors.brand.300}", _dark: "{colors.brand.700}" } },
                    /* brand.600, not brand.500 — this is the fill under white
                       button text and #2f8f52 measures only 4.06:1 there, where
                       #227342 measures 5.83:1. See "One green" at the top. */
                    solid: { value: { base: "{colors.brand.600}", _light: "{colors.brand.600}", _dark: "{colors.brand.600}" } },
                    /* brand.500 — 4.06:1 on white and 4.65:1 on the dark canvas,
                       so one ring value clears the 3:1 bar in both themes. */
                    focusRing: { value: { base: "{colors.brand.500}", _light: "{colors.brand.500}", _dark: "{colors.brand.500}" } },
                },
                /* `colorPalette="blue"` is the same colour as `colorPalette=
                   "brand"` by construction — call sites are split between the
                   two names and they must not be two different colours. */
                blue: {
                    contrast: { value: { base: "white", _light: "white", _dark: "white" } },
                    fg: { value: { base: "{colors.brand.700}", _light: "{colors.brand.700}", _dark: "{colors.brand.300}" } },
                    subtle: { value: { base: "{colors.brand.100}", _light: "{colors.brand.100}", _dark: "{colors.brand.900}" } },
                    muted: { value: { base: "{colors.brand.200}", _light: "{colors.brand.200}", _dark: "{colors.brand.800}" } },
                    emphasized: { value: { base: "{colors.brand.300}", _light: "{colors.brand.300}", _dark: "{colors.brand.700}" } },
                    solid: { value: { base: "{colors.brand.600}", _light: "{colors.brand.600}", _dark: "{colors.brand.600}" } },
                    focusRing: { value: { base: "{colors.brand.500}", _light: "{colors.brand.500}", _dark: "{colors.brand.500}" } },
                },
                /* Success / paid / synced. Re-pointed at `teal` so it survives
                   a green brand — see "Green brand vs green success" at the top
                   of the file. Only the SEMANTICS move: the numeric `green.*`
                   ramp is left stock, because nothing in the app references it
                   and a chart or an illustration may still want literal green.

                   `solid` splits by mode instead of taking one step, which is
                   the only place this ramp departs from the brand's shape.
                   teal.700 carries white text at 7.73:1 but sits at 2.36:1
                   against the dark panel — a legible badge on an invisible
                   pill — while teal.600 has the fill contrast (4.87:1) and
                   fails white text at 3.74:1. So the dark solid is teal.600
                   with BLACK text (5.33:1), which is what Chakra itself does
                   for its lighter palettes, and the light solid stays white on
                   teal.700. Both halves clear AA on both axes. Chakra's own
                   green.solid, for the record, was green.600 under white text
                   at 3.30:1 — this replaces a real AA failure. */
                green: {
                    contrast: { value: { base: "white", _light: "white", _dark: "black" } },
                    fg: { value: { base: "{colors.teal.700}", _light: "{colors.teal.700}", _dark: "{colors.teal.300}" } },
                    subtle: { value: { base: "{colors.teal.100}", _light: "{colors.teal.100}", _dark: "{colors.teal.900}" } },
                    muted: { value: { base: "{colors.teal.200}", _light: "{colors.teal.200}", _dark: "{colors.teal.800}" } },
                    emphasized: { value: { base: "{colors.teal.300}", _light: "{colors.teal.300}", _dark: "{colors.teal.700}" } },
                    solid: { value: { base: "{colors.teal.700}", _light: "{colors.teal.700}", _dark: "{colors.teal.600}" } },
                    focusRing: { value: { base: "{colors.teal.600}", _light: "{colors.teal.600}", _dark: "{colors.teal.500}" } },
                },
            },
            radii: {
                /* Chakra's component recipes read these three, NOT the raw
                   scale: l1 → checkmarks and swatches, l2 → Button / Input /
                   Tag / Tabs triggers / menu items, l3 → Card / Dialog / Menu
                   / Popover / Select content. Defaults are xs/sm/md (2/4/6px);
                   pointing them one rung higher is what actually rounds the
                   app, and it happens without a single call-site edit. */
                l1: { value: "{radii.xs}" },
                l2: { value: "{radii.md}" },
                l3: { value: "{radii.xl}" },
            },
            shadows: {
                /* Additive names only — Chakra's xs/sm/md/lg/xl/2xl are left
                   untouched so nothing that already uses them shifts. The
                   light-mode tint is brand.950 (rgba(5, 43, 18, …)) rather than
                   neutral black, so a card's shadow sits in the same family as
                   the felt; at 6–16% alpha it reads as depth, not as colour.
                   Dark values drop the tint for plain black, which is the only
                   thing that reads as depth on a near-black canvas. */
                card: {
                    value: {
                        base: "0 1px 2px rgba(5, 43, 18, 0.06), 0 1px 3px rgba(5, 43, 18, 0.08)",
                        _light: "0 1px 2px rgba(5, 43, 18, 0.06), 0 1px 3px rgba(5, 43, 18, 0.08)",
                        _dark: "0 1px 2px rgba(0, 0, 0, 0.5)",
                    },
                },
                raised: {
                    value: {
                        base: "0 4px 12px rgba(5, 43, 18, 0.08)",
                        _light: "0 4px 12px rgba(5, 43, 18, 0.08)",
                        _dark: "0 4px 12px rgba(0, 0, 0, 0.55)",
                    },
                },
                overlay: {
                    value: {
                        base: "0 12px 32px rgba(5, 43, 18, 0.16)",
                        _light: "0 12px 32px rgba(5, 43, 18, 0.16)",
                        _dark: "0 12px 32px rgba(0, 0, 0, 0.65)",
                    },
                },
                /* Bottom tab bar / sticky action rows — the shadow points up. */
                sticky: {
                    value: {
                        base: "0 -4px 20px rgba(5, 43, 18, 0.06)",
                        _light: "0 -4px 20px rgba(5, 43, 18, 0.06)",
                        _dark: "0 -4px 20px rgba(0, 0, 0, 0.5)",
                    },
                },
            },
        },
        /* ── The glossy surface treatment ──────────────────────────────────
           `layerStyle="glass.bar"` / `"glass.panel"` — background + blur +
           fallback in one name, so the recipe lives here and not in six
           components with six slightly different blur radii. */
        layerStyles: {
            glass: {
                /* Sticky/fixed chrome: the header and the mobile tab bar.
                   `saturate` keeps colours from going grey behind the blur,
                   which is what makes it read as glass rather than as fog. */
                bar: {
                    value: {
                        bg: "bg.glass",
                        backdropFilter: "saturate(180%) blur(20px)",
                        WebkitBackdropFilter: "saturate(180%) blur(20px)",
                        [NO_BACKDROP_FILTER]: { bg: "bg.panel" },
                    },
                },
                /* Floating material inside the page flow: the sticky action
                   rows on the create wizard and the organiser edit form. */
                panel: {
                    value: {
                        bg: "bg.glassPanel",
                        backdropFilter: "saturate(180%) blur(24px)",
                        WebkitBackdropFilter: "saturate(180%) blur(24px)",
                        [NO_BACKDROP_FILTER]: { bg: "bg.panel" },
                    },
                },
            },
        },
        /* Partial overrides — `createSystem` deep-merges these into Chakra's
           own slot recipes, so only the listed properties change and every
           variant, size and part we don't mention is untouched.

           This is how dialogs / menus / popovers get the glass treatment
           without a `layerStyle` prop on each of the ~25 `Dialog.Content` call
           sites. It has to happen at the recipe layer rather than in
           `globalCss`, because Chakra emits recipes into a CSS layer that wins
           over `base` — a global rule setting `background` would simply lose to
           the recipe's own `bg: bg.panel`.

           `slots` is required by the type and is re-stated from the SAME
           anatomy Chakra's own recipe uses. That matters: the config merge
           walks arrays index by index, so handing it a shorter list (say
           `["content"]`) would overwrite slot 0 of the real anatomy and leave
           the rest — quietly breaking every other part of the component.
           Passing the identical array makes the merge a no-op. */
        slotRecipes: {
            dialog: { slots: dialogAnatomy.keys(), base: { content: GLASS_CONTENT } },
            menu: { slots: menuAnatomy.keys(), base: { content: GLASS_CONTENT } },
            popover: { slots: popoverAnatomy.keys(), base: { content: GLASS_CONTENT } },
        },
    },
})

export const system = createSystem(defaultConfig, config)
