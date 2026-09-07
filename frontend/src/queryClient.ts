import { QueryClient } from "@tanstack/react-query"

/**
 * Shared react-query client for the whole app.
 *
 * Tuning notes:
 *  - `staleTime: 30s` — navigating back to a page you saw in the last 30 s
 *    shows the cached data INSTANTLY with no network call. After 30 s the
 *    cache still renders immediately, then revalidates in the background
 *    (stale-while-revalidate). This is what kills the "every navigation
 *    reloads long and re-fires requests" problem — bela was re-fetching the
 *    tournaments list on every visit to /turniri and calling getProfile()
 *    three separate times on a cold load.
 *  - `gcTime: 1h` — unused cache entries linger for an hour after the last
 *    component using them unmounts. Kept >= the persist `maxAge` (main.tsx) so
 *    a query isn't garbage-collected out of the cache before it can be written
 *    to localStorage for the next cold load.
 *  - `refetchOnWindowFocus: false` — `useLiveSocket` (realtime/LiveSocket.java
 *    via `/ws/live/{uuid}`) already pings interested pages when something
 *    changes server-side, so a blanket tab-focus refetch would just be a
 *    second, poorer trigger for the same thing and would add load and flicker.
 *    `usePolling` remains the fallback for pages that don't watch the socket.
 *  - `retry: 1` — one silent retry smooths over a transient blip without
 *    hammering the backend; the axios interceptor still surfaces real errors.
 *
 * Individual queries override these where they need to (e.g. a polling view
 * can pass a shorter staleTime or a refetchInterval).
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: 60 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
})

/**
 * Cache version for the localStorage persister (main.tsx). Bump this whenever a
 * cached payload's SHAPE changes in a breaking way (backend DTO change, key
 * restructure) so old persisted snapshots are discarded instead of rendered.
 */
export const CACHE_BUSTER = "v1"

/** localStorage key the persister writes to (main.tsx). */
export const PERSIST_KEY = "bela-rq-cache"

/**
 * Centralised query keys so cache reads/writes/prefetch stay consistent.
 *
 * Wave note: `tournamentDetails` is already used for the hover/tap prefetch on
 * the tournaments list (TournamentsPage `useTournamentPrefetch`). The detail
 * page itself (`pages/TournamentDetailsPage.tsx`) is still useEffect-based and
 * will adopt this exact key — plus `tournamentPairs`, `rounds` and `cjenik` —
 * in a later wave; the prefetched entry then becomes a real cache hit and the
 * page opens with zero spinner. Until then the prefetch only warms the HTTP
 * layer, which is still a win but not the full one.
 */
export const qk = {
    /**
     * Tournament lists. `filters` is the exact argument set handed to
     * `fetchTournaments` — react-query hashes objects key-order-independently,
     * so `{ status: "finished", limit: 6 }` is one stable entry per page size.
     */
    tournaments: (filters?: Record<string, string | number | undefined>) =>
        ["tournaments", filters ?? {}] as const,
    /** Backend-side total per status bucket — drives the "Učitaj više" button. */
    tournamentsCount: (status: "upcoming" | "finished") =>
        ["tournamentsCount", status] as const,
    /** Single tournament, keyed by UUID **or** slug — whatever is in the URL. */
    tournamentDetails: (idOrSlug: string) => ["tournamentDetails", idOrSlug] as const,
    tournamentPairs: (uuid: string) => ["tournamentPairs", uuid] as const,
    rounds: (uuid: string) => ["rounds", uuid] as const,
    cjenik: (uuid: string) => ["cjenik", uuid] as const,
    /** The signed-in user's own profile — one shared entry (see hooks/useMyProfile). */
    profile: ["profile"] as const,
    /**
     * A public player profile page, keyed by its URL slug.
     *
     * The payload carries owner-only extras when the viewer IS that player, so
     * the `publicProfile` root is in NON_PERSISTED_KEY_ROOTS below — it never
     * reaches localStorage and can't be restored for the next person on a
     * shared device.
     */
    publicProfile: (slug: string) => ["publicProfile", slug] as const,
    /**
     * "Pronađi para" board. `status` mirrors the page's filter chip and
     * `viewer` is the signed-in UID (or `"anon"`), because the rows carry
     * owner-only affordances — without the viewer in the key one account's
     * board would be served from cache to the next account on the device.
     */
    pairRequests: (status?: "open" | "matched" | "all", viewer?: string) =>
        ["pairRequests", status ?? "all", viewer ?? "anon"] as const,
    /** Prefix matching every `pairRequests` entry — for broad invalidation. */
    pairRequestsRoot: ["pairRequests"] as const,
    /** Pair-finding requests scoped to one tournament. */
    pairRequestsForTournament: (tournamentUuid: string) =>
        ["pairRequests", "byTournament", tournamentUuid] as const,
    /** Calendar view — upcoming + finished merged into one month grid. */
    calendar: ["calendar"] as const,
    /** Map view — upcoming tournaments that carry coordinates. */
    map: ["map"] as const,
    /** Admin console reads. */
    adminDashboard: ["admin", "dashboard"] as const,
    adminPlayers: ["admin", "players"] as const,
    /** Contact-form triage inbox — carries senders' e-mail/IP, admin-only. */
    adminContactMessages: ["admin", "contactMessages"] as const,
    /** The signed-in user's own saved pair-name presets ("Moji pari"). */
    myPairPresets: ["myPairPresets"] as const,
    /** Names of the signed-in user's saved drink-price templates. */
    myDrinkTemplateNames: ["myDrinkTemplateNames"] as const,
    /** One named drink-price template's rows, for the inline editor. */
    myDrinkTemplate: (name: string) => ["myDrinkTemplate", name] as const,
    /** Every bill the signed-in user was a party to, across all tournaments. */
    myInvoices: ["myInvoices"] as const,
}

/**
 * Query-key roots that must NEVER be written to localStorage.
 *
 * Everything here is auth-dependent: it is scoped to the signed-in user, so a
 * persisted snapshot could be restored for a *different* user on a shared
 * device (or after a sign-out) and render someone else's data before the
 * refetch corrects it. These keys are cheap to refetch, so they just don't
 * participate in persistence at all. See `shouldDehydrateQuery` in main.tsx.
 */
export const NON_PERSISTED_KEY_ROOTS: ReadonlySet<string> = new Set([
    "profile",
    "admin",
    // Rows carry owner-only affordances (edit / delete / contact).
    "pairRequests",
    // Owner-only extras when the viewer is the profile's own player.
    "publicProfile",
    // Pair lists expose the submitter's contact details to the organiser.
    "tournamentPairs",
    // The detail payload widens for the organiser (paid flags, contacts).
    "tournamentDetails",
    // The cache holds local row shapes (`_dirty` / `_editing` score drafts);
    // a half-typed score must not resurrect after a reload.
    "rounds",
    // Owner-only saved pair presets, drink templates and invoice history.
    "myPairPresets",
    "myDrinkTemplateNames",
    "myDrinkTemplate",
    "myInvoices",
])
