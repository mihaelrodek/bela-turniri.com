/** The ONE media query for the full-screen landscape table (2026-10-12):
 *  a phone held sideways. Since the app-wide short-landscape mode (same day)
 *  it lives in `utils/shortLandscape.ts` and is re-exported here under its
 *  game name, so the table and the rest of the app can never disagree about
 *  where landscape starts. Still dependency-free: `App.tsx` reads it on
 *  every route and must not pull `tableStyles.ts` — with its felt texture
 *  data-URI — into the entry chunk. `tableStyles.LANDSCAPE_TABLE` wraps it
 *  for `css` blocks. */
export { SHORT_LANDSCAPE_QUERY as LANDSCAPE_TABLE_QUERY } from "../utils/shortLandscape"
