package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.ManualRoundRequest;
import hr.mrodek.apps.bela_turniri.dtos.MatchDto;
import hr.mrodek.apps.bela_turniri.dtos.RoundDto;
import hr.mrodek.apps.bela_turniri.dtos.UpdateMatchRequest;
import hr.mrodek.apps.bela_turniri.services.CurrentUser;
import hr.mrodek.apps.bela_turniri.services.IdempotencyService;
import hr.mrodek.apps.bela_turniri.services.RoundService;
import hr.mrodek.apps.bela_turniri.services.TournamentAccess;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;

@Path("/tournaments/{uuid}/rounds")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class RoundController {

    @Inject RoundService roundService;
    @Inject TournamentAccess access;
    @Inject IdempotencyService idempotency;
    @Inject CurrentUser currentUser;

    /** Route label stored on the replay marker — diagnostics only. */
    private static final String UPDATE_MATCH_ENDPOINT =
            "PUT /tournaments/{uuid}/rounds/{roundId}/matches/{matchId}";

    /**
     * 404 when the tournament doesn't exist, 403 when the caller may not
     * manage it. The path segment is a slug or a UUID — {@link
     * TournamentAccess#loadForEdit} accepts either, since tournaments grew
     * pretty slugs after the first shared links were already in the wild.
     */
    private void assertCanEdit(String idOrSlug) {
        access.loadForEdit(idOrSlug);
    }

    @GET
    public List<RoundDto> list(@PathParam("uuid") String uuid) {
        return roundService.listByTournamentUuid(uuid);
    }

    @POST
    @Path("/draw")
    @Authenticated
    @Transactional
    public RoundDto draw(@PathParam("uuid") String uuid) {
        assertCanEdit(uuid);
        return roundService.drawNextRound(uuid);
    }

    /**
     * Manual round generation — the organiser supplies the exact list of
     * pairings. Used in the late stage of a small bracket (≤ 4 active
     * pairs) where the automatic random draw would produce awkward
     * pairings. Validation on the body (pair belongs to tournament, not
     * eliminated, no duplicates, no self-pair) lives in the service.
     */
    @POST
    @Path("/manual")
    @Authenticated
    @Transactional
    public RoundDto drawManual(@PathParam("uuid") String uuid,
                               @Valid ManualRoundRequest req) {
        assertCanEdit(uuid);
        return roundService.drawManualRound(uuid, req);
    }

    /**
     * The one write the organiser makes over and over, from a phone, in a
     * hall with unreliable Wi-Fi. The SPA queues it offline and replays on
     * reconnect, so it accepts an optional {@code X-Client-Op-Id}: the same
     * id sent twice applies the score once and returns the identical
     * {@link MatchDto} body both times (see {@link IdempotencyService}).
     * Without the header nothing changes — the work simply runs.
     *
     * <p>The access check stays OUTSIDE the idempotent block on purpose: a
     * replayed op id must not let a caller who has since lost edit rights
     * read back a response they are no longer entitled to.
     */
    @PUT
    @Path("/{roundId}/matches/{matchId}")
    @Authenticated
    @Transactional
    public Response updateMatch(
            @PathParam("uuid") String uuid,
            @PathParam("roundId") Long roundId,
            @PathParam("matchId") Long matchId,
            @HeaderParam("X-Client-Op-Id") String clientOpId,
            @Valid UpdateMatchRequest req
    ) {
        assertCanEdit(uuid);
        return idempotency.execute(clientOpId, currentUser.uidOrNull(), UPDATE_MATCH_ENDPOINT, () -> {
            MatchDto saved = roundService.updateMatchScore(uuid, roundId, matchId, req);
            return Response.ok(saved).build();
        });
    }

    @DELETE
    @Path("/{roundId}/matches")
    @Authenticated
    @Transactional
    public Response resetRound(
            @PathParam("uuid") String uuid,
            @PathParam("roundId") Long roundId
    ) {
        assertCanEdit(uuid);
        roundService.hardResetRound(uuid, roundId);
        return Response.noContent().build();
    }

    @PUT
    @Path("/{roundId}/finish")
    @Authenticated
    @Transactional
    public RoundDto finishRound(
            @PathParam("uuid") String uuid,
            @PathParam("roundId") Long roundId
    ) {
        assertCanEdit(uuid);
        // IllegalStateException is mapped to 400 by the global ExceptionMapper
        return roundService.finishRound(uuid, roundId);
    }

    @PATCH
    @Path("/{roundId}/matches/{matchId}/override-score")
    @Authenticated
    @Transactional
    public RoundDto overrideScore(
            @PathParam("uuid") String uuid,
            @PathParam("roundId") Long roundId,
            @PathParam("matchId") Long matchId,
            @Valid UpdateMatchRequest req
    ) {
        assertCanEdit(uuid);
        return roundService.overrideMatchScore(uuid, roundId, matchId, req);
    }
}
