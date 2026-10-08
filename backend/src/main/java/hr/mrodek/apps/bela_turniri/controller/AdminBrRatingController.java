package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.BrDtos;
import hr.mrodek.apps.bela_turniri.repository.BrRatingRepository;
import hr.mrodek.apps.bela_turniri.services.BrRatingService;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.time.OffsetDateTime;
import java.util.List;

/** Unreleased: inspection only for administrators, no public API or frontend integration. */
@Path("/admin/br")
@RolesAllowed("admin")
@Produces(MediaType.APPLICATION_JSON)
public class AdminBrRatingController {
    @Inject BrRatingService service;
    @Inject BrRatingRepository repo;

    @GET @Path("/status") public BrDtos.Status status() { return service.status(); }
    @GET @Path("/players/{uid}") public BrDtos.Rating player(@PathParam("uid") String uid) {
        var rating = repo.rating(uid, OffsetDateTime.now());
        if (rating == null) throw new NotFoundException("No BR games for this account");
        return rating;
    }
    @GET @Path("/players/{uid}/history") public List<BrDtos.Change> history(@PathParam("uid") String uid,
            @QueryParam("offset") @DefaultValue("0") int offset, @QueryParam("limit") @DefaultValue("50") int limit) {
        page(offset, limit);
        return repo.history(uid, offset, limit);
    }
    @GET @Path("/standings") public BrDtos.Ranking standings(
            @QueryParam("offset") @DefaultValue("0") int offset, @QueryParam("limit") @DefaultValue("50") int limit) {
        page(offset, limit);
        return repo.ranking(offset, limit, OffsetDateTime.now());
    }
    @GET @Path("/seasons") public List<BrDtos.Season> seasons() { return repo.seasons(OffsetDateTime.now(), 100); }
    @GET @Path("/seasons/{season}/standings") public BrDtos.SeasonRanking season(@PathParam("season") String season,
            @QueryParam("offset") @DefaultValue("0") int offset, @QueryParam("limit") @DefaultValue("50") int limit) {
        page(offset, limit);
        if (!season.matches("[0-9]{4}-Q[1-4]")) throw new BadRequestException("Invalid season");
        return repo.standings(season, offset, limit, OffsetDateTime.now());
    }
    @GET @Path("/hall-of-fame") public List<BrDtos.Award> awards(
            @QueryParam("offset") @DefaultValue("0") int offset, @QueryParam("limit") @DefaultValue("50") int limit) {
        page(offset, limit);
        return repo.awards(offset, limit);
    }
    private static void page(int offset, int limit) {
        if (offset < 0 || offset > 100_000 || limit < 1 || limit > 100) throw new BadRequestException("Invalid pagination");
    }
}
