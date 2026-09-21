/**
 * The public account-deletion route, spelled once.
 *
 * Its own module rather than a const exported from `AccountDeletionPage.tsx`,
 * because both importers — the router in `App.tsx` and the delete card deep
 * inside the profile chunk — only want the STRING. Importing it from the page
 * would statically pull that page (and the whole `legal` prose namespace it
 * renders) into their chunks and undo the lazy split it exists for.
 *
 * Croatian slug, like every other route in this app. Deliberately absent from
 * `FULL_SITE_ONLY_PREFIXES` in `src/site.ts`: the games-only build is the one
 * the app stores review, and this is the URL listed in Google Play's Data
 * safety form.
 */
export const ACCOUNT_DELETION_PATH = "/brisanje-racuna"
