package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.GameResultReportRequest;
import hr.mrodek.apps.bela_turniri.services.GameStatsService;
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


/**
 * Server-to-server intake for finished online games (game/README.md §8.4).
 *
 * <p><b>Not a user endpoint.</b> Full public path:
 * {@code POST /api/internal/game-results} (the {@code /internal} prefix plus
 * {@code quarkus.http.root-path=/api}). Caddy must 404 this path from the
 * outside exactly like {@code /api/q/*}; real traffic arrives on the internal
 * docker network and the shared secret is a second layer, not the only one.
 *
 * <h2>Why not {@code @Authenticated}</h2>
 * The caller is the Node game server, which has no Firebase user and no ID
 * token to present. Auth is lazy in this app, so leaving the annotation off
 * means OIDC is never invoked here; the {@code X-Internal-Token} check below
 * is the entire gate. It runs before anything is read from the body.
 *
 * <p>The token check itself lives in {@link InternalTokenGuard}, shared with
 * the other {@code /api/internal/*} endpoint.
 *
 * <h2>Idempotency</h2>
 * The reporter cannot tell "the POST never arrived" from "the response never
 * came back", so it retries with the SAME {@code resultId}. The unique index
 * on {@code game_results.uuid} makes the insert itself the gate (see
 * {@code GameResultRepository.insertIfAbsent}) and a replay answers
 * {@code {"recorded": false}} — a 200, not a 409: for the reporter both mean
 * "this game is safely recorded, stop retrying", and an error status would
 * only produce noise in its logs.
 */
@Path("/internal/game-results")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class GameResultsInternalController {

    @Inject GameStatsService gameStats;
    @Inject InternalTokenGuard guard;
    @Inject Validator validator;

    /** {@code {"recorded": true}} on a fresh insert, {@code false} on a replay. */
    public record RecordedResponse(boolean recorded) {}

    /**
     * Note the body is NOT annotated {@code @Valid}: JAX-RS cascades that
     * before the method body runs, so an unauthenticated caller would get a
     * per-field 400 describing the DTO instead of a flat 401. The token is
     * checked first and the identical validation is then run by hand, raising
     * the same {@link ConstraintViolationException} the automatic path would,
     * so {@code ConstraintViolationExceptionMapper} produces one identical
     * 400 envelope either way (same reasoning as the multipart branch of
     * {@code TournamentController.create}).
     */
    @POST
    @Transactional
    public RecordedResponse report(@HeaderParam(InternalTokenGuard.TOKEN_HEADER) String token,
                                   GameResultReportRequest body) {
        guard.require(token);
        if (body == null) throw new BadRequestException("body is required");
        var violations = validator.validate(body);
        if (!violations.isEmpty()) throw new ConstraintViolationException(violations);
        return new RecordedResponse(gameStats.record(body));
    }

}
