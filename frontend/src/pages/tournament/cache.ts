import { qk, queryClient } from "../../queryClient"

/**
 * Invalidate every cached view that lists tournaments.
 *
 * `qk.tournaments` and `qk.tournamentsCount` are FAMILIES (one entry per
 * filter set / per status bucket), so they are invalidated by their key ROOT
 * rather than by a single exact key — otherwise "upcoming, 6 per page" would
 * be refreshed and "finished, 12 per page" would not.
 *
 * Why this matters more here than in a typical app: all four of these keys
 * are persisted to localStorage (see `NON_PERSISTED_KEY_ROOTS` — they are the
 * public, viewer-independent ones, so they are NOT on that list). Without an
 * invalidation, a tournament created, edited or deleted on this device still
 * renders from disk on the next cold load, and a deleted one comes back as a
 * card that 404s when tapped.
 */
export function invalidateTournamentLists(): void {
    // Key roots — react-query matches by prefix, so this covers every
    // `qk.tournaments({...})` and `qk.tournamentsCount(...)` variant.
    void queryClient.invalidateQueries({ queryKey: ["tournaments"] })
    void queryClient.invalidateQueries({ queryKey: ["tournamentsCount"] })
    void queryClient.invalidateQueries({ queryKey: qk.calendar })
    void queryClient.invalidateQueries({ queryKey: qk.map })
}

export default invalidateTournamentLists
