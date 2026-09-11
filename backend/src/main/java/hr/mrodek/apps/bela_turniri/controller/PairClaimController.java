package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.repository.PairsRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import hr.mrodek.apps.bela_turniri.services.CurrentUser;
import hr.mrodek.apps.bela_turniri.services.SlugService;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

import java.time.OffsetDateTime;

/**
 * Pair-sharing claim flow.
 *
 *   GET   /pairs/claim/{token}/preview   — public read of basic info so
 *                                          the claim landing page can
 *                                          show the partner what they're
 *                                          claiming before they accept.
 *   POST  /pairs/claim/{token}           — auth-required claim; sets
 *                                          coSubmittedByUid on the pair.
 *
 * The primary submitter copies the share URL from their pair card
 * (the /claim-pair/{token} route on the frontend) and hands it to
 * their partner. The partner opens it, signs in if needed, taps the
 * Preuzmi button, and becomes co-owner of the pair — meaning the pair
 * shows up on their profile, they get push notifications about it,
 * and their personal invoice list includes matches it played.
 */
@Path("/pairs/claim/{token}")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PairClaimController {

    @Inject PairsRepository pairRepo;
    @Inject UserProfileRepository userProfileRepo;
    @Inject SlugService slugService;
    @Inject CurrentUser currentUser;

    /**
     * Public read used by the claim landing page. Returns the minimum
     * info the partner needs to recognise the pair: pair name,
     * tournament name + start date, and current claim state (whether
     * it's already been claimed by someone, and by whom if so — name +
     * slug for display, no UIDs leaked).
     */
    @GET
    @Path("/preview")
    public ClaimPreviewDto preview(@PathParam("token") String token) {
        Pairs p = pairRepo.findByClaimToken(token).orElse(null);
        if (p == null) throw new NotFoundException();

        String primaryName = null, primarySlug = null;
        if (p.getSubmittedByUid() != null) {
            var prof = userProfileRepo.findByUid(p.getSubmittedByUid()).orElse(null);
            if (prof != null) {
                primaryName = prof.getDisplayName();
                primarySlug = prof.getSlug();
            }
        }
        String coName = null, coSlug = null;
        if (p.getCoSubmittedByUid() != null) {
            var prof = userProfileRepo.findByUid(p.getCoSubmittedByUid()).orElse(null);
            if (prof != null) {
                coName = prof.getDisplayName();
                coSlug = prof.getSlug();
            }
        }

        var t = p.getTournament();
        return new ClaimPreviewDto(
                p.getName(),
                t.getName(),
                t.getSlug() != null ? t.getSlug() : (t.getUuid() != null ? t.getUuid().toString() : null),
                t.getStartAt(),
                primaryName,
                primarySlug,
                p.getCoSubmittedByUid() != null,
                coName,
                coSlug
        );
    }

    /**
     * Claim co-ownership. Conflict states:
     *   - already claimed by a different user → 409 ALREADY_CLAIMED
     *   - viewer is the primary submitter → 409 OWNER_SAME
     *   - viewer is already the co-owner → no-op, 200
     */
    @POST
    @Authenticated
    @Transactional
    public ClaimResultDto claim(@PathParam("token") String token) {
        String me = currentUser.requireUid();

        Pairs p = pairRepo.findByClaimToken(token).orElse(null);
        if (p == null) throw new NotFoundException();

        // A pair registered without an account has no primary owner at all.
        // Claiming it means ADOPTING it — the claimer becomes the submitter,
        // not a co-owner — which is what the link handed to an anonymous
        // submitter is for: "sign up later and this registration is yours".
        // Without this branch the flow below would file them as the partner of
        // nobody, and the row would stay ownerless forever.
        if (p.getSubmittedByUid() == null) {
            slugService.ensureProfile(me, currentUser.displayName());
            p.setSubmittedByUid(me);
            p.setUpdatedAt(OffsetDateTime.now());
            pairRepo.persist(p);
            return new ClaimResultDto(true, p.getId());
        }

        if (me.equals(p.getSubmittedByUid())) {
            throw new ClientErrorException("OWNER_SAME", 409);
        }
        if (p.getCoSubmittedByUid() != null) {
            if (me.equals(p.getCoSubmittedByUid())) {
                // No-op idempotent — already claimed by this same user.
                return new ClaimResultDto(true, p.getId());
            }
            throw new ClientErrorException("ALREADY_CLAIMED", 409);
        }

        // Make sure the claimer's UserProfile + slug exist so they show
        // up on subsequent pair-list enrichments. Mirrors the same
        // ensureProfile call used in self-register.
        slugService.ensureProfile(me, currentUser.displayName());

        p.setCoSubmittedByUid(me);
        p.setUpdatedAt(OffsetDateTime.now());
        pairRepo.persist(p);

        return new ClaimResultDto(true, p.getId());
    }

    /* ===================== DTOs ===================== */

    public record ClaimPreviewDto(
            String pairName,
            String tournamentName,
            String tournamentRef,
            OffsetDateTime tournamentStartAt,
            String primaryName,
            String primarySlug,
            boolean alreadyClaimed,
            String coOwnerName,
            String coOwnerSlug
    ) {}

    public record ClaimResultDto(boolean claimed, Long pairId) {}
}
