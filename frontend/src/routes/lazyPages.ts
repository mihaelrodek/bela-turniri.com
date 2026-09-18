import { loadNamespace } from "../i18n"

/**
 * Route chunk factories for prefetching. Exported separately from App.tsx
 * so usePrefetchRoute can access them without modifying App.tsx.
 *
 * Each export is the raw import factory, NOT the wrapped lazyWithReload
 * component — calling factory() directly loads the module and triggers the
 * chunk download, which is what requestIdleCallback prefetch needs.
 *
 * KEEP IN SYNC WITH App.tsx. A route whose `lazyRoute(...)` there names a
 * route-scoped dictionary namespace (`admin`, `legal`, `game`, `blok` — see
 * src/i18n/index.ts) must warm that namespace here too; prefetching only half
 * of what the route needs leaves the other half on the navigation's critical
 * path, which is the one thing the prefetch exists to remove. `loadNamespace`
 * never rejects for the active locale's own chunk, and a Croatian failure is
 * swallowed here because a prefetch must never surface an error.
 */

export const calendarPageFactory = () => import("../pages/CalendarPage")
export const mapPageFactory = () => import("../pages/MapPage")

/* The profile page renders the "Blok" tab (BlokHistoryCard → BlokGamesList),
   so it needs the `blok` namespace — same pairing as App.tsx. */
export const profilePageFactory = () => Promise.all([
    import("../pages/PublicProfilePage"),
    loadNamespace("blok").catch(() => {}),
]).then(([mod]) => mod)

/* The detail page is already prefetched unconditionally in App.tsx
   after first paint (through the component's own `.preload()`), but it's
   listed here for completeness. `admin` rides along for CjenikTab. */
export const tournamentDetailsPageFactory = () => Promise.all([
    import("../pages/TournamentDetailsPage"),
    loadNamespace("admin").catch(() => {}),
]).then(([mod]) => mod)
