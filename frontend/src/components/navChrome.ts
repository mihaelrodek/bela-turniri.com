/* ──────────────────────────────────────────────────────────────────────────
   One source of truth for the sticky header's height.

   Several screens pin something directly under the navbar — the tournament
   sidebar, the mobile section band, the map's computed height — and each of
   them used to hard-code its own guess. When the header changed size those
   guesses silently drifted, leaving either a gap or an overlap.

   Keep NavBar's rendered height equal to these values: they are the padding
   (py) plus the logo box plus the 1px bottom hairline.
   ────────────────────────────────────────────────────────────────────── */

/** Rendered navbar height, in px, per breakpoint — the row content only. On
 *  an installed iPhone PWA, or a native app on Android 16+, the header also
 *  carries `padding-top: var(--safe-top)` to clear the notch/Dynamic
 *  Island/status bar (see NavBar.tsx and index.html's `--safe-top`), so its
 *  actual on-screen height is this plus that inset. `NAVBAR_SAFE_TOP` below
 *  is that combined figure — every consumer that positions something UNDER
 *  the header must use it, not the raw px. */
import { isGamesSite } from "../site"

export const NAVBAR_H = { base: 48, md: 52 } as const

/** `NAVBAR_H` plus the safe-area inset, as a CSS length. `var(--safe-top)`
 *  (index.html) resolves to 0px wherever neither source applies (Android,
 *  desktop, an ordinary browser tab), so this is a no-op everywhere except a
 *  notched iPhone running the installed PWA or an edge-to-edge Android app. */
export const NAVBAR_SAFE_TOP = {
    base: `calc(${NAVBAR_H.base}px + var(--safe-top))`,
    md: `calc(${NAVBAR_H.md}px + var(--safe-top))`,
}

/** Same, as CSS lengths — for `top` on a sticky element. */
export const NAVBAR_TOP = NAVBAR_SAFE_TOP

/** Navbar + the app Container's top padding (py={6} → 24px): where a card
 *  pinned inside the content column should come to rest. */
export const CONTENT_STICKY_TOP = {
    base: `calc(${NAVBAR_H.base + 24}px + var(--safe-top))`,
    md: `calc(${NAVBAR_H.md + 24}px + var(--safe-top))`,
}

/** Where the shared toaster (`src/toaster.ts`) should start its "top"
 *  placement stack, as a single CSS length (zag-js's `offsets.top` is a
 *  plain string, not a Chakra responsive object, so this picks the larger
 *  `md` navbar height — 4px of extra clearance on `base` is harmless).
 *
 *  Why this exists: iOS 26 Safari tints the status bar from whatever fixed
 *  element touches the very top of the viewport, and never re-samples while
 *  a page (e.g. the game table) has scrolling locked. A toast placed at
 *  `top: 0` — zag-js's default — sits over that edge, so an error toast can
 *  leave the status bar red long after the toast itself is gone. Starting
 *  the stack below the sticky navbar keeps every toast, of any colour, off
 *  the top edge entirely. `max(env(safe-area-inset-top), offset)` in
 *  zag-js's own placement math means this value already dominates the
 *  bare safe-area inset, so no extra calc is needed on top of it. */
export const TOAST_TOP_OFFSET = `calc(${NAVBAR_H.md}px + var(--safe-top) + 8px)`

/** Approximate rendered height of `MobileTabBar` (base breakpoint only — it's
 *  hidden md+): its own `pt="2"` + icon/label row + `py="2"` on each cell,
 *  NOT counting the `padding-bottom: var(--safe-bottom)` it adds on top for
 *  the home-indicator area. Anything else that must float clear of the bar
 *  on mobile (a bottom sheet, a floating action button) should add this
 *  PLUS that same safe-area term via `MOBILE_TABBAR_CLEARANCE` below, rather
 *  than re-guess the bar's height independently. */
export const MOBILE_TABBAR_H: number = isGamesSite ? 0 : 64

/** `MOBILE_TABBAR_H` plus the safe-area inset the bar itself pads for. */
export const MOBILE_TABBAR_CLEARANCE = `calc(${MOBILE_TABBAR_H}px + var(--safe-bottom))`

/** Padding for a full-screen `position: fixed; inset: 0` overlay — the belot
 *  stage, the declarations reveal, the trick history, the trump flash.
 *
 *  Such an overlay deliberately COVERS the whole screen, notch and home
 *  indicator included, because its backdrop is supposed to reach every edge.
 *  Its contents must not: with the WebView full-bleed on both platforms
 *  (`ios.contentInset: "never"`, Android's enforced edge-to-edge) nothing
 *  native is left to save a centred card from a landscape cutout or a close
 *  button from the gesture bar. Spread into the overlay's `css`, not its
 *  props, so it is one decision in one place.
 *
 *  The horizontal terms keep the 3-spacing gutter those overlays already had
 *  and only grow past it where a device edge is genuinely unusable; the
 *  vertical terms are the bare inset, since these overlays centre their
 *  content and had no vertical gutter to preserve. All four resolve to 0 on
 *  desktop and in an ordinary browser tab. */
export const OVERLAY_SAFE_INSET = {
    paddingTop: "var(--safe-top)",
    paddingBottom: "var(--safe-bottom)",
    paddingInlineStart: "max(var(--chakra-spacing-3), var(--safe-left))",
    paddingInlineEnd: "max(var(--chakra-spacing-3), var(--safe-right))",
} as const

/** Where the "Novosti" FAB (`whatsNew/WhatsNewFab.tsx`) sits, so that the
 *  active-room pill (`game/components/ActiveRoomWidget.tsx`) can dock right
 *  beside it instead of guessing — px, per breakpoint. */
export const WHATS_NEW_FAB = {
    size: 48,
    /** Gutter from the viewport's right edge, in px. The SAFE-AREA term is
     *  not baked in here because `ActiveRoomWidget` docks beside the FAB and
     *  needs to do arithmetic on this number; both consumers add
     *  `var(--safe-right)` on top (see `WHATS_NEW_FAB_RIGHT` below for the
     *  FAB's own ready-made value). Without it, a phone held in landscape
     *  puts both of them under the cutout. */
    right: { base: 16, md: 24 },
    bottom: {
        base: `calc(${MOBILE_TABBAR_CLEARANCE} + 12px)`,
        /* md+ has no tab bar, so nothing else is paying for the home
           indicator at this edge — an iPad in a native shell would otherwise
           put the FAB on top of it. */
        md: "calc(88px + var(--safe-bottom))",
    },
} as const

/** `WHATS_NEW_FAB.right` with the landscape-cutout inset already added, for
 *  anything docking to the right edge that is NOT doing arithmetic on the
 *  gutter. */
export const WHATS_NEW_FAB_RIGHT = {
    base: `calc(${WHATS_NEW_FAB.right.base}px + var(--safe-right))`,
    md: `calc(${WHATS_NEW_FAB.right.md}px + var(--safe-right))`,
}
