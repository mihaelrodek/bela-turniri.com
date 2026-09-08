/* ──────────────────────────────────────────────────────────────────────────
   Where the blok's fixed "MI + / VI +" bar sits, as CSS length strings.

   Extracted from `pages/BlokPage.tsx` because a second component now has to
   know about that bar without importing the page: the app-wide "you are still
   at a table" dock (`game/components/ActiveRoomWidget.tsx`) is also fixed to
   the bottom-right, and on `/blok` it landed exactly on top of the two
   buttons that are the whole point of the screen.

   Kept as a plain constants module with no imports so the widget can read it
   without pulling the blok's lazy chunk into the entry bundle.
   ────────────────────────────────────────────────────────────────────── */

/** Breathing room below the controls, inside the painted bar. */
export const ACTION_BAR_GAP = "0.75rem"

/**
 * The painted bar reaches the viewport edge. Safe-area clearance and the
 * breathing gap are padding inside it, so the page background cannot show as
 * a differently coloured strip underneath the bar.
 */
export const ACTION_BAR_BOTTOM = "0px"

/** The bar's height. */
export const ACTION_BAR_H = "8.25rem"

/** Space to keep clear beneath the deal list — and the offset anything else
 *  fixed to the bottom of this route has to clear to sit ABOVE the bar. */
export const ACTION_BAR_RESERVE = `calc(${ACTION_BAR_H} + ${ACTION_BAR_GAP} + env(safe-area-inset-bottom, 0px))`
