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
 *  an installed iPhone PWA the header also carries `padding-top:
 *  env(safe-area-inset-top)` to clear the notch/Dynamic Island (see
 *  NavBar.tsx), so its actual on-screen height is this plus that inset.
 *  `NAVBAR_SAFE_TOP` below is that combined figure — every consumer that
 *  positions something UNDER the header must use it, not the raw px. */
export const NAVBAR_H = { base: 48, md: 52 } as const

/** `NAVBAR_H` plus the safe-area inset, as a CSS length. `env(...)` resolves
 *  to 0px on every browser that doesn't define it (Android, desktop, an
 *  ordinary browser tab), so this is a no-op everywhere except a notched
 *  iPhone running the installed PWA. */
export const NAVBAR_SAFE_TOP = {
    base: `calc(${NAVBAR_H.base}px + env(safe-area-inset-top, 0px))`,
    md: `calc(${NAVBAR_H.md}px + env(safe-area-inset-top, 0px))`,
}

/** Same, as CSS lengths — for `top` on a sticky element. */
export const NAVBAR_TOP = NAVBAR_SAFE_TOP

/** Navbar + the app Container's top padding (py={6} → 24px): where a card
 *  pinned inside the content column should come to rest. */
export const CONTENT_STICKY_TOP = {
    base: `calc(${NAVBAR_H.base + 24}px + env(safe-area-inset-top, 0px))`,
    md: `calc(${NAVBAR_H.md + 24}px + env(safe-area-inset-top, 0px))`,
}

/** Approximate rendered height of `MobileTabBar` (base breakpoint only — it's
 *  hidden md+): its own `pt="2"` + icon/label row + `py="2"` on each cell,
 *  NOT counting the `padding-bottom: env(safe-area-inset-bottom)` it adds on
 *  top for the home-indicator area. Anything else that must float clear of
 *  the bar on mobile (a bottom sheet, a floating action button) should add
 *  this PLUS that same safe-area term via `MOBILE_TABBAR_CLEARANCE` below,
 *  rather than re-guess the bar's height independently. */
export const MOBILE_TABBAR_H = 64

/** `MOBILE_TABBAR_H` plus the safe-area inset the bar itself pads for. */
export const MOBILE_TABBAR_CLEARANCE = `calc(${MOBILE_TABBAR_H}px + env(safe-area-inset-bottom, 0px))`
