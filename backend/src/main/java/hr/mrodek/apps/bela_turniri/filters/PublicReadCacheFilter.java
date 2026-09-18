package hr.mrodek.apps.bela_turniri.filters;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;

/**
 * Two related jobs, both about letting a repeat GET skip real work:
 *
 * <ol>
 *   <li><b>Shared {@code Cache-Control}</b> on a whitelist of public
 *       read-only endpoints whose response body is identical for every
 *       caller — same rationale as before this class grew a second job (see
 *       "Why a whitelist" below).</li>
 *   <li><b>Weak {@code ETag} + {@code If-None-Match} → 304</b> on that same
 *       whitelist, plus one private, per-caller route
 *       ({@code GET /user/me/profile}) that gets its own {@code Cache-Control}
 *       but the identical revalidation mechanics. A 304 has no body, so a
 *       client that already holds the current bytes pays only a request/
 *       response header round trip instead of re-downloading and
 *       re-parsing the JSON.</li>
 * </ol>
 *
 * <p>Why a whitelist and not "all GETs": {@code /public/users/{slug}} varies
 * by caller (phone numbers and hidden participations are redacted for anyone
 * who isn't the profile owner), so tagging it {@code public} could leak the
 * authenticated variant through a shared cache. Only the truly uniform reads
 * are listed here — which is also exactly why the profile route is only
 * ETag'd (private revalidation), never stamped {@code public}.
 *
 * <p>Effect of the shared {@code Cache-Control}:
 * <ul>
 *   <li>The browser reuses the response for {@code max-age} — back/forward
 *       navigation between the list and a tournament page becomes instant
 *       instead of a round trip. {@code stale-while-revalidate} lets it serve
 *       a slightly-stale copy immediately while refetching in the
 *       background, so a cold navigation right after the {@code max-age}
 *       window still paints instantly.</li>
 *   <li>{@code s-maxage} lets Caddy (or a CDN, if one is ever put in front)
 *       serve the list from the edge and offload the backend. Harmless when
 *       no shared cache is present.</li>
 * </ul>
 *
 * <p>Deliberately NOT here: anything under {@code /rounds}, match state, or
 * pair listings ({@code /tournaments/{id}/pairs}). Organisers edit those live
 * during a tournament and a 20 s stale read would make a freshly entered
 * score look lost.
 *
 * <p>Endpoints that set their own {@code Cache-Control} (preview pages, the
 * sitemap, the image proxy, the QR code and share-image renderers) are
 * skipped entirely — we never overwrite an explicit value, and those already
 * carry their own strong, domain-specific ETag.
 */
@Provider
public class PublicReadCacheFilter implements ContainerResponseFilter {

    private static final Logger LOG = Logger.getLogger(PublicReadCacheFilter.class);

    /**
     * Same {@code ObjectMapper} bean the JAX-RS Jackson provider and every
     * controller inject — used only to turn the already-built response
     * entity (a plain DTO / List / Map, never a stream) into the bytes we
     * hash for the weak ETag. The hash does not need to be byte-identical
     * to what eventually goes over the wire; it only needs to be
     * deterministic for the same logical content, which a consistent
     * ObjectMapper guarantees.
     */
    @Inject
    ObjectMapper objectMapper;

    private static final String CACHE_VALUE =
            "public, max-age=20, s-maxage=60, stale-while-revalidate=120";

    /** {@code GET /user/me/profile} is per-caller — never a shared cache, but still worth a 304. */
    private static final String PRIVATE_CACHE_VALUE = "private, no-cache";

    /**
     * Exact paths (relative to the {@code /api} root) that are safe to cache
     * publicly. Computed purely from public tables with no reference to the
     * caller (once an {@code Authorization} header rules out a personalised
     * response — see {@link #filter}):
     * <ul>
     *   <li>{@code tournaments} — the upcoming / finished listing
     *       ({@code TournamentController#list}); the same rows for everyone,
     *       soft-deleted ones already filtered by the entity's
     *       {@code @Where} clause.</li>
     *   <li>NOTE (blocks, App Store 1.2): since
     *       {@code UserBlockService.blockerUidFor}, those two listings ARE
     *       caller-dependent for a SIGNED-IN caller — a user who blocked an
     *       organiser sees fewer rows. They stay on this list because a
     *       request carrying an {@code Authorization} header is now skipped
     *       outright (see {@link #filter}), so only the uniform anonymous
     *       response is ever cacheable; {@code Vary: Authorization} remains
     *       as the second line of defence for any cache that saw an older
     *       response.</li>
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

    /**
     * Other GET sub-paths directly under {@code tournaments/} that are NOT
     * the {@code {idOrSlug}} detail endpoint, so {@link #isTournamentDetail}
     * doesn't mistake them for one. {@code count} is handled by
     * {@link #CACHEABLE} already; it's listed here too so the exclusion
     * reads as one complete set rather than being split across two places.
     */
    private static final Set<String> TOURNAMENTS_NON_DETAIL_SEGMENTS = Set.of(
            "count", "mine", "multipart", "geocode-missing"
    );

    private static final String PUBLIC_USERS_PREFIX = "public/users/";

    /** {@code GET /user/me/profile} — always authenticated, never shared, still worth revalidating. */
    private static final String USER_ME_PROFILE = "user/me/profile";

