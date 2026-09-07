package hr.mrodek.apps.bela_turniri.filters;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.ext.Provider;

import java.util.List;
import java.util.Set;

/**
 * Adds a short, shared-cacheable {@code Cache-Control} to a whitelist of
 * public read-only endpoints whose response body is identical for every
 * caller.
 *
 * <p>Why a whitelist and not "all GETs": {@code /public/users/{slug}} varies
 * by caller (phone numbers and hidden participations are redacted for anyone
 * who isn't the profile owner), so tagging it {@code public} could leak the
 * authenticated variant through a shared cache. Only the truly uniform reads
 * are listed here.
 *
 * <p>Effect:
 * <ul>
 *   <li>The browser reuses the response for {@code max-age} — back/forward
 *       navigation between the list and a tournament page becomes instant
 *       instead of a round trip.</li>
 *   <li>{@code s-maxage} lets Caddy (or a CDN, if one is ever put in front)
 *       serve the list from the edge and offload the backend. Harmless when
 *       no shared cache is present.</li>
 * </ul>
 *
 * <p>Deliberately NOT here: anything under {@code /rounds}, match state, or
 * pair listings. Organisers edit those live during a tournament and a 20 s
 * stale read would make a freshly entered score look lost.
 *
 * <p>Endpoints that set their own {@code Cache-Control} (preview pages, the
 * sitemap, the image proxy) are skipped — we never overwrite an explicit value.
 */
@Provider
public class PublicReadCacheFilter implements ContainerResponseFilter {

    private static final String CACHE_VALUE = "public, max-age=20, s-maxage=60";

    /**
     * Exact paths (relative to the {@code /api} root) that are safe to cache
     * publicly. Both are computed purely from the {@code Tournaments} table
     * with no reference to the caller:
     * <ul>
     *   <li>{@code tournaments} — the upcoming / finished listing
     *       ({@code TournamentController#list}); the same rows for everyone,
     *       soft-deleted ones already filtered by the entity's
     *       {@code @Where} clause.</li>
     *   <li>{@code tournaments/count} — the "Učitaj više" total.</li>
     * </ul>
     */
    private static final Set<String> CACHEABLE = Set.of(
            "tournaments",
            "tournaments/count"
    );

    /** Suffix of the per-tournament drink price list ({@code CjenikController}),
     *  which is a public read whose body does not depend on the caller. Matched
     *  by suffix because the path carries a uuid-or-slug segment. */
    private static final String CJENIK_SUFFIX = "/cjenik";
    private static final String TOURNAMENTS_PREFIX = "tournaments/";

    @Override
    public void filter(ContainerRequestContext req, ContainerResponseContext res) {
        if (!"GET".equalsIgnoreCase(req.getMethod())) return;
        if (res.getStatus() != 200) return;
        // Respect an explicit Cache-Control set by the resource method.
        if (res.getHeaders().containsKey(HttpHeaders.CACHE_CONTROL)) return;

        String path = req.getUriInfo() != null ? req.getUriInfo().getPath() : null;
        if (path == null) return;
        // Normalise: drop a leading slash, an optional "api/" prefix and a
        // trailing slash so the match works regardless of how the configured
        // root-path is reported.
        if (path.startsWith("/")) path = path.substring(1);
        if (path.startsWith("api/")) path = path.substring(4);
        if (path.endsWith("/")) path = path.substring(0, path.length() - 1);

        boolean cacheable = CACHEABLE.contains(path)
                || (path.startsWith(TOURNAMENTS_PREFIX)
                        && path.endsWith(CJENIK_SUFFIX)
                        // exactly tournaments/{idOrSlug}/cjenik — not a deeper
                        // sub-resource that might be owner-scoped
                        && path.indexOf('/', TOURNAMENTS_PREFIX.length())
                                == path.length() - CJENIK_SUFFIX.length());

        if (cacheable) {
            res.getHeaders().putSingle(HttpHeaders.CACHE_CONTROL, CACHE_VALUE);
            // Vary keys the browser cache on the Authorization header so an
            // anonymous copy can never be replayed to a signed-in user (or the
            // reverse) should any of these listings grow a caller-dependent
            // field later. Free for the endpoints that really are uniform —
            // anonymous requests carry no Authorization, so they all share one
            // cache key.
            //
            // Append rather than replace: another filter (or the resource
            // itself) may already vary on Origin / Accept-Encoding, and
            // overwriting that would let a CDN serve the wrong variant.
            if (!variesOnAuthorization(res.getHeaders().get(HttpHeaders.VARY))) {
                res.getHeaders().add(HttpHeaders.VARY, "Authorization");
            }
        }
    }

    /** True when any existing Vary header already lists Authorization. */
    private static boolean variesOnAuthorization(List<Object> existing) {
        if (existing == null || existing.isEmpty()) return false;
        for (Object v : existing) {
            if (v == null) continue;
            for (String token : v.toString().split(",")) {
                if (token.trim().equalsIgnoreCase("Authorization")) return true;
            }
        }
        return false;
    }
}
