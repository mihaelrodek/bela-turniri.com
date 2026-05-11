package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.AddMatchDrinkRequest;
import hr.mrodek.apps.bela_turniri.dtos.MatchBillDto;
import hr.mrodek.apps.bela_turniri.model.Matches;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.repository.MatchesRepository;
import hr.mrodek.apps.bela_turniri.repository.TournamentsRepository;
import hr.mrodek.apps.bela_turniri.services.MatchBillService;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.Objects;

/**
 * Per-match drink-bill endpoints.
 *
 *   GET    /tournaments/{uuid}/matches/{matchId}/bill             — owner OR participant
 *   POST   /tournaments/{uuid}/matches/{matchId}/drinks           — owner only
 *   DELETE /tournaments/{uuid}/matches/{matchId}/drinks/{drinkId} — owner only
 *   POST   /tournaments/{uuid}/matches/{matchId}/pay              — owner only
 *   POST   /tournaments/{uuid}/matches/{matchId}/unpay            — owner only
 *
 * Privacy: prices are NEVER visible to non-participants. The GET returns
 * 404 for anyone who isn't a player on the match or the tournament owner.
 *
 * Edit lock: once a bill is paid the bartender can't add/remove drinks
 * without first hitting unpay. Enforced in MatchBillService.
 */
@Path("/tournaments/{uuid}/matches/{matchId}")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class MatchBillController {

    @Inject MatchBillService billService;
    @Inject MatchesRepository matchesRepo;
    @Inject TournamentsRepository tournamentsRepo;
    @Inject SecurityIdentity identity;
    @Inject JsonWebToken jwt;

    @GET
    @Path("/bill")
    public MatchBillDto getBill(
            @PathParam("uuid") String uuid,
            @PathParam("matchId") Long matchId
    ) {
        Matches m = loadMatch(uuid, matchId);
        // Owner or a participant only. Anyone else: 404 (don't leak existence).
        if (!isOwnerOrAdmin(m.getTournament()) && !billService.isParticipant(m, currentUid())) {
            throw new NotFoundException();
        }
        return billService.getBill(matchId);
    }

    @POST
    @Path("/drinks")
    public MatchBillDto addDrink(
            @PathParam("uuid") String uuid,
            @PathParam("matchId") Long matchId,
            AddMatchDrinkRequest body
    ) {
        assertOwner(uuid, matchId);
        if (body == null || body.priceId() == null) {
            throw new BadRequestException("priceId is required");
        }
        int qty = body.quantity() == null ? 1 : Math.max(1, body.quantity());
        return billService.addDrink(matchId, body.priceId(), qty);
    }

    @DELETE
    @Path("/drinks/{drinkId}")
    public MatchBillDto removeDrink(
            @PathParam("uuid") String uuid,
            @PathParam("matchId") Long matchId,
            @PathParam("drinkId") Long drinkId
    ) {
        assertOwner(uuid, matchId);
        return billService.removeDrink(matchId, drinkId);
    }

    @POST
    @Path("/pay")
    public MatchBillDto markPaid(
            @PathParam("uuid") String uuid,
            @PathParam("matchId") Long matchId
    ) {
        assertOwner(uuid, matchId);
        return billService.markPaid(matchId, currentUid());
    }

    @POST
    @Path("/unpay")
    public MatchBillDto markUnpaid(
            @PathParam("uuid") String uuid,
            @PathParam("matchId") Long matchId
    ) {
        assertOwner(uuid, matchId);
        return billService.markUnpaid(matchId);
    }

    /* ===================== helpers ===================== */

    private String currentUid() {
        return jwt != null ? jwt.getSubject() : null;
    }

    private Matches loadMatch(String uuidOrSlug, Long matchId) {
        Tournaments t = tournamentsRepo.findByUuidOrSlug(uuidOrSlug).orElse(null);
        if (t == null) throw new NotFoundException();
        Matches m = matchesRepo.findByIdOptional(matchId).orElse(null);
        if (m == null || m.getTournament() == null
                || !Objects.equals(m.getTournament().getId(), t.getId())) {
            throw new NotFoundException();
        }
        return m;
    }

    private boolean isOwnerOrAdmin(Tournaments t) {
        boolean admin = identity != null && identity.hasRole("admin");
        if (admin) return true;
        String me = currentUid();
        return me != null && Objects.equals(me, t.getCreatedByUid());
    }

    private void assertOwner(String uuidOrSlug, Long matchId) {
        Matches m = loadMatch(uuidOrSlug, matchId);
        if (!isOwnerOrAdmin(m.getTournament())) {
            throw new ForbiddenException("Only the tournament creator can edit the bill.");
        }
    }
}
