package hr.mrodek.apps.bela_turniri.errors;

import hr.mrodek.apps.bela_turniri.services.MessageService;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;

/**
 * Domain guard-clauses throw IllegalStateException when the operation is
 * forbidden by current state (e.g. "next round already started, cannot buy
 * extra life"). Map to 409 Conflict — the request is syntactically valid
 * but the resource's state makes it inapplicable.
 *
 * <p>Logged at DEBUG only — see {@link IllegalArgumentExceptionMapper} for
 * the rationale. The frontend keys UI off these 409 bodies (e.g.
 * {@code UNPAID_REQUIRED}), so having the message in the log makes
 * "why did the button do nothing?" reports traceable.
 */
@Provider
public class IllegalStateExceptionMapper implements ExceptionMapper<IllegalStateException> {

    private static final Logger LOG = Logger.getLogger(IllegalStateExceptionMapper.class);

    @Inject MessageService messages;

    @Override
    public Response toResponse(IllegalStateException ex) {
        LOG.debugf("409 CONFLICT: %s", ex.getMessage());
        return Response.status(Response.Status.CONFLICT)
                .type(MediaType.APPLICATION_JSON)
                .entity(ApiError.of("CONFLICT",
                        ex.getMessage() != null ? ex.getMessage() : messages.t("error.conflict")))
                .build();
    }
}
