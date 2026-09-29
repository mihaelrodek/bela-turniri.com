/** Gold / silver / bronze, in podium order.
 *
 *  Its own module (2026-09-29): exported from TournamentResultsCard.tsx it
 *  broke Fast Refresh for that component — a component file may only export
 *  components (react-refresh/only-export-components).
 *
 *  Exported because three screens were carrying their own copy of these three
 *  hex values (this card, the tournament detail page's rewards tile and the
 *  profile page's winner trophy) and a fourth would have been along shortly.
 *  They stay literals rather than semantic tokens on purpose: the metals read
 *  as themselves in both colour modes and have no `fg.*` equivalent. */
export const MEDALS = ["#F5C518", "#9CA3AF", "#CD7F32"] as const
