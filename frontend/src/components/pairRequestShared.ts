import type { PairRequest } from "../api/pairRequests"

/* ──────────────────────────────────────────────────────────────────────────
   pairRequestShared — the pure, React-free half of the "tražim para" board,
   the same split `listingShared.ts` makes for the tournament listing: the
   sort catalogue and the small normalisers live here, the components that
   render them live in `pairRequestPrimitives.tsx`.

   Keeping the two apart is not only tidiness — a module that exports both a
   component and a constant breaks Vite's fast refresh, which is what the
   `react-refresh/only-export-components` rule is guarding.

   NOTHING here formats a date or a phone number: `utils/format.ts` owns dates
   (locale-aware) and the dictionaries own every visible word.
   ────────────────────────────────────────────────────────────────────── */

/** Epoch ms, or +∞ for a missing/garbage instant so unknowns sort last in
 *  every ascending order rather than pretending to be 1970. */
function timeOf(iso?: string | null): number {
    if (!iso) return Number.POSITIVE_INFINITY
    const ms = new Date(iso).getTime()
    return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms
}

/** Newest request first — the board's only order since the "Sortiraj" menu
 *  (oldest / soonest tournament / name) was dropped. */
export function sortPairRequests(list: readonly PairRequest[]): PairRequest[] {
    // Always a copy — `list` comes straight out of a .filter() over the query
    // cache, and sorting in place would mutate the memo upstream.
    return [...list].sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt))
}

/** Up to two initials, same rule as the poster-less tournament placeholder. */
export function pairInitials(name: string): string {
    const words = (name ?? "").trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) return "?"
    if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase()
    return (words[0][0] + words[1][0]).toLocaleUpperCase()
}
