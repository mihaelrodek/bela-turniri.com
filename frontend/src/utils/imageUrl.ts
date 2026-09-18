/* ──────────────────────────────────────────────────────────────────────────
   Helpers for the backend's `?w=` image-variant contract (2026-09-13 perf
   programme, package C on the backend / package D here):

     GET /api/resources/{id}/image?w=480   → poster, 480px wide
     GET /api/resources/{id}/image?w=960   → poster, 960px wide
     GET /api/resources/{id}/image?w=128   → avatar, 128px wide
     any other `w`                         → 400

   The contract is scoped to that exact path. `posterUrl`/`bannerUrl`/
   `avatarUrl` in every DTO are always backend-proxied paths of this shape —
   see `TournamentMapper.publicUrl` and `PublicProfileService` on the
   backend, both of which compute `/api/resources/<id>/image` from the
   resource id rather than ever handing out a raw MinIO URL. Still, every
   helper here re-checks the path before appending `?w=`, so a URL that
   somehow points elsewhere (a future external source, a stale cached shape)
   passes through unmodified instead of picking up a query param the origin
   server won't understand.
   ────────────────────────────────────────────────────────────────────── */

const RESOURCE_IMAGE_PATH = /^\/api\/resources\/\d+\/image$/

/** True when `url` is a bare `/api/resources/{id}/image` path with no
 *  existing query string — the only shape the `w=` contract applies to. */
export function isResourceImageUrl(url: string | null | undefined): url is string {
    if (!url) return false
    return RESOURCE_IMAGE_PATH.test(url)
}

function withWidth(url: string, w: number): string {
    return `${url}?w=${w}`
}

export type PosterSrcSet = {
    /** Original, full-size URL — the `src`/fallback for browsers that
     *  ignore `srcset`, and for anything not on the proxied resource path. */
    src: string
    /** `w`-descriptor srcset, present only for a proxied resource URL. */
    srcSet?: string
    /** Matching `sizes`, present only alongside `srcSet`. */
    sizes?: string
}

/**
 * Poster `srcset`/`sizes` for the backend's 480/960 widths, falling back to
 * the original URL as `src`. Returns `null` for no poster at all; returns a
 * `src`-only result (no `srcSet`) for a poster URL that isn't on the proxied
 * resource path, so callers can spread the result onto an `<Image>` in one
 * shot regardless of which case they got.
 */
export function posterSrcSet(url: string | null | undefined, sizes: string): PosterSrcSet | null {
    if (!url) return null
    if (!isResourceImageUrl(url)) return { src: url }
    return {
        src: url,
        srcSet: `${withWidth(url, 480)} 480w, ${withWidth(url, 960)} 960w`,
        sizes,
    }
}

/**
 * `sizes` for a poster inside `.responsive-card-grid` (ListingCard): 1 / 2 / 3
 * columns at 0 / 42rem / 68rem *container* width (see
 * `platform/foldable.css`). `sizes` can't express container queries, so this
 * approximates against viewport width instead — close enough for a resource
 * hint, off only on pages where the grid's container is narrower than the
 * viewport (e.g. a side rail), which this app doesn't have on the listing.
 */
export const LISTING_CARD_POSTER_SIZES =
    "(min-width: 1088px) 33vw, (min-width: 672px) 50vw, 100vw"

/**
 * `sizes` for the tournament-detail header poster (`DetailsSection`): a
 * fixed 264px rail from Chakra's `xl` breakpoint up, full-bleed below it.
 */
export const DETAIL_POSTER_SIZES = "(min-width: 1280px) 264px, 100vw"

/** `href`/`imageSrcSet`/`imageSizes` for preloading the detail-page header
 *  poster — shared by the hover-prefetch (`react-dom`'s `preload()`) and the
 *  route-mount `<link rel="preload">` (`useDocumentHead`), so the browser
 *  matches the preload to what the real `<img>` ends up requesting instead
 *  of fetching the image twice under two different URLs. */
export function detailPosterPreload(
    url: string | null | undefined,
): { href: string; imageSrcSet?: string; imageSizes?: string } | null {
    const spec = posterSrcSet(url, DETAIL_POSTER_SIZES)
    if (!spec) return null
    return { href: spec.src, imageSrcSet: spec.srcSet, imageSizes: spec.sizes }
}

/** Parses a plain pixel string ("44px") to a number, or `null` for anything
 *  else (a token, a responsive object already unwrapped to some other unit,
 *  `undefined`) — callers treat `null` as "unknown, don't guess". */
function parsePx(value: string): number | null {
    const m = /^(\d+(?:\.\d+)?)px$/.exec(value.trim())
    return m ? Number(m[1]) : null
}

/**
 * Avatar URL downscaled to the backend's `?w=128` variant when the rendered
 * box is small enough to benefit (≤ 64px edge — twice the 128px asset, which
 * covers up to a 2x-DPR 64px box without upscaling artifacts). Never
 * upscales: a box bigger than 64px, or a box size this can't parse (not a
 * plain pixel value), gets the original full-size URL back rather than a
 * guessed-wrong crop.
 */
export function avatarSrcForBox(
    url: string | null | undefined,
    boxPx: number | string | undefined,
): string | null {
    if (!url) return null
    if (!isResourceImageUrl(url)) return url
    const px = typeof boxPx === "number" ? boxPx : boxPx ? parsePx(boxPx) : null
    if (px == null || px > 64) return url
    return withWidth(url, 128)
}
