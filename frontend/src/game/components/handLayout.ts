/* Hand sizing shared by `Hand` and whoever docks to it (GameRoomPage). Kept out
   of Hand.tsx so that file exports only its component (fast refresh). */

/** Card widths from CARD_METRICS. Slot maths must use the size actually drawn. */
export const CARD_WIDTH: Record<HandCardSize, number> = { sm: 56, md: 72, ml: 84 }
/** The hand's card size per breakpoint. `ml` from 62em (2026-09-20, user
 *  request: bigger cards on the web): eight of them are 714 px, which leaves
 *  the 880 px column just enough margin for my avatar beside the row. At 48em
 *  the column is 760 px and only `md` fits with the avatar. */
export type HandCardSize = "sm" | "md" | "ml"
export const HAND_CARD_SIZE = { base: "sm", md: "md", lg: "ml" } as const
/** The gap between two slots, in px. Used in the grid's own width sum. */
export const SLOT_GAP = 6

/** Width of the one-row grid, for whoever docks something to its edge (my
 *  avatar in GameRoomPage). Null on a phone: two rows of four, nothing docks. */
export function handRowWidth(size: HandCardSize): number | null {
    return size === "sm" ? null : CARD_WIDTH[size] * 8 + SLOT_GAP * 7
}