    @Override
    public void filter(ContainerRequestContext req, ContainerResponseContext res) {
        if (!"GET".equalsIgnoreCase(req.getMethod())) return;
        if (res.getStatus() != 200) return;
        // Respect an explicit Cache-Control set by the resource method —
        // e.g. the image proxy, QR code, share-image and preview endpoints
        // all set their own and already carry their own ETag.
        if (res.getHeaders().containsKey(HttpHeaders.CACHE_CONTROL)) return;

        String path = normalizePath(req);
        if (path == null) return;

        // GET /user/me/profile: always authenticated (class-level
        // @Authenticated on UserMeController), always per-caller, so it
        // gets its own private Cache-Control rather than the public one
        // below — but the exact same weak-ETag revalidation, since the body
        // still only changes when the caller edits their own profile.
        if (USER_ME_PROFILE.equals(path)) {
            res.getHeaders().putSingle(HttpHeaders.CACHE_CONTROL, PRIVATE_CACHE_VALUE);
            applyWeakEtag(req, res);
            return;
        }

        // An authenticated response is never stamped shared-cacheable at
        // all beyond this point. `Vary: Authorization` below would already
        // keep a conforming cache from mixing the variants, but since blocks
        // (App Store 1.2) made the listings caller-dependent for a signed-in
        // caller, and the public profile redacts fields for a signed-in
        // non-owner, "never cached/ETag'd for a signed-in caller" is a
        // property worth holding outright rather than delegating to every
        // cache in the path getting Vary right.
        if (req.getHeaderString(HttpHeaders.AUTHORIZATION) != null) return;

        boolean cacheable = CACHEABLE.contains(path)
                || isCjenik(path)
                || isTournamentDetail(path)
                || isPublicProfile(path);

        if (!cacheable) return;

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

        applyWeakEtag(req, res);
    }

    /** Exactly {@code tournaments/{idOrSlug}} — the tournament detail GET, not a sub-resource. */
    private static boolean isTournamentDetail(String path) {
        if (!path.startsWith(TOURNAMENTS_PREFIX)) return false;
        String rest = path.substring(TOURNAMENTS_PREFIX.length());
        if (rest.isEmpty() || rest.contains("/")) return false;
        return !TOURNAMENTS_NON_DETAIL_SEGMENTS.contains(rest);
    }

    /** Exactly {@code tournaments/{idOrSlug}/cjenik} — not a deeper sub-resource that might be owner-scoped. */
    private static boolean isCjenik(String path) {
        return path.startsWith(TOURNAMENTS_PREFIX)
                && path.endsWith(CJENIK_SUFFIX)
                && path.indexOf('/', TOURNAMENTS_PREFIX.length()) == path.length() - CJENIK_SUFFIX.length();
    }

    /** Exactly {@code public/users/{slug}} — not the nested {@code /pairs/{pairId}/matches} route. */
    private static boolean isPublicProfile(String path) {
        if (!path.startsWith(PUBLIC_USERS_PREFIX)) return false;
        String rest = path.substring(PUBLIC_USERS_PREFIX.length());
        return !rest.isEmpty() && !rest.contains("/");
    }

    /**
     * Compute a weak ETag from the response entity and either short-circuit
     * to 304 (client already has this content) or stamp the header for next
     * time. Best-effort: any serialization failure is logged and swallowed
     * rather than failing a request that would otherwise have succeeded —
     * ETag support is an optimisation, not a correctness requirement.
     */
    private void applyWeakEtag(ContainerRequestContext req, ContainerResponseContext res) {
        Object entity = res.getEntity();
        if (entity == null) return;
        try {
            byte[] json = objectMapper.writeValueAsBytes(entity);
            String etag = "W/\"" + sha256Prefix(json) + "\"";

            String ifNoneMatch = req.getHeaderString(HttpHeaders.IF_NONE_MATCH);
            if (ifNoneMatch != null && weakEtagMatches(ifNoneMatch, etag)) {
                // Cache-Control was already set above (for either the shared
                // or the private branch) — repeating it here would just
                // duplicate a header already on the response, so we leave it
                // alone and only flip status/entity.
                res.setStatus(304);
                res.setEntity(null);
            }
            res.getHeaders().putSingle(HttpHeaders.ETAG, etag);
        } catch (Exception e) {
            LOG.warnf(e, "Failed to compute weak ETag for %s (ignored, best-effort)", req.getUriInfo().getPath());
        }
    }

    /** First 16 bytes (32 hex chars) of the SHA-256 digest — plenty for a cache-validator key. */
    private static String sha256Prefix(byte[] body) {
        try {
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            byte[] digest = sha256.digest(body);
            return HexFormat.of().formatHex(digest, 0, 16);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e); // SHA-256 is always available on the JVMs we run
        }
    }

    /**
     * RFC 7232 weak comparison: an {@code If-None-Match} value matches when
     * its tag is equal ignoring a leading {@code W/} on either side (or when
     * the header is the wildcard {@code *}). Browsers echo back exactly what
     * we sent, but we compare weakly on principle since we only ever emit
     * weak tags ourselves.
     */
    private static boolean weakEtagMatches(String ifNoneMatch, String weakEtag) {
        if ("*".equals(ifNoneMatch.trim())) return true;
        String bare = stripWeakPrefix(weakEtag);
        for (String candidate : ifNoneMatch.split(",")) {
            String c = candidate.trim();
            if (c.equals(weakEtag) || stripWeakPrefix(c).equals(bare)) return true;
        }
        return false;
    }

    private static String stripWeakPrefix(String tag) {
        return tag.startsWith("W/") ? tag.substring(2) : tag;
    }

    /**
     * Normalise the request path: drop a leading slash, an optional
     * {@code "api/"} prefix and a trailing slash so matching works
     * regardless of how the configured root-path is reported.
     */
    private static String normalizePath(ContainerRequestContext req) {
        String path = req.getUriInfo() != null ? req.getUriInfo().getPath() : null;
        if (path == null) return null;
        if (path.startsWith("/")) path = path.substring(1);
        if (path.startsWith("api/")) path = path.substring(4);
        if (path.endsWith("/")) path = path.substring(0, path.length() - 1);
        return path;
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
