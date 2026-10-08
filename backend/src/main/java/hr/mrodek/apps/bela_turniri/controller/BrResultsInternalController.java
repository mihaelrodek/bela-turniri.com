package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.BrResultReportRequest;
import hr.mrodek.apps.bela_turniri.services.BrRatingService;
import hr.mrodek.apps.bela_turniri.services.InternalTokenGuard;
import jakarta.inject.Inject;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

/** Same network/shared-secret boundary as game-results. No browser can award itself BR. */
@Path("/internal/br-results")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class BrResultsInternalController {
    @Inject InternalTokenGuard guard;
    @Inject Validator validator;
    @Inject BrRatingService ratings;
    public record Recorded(boolean recorded) {}

    @POST
    public Recorded report(@HeaderParam(InternalTokenGuard.TOKEN_HEADER) String token, BrResultReportRequest body) {
        guard.require(token);
        if (body == null) throw new BadRequestException("body is required");
        var violations = validator.validate(body);
        if (!violations.isEmpty()) throw new ConstraintViolationException(violations);
        return new Recorded(ratings.record(body));
    }
}
