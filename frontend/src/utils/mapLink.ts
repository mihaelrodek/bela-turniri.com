/* ──────────────────────────────────────────────────────────────────────────
   mapLink — the single definition of "point this at /karta, focused on one
   tournament".

   Lives in utils/ rather than in `pages/MapPage.tsx` on purpose: MapPage is
   `React.lazy`-loaded precisely because it drags Leaflet in with it, so any
   module that merely wants to LINK to the map must not import from it — that
   one import would pull the map chunk into the calendar's bundle. A plain,
   dependency-free module both sides can share keeps the split intact.
   ────────────────────────────────────────────────────────────────────── */

import type { TournamentCard } from "../types/tournaments"

/**
 * Query parameter `/karta` reads to preselect a tournament, e.g.
 * `/karta?turnir=1-bela-open-22-04-2026`. Croatian, like every other route
 * and domain word in this app. A query parameter rather than a path segment
 * so `/karta` keeps exactly one route and one canonical URL: the target is a
 * view state of the map page, not a different page.
 */
export const MAP_TARGET_PARAM = "turnir"

/**
 * Can this tournament be shown on the map at all?
 *
 * Geocoding is lazy (`GeocodeService` calls Nominatim one row at a time), so
 * a genuinely unlocated row — or one that simply has not been geocoded yet —
 * carries no latitude/longitude and has no pin to fly to. Callers use this to
 * HIDE the "open on map" control rather than render one that leads nowhere.
 * `isFinite` and not just a `typeof` check, to match how MapPage itself
 * decides which tournaments it can place.
 */
export function hasMapCoordinates(item: Pick<TournamentCard, "latitude" | "longitude">): boolean {
    return typeof item.latitude === "number"
        && Number.isFinite(item.latitude)
        && typeof item.longitude === "number"
        && Number.isFinite(item.longitude)
}

/**
 * Route to `/karta` focused on one tournament. Prefers the slug — the same
 * preference every other in-app tournament link makes, and the map resolves
 * either form — so the URL a user copies out of the address bar is readable.
 */
export function mapLinkFor(item: Pick<TournamentCard, "uuid" | "slug">): string {
    return `/karta?${MAP_TARGET_PARAM}=${encodeURIComponent(item.slug ?? item.uuid)}`
}
