import { getLocale } from "../i18n"
import { releasesHr } from "./releases.hr"
import { releasesSl } from "./releases.sl"

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
   real dictionaries — write Croatian first, then a faithful Slovenian
   translation in `releases.sl.ts` — just without the compiler enforcing it,
   since prose doesn't type-check key by key. Newest release first in both
   files.

   This module (and the two locale files behind it) is imported ONLY from
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

/** Newest first, in the active UI locale. `getLocale()` is read at call
 *  time (like `utils/format.ts` does), not cached at module load, so a
 *  language switch is picked up the next time the dialog opens. */
export function getReleases(): Release[] {
    return getLocale() === "sl" ? releasesSl : releasesHr
}
