/* Hand sizing shared by `Hand` and whoever docks to it (GameRoomPage). Kept out
   of Hand.tsx so that file exports only its component (fast refresh). */

/** Card widths from CARD_METRICS. Slot maths must use the size actually drawn. */
export const CARD_WIDTH: Record<HandCardSize, number> = { xs: 48, sm: 56, md: 72, ml: 84 }
/** The hand's card size per breakpoint. `ml` from 62em (2026-09-20, user
 *  request: bigger cards on the web): eight of them are 714 px, which leaves
 *  the 880 px column just enough margin for my avatar beside the row. At 48em
 *  the column is 760 px and only `md` fits with the avatar. */
export type HandCardSize = "xs" | "sm" | "md" | "ml"
/** A PHONE GETS `xs` (2026-09-20, user request). In a browser tab — no
 *  installed PWA, so the URL bar and the toolbar are both on screen — the
 *  `sm` hand plus the reactions strip left the trick a slot it could only
 *  fill with tiny cards. The hand gives up 8 px a card (two rows, so 16 px of
 *  height) and the felt spends it on the cards everybody is actually looking
 *  at. 48 × 77 is still well over the 44 px tap floor, and the slots do not
 *  overlap on a phone. */
export const HAND_CARD_SIZE = { base: "xs", sm: "sm", md: "md", lg: "ml" } as const
/** The gap between two slots, in px. Used in the grid's own width sum. */
export const SLOT_GAP = 6

/** Width of the one-row grid, for whoever docks something to its edge (my
 *  avatar in GameRoomPage). Null on a phone: two rows of four, nothing docks. */
export function handRowWidth(size: HandCardSize): number | null {
    return size === "xs" || size === "sm" ? null : CARD_WIDTH[size] * 8 + SLOT_GAP * 7
}
