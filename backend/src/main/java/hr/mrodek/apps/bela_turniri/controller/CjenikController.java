package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.DrinkPriceDto;
import hr.mrodek.apps.bela_turniri.dtos.SaveDrinkPricesRequest;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.repository.TournamentsRepository;
import hr.mrodek.apps.bela_turniri.services.CjenikService;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.List;
import java.util.Objects;

/**
 * Per-tournament cjenik (drink price list).
 *
 *   GET    /tournaments/{uuid}/cjenik                       — public read
 *   PUT    /tournaments/{uuid}/cjenik                       — owner-only replace
 *   POST   /tournaments/{uuid}/cjenik/save-as-template      — owner-only
 *   POST   /tournaments/{uuid}/cjenik/import-template       — owner-only
 *
 * Reads are public so anyone viewing the tournament can see the prices
 * (matches the menu being printed on a board at the venue). Mutations
 * require the tournament creator (or an admin).
 *
 * The per-user reusable template lives in {@link UserDrinkTemplateController}.
 */
@Path("/tournaments/{uuid}/cjenik")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class CjenikController {

    @Inject CjenikService cjenikService;
    @Inject TournamentsRepository tournamentsRepo;
    @Inject SecurityIdentity identity;
    @Inject JsonWebToken jwt;

    @GET
    public List<DrinkPriceDto> getTournamentCjenik(@PathParam("uuid") String uuid) {
        var t = tournamentsRepo.findByUuidOrSlug(uuid).orElse(null);
        if (t == null) throw new NotFoundException("Tournament not found");
        return cjenikService.listForTournament(t.getId());
    }

    @PUT
    @Authenticated
    @Transactional
    public List<DrinkPriceDto> putTournamentCjenik(
            @PathParam("uuid") String uuid,
            SaveDrinkPricesRequest body
    ) {
        Tournaments t = mustOwn(uuid);
        return cjenikService.replaceTournamentCjenik(
                t,
                body == null || body.items() == null ? List.of() : body.items()
        );
    }

    @POST
    @Path("/save-as-template")
    @Authenticated
    @Transactional
    public List<DrinkPriceDto> saveAsTemplate(@PathParam("uuid") String uuid) {
        Tournaments t = mustOwn(uuid);
        return cjenikService.saveTournamentAsTemplate(t, jwt.getSubject());
    }

    @POST
    @Path("/import-template")
    @Authenticated
    @Transactional
    public List<DrinkPriceDto> importTemplate(@PathParam("uuid") String uuid) {
        Tournaments t = mustOwn(uuid);
        return cjenikService.importTemplateIntoTournament(t, jwt.getSubject());
    }

    /**
     * Resolve a tournament by uuid OR slug and 403 unless the current user
     * is its creator (or an admin). Same convention as TournamentController.
     */
    private Tournaments mustOwn(String uuidOrSlug) {
        var t = tournamentsRepo.findByUuidOrSlug(uuidOrSlug).orElse(null);
        if (t == null) throw new NotFoundException("Tournament not found");
        boolean admin = identity != null && identity.hasRole("admin");
        if (admin) return t;
        String me = jwt != null ? jwt.getSubject() : null;
        if (me == null || !Objects.equals(me, t.getCreatedByUid())) {
            throw new ForbiddenException("Only the tournament creator can edit cjenik.");
        }
        return t;
    }
}
