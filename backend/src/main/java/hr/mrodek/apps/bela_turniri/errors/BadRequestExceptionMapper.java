package hr.mrodek.apps.bela_turniri.errors;

import hr.mrodek.apps.bela_turniri.services.MessageService;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;

/**
 * Surfaces the message of a {@link BadRequestException} to the client.
 *
 * <p>Plain {@code new BadRequestException("…")} builds a 400 with an EMPTY
 * body — the message lives only on the Java exception and never reaches the
 * HTTP response, so the SPA could only show a generic "bad request" fallback.
 * Several controllers already throw it that way (e.g. {@code CjenikController}
 * on a missing template name). This mapper is more specific than
 * {@link GenericExceptionMapper}, which would otherwise pass the bodyless
 * response straight through, so the axios error toast finally shows the real
 * reason.
 *
 * <p>The fallback text is localised, not hardcoded: the frontend renders
 * {@code ApiError.message} verbatim in a toast, so it must come back in the
 * language the caller asked for ({@code X-Locale}). See {@link MessageService}.
 */
@Provider
public class BadRequestExceptionMapper implements ExceptionMapper<BadRequestException> {

    private static final Logger LOG = Logger.getLogger(BadRequestExceptionMapper.class);

    /** Message JAX-RS auto-generates when the exception was built without one. */
    private static final String DEFAULT_JAXRS_MESSAGE = "HTTP 400 Bad Request";

    @Inject MessageService messages;

    @Override
    public Response toResponse(BadRequestException ex) {
        String msg = ex.getMessage();
        if (msg == null || msg.isBlank() || DEFAULT_JAXRS_MESSAGE.equals(msg)) {
            msg = messages.t("error.badRequest");
        }
        // DEBUG, not WARN: a 400 is a caller problem, not a server problem.
        // Still worth a line so a "why is the SPA showing this toast?" bug
        // report can be traced in the logs via the request id.
        LOG.debugf("400 BAD_REQUEST: %s", msg);
        return Response.status(Response.Status.BAD_REQUEST)
                .type(MediaType.APPLICATION_JSON)
                .entity(ApiError.of("BAD_REQUEST", msg))
                .build();
    }
}
