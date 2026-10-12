/** The ONE media query for the full-screen landscape table (2026-10-12):
 *  a phone held sideways. Kept in a dependency-free module because
 *  `App.tsx` reads it on every route (to drop the chrome) and must not pull
 *  `tableStyles.ts` — with its felt texture data-URI — into the entry chunk.
 *  `tableStyles.LANDSCAPE_TABLE` wraps it for `css` blocks. */
export const LANDSCAPE_TABLE_QUERY = "(orientation: landscape) and (max-height: 560px)"
