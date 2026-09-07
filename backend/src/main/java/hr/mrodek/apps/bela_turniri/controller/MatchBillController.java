package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.AddMatchDrinkRequest;
import hr.mrodek.apps.bela_turniri.dtos.MatchBillDto;
import hr.mrodek.apps.bela_turniri.model.Matches;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.repository.MatchesRepository;
import hr.mrodek.apps.bela_turniri.services.CurrentUser;
import hr.mrodek.apps.bela_turniri.services.IdempotencyService;
import hr.mrodek.apps.bela_turniri.services.MatchBillService;
import hr.mrodek.apps.bela_turniri.services.TournamentAccess;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

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
 *
 * Transactions: every mutating endpoint is {@code @Transactional} so the
 * ownership check in {@link #assertOwner} and the write that follows run
 * in ONE transaction against ONE persistence context. Without it the
 * service opened its own transaction after the check had already
 * committed-and-closed, leaving a window where ownership could change
 * between the two and re-loading the same match twice per request.
 */
@Path("/tournaments/{uuid}/matches/{matchId}")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class MatchBillController {

    @Inject MatchBillService billService;
    @Inject MatchesRepository matchesRepo;
    @Inject TournamentAccess access;
    @Inject CurrentUser currentUser;
    @Inject IdempotencyService idempotency;
    @Inject hr.mrodek.apps.bela_turniri.services.MessageService messages;

    @GET
    @Path("/bill")
    public MatchBillDto getBill(
            @PathParam("uuid") String uuid,
            @PathParam("matchId") Long matchId
    ) {
        Matches m = loadMatch(uuid, matchId);
        // Owner or a participant only. Anyone else: 404, not 403 — a 403
        // would confirm to any signed-in stranger that this match has a bill.
        if (!billService.isParticipant(m, currentUid())) {
            access.assertCanEditOrHide(m.getTournament());
        }
        return billService.getBill(matchId);
    }

    /*
     * The four mutating bill endpoints below all accept an optional
     * X-Client-Op-Id. The bartender adds drinks on a phone at the table,
     * which is exactly where the Wi-Fi gives out; the SPA queues those
     * writes and replays them on reconnect, and the header is what stops a
     * replay from adding the same rakija twice or un-doing a pay/unpay
     * pair. Absent header = unchanged behaviour.
     *
     * assertOwner stays outside the idempotent block: a replay must be
     * re-authorised, never served from the marker alone.
     */

    @POST
    @Path("/drinks")
    @Transactional
    public Response addDrink(
            @PathParam("uuid") String uuid,
            @PathParam("matchId") Long matchId,
            @HeaderParam("X-Client-Op-Id") String clientOpId,
            @Valid AddMatchDrinkRequest body
    ) {
        assertOwner(uuid, matchId);
        // priceId/quantity shape is enforced by the DTO's constraints; only
        // an entirely absent body still has to be caught by hand.
        if (body == null) {
            throw new BadRequestException(messages.t("matchBill.priceIdRequired"));
        }
        int qty = body.quantity() == null ? 1 : body.quantity();
        return idempotency.execute(clientOpId, currentUid(),
                "POST /tournaments/{uuid}/matches/{matchId}/drinks",
                () -> Response.ok(billService.addDrink(matchId, body.priceId(), qty)).build());
    }

    @DELETE
    @Path("/drinks/{drinkId}")
    @Transactional
    public Response removeDrink(
            @PathParam("uuid") String uuid,
            @PathParam("matchId") Long matchId,
            @PathParam("drinkId") Long drinkId,
            @HeaderParam("X-Client-Op-Id") String clientOpId
    ) {
        assertOwner(uuid, matchId);
        return idempotency.execute(clientOpId, currentUid(),
                "DELETE /tournaments/{uuid}/matches/{matchId}/drinks/{drinkId}",
                () -> Response.ok(billService.removeDrink(matchId, drinkId)).build());
    }

    @POST
    @Path("/pay")
    @Transactional
    public Response markPaid(
            @PathParam("uuid") String uuid,
            @PathParam("matchId") Long matchId,
            @HeaderParam("X-Client-Op-Id") String clientOpId
    ) {
        assertOwner(uuid, matchId);
        return idempotency.execute(clientOpId, currentUid(),
                "POST /tournaments/{uuid}/matches/{matchId}/pay",
                () -> Response.ok(billService.markPaid(matchId, currentUid(), currentUser.displayName())).build());
    }

    @POST
    @Path("/unpay")
    @Transactional
    public Response markUnpaid(
            @PathParam("uuid") String uuid,
            @PathParam("matchId") Long matchId,
            @HeaderParam("X-Client-Op-Id") String clientOpId
    ) {
        assertOwner(uuid, matchId);
        return idempotency.execute(clientOpId, currentUid(),
                "POST /tournaments/{uuid}/matches/{matchId}/unpay",
                () -> Response.ok(billService.markUnpaid(matchId)).build());
    }

    /* ===================== helpers ===================== */

    private String currentUid() {
        return currentUser.uidOrNull();
    }

    private Matches loadMatch(String uuidOrSlug, Long matchId) {
        Tournaments t = access.load(uuidOrSlug);
        Matches m = matchesRepo.findByIdOptional(matchId).orElse(null);
        if (m == null || m.getTournament() == null
                || !Objects.equals(m.getTournament().getId(), t.getId())) {
            throw new NotFoundException();
        }
        return m;
    }

    private void assertOwner(String uuidOrSlug, Long matchId) {
        access.assertCanEdit(loadMatch(uuidOrSlug, matchId).getTournament());
    }
}
