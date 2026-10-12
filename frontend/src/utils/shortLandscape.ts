/* ──────────────────────────────────────────────────────────────────────────
   Short landscape — a phone held sideways (2026-10-12, owner).

   ONE query for the whole app: the game's full-screen landscape table
   (`game/landscapeQuery.ts` re-exports it as `LANDSCAPE_TABLE_QUERY`) and
   the compact chrome every other screen switches to — a ~40 px navbar that
   scrolls away, a footer that only follows the content, lower cards. Keyed
   on HEIGHT, not width: a phone on its side is 667–932 px wide, i.e. past
   `md`, and was getting the full desktop chrome on 360–430 px of height.
   Portrait phones and real desktops never match it.

   Dependency-free on purpose: `App.tsx` and the entry chunk read it.
   `src/index.css` repeats the query for the `--nav-h` / `--nav-pin`
   variables (plain CSS cannot import it) — change both together.
   ────────────────────────────────────────────────────────────────────── */

/** The bare media query, for `window.matchMedia`. */
export const SHORT_LANDSCAPE_QUERY = "(orientation: landscape) and (max-height: 560px)"

/** The same as a `css` block key: `css={{ [SHORT_LANDSCAPE]: { py: "1" } }}`.
 *  Chakra sorts a max-height query after its min-width breakpoints, so an
 *  override here wins over a responsive `{ base, md }` prop on the same
 *  element. */
export const SHORT_LANDSCAPE = `@media ${SHORT_LANDSCAPE_QUERY}`
