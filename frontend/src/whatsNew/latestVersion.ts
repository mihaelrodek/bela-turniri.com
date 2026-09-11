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
export const LATEST_VERSION = "v2"
