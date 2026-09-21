/** Single source of truth for the newest release's version tag.
 *
 * Split out of `releases.ts` on purpose: `store.ts` needs this one string to
 * answer `hasUnseen()` for the FAB's badge dot, and the FAB is mounted
 * eagerly (see `main.tsx`). If `store.ts` imported `releases.ts` directly for
 * that, it would drag both locales' full release prose — `releases.hr.ts` +
 * `releases.sl.ts` — into the app's initial bundle, defeating the point of
 * lazy-loading `WhatsNewDialog`. `releases.hr.ts` re-exports this same
 * constant as its newest entry's `version`, so the two can never drift apart.
 */
export const LATEST_VERSION = "v4"

/** Which product area a release group's content is about — see
 *  `ReleaseGroup.area` in `releases.ts` for the classification rules. Lives
 *  here (not in `releases.ts`) so `RELEASE_AREAS` below can sit next to
 *  `LATEST_VERSION` without pulling in either locale's release prose. */
export type ReleaseArea = "game" | "blok" | "tournaments" | "general"

/** Newest-first index of which areas each release touches — no prose, just
 *  enough for `LATEST_VERSION_GAMES` below to be computed without importing
 *  `releases.hr.ts` / `releases.sl.ts` (see `LATEST_VERSION`'s comment for
 *  why that matters for the eager `WhatsNewFab`/`store.ts` path).
 *
 *  Hand-kept in sync with `releases.hr.ts`'s newest-first release list: one
 *  entry per release, in the same order, listing the `area`s of its groups.
 *  Comments give each entry's date so it's easy to eyeball against the real
 *  file when adding a release. */
export const RELEASE_AREAS: readonly { version: string; areas: readonly ReleaseArea[] }[] = [
    { version: LATEST_VERSION, areas: ["general", "game"] }, // 2026-09-21
    { version: "v3", areas: ["game"] }, // 2026-09-18
    { version: "v3", areas: ["game", "blok", "tournaments", "general"] }, // 2026-09-10
]

/** Areas that show up on the games site (bela.games / belot.games) — see
 *  `releases.ts`'s `getReleases()` for the actual per-group filtering this
 *  mirrors. */
const GAMES_VISIBLE_AREAS: ReadonlySet<ReleaseArea> = new Set(["game", "blok", "general"])

/** Version tag of the newest release that has at least one item visible on
 *  the games site — i.e. skips a release whose only content is
 *  tournaments-only, so a tournaments-only release never lights the
 *  "Novosti" badge dot on bela.games/belot.games. Falls back to
 *  `LATEST_VERSION` if (somehow) nothing in the index qualifies, so the
 *  badge fails safe (shows unseen) rather than silently never lighting up. */
export const LATEST_VERSION_GAMES: string =
    RELEASE_AREAS.find((r) => r.areas.some((a) => GAMES_VISIBLE_AREAS.has(a)))?.version ?? LATEST_VERSION
