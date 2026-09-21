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

/** Glass for floating material — the shared body of the `dialog` slot-recipe
 *  override below.
 *
 *  No `WebkitBackdropFilter` here, unlike `layerStyles.glass.*`: a slot
 *  recipe's styles are typed as `SystemStyleObject`, which only admits
 *  properties Chakra generates, and vendor prefixes aren't among them.
 *  Browsers that support only the prefixed property (iOS Safari before 18)
 *  therefore take the `@supports not` branch and get the opaque `bg.opaque` —
 *  a solid dialog at full contrast, which is the correct degradation anyway. */
const GLASS_CONTENT: SystemStyleObject = {
    bg: "bg.glassPanel",
    backdropFilter: "saturate(180%) blur(24px)",
    [NO_BACKDROP_FILTER]: { bg: "bg.opaque" },
}

/** Opaque floating material for menus and popovers (2026-09-10).
 *
 *  They used to share GLASS_CONTENT, and on iOS Safari that produced an
 *  unreadable menu: the avatar/burger menu rendered as a tint with NO blur
 *  over the tournament posters behind it. Safari drops `backdrop-filter` on a
 *  popper-positioned layer while it is transformed/animated (Chakra's
 *  Menu/Popover positioner + enter animation), and the `@supports` fallback
 *  never fires because the property IS supported — it just isn't applied. A
 *  dialog is different: its content sits on a fixed full-screen backdrop, no
 *  popper transform, and the blur holds, so dialogs keep the glass. */
const SOLID_CONTENT: SystemStyleObject = {
    // `bg.opaque` (THEME --opaque: modals, popovers), one step above the
    // panel, so a menu reads as floating over the cards behind it.
    bg: "bg.opaque",
}

/* ──────────────────────────────────────────────────────────────────────────
   bela-turniri.com design system — THEME.md ("Pergament" light, "Sumrak"
   dark) mapped onto Chakra v3. THEME.md is the single source of truth for
   every colour and font below; the same values exist as plain CSS variables
   (`--canvas`, `--brand`, `--sh-card` …) in `src/index.css` for non-Chakra
   styles. The app switches theme with `class="dark"` on <html>.

   Built as `createSystem(defaultConfig, config)` — a MERGE on top of Chakra's
   own preset, not a replacement. Every default token name (`gray.500`,
   `blue.fg`, `bg.subtle`, `fg.muted`, `border.emphasized`, the whole
   `colorPalette` machinery …) stays valid; this file re-values them.

   What lives here
   ───────────────
   • Surface / text / border ladders (`bg.*`, `fg.*`, `border*`) that resolve
     to the THEME neutrals in each mode.
   • `brand.50…950` — the felt green, anchored on the THEME brand values —
     plus `colorPalette` semantics for `brand`, `blue`, `gray` and the four
     palettes re-pointed at THEME semantics: `orange` → live, `green` → ok,
     `yellow` → gold, `red` → red, `purple` → tan (admin styling).
   • Named THEME colours: `tan`, `live`, `ok`, `gold`, `danger`, the card-table
     `felt`/`felt2`/`cardface`/`cardline` and the four `suit.*` colours.
   • Fonts (`heading` / `body` / `mono`, self-hosted variable fonts imported
     in main.tsx), `textStyles`, elevation shadows, the `l1`/`l2`/`l3` radii
     and the glass layer styles.

   ── Why blue is an alias ───────────────────────────────────────────────────
   130-odd call sites say `colorPalette="blue"` or reference `blue.fg` /
   `blue.subtle` / `blue.solid` directly. Chakra's stock `blue` ramp and its
   semantics are therefore kept as an ALIAS of the brand ramp, step for step:
   `colorPalette="blue"` and `colorPalette="brand"` are the same colour by
   construction, and a rebrand is one ramp instead of 130 edits. Rename a
   `blue.*` reference when you are already editing that line, never on its
   own. `theme-color` (index.html, color-mode.tsx, the manifests) and the
   map-pin SVGs are OUTSIDE this file and must be moved by hand.

   ── Brand solid vs THEME `--brand` ─────────────────────────────────────────
   THEME has one `--brand-solid` (primary button fill) and one `--brand`
   (progress fill, accents). They are the same colour in light (#2E6343, ramp
   step 600) and differ in dark: solid #2F8F52 (500) carries the `on-brand`
   text, `--brand` #79C08F (400) is the vivid accent. `brand.solid` is the
   former, `brand.DEFAULT` the latter.

   ── Palettes that follow THEME semantics ───────────────────────────────────
   `orange`, `green`, `yellow`, `red` and `purple` keep their names but their SEMANTICS
   (solid / fg / subtle / muted / emphasized / contrast / focusRing) point at
   THEME's live / ok / gold / red / tan, so `colorPalette="orange"` on a badge is
   "Igra se" without a call-site edit. Only the semantics move; the numeric
   Chakra ramps (`orange.500` …) are stock and should be migrated to the
   named tokens (`live`, `ok`, `gold`, `danger`) when touched. THEME ships
   subtles for live / ok / tan only: the gold and red subtles are mixed from
   the colour into the panel/canvas, and every `muted` / `emphasized` is the
   subtle mixed 22 % / 42 % toward the solid colour (see `PALETTE`).

   ── Corners ───────────────────────────────────────────────────────────────
   Chakra v3's component recipes do not read `radii.md` directly; they read the
   SEMANTIC radii `l1`/`l2`/`l3`. Redefining those three plus the raw scale
   rounds every Button, Input, Card, Dialog, Menu, Popover, Select, Tag and
   Tabs trigger at once, so no call site adds `rounded`.

   ── Gloss ─────────────────────────────────────────────────────────────────
   Literal `opacity` on an element also fades its text, so "glass" is a
   translucent background token plus `backdrop-filter: blur()`, content on top
   at full opacity. It is applied only to MATERIAL surfaces that float over
   other content: the sticky header, the mobile tab bar, dialogs (menus and
   popovers are opaque, see SOLID_CONTENT). Cards and list rows in the page
   flow are opaque `bg.panel` — translucency there reads as a rendering bug.
   Both layer styles carry an `@supports not` fallback to the opaque
   `bg.panel`, so a browser without `backdrop-filter` gets a solid surface.

   ── Why `_light` is spelled out next to `base` ─────────────────────────────
   Chakra's own defaults key their light value under `_light`, not `base`.
   `createSystem` DEEP-MERGES the two `value` objects, so overriding a token
   Chakra already defines (bg.panel, fg.muted, border.*, gray.*, …) leaves
   Chakra's `_light` in place next to our `base`, and the emitted CSS puts them
   on different selectors:

       base    -> &:where(html, .chakra-theme)
       _light  -> :root &, .light &            ← higher specificity

   …so a `base`-only override silently loses in light mode. Every token below
   therefore goes through `pair()`, which writes `base` and `_light` alike.

   ── Recipes layer ──────────────────────────────────────────────────────────
   Chakra emits slot recipes into a CSS layer that wins over `globalCss`
   (`@layer base`), which is why the dialog glass lives in `slotRecipes`.
   Keyframes, if any are ever needed, belong in `src/index.css` — Chakra v3's
   `globalCss` type rejects raw `@keyframes` blocks.
   ────────────────────────────────────────────────────────────────────── */

