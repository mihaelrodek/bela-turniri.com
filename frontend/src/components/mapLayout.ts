import { NAVBAR_H } from "./navChrome"

/* Map page geometry, shared by MapPage (inside the lazy, Leaflet-carrying
   chunk) and MapPageSkeleton (in the entry bundle, shown while that chunk
   downloads) so the grey placeholder and the real map occupy the same box.
   Moved out of MapPage.tsx on 2026-09-29 for that reason. */

/**
 * Desktop height shared by the map and the "visible on map" list column, so
 * their bottoms line up and the list scrolls INSIDE itself instead of the
 * page growing underneath it. Computed from this page's actual chrome —
 * not guessed:
 *   NavBar (sticky, 52px from NAVBAR_H.md) + Container top padding (py=6 → 24px)
 *   + the toolbar panel (~76px, incl. its own p="3" padding)
 *   + the VStack gap above the grid (gap="4" → 16px)
 *   + Container bottom padding (py=6 → 24px — this app has no sticky
 *     footer below the routed content, unlike the sibling futsal app)
 *   + ~10px safety margin for borders / scrollbar
 *   = 202px of fixed chrome around the map on md+.
 * `100dvh` (not `vh`) so the value tracks the real visible viewport, same
 * reasoning as the mobile constant below.
 */
export const MAP_DESKTOP_H = `calc(100dvh - ${NAVBAR_H.md + 24 + 76 + 16 + 24 + 10}px - var(--safe-top))`
export const MAP_DESKTOP_MIN_H = "420px"

/**
 * Mobile map height. Unlike the desktop column, the tournament list sits
 * BELOW the map on phones (see the ordering note on the grid below), so
 * there is no "chrome below the map" to subtract here — only the toolbar
 * strip above it. 52dvh gives a genuinely usable map on the first screen
 * without pushing the list far off-screen, and `dvh` (not `vh`) tracks the
 * real visible viewport as Safari's URL bar collapses/expands, so the map
 * doesn't jump or overflow when that happens.
 */
export const MAP_MOBILE_H = "52dvh"
export const MAP_MOBILE_MIN_H = "340px"
