package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.GameReliabilityEventRequest;
import hr.mrodek.apps.bela_turniri.services.GameReliabilityService;
import hr.mrodek.apps.bela_turniri.services.InternalTokenGuard;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

/** Internal, idempotent intake for confirmed online-game abandonments. */
@Path("/internal/game-reliability-events")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class GameReliabilityInternalController {
    @Inject GameReliabilityService reliability;
    @Inject InternalTokenGuard guard;
    @Inject Validator validator;

    public record RecordedResponse(boolean recorded) {}

    @POST
    @Transactional
    public RecordedResponse report(@HeaderParam(InternalTokenGuard.TOKEN_HEADER) String token,
                                   GameReliabilityEventRequest body) {
        guard.require(token);
        if (body == null) throw new BadRequestException("body is required");
        var violations = validator.validate(body);
        if (!violations.isEmpty()) throw new ConstraintViolationException(violations);
        return new RecordedResponse(reliability.recordAbandonment(body));
    }
}
