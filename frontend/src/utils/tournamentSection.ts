/* ---------- Section ↔ URL ----------

   The tournament page's sections live in the URL — `/turniri/:uuid/:section?` —
   rather than in component state. That is what makes a refresh land back on the
   section the user was reading, a section shareable as a link, and the browser's
   back/forward buttons move between sections.

   These slugs are URL tokens, not copy. They belong to the route table exactly
   like `/turniri` or `/pronadi-para`, so they stay Croatian in every locale and
   deliberately never enter the i18n dictionaries — a URL that changed shape with
   the UI language would break every shared link the moment the reader's locale
   differed from the sender's. `zdrijeb` drops the diacritic from "ždrijeb", the
   same rule the backend's SlugService applies when it builds tournament slugs.

   `details` is the canonical default and has no slug of its own: the bare
   `/turniri/:uuid` renders it. One tournament therefore keeps exactly one
   canonical URL for search engines (see `canonicalUrl` in useTournamentHead,
   which never carries a section).
   ────────────────────────────────────────────────────────────────────── */

export const SECTION_SLUG = {
    details: "detalji",
    pairs: "parovi",
    bracket: "zdrijeb",
    cjenik: "cjenik",
    /* `racuni` resolves for EVERYONE, even though the nav item is only
       rendered for the organiser and for someone already holding a waiter
       session. That is what makes the organiser's `?kod=` share link work: it
       lands a waiter on a section they have never been able to see, and the
       code gate underneath turns the code into the session that reveals it. */
    racuni: "racuni",
} as const

export type SectionKey = keyof typeof SECTION_SLUG

export const SECTION_BY_SLUG: Record<string, SectionKey> = Object.fromEntries(
    (Object.keys(SECTION_SLUG) as SectionKey[]).map((key) => [SECTION_SLUG[key], key]),
)

/**
 * Slug → section, with Detalji as the fallback. An unknown segment resolves
 * to the default section instead of 404-ing: a mistyped or stale deep link
 * should still show the tournament, and the canonical <link> already points
 * search engines back at the bare URL.
 */
export function sectionFromSlug(slug: string | undefined): SectionKey {
    if (!slug) return "details"
    return SECTION_BY_SLUG[slug.toLowerCase()] ?? "details"
}

/** Path for a section — `details` stays on the bare, canonical tournament URL. */
export function sectionPath(idOrSlug: string, key: SectionKey): string {
    const base = `/turniri/${idOrSlug}`
    return key === "details" ? base : `${base}/${SECTION_SLUG[key]}`
}
