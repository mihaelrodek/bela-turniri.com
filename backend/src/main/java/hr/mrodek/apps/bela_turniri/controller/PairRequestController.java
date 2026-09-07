package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.CreatePairRequestRequest;
import hr.mrodek.apps.bela_turniri.dtos.PairRequestDto;
import hr.mrodek.apps.bela_turniri.enums.PairRequestStatus;
import hr.mrodek.apps.bela_turniri.mappers.PairRequestMapper;
import hr.mrodek.apps.bela_turniri.model.PairRequest;
import hr.mrodek.apps.bela_turniri.repository.PairRequestRepository;
import hr.mrodek.apps.bela_turniri.services.CurrentUser;
import hr.mrodek.apps.bela_turniri.services.TournamentAccess;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Pair-finding requests. Players can post a "looking for partner" entry against
 * any upcoming tournament; other players see them and can mark themselves as matched.
 *
 * Routes:
 *   POST   /pair-requests/by-tournament/{tournamentUuid}        — create
 *   GET    /pair-requests                                       — list (optional ?status=open|matched)
 *   GET    /pair-requests/by-tournament/{tournamentUuid}        — list for one tournament
 *   POST   /pair-requests/{requestUuid}/match                   — mark as matched
 *   DELETE /pair-requests/{requestUuid}                         — remove
 */
@Path("/pair-requests")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PairRequestController {

    @Inject PairRequestRepository repo;
    @Inject TournamentAccess access;
    @Inject PairRequestMapper mapper;
    @Inject CurrentUser currentUser;
    @Inject hr.mrodek.apps.bela_turniri.services.MessageService messages;

    /** Throws 403 if the current user neither posted the request nor is an admin. */
    private void assertCanManage(PairRequest r) {
        if (currentUser.isAdmin()) return;
        String me = currentUser.uidOrNull();
        if (me == null || !me.equals(r.getCreatedByUid())) {
            throw new ForbiddenException(messages.t("pairRequest.forbidden.edit"));
        }
    }

    /** Load a pair-finding request by uuid or 404. */
    private PairRequest load(UUID requestUuid) {
        return repo.findByUuid(requestUuid)
                .orElseThrow(() -> new NotFoundException(messages.t("pairRequest.notFound")));
    }

    /**
     * Strip phone numbers from list responses served to unauthenticated callers.
     * The product still wants pair-finding requests visible to anonymous browsers
     * (so people can see "this tournament has 3 people looking for a partner"),
     * but exposing phone numbers without auth turned the endpoint into a
     * one-click PII scraper. Logged-in users get the full payload.
     */
    private List<PairRequestDto> redactForAnonymous(List<PairRequestDto> dtos) {
        // hasPhone is stamped for EVERY caller, not just anonymous ones: the
        // field has to mean the same thing in both payloads, or the client
        // would need two code paths to read one flag.
        for (PairRequestDto d : dtos) d.setHasPhone(d.getPhone() != null && !d.getPhone().isBlank());
        // "Anonymous" must be decided from the JWT subject, never from
        // SecurityIdentity: these two list endpoints carry no
        // @Authenticated, and under quarkus.http.auth.proactive=false the
        // identity then stays anonymous even for a caller holding a
        // perfectly valid bearer token — so every signed-in user got the
        // redacted payload. Same trap documented on PublicProfileController.
        if (!currentUser.isAnonymous()) return dtos;
        for (PairRequestDto d : dtos) d.setPhone(null);
        return dtos;
    }

    @POST
    @Path("/by-tournament/{tournamentUuid}")
    @Authenticated
    @Transactional
    public Response create(
            @PathParam("tournamentUuid") String tournamentIdOrSlug,
            @Valid CreatePairRequestRequest body
    ) {
        // The path segment can be either a UUID (legacy clients) or the new
        // tournament slug — TournamentAccess.load resolves both.
        var t = access.load(tournamentIdOrSlug);

        var r = new PairRequest();
        r.setTournament(t);
        r.setPlayerName(body.playerName().trim());
        r.setPhone(body.phone() == null || body.phone().isBlank() ? null : body.phone().trim());
        r.setNote(body.note() == null || body.note().isBlank() ? null : body.note().trim());
        r.setStatus(PairRequestStatus.OPEN);
        r.setCreatedByUid(currentUser.requireUid());

        repo.save(r);
        return Response.status(Response.Status.CREATED).entity(mapper.toDto(r)).build();
    }

    @GET
    public List<PairRequestDto> list(@QueryParam("status") String status) {
        if (status == null || status.isBlank()) {
            return redactForAnonymous(mapper.toDtoList(repo.findAllOrderByCreatedDesc()));
        }
        try {
            PairRequestStatus s = PairRequestStatus.valueOf(status.toUpperCase());
            return redactForAnonymous(mapper.toDtoList(repo.findByStatus(s)));
        } catch (IllegalArgumentException ex) {
            return List.of();
        }
    }

    @GET
    @Path("/by-tournament/{tournamentUuid}")
    public List<PairRequestDto> listForTournament(@PathParam("tournamentUuid") String tournamentIdOrSlug) {
        var t = access.load(tournamentIdOrSlug);
        return redactForAnonymous(mapper.toDtoList(repo.findByTournament_Id(t.getId())));
    }

    /**
     * Edit name/phone/note on a pair-finding request. Only the original poster
     * (or an admin) may edit; tournament cannot be changed — that's a delete +
     * create flow if the user wants to switch tournaments.
     */
    @PUT
    @Path("/{requestUuid}")
    @Authenticated
    @Transactional
    public Response update(
            @PathParam("requestUuid") UUID requestUuid,
            @Valid CreatePairRequestRequest body
    ) {
        var r = load(requestUuid);
        assertCanManage(r);

        r.setPlayerName(body.playerName().trim());
        r.setPhone(body.phone() == null || body.phone().isBlank() ? null : body.phone().trim());
        r.setNote(body.note() == null || body.note().isBlank() ? null : body.note().trim());
        r.setUpdatedAt(OffsetDateTime.now());
        return Response.ok(mapper.toDto(r)).build();
    }

    @POST
    @Path("/{requestUuid}/match")
    @Authenticated
    @Transactional
    public Response match(@PathParam("requestUuid") UUID requestUuid) {
        var r = load(requestUuid);
        assertCanManage(r);

        if (r.getStatus() != PairRequestStatus.MATCHED) {
            r.setStatus(PairRequestStatus.MATCHED);
            r.setUpdatedAt(OffsetDateTime.now());
        }
        return Response.ok(mapper.toDto(r)).build();
    }

    @DELETE
    @Path("/{requestUuid}")
    @Authenticated
    @Transactional
    public Response delete(@PathParam("requestUuid") UUID requestUuid) {
        var r = load(requestUuid);
        assertCanManage(r);
        repo.delete(r);
        return Response.noContent().build();
    }
}