/** A colour that differs by mode. `base` and `_light` carry the same value on
 *  purpose — see "Why `_light` is spelled out" above. */
const pair = (light: string, dark: string) => ({
    value: { base: light, _light: light, _dark: dark },
})

/** The felt-green ramp. Anchored on THEME: 100 = light brand-subtle, 300 =
 *  dark brand-fg, 400 = dark `--brand`, 500 = dark brand-solid, 600 = light
 *  brand / brand-solid, 700 = light brand-fg, 800 = dark brand-subtle,
 *  950 = dark on-brand. 50 / 200 / 900 are interpolated in the same hue. */
const BRAND_RAMP = {
    50: { value: "#F0F6EF" },
    100: { value: "#DDE9DC" },
    200: { value: "#B6D8BF" },
    300: { value: "#8ACFA0" },
    400: { value: "#79C08F" },
    500: { value: "#2F8F52" },
    600: { value: "#2E6343" },
    700: { value: "#265238" },
    800: { value: "#264233" },
    900: { value: "#182B21" },
    950: { value: "#0E1F16" },
}

/** Warm neutral ramp so raw `gray.*` reads warm. 50–300 are THEME's light
 *  fills/borders, 500 / 600 / 700 / 800 its faint / muted / soft / ink. It is
 *  a single mode-independent ramp (like every Chakra numeric ramp); the mode
 *  awareness lives in the `bg.*` / `fg.*` / `border*` / `gray.*` semantics. */
const GRAY_RAMP = {
    50: { value: "#FAF6EE" },
    100: { value: "#F2ECE1" },
    200: { value: "#E4DACA" },
    300: { value: "#C9BBA2" },
    400: { value: "#ACA08A" },
    500: { value: "#8D7F6E" },
    600: { value: "#6E6152" },
    700: { value: "#4E4238" },
    800: { value: "#2A211A" },
    900: { value: "#1D1712" },
    950: { value: "#120E0A" },
}

