import { getLocale, type Locale } from "../i18n"
import { isGamesSite } from "../site"
import { releasesHr } from "./releases.hr"
import { releasesSl } from "./releases.sl"
import { releasesEn } from "./releases.en"
import type { ReleaseArea } from "./latestVersion"

export type { ReleaseArea }

/* ──────────────────────────────────────────────────────────────────────────
   "Novosti" (what's new) release notes — content, not UI chrome.

   Unlike everything else in the app, this text does NOT live in
   `src/i18n/{hr,sl}/*.ts`. Those dictionaries are typed key-for-key against
   `hr` (a missing Slovenian key is a compile error), which is the right
   contract for short, stable UI labels but the wrong one for prose: a
   release note is written once, dated, and never touched again, and forcing
   it through the same one-key-per-string dictionary shape would make every
   past release's paragraphs permanent dead weight in `whatsNew.ts` with no
   natural place to retire them. Keeping it here instead means the dialog
   chrome (`src/i18n/{hr,sl}/whatsNew.ts` — chip labels, aria-labels, the
   page counter) stays small and timeless, while the actual announcements
   accumulate as plain, append-only data.

   `releases.hr.ts` is still the source of truth in the same sense as the
   real dictionaries — write Croatian first, then a faithful translation in
   `releases.sl.ts` and `releases.en.ts` — just without the compiler enforcing
   it, since prose doesn't type-check key by key. Newest release first in
   every file, and every file holds the same releases in the same order.

   This module (and the locale files behind it) is imported ONLY from
   `WhatsNewDialog.tsx`, which `main.tsx` mounts via `React.lazy` — so none of
   this prose reaches the initial bundle. `store.ts`'s `hasUnseen()` needs the
   newest version tag before the dialog has ever opened (the FAB's badge dot
   is eager), so it reads `LATEST_VERSION` from `./latestVersion` instead of
   importing this file — see that module's comment.
   ────────────────────────────────────────────────────────────────────── */

/** One paragraph block under a page heading. `body` paragraphs support a
 *  tiny inline `**bold**` syntax, rendered by `renderInline` in
 *  `WhatsNewDialog.tsx` — not real markdown, just enough for emphasis. */
export interface ReleaseSection {
    title: string
    body: string[]
    /**
     * Render `body` as a bulleted list instead of paragraphs. For a section
     * that is genuinely an enumeration of capabilities — a reader scans those
     * for the one thing they care about, and a wall of paragraphs hides it.
     */
    bullets?: boolean
}

/** One themed group inside a release — "Blok", "Turniri", … Rendered one
 *  under another in a single scrolling view; there is deliberately no
 *  pagination (2026-09-10, user request: a release note is skimmed, and a
 *  stepper hides half of it behind a control nobody presses). */
export interface ReleaseGroup {
    heading: string
    sections: ReleaseSection[]
    /**
     * Which product this group's content is about. Groups are already
     * thematic (one heading per topic — "Blok", "Turniri", "Bela Online",
     * "Aplikacija", …), so this classifies at the group level rather than
     * per section: every section in a group shares its subject.
     *
     * Drives `getReleases()`'s filtering on the games site (bela.games /
     * belot.games), which has no tournaments/calendar/map — see that
     * function below. `"general"` is for content that reads fine with no
     * mention of tournaments (app-wide redesigns, install prompts, …); a
     * group mixing general and tournament-specific content should be split,
     * or classified `"tournaments"` if the tournament framing dominates.
     * `LATEST_VERSION_GAMES` in `latestVersion.ts` mirrors this per-release
     * (not per-group) for the eager unseen-badge check — keep both in sync
     * when adding a release.
     */
    area: ReleaseArea
    /**
     * Render this group in the announcement accent (amber) instead of the
     * app's brand green, and give it a tinted panel. For the ONE group in a
     * release that is a heads-up about something not shipped yet — it sits
     * at the top and must not read like the rest of the "here is what
     * changed" list. At most one group per release should set it.
     */
    accent?: boolean
}

/** One dated release. `version` is a plain major counter — `v1`, `v2`, … —
 *  bumped only when the OWNER says so (2026-09-10): a date-derived tag made
 *  every small fix look like a release. `date` is ISO (`formatDateLong` in
 *  the dialog renders it localised). */
export interface Release {
    version: string
    date: string
    title: string
    groups: ReleaseGroup[]
}

/** Areas shown on the games site (bela.games / belot.games) — no
 *  tournaments, calendar or map there, so `"tournaments"` groups are cut.
 *  `"general"` groups are kept: they were written (and classified) to read
 *  fine on their own, with no tournament context. */
const GAMES_VISIBLE_AREAS: ReadonlySet<ReleaseArea> = new Set(["game", "blok", "general"])

/** On the games site, drop tournament-only groups from every release, then
 *  drop any release left with no groups at all — a release that was purely
 *  about tournaments simply never appears there. bela-turniri.com gets the
 *  unfiltered list. */
function filterForSite(releases: Release[]): Release[] {
    if (!isGamesSite) return releases
    return releases
        .map((release) => ({
            ...release,
            groups: release.groups.filter((group) => GAMES_VISIBLE_AREAS.has(group.area)),
        }))
        .filter((release) => release.groups.length > 0)
}

/** Newest first, in the active UI locale, filtered for the current site.
 *  `getLocale()` is read at call time (like `utils/format.ts` does), not
 *  cached at module load, so a language switch is picked up the next time
 *  the dialog opens. */
export function getReleases(): Release[] {
    const byLocale: Partial<Record<Locale, Release[]>> = { sl: releasesSl, en: releasesEn }
    // `hr` is the fallback for a locale whose notes have not been written yet,
    // exactly as `translate()` falls back for a missing dictionary key.
    const releases = byLocale[getLocale()] ?? releasesHr
    return filterForSite(releases)
}
