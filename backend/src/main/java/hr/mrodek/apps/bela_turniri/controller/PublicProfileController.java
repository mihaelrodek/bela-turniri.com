package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.PairMatchHistoryDto;
import hr.mrodek.apps.bela_turniri.dtos.PublicProfileDto;
import hr.mrodek.apps.bela_turniri.services.PublicProfileService;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * Anonymous-readable profile pages. Anyone can hit these — there is no
 * {@code @Authenticated} on the class — because the product decision is
 * that profile *pages* are publicly visible (so people can share a link to
 * their tournament history).
 *
 * <p>Phone numbers, however, are redacted for unauthenticated callers so the
 * endpoint can't be used as an anonymous PII scraper. Logged-in users see
 * the full profile.
 *
 * Routes:
 *   GET /public/users/{slug}                              — profile + pairs + tournaments
 *   GET /public/users/{slug}/pairs/{pairId}/matches       — match-by-match history for one pair
 */
@Path("/public/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PublicProfileController {

    @Inject PublicProfileService profileService;
    @Inject SecurityIdentity identity;
    @Inject JsonWebToken jwt;

    /**
     * True when no Firebase ID token was presented (or it didn't verify).
     *
     * We check {@code jwt.getSubject()} instead of
     * {@code identity.isAnonymous()} because Quarkus OIDC runs in
     * non-proactive mode (proactive=false) — under that setting,
     * SecurityIdentity stays anonymous on endpoints without
     * {@code @Authenticated} even when a valid bearer token is in the
     * request. Injecting JsonWebToken and reading the subject DOES force
     * verification, so this is the reliable signal.
     */
    private boolean isAnonymous() {
        return jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank();
    }

    @GET
    @Path("/{slug}")
    public PublicProfileDto getBySlug(@PathParam("slug") String slug) {
        boolean anon = isAnonymous();
        String viewerUid = (jwt != null) ? jwt.getSubject() : null;
        return profileService.getBySlug(slug, viewerUid, anon);
    }

    @GET
    @Path("/{slug}/pairs/{pairId}/matches")
    @Transactional
    public PairMatchHistoryDto getPairMatches(
            @PathParam("slug") String slug,
            @PathParam("pairId") Long pairId
    ) {
        return profileService.getPairMatches(slug, pairId);
    }
}
