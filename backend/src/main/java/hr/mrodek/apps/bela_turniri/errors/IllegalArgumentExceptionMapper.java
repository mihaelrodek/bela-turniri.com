package hr.mrodek.apps.bela_turniri.errors;

import hr.mrodek.apps.bela_turniri.services.MessageService;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;

/**
 * Thrown by service code when caller data is structurally valid but
 * semantically wrong (e.g. "round does not belong to tournament").
 * Map to 400 Bad Request.
 *
 * <p>Logged at DEBUG only — a 400 means the caller sent something wrong, not
 * that the server is broken, so it must not pollute the prod INFO stream.
 * With {@code %dev.quarkus.log.min-level=DEBUG} the line is visible while
 * developing, and in prod it can be switched on per-category when a user
 * reports an unexplained rejection.
 */
@Provider
public class IllegalArgumentExceptionMapper implements ExceptionMapper<IllegalArgumentException> {

    private static final Logger LOG = Logger.getLogger(IllegalArgumentExceptionMapper.class);

    @Inject MessageService messages;

    @Override
    public Response toResponse(IllegalArgumentException ex) {
        // Message only, no stack trace: the interesting part is always the
        // guard-clause text, and stack traces for expected rejections are noise.
        LOG.debugf("400 BAD_REQUEST: %s", ex.getMessage());
        return Response.status(Response.Status.BAD_REQUEST)
                .type(MediaType.APPLICATION_JSON)
                .entity(ApiError.of("BAD_REQUEST",
                        ex.getMessage() != null ? ex.getMessage() : messages.t("error.badRequest")))
                .build();
    }
}