/** THEME statuses as semantic-palette objects (`colorPalette` shape). Where
 *  THEME has no value the choice is noted inline; `solid` is the THEME colour
 *  itself, `contrast` the best of cream / dark text on it. */
const statusPalette = (p: {
    solid: [string, string]
    contrast: [string, string]
    fg: [string, string]
    subtle: [string, string]
    muted: [string, string]
    emphasized: [string, string]
    focusRing: [string, string]
}) => ({
    solid: pair(...p.solid),
    contrast: pair(...p.contrast),
    fg: pair(...p.fg),
    subtle: pair(...p.subtle),
    muted: pair(...p.muted),
    emphasized: pair(...p.emphasized),
    focusRing: pair(...p.focusRing),
})

/** Palettes built from THEME statuses. `muted` = subtle mixed 22 % toward the
 *  solid colour, `emphasized` = 42 % (light mixed over the light subtle, dark
 *  over the dark subtle). */
const PALETTE = {
    // live / orange — THEME live + live-subtle. Cream on #C4661C is 3.9:1
    // (ink is 3.96:1): a THEME value, flagged, not corrected.
    live: statusPalette({
        solid: ["#C4661C", "{colors.orange.500}"],
        contrast: ["#FFFCF7", "#000000"],
        fg: ["#C4661C", "{colors.orange.300}"],
        subtle: ["#F7E3CE", "{colors.orange.900}"],
        muted: ["#ECC8A7", "{colors.orange.800}"],
        emphasized: ["#E2AF83", "{colors.orange.700}"],
        focusRing: ["#C4661C", "{colors.orange.500}"],
    }),
    // ok / green — THEME ok + ok-subtle.
    ok: statusPalette({
        solid: ["#1F6F63", "{colors.teal.600}"],
        contrast: ["#FFFCF7", "#000000"],
        fg: ["#1F6F63", "{colors.teal.300}"],
        subtle: ["#DCEDE8", "{colors.teal.900}"],
        muted: ["#B2D1CB", "{colors.teal.800}"],
        emphasized: ["#8DB8B0", "{colors.teal.700}"],
        focusRing: ["#1F6F63", "{colors.teal.500}"],
    }),
    // tan (team ONI, secondary accent; also standing in for `purple`, see the
    // semantics below) — THEME tan + tan-subtle. `fg` is THEME tan itself
    // (3.97:1 on the light panel — flagged, THEME's value). `solid` is the
    // one deliberate departure: tan mixed 10 % toward ink (#9C6939), because
    // cream on THEME's #A9713C is only 4.01:1 and a filled button / badge must
    // carry AA text (cream on #9C6939 = 4.57:1). Dark solid is THEME tan with
    // canvas-coloured text (6.44:1).
    tan: statusPalette({
        solid: ["#9C6939", "#a98a6d"],
        contrast: ["#FFFCF7", "#000000"],
        fg: ["#A9713C", "#c4a98c"],
        subtle: ["#F2E3CE", "#2b2723"],
        muted: ["#E2CAAE", "#3f362d"],
        emphasized: ["#D3B391", "#54463a"],
        focusRing: ["#A9713C", "#c4a98c"],
    }),
    // gold / yellow — THEME gold; subtle is NOT in THEME: light = gold 16 %
    // into the panel (#FDFBF7), dark = gold 18 % into the canvas (#171B1D).
    // Cream on light gold is 3.06:1, so the light contrast is ink (5.03:1).
    gold: statusPalette({
        solid: ["#B88A24", "{colors.yellow.300}"],
        contrast: ["#2A211A", "#000000"],
        fg: ["#B88A24", "{colors.yellow.300}"],
        subtle: ["#F2E9D5", "{colors.yellow.900}"],
        muted: ["#E5D4AE", "{colors.yellow.800}"],
        emphasized: ["#DAC18B", "{colors.yellow.700}"],
        focusRing: ["#B88A24", "{colors.yellow.500}"],
    }),
    // red — THEME red; subtle derived like gold's (16 % / 18 %). Dark solid
    // is the salmon #E27A70 with canvas-coloured text (5.09:1).
    red: statusPalette({
        solid: ["#B8423C", "{colors.red.600}"],
        contrast: ["#FFFCF7", "#ffffff"],
        fg: ["#B8423C", "{colors.red.300}"],
        subtle: ["#F2DDD9", "{colors.red.900}"],
        muted: ["#E5BBB6", "{colors.red.800}"],
        emphasized: ["#DA9C97", "{colors.red.700}"],
        focusRing: ["#B8423C", "{colors.red.500}"],
    }),
}

