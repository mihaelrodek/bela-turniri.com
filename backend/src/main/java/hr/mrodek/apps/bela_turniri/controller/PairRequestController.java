package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.CreatePairRequestRequest;
import hr.mrodek.apps.bela_turniri.dtos.PairRequestDto;
import hr.mrodek.apps.bela_turniri.enums.PairRequestStatus;
import hr.mrodek.apps.bela_turniri.mappers.PairRequestMapper;
import hr.mrodek.apps.bela_turniri.model.PairRequest;
import hr.mrodek.apps.bela_turniri.repository.PairRequestRepository;
import hr.mrodek.apps.bela_turniri.repository.TournamentsRepository;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

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
    @Inject TournamentsRepository tournamentsRepo;
    @Inject PairRequestMapper mapper;
    @Inject SecurityIdentity identity;
    @Inject JsonWebToken jwt;

    /** Throws 403 if the current user neither posted the request nor is an admin. */
    private void assertCanManage(PairRequest r) {
        boolean admin = identity != null && identity.hasRole("admin");
        if (admin) return;
        String me = jwt != null ? jwt.getSubject() : null;
        if (me == null || !me.equals(r.getCreatedByUid())) {
            throw new ForbiddenException("Only the poster or an admin can modify this request.");
        }
    }

    @POST
    @Path("/by-tournament/{tournamentUuid}")
    @Authenticated
    @Transactional
    public Response create(
            @PathParam("tournamentUuid") UUID tournamentUuid,
            @Valid CreatePairRequestRequest body
    ) {
        var t = tournamentsRepo.findByUuid(tournamentUuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();

        var r = new PairRequest();
        r.setTournament(t);
        r.setPlayerName(body.playerName().trim());
        r.setPhone(body.phone() == null || body.phone().isBlank() ? null : body.phone().trim());
        r.setNote(body.note() == null || body.note().isBlank() ? null : body.note().trim());
        r.setStatus(PairRequestStatus.OPEN);
        r.setCreatedByUid(jwt.getSubject());

        repo.save(r);
        return Response.status(Response.Status.CREATED).entity(mapper.toDto(r)).build();
    }

    @GET
    public List<PairRequestDto> list(@QueryParam("status") String status) {
        if (status == null || status.isBlank()) {
            return mapper.toDtoList(repo.findAllOrderByCreatedDesc());
        }
        try {
            PairRequestStatus s = PairRequestStatus.valueOf(status.toUpperCase());
            return mapper.toDtoList(repo.findByStatus(s));
        } catch (IllegalArgumentException ex) {
            return List.of();
        }
    }

    @GET
    @Path("/by-tournament/{tournamentUuid}")
    public Response listForTournament(@PathParam("tournamentUuid") UUID tournamentUuid) {
        var t = tournamentsRepo.findByUuid(tournamentUuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        return Response.ok(mapper.toDtoList(repo.findByTournament_Id(t.getId()))).build();
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
        var r = repo.findByUuid(requestUuid).orElse(null);
        if (r == null) return Response.status(Response.Status.NOT_FOUND).build();
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
        var r = repo.findByUuid(requestUuid).orElse(null);
        if (r == null) return Response.status(Response.Status.NOT_FOUND).build();
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
        var r = repo.findByUuid(requestUuid).orElse(null);
        if (r == null) return Response.status(Response.Status.NOT_FOUND).build();
        assertCanManage(r);
        repo.delete(r);
        return Response.noContent().build();
    }
}
