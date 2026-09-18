package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.PairMatchHistoryDto;
import hr.mrodek.apps.bela_turniri.dtos.PublicProfileDto;
import hr.mrodek.apps.bela_turniri.services.CurrentUser;
import hr.mrodek.apps.bela_turniri.services.PublicProfileService;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

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

    /**
     * The caller, via {@link CurrentUser} rather than a hand-rolled
     * {@code jwt.getSubject()} dance (CLAUDE.md: "Do not compare
     * {@code jwt.getSubject()} by hand in controllers").
     *
     * <p>Same semantics as before: {@code CurrentUser.uid()} reads the subject
     * straight off {@link org.eclipse.microprofile.jwt.JsonWebToken}, which is
     * what forces verification. {@code SecurityIdentity} would NOT do — with
     * {@code quarkus.http.auth.proactive=false} it stays anonymous on an
     * endpoint without {@code @Authenticated} even when a valid bearer token
     * was sent, and this endpoint has none.
     *
     * <p>The viewer matters twice here: it un-redacts phone numbers for a
     * signed-in caller, and it is what the block check
     * ({@code UserBlockRepository.existsEitherWay}) is run against.
     */
    @Inject CurrentUser currentUser;

    @GET
    @Path("/{slug}")
    public PublicProfileDto getBySlug(@PathParam("slug") String slug) {
        return profileService.getBySlug(slug, currentUser.uidOrNull(), currentUser.isAnonymous());
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