/** Brand semantics — `brand` and `blue` are identical (see "Why blue is an
 *  alias"). Every value resolves to a THEME value in its mode. */
const brandSemantics = {
    // THEME --brand: light = solid (600), dark = the vivid #79C08F (400).
    DEFAULT: pair("{colors.brand.600}", "#7fc496"),
    // --on-brand: #FFFCF7 light / #0E1F16 dark.
    contrast: pair("#FFFCF7", "#ffffff"),
    fg: pair("{colors.brand.700}", "#7fc496"),
    subtle: pair("{colors.brand.100}", "#0a3d1c"),
    // Ladder subtle → muted → emphasized, one ramp step each.
    muted: pair("{colors.brand.200}", "#0a4f20"),
    emphasized: pair("{colors.brand.300}", "#1a5d36"),
    solid: pair("{colors.brand.600}", "#227342"),
    // The ring is the vivid brand: 6.6:1 on the light panel, 5.9:1 on dark.
    focusRing: pair("{colors.brand.600}", "#2f8f52"),
}

/* DARK MODE (2026-09-21): the THEME.md "Sumrak" dark palette was tried in three
   strengths and rejected as too loud; every `_dark` value below is the earlier
   production one (neutral zinc surfaces, Chakra 300–900 status steps, the old
   brand greens), except `tan`, which is a muted taupe. Light is THEME.md. */
