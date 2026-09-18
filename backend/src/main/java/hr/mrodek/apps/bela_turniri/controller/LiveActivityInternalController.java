package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.LiveActivityRequest;
import hr.mrodek.apps.bela_turniri.services.InternalTokenGuard;
import hr.mrodek.apps.bela_turniri.services.LiveActivitySender;
import jakarta.inject.Inject;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/**
 * Server-to-server relay for Live Activities (iOS) and Live Updates (Android),
 * game/README.md §3 "Live Activity".
 *
 * <p><b>Not a user endpoint.</b> Full public path
 * {@code POST /api/internal/live-activity}; Caddy 404s {@code /api/internal/*}
 * from outside, and {@link InternalTokenGuard} is the second layer — exactly
 * as for {@link GameResultsInternalController}.
 *
 * <h2>Why 202 and why nothing waits</h2>
 * The caller is the game server, mid-game, sending up to one event per player
 * per second. The FCM round-trips run on {@link LiveActivitySender}'s own pool
 * after this method has returned, so a slow or unconfigured FCM can never
 * stall a move. 202 means "taken", not "delivered" — delivery is best-effort
 * and there is nothing the game server could do with a failure anyway.
 *
 * <p>The body is validated by hand AFTER the token, not with {@code @Valid},
 * for the reason spelled out on {@link GameResultsInternalController#report}:
 * an unauthenticated caller must get a flat 401, never a per-field 400
 * describing the DTO. The resulting 400 envelope is identical.
 */
@Path("/internal/live-activity")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class LiveActivityInternalController {

    @Inject InternalTokenGuard guard;
    @Inject Validator validator;
    @Inject LiveActivitySender sender;

    @POST
    public Response relay(@HeaderParam(InternalTokenGuard.TOKEN_HEADER) String token,
                          LiveActivityRequest body) {
        guard.require(token);
        if (body == null) throw new BadRequestException("body is required");
        var violations = validator.validate(body);
        if (!violations.isEmpty()) throw new ConstraintViolationException(violations);
        sender.dispatch(body);
        return Response.accepted().build();
    }
}