const config = defineConfig({
    globalCss: {
        /* ── App-wide background colour ───────────────────────────────────
           The faint four-suit card art lives in `components/AppBackground.tsx`
           (a real `position: fixed` element — iOS Safari ignores
           `background-attachment: fixed` on the document scroller). `body`
           keeps only the base colour and the body font here; its own
           background propagates to the canvas layer (CSS spec), which is why
           `AppBackground` needs no colour of its own. */
        "html, body": {
            backgroundColor: "bg.canvas",
            color: "fg.ink",
            fontFamily: "body",
        },
        /* The page never moves sideways and never rubber-bands (2026-09-21,
           reported from an iPhone: the lobby could be dragged left/right and
           pulled past its own top and bottom). Two separate causes:
             - sideways: ONE element wider than the viewport (a lobby card's
               badge row) made the whole document horizontally scrollable.
               That element is fixed at its source; `overflow-x: clip` is the
               net under the next one. `clip`, not `hidden`: it makes no scroll
               container, so `position: sticky` headers keep working.
             - past the ends: Safari's elastic overscroll. `overscroll-behavior`
               switches it off; pull-to-refresh is our own touch handler
               (`PwaNativeGestures`), not the browser's, so nothing is lost.
           Inner scrollers (dialogs, the filter chip strip, tables) are
           untouched — this is the document only. */
        html: {
            overflowX: "clip",
            overscrollBehaviorY: "none",
        },
        body: {
            overflowX: "clip",
            overscrollBehaviorX: "none",
        },
        "::selection": {
            bg: "brand.subtle",
            color: "brand.fg",
        },

        /* ── Leaflet in dark mode ──────────────────────────────────────────
           The basemap tiles are a fixed light raster from CARTO, so on the
           dark theme the map would be a bright rectangle in a dark page.
           Filtering the tile PANE (not each tile) avoids seams, and markers
           and popups live in sibling panes so they keep their real colours.

           Two steps that don't fight each other:
             1. `brightness()`/`contrast()` on the pane — tone only, never hue,
                so it darkens a placeholder tile and a real one identically.
                0.2 lands white ≈ #333: dark, not full black.
             2. A `::after` pseudo INSIDE the tile pane (confined to tiles)
                blended with `mix-blend-mode: color`, which takes hue and
                saturation from its own background and lightness from what is
                behind it — so it imposes the tint even on a desaturated
                pixel (a `hue-rotate` has nothing to rotate there) while each
                tile keeps its own tone. The tint is the "Sumrak" canvas hue
                (~180°, teal) so the map sits with the dark palette.
           The pane's filter runs on the composited result of both steps, so
           the tint is darkened along with the tiles.

           `.dark` is `class="dark"` on <html>, so all of this is dark-only.
           `.bela-basemap-raster` narrows it to the RASTER path: with
           VITE_MAP_PROVIDER=openfreemap the basemap is a MapLibre GL canvas
           drawing a genuinely dark vector style, and darkening THAT would
           double-darken it. `components/MapBaseLayer.tsx` puts the class on
           the Leaflet container only when it renders a `<TileLayer>`; it has
           to be a container class because the `::after` lives on the pane the
           GL canvas also sits in. */
        ".dark .bela-basemap-raster .leaflet-tile-pane": {
            filter: "brightness(0.2) contrast(1.05)",
        },
        // No `position` override needed: leaflet.css already sets every
        // `.leaflet-pane` to `position: absolute`, which is a valid
        // containing block for the `inset: 0` pseudo below on its own.
        ".dark .bela-basemap-raster .leaflet-tile-pane::after": {
            content: "\"\"",
            position: "absolute",
            inset: 0,
            background: "#1c5f92",
            mixBlendMode: "color",
            pointerEvents: "none",
        },

        /* Leaflet gives EVERY `divIcon` a white fill and a grey border
           (`.leaflet-div-icon` in leaflet.css) — styling meant for its old
           text-label icons. Our pins are inline SVGs that bring their own
           artwork, so that box is pure leftover: invisible on light tiles,
           but on the dark map it reads as a pale plaque behind the pin.

           `!important` for the same reason as the rules below: Chakra emits
           globalCss into `@layer base`, and unlayered author styles
           (leaflet.css) beat layered ones however specific the selector. Not
           dark-only — the box was always wrong, dark is just where it shows. */
        ".leaflet-div-icon": {
            background: "transparent !important",
            border: "0 !important",
        },

        /* Leaflet's own chrome — zoom buttons, popup bubble, attribution bar —
           ships hardcoded white, which left bright holes in the dark map, and
           the popup's Chakra content (fg.ink, light in dark mode) rendered
           white on white. `!important` is load-bearing (same layer reason as
           above). */
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
        // THEME dark --glass (rgba(30, 36, 38, .78)) is the same family; the
        // attribution bar sits on the raster, so it is tinted from the canvas
        // (#171B1D) at the same alpha the old bar had.
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
                /* The felt green — see BRAND_RAMP for what each step is. */
                brand: BRAND_RAMP,
                /* Legacy alias of the brand ramp — see "Why blue is an alias".
                   Kept as a FULL ramp, not just the semantics, because
                   `blue.500` and friends are referenced directly in places. */
                blue: BRAND_RAMP,
                /* Warm neutrals — raw `gray.*` reads warm. */
                gray: GRAY_RAMP,
                /* Suit FILL colours and their label-text twins: identical in
                   both themes (THEME "Boje znakova karata"). Usable as
                   `bg="suit.heart"`, `color="suit.heartText"`. */
                suit: {
                    heart: { value: "#E24B4A" },
                    bell: { value: "#F2C14E" },
                    leaf: { value: "#4DA66A" },
                    acorn: { value: "#B8823F" },
                    heartText: { value: "#B8423C" },
                    bellText: { value: "#9A7B1E" },
                    leafText: { value: "#3F8A5B" },
                    acornText: { value: "#8C6027" },
                },
            },
            /* THEME typography (self-hosted @fontsource-variable, imported in
               main.tsx — the family names are the ones those packages
               register). Fallback stacks are THEME's --font-* stacks. */
            fonts: {
                heading: { value: "\"Bricolage Grotesque Variable\", system-ui, sans-serif" },
                body: {
                    value: "\"Instrument Sans Variable\", system-ui, -apple-system, \"Segoe UI\", sans-serif",
                },
                mono: { value: "\"JetBrains Mono Variable\", ui-monospace, monospace" },
            },
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
        /* THEME "Ljestvica". Sizes / line-heights are the existing ones for
           the styles that already existed (nothing but `mono` is referenced
           via `textStyle` today); the new styles carry THEME's own. */
        textStyles: {
            /* THEME `display` — screen title, hero. */
            display: {
                value: {
                    fontFamily: "heading",
                    fontWeight: "bold",
                    fontSize: "40px",
                    lineHeight: "1.1",
                    letterSpacing: "-0.03em",
                },
            },
            /* THEME `title` — page-level h1 (tournament name, a profile's
               display name). */
            title: {
                value: {
                    fontFamily: "heading",
                    fontWeight: "semibold",
                    fontSize: { base: "2xl", md: "3xl" },
                    lineHeight: "1.15",
                    letterSpacing: "-0.025em",
                },
            },
            /* THEME `heading` — section / card headings ("Runde", "Cjenik"). */
            heading: {
                value: {
                    fontFamily: "heading",
                    fontWeight: "semibold",
                    fontSize: "md",
                    lineHeight: "1.3",
                    letterSpacing: "-0.015em",
                },
            },
            /* THEME `body` — default running text. */
            body: {
                value: {
                    fontFamily: "body",
                    fontWeight: "normal",
                    fontSize: "sm",
                    lineHeight: "1.55",
                    letterSpacing: "0",
                },
            },
            /* THEME `label` — form labels, meta lines. */
            label: {
                value: {
                    fontFamily: "body",
                    fontWeight: "medium",
                    fontSize: "13.5px",
                    lineHeight: "1.4",
                    letterSpacing: "0",
                },
            },
            /* THEME `caption` — section overlines. THEME sets it UPPERCASE. */
            caption: {
                value: {
                    fontFamily: "body",
                    fontWeight: "semibold",
                    fontSize: "xs",
                    lineHeight: "1.4",
                    letterSpacing: "0.09em",
                    textTransform: "uppercase",
                },
            },
            /* THEME `numeric` — big scores and prices. */
            numeric: {
                value: {
                    fontFamily: "mono",
                    fontWeight: "bold",
                    fontSize: "26px",
                    lineHeight: "1",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.02em",
                },
            },
            /* THEME `numeric-sm` — occupancy, small figures. */
            numericSm: {
                value: {
                    fontFamily: "mono",
                    fontWeight: "semibold",
                    fontSize: "13px",
                    lineHeight: "1.4",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "0",
                },
            },
            /* THEME `mono-label` — MI / ONI, round tags. THEME sets it
               UPPERCASE. */
            monoLabel: {
                value: {
                    fontFamily: "mono",
                    fontWeight: "semibold",
                    fontSize: "11.5px",
                    lineHeight: "1",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                },
            },
            /* Scores, prices and any digits that must line up in a column —
               the size-flexible sibling of `numericSm` (same weight and
               tracking, size comes from the call site). */
            mono: {
                value: {
                    fontFamily: "mono",
                    fontWeight: "semibold",
                    fontSize: "sm",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "0",
                },
            },
        },
        semanticTokens: {
            colors: {
                bg: {
                    /* The unqualified `bg` — what Chakra's own checkmark,
                       radiomark, native-select, segment-group, tabs,
                       code-block and qr-code recipes paint from, and what
                       `bg="bg"` call sites mean: a control surface sitting ON
                       a card. Pinned to THEME `--panel`; the page background
                       is `bg.canvas`. */
                    DEFAULT: pair("#FDFBF7", "#1e1e22"),
                    /* THEME --canvas: the page behind every panel. */
                    canvas: pair("#F7F2E9", "#1c1d20"),
                    /* THEME --panel: cards, dialogs' fallback, the navbar.
                       OPAQUE (it was 61 % translucent before THEME). */
                    panel: pair("#FDFBF7", "rgba(30, 30, 34, 0.61)"),
                    /* THEME --opaque: modals, menus, popovers — one step above
                       the panel. */
                    opaque: pair("#FFFEFB", "#1e1e22"),
                    /* THEME --fill-subtle: inputs, table stripes, inactive
                       chips. Deliberately neutral, not felt-tinted: it is the
                       app's "no state" fill. */
                    subtle: pair("#FAF6EE", "#2d2d31"),
                    /* THEME --fill-muted: segmented track, hover. */
                    muted: pair("#F2ECE1", "#45454b"),
                    /* One step louder than `muted` — selected rows, active
                       chips. THEME has no fourth fill, so this is `--bd`
                       (light #E4DACA, dark #2C3434): the next rung of the
                       same ladder. */
                    emphasized: pair("#E4DACA", "#58585f"),
                    /* ── Glass surfaces ──────────────────────────────────────
                       `glass` is THEME --glass (sticky header / bottom bar);
                       `glassPanel` is denser (dialogs carry dense body text
                       over a busy page). Both use the panel's RGB. Only ever
                       paired with the backdrop blur in `layerStyles.glass.*`,
                       which also carries the opaque fallback. */
                    glass: pair("rgba(253, 251, 247, 0.8)", "rgba(30, 30, 34, 0.72)"),
                    glassPanel: pair("rgba(253, 251, 247, 0.9)", "rgba(30, 30, 34, 0.9)"),
                    /* Chakra's alert / field-error surfaces, re-pointed at
                       the THEME palettes they mean. */
                    error: pair("#F2DDD9", "{colors.red.900}"),
                    warning: pair("#F7E3CE", "{colors.orange.900}"),
                    success: pair("#DCEDE8", "{colors.teal.900}"),
                    info: pair("#DDE9DC", "#0a3d1c"),
                },
                fg: {
                    /* Chakra's unqualified `fg` (input text, menu items …) =
                       THEME --ink. */
                    DEFAULT: pair("#2A211A", "#fafafa"),
                    /* THEME --ink: primary text. */
                    ink: pair("#2A211A", "#fafafa"),
                    /* THEME --soft: secondary text. */
                    soft: pair("#4E4238", "#d4d4d8"),
                    /* THEME --muted: tertiary text. */
                    muted: pair("#6E6152", "#a1a1aa"),
                    /* THEME --faint: captions, placeholders. Measured against
                       --panel it is 3.77:1 light / 3.35:1 dark — under 4.5:1
                       for normal text. That is THEME's value and is kept;
                       treat it as decorative / large text. */
                    subtle: pair("#8D7F6E", "#91919a"),
                    error: pair("#B8423C", "{colors.red.300}"),
                    warning: pair("#C4661C", "{colors.orange.300}"),
                    success: pair("#1F6F63", "{colors.teal.300}"),
                    info: pair("#265238", "#7fc496"),
                },
                border: {
                    /* THEME --bd: card and input borders. */
                    DEFAULT: pair("#E4DACA", "#2d2d31"),
                    /* THEME --bd-subtle: separators, hairlines. */
                    subtle: pair("#EFE8DB", "#2d2d31"),
                    /* THEME has one step above --bd (--bd-strong), so
                       `emphasized` and `strong` are the same value. */
                    emphasized: pair("#C9BBA2", "#45454b"),
                    /* THEME --bd-strong: focused fields, the active tab
                       underline. */
                    strong: pair("#C9BBA2", "#58585f"),
                    /* Hairline for a glass surface. A solid `border` token on
                       a translucent bar reads as a hard line floating in
                       front of the blur; a translucent one sits in it. Tinted
                       with THEME's shadow brown (light) / ink cream (dark). */
                    glass: pair("rgba(60, 42, 20, 0.08)", "rgba(255, 255, 255, 0.10)"),
                    error: pair("#B8423C", "{colors.red.300}"),
                },

                /* ── Named THEME colours ─────────────────────────────────────
                   `color="tan"`, `bg="live.subtle"`, `borderColor="ok"` … */
                /* Secondary accent (team ONI). */
                tan: {
                    DEFAULT: pair("#A9713C", "#c4a98c"),
                    /* subtle / solid / contrast / fg / muted / emphasized /
                       focusRing: the full palette, so `colorPalette="tan"`
                       works — see PALETTE. */
                    ...PALETTE.tan,
                },
                /* Status: igra se. */
                live: {
                    DEFAULT: pair("#C4661C", "{colors.orange.300}"),
                    subtle: pair("#F7E3CE", "{colors.orange.900}"),
                },
                /* Status: plaćeno / uspjeh. */
                ok: {
                    DEFAULT: pair("#1F6F63", "{colors.teal.300}"),
                    subtle: pair("#DCEDE8", "{colors.teal.900}"),
                },
                /* Zvanja, dealer chip. `subtle` is derived (not in THEME). */
                gold: {
                    DEFAULT: pair("#B88A24", "{colors.yellow.300}"),
                    subtle: pair("#F2E9D5", "{colors.yellow.900}"),
                },
                /* Error, destructive, heart. Same colour as `red.fg`. */
                danger: pair("#B8423C", "{colors.red.300}"),
                /* Card-table surface: radial-gradient(120% 90% at 50% 38%,
                   {felt}, {felt2}). */
                felt: pair("#EFE7D8", "#14191A"),
                felt2: pair("#E7DCC7", "#101415"),
                /* Card face and edge — cream in BOTH themes. */
                cardface: pair("#FFFDF8", "#F6F0E4"),
                cardline: pair("#E0D6C4", "#D9CEBB"),

                /* ── The default focus ring ──────────────────────────────────
                   Chakra's `focusVisibleRing` reads `colorPalette.focusRing`
                   and the ROOT `colorPalette` is `gray`, so every control
                   without an explicit palette would focus in gray. Overriding
                   `gray.focusRing` (rather than pointing the root at brand,
                   which would turn every unstyled Button green) makes the
                   ring the brand colour with a blast radius of exactly the
                   ring. The rest of `gray` is the warm neutral palette. */
                gray: {
                    /* Solid fill: ink on cream (light), cream on canvas (dark). */
                    solid: pair("#2A211A", "#ffffff"),
                    contrast: pair("#FFFCF7", "#000000"),
                    fg: pair("#2A211A", "#e4e4e7"),
                    /* THEME fills, one rung each: light 100 / 200 / 300; dark
                       fill-subtle / fill-muted / bd. */
                    subtle: pair("#F2ECE1", "#1e1e22"),
                    muted: pair("#E4DACA", "#2d2d31"),
                    emphasized: pair("#C9BBA2", "#45454b"),
                    focusRing: pair("{colors.brand.600}", "#2f8f52"),
                },
                /* `colorPalette="brand"` fully wired, shaped like Chakra's own
                   ramp semantics. Every value resolves to THEME:
                   light solid #2E6343 / fg #265238 / subtle #DDE9DC / on-brand
                   #FFFCF7; dark solid #2F8F52 / fg #8ACFA0 / subtle #264233 /
                   on-brand #0E1F16 (4.22:1 on the solid — see the report:
                   AA for large / bold text only). */
                brand: brandSemantics,
                /* Identical to brand — see "Why blue is an alias". */
                blue: brandSemantics,
                /* Re-pointed at THEME statuses — see "Palettes that follow
                   THEME semantics". */
                orange: PALETTE.live,
                green: PALETTE.ok,
                yellow: PALETTE.gold,
                red: PALETTE.red,
                /* `purple` is used only for admin styling (public profile,
                   tournament details / dialogs); it follows `tan` so nothing
                   renders in Chakra's stock violet. */
                purple: PALETTE.tan,
            },
            radii: {
                /* Chakra's component recipes read these three, NOT the raw
                   scale: l1 → checkmarks and swatches, l2 → Button / Input /
                   Tag / Tabs triggers / menu items, l3 → Card / Dialog / Menu
                   / Popover / Select content. Defaults are xs/sm/md (2/4/6px);
                   pointing them one rung higher rounds the app without a
                   single call-site edit. */
                l1: { value: "{radii.xs}" },
                l2: { value: "{radii.md}" },
                l3: { value: "{radii.xl}" },
            },
            shadows: {
                /* Additive names only — Chakra's xs/sm/md/lg/xl/2xl are left
                   untouched. `card` and `raised` are THEME --sh-card /
                   --sh-raised verbatim (warm brown tint in light, plain black
                   in dark, the only thing that reads as depth on a dark
                   canvas). `overlay` / `sticky` keep their earlier offsets and
                   blur with the same tint. */
                card: {
                    value: {
                        base: "0 1px 2px rgba(60, 42, 20, 0.07), 0 1px 3px rgba(60, 42, 20, 0.06)",
                        _light: "0 1px 2px rgba(60, 42, 20, 0.07), 0 1px 3px rgba(60, 42, 20, 0.06)",
                        _dark: "0 1px 2px rgba(0, 0, 0, 0.35)",
                    },
                },
                raised: {
                    value: {
                        base: "0 6px 18px rgba(60, 42, 20, 0.10)",
                        _light: "0 6px 18px rgba(60, 42, 20, 0.10)",
                        _dark: "0 8px 22px rgba(0, 0, 0, 0.40)",
                    },
                },
                overlay: {
                    value: {
                        base: "0 12px 32px rgba(60, 42, 20, 0.16)",
                        _light: "0 12px 32px rgba(60, 42, 20, 0.16)",
                        _dark: "0 12px 32px rgba(0, 0, 0, 0.65)",
                    },
                },
                /* Bottom tab bar / sticky action rows — the shadow points up. */
                sticky: {
                    value: {
                        base: "0 -4px 20px rgba(60, 42, 20, 0.06)",
                        _light: "0 -4px 20px rgba(60, 42, 20, 0.06)",
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

           This is how dialogs get the glass treatment (menus / popovers the
           opaque one — see SOLID_CONTENT) without a `layerStyle` prop on each
           of the ~25 `Dialog.Content` call sites. It has to happen at the
           recipe layer rather than in `globalCss`, because Chakra emits
           recipes into a CSS layer that wins over `base` — a global rule
           setting `background` would simply lose to the recipe's own
           `bg: bg.panel`.

           `slots` is required by the type and is re-stated from the SAME
           anatomy Chakra's own recipe uses. That matters: the config merge
           walks arrays index by index, so handing it a shorter list (say
           `["content"]`) would overwrite slot 0 of the real anatomy and leave
           the rest — quietly breaking every other part of the component.
           Passing the identical array makes the merge a no-op. */
        slotRecipes: {
            dialog: { slots: dialogAnatomy.keys(), base: { content: GLASS_CONTENT } },
            menu: { slots: menuAnatomy.keys(), base: { content: SOLID_CONTENT } },
            popover: { slots: popoverAnatomy.keys(), base: { content: SOLID_CONTENT } },
        },
    },
})

export const system = createSystem(defaultConfig, config)
