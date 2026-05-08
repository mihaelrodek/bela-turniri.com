package hr.mrodek.apps.bela_turniri.errors;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;

/**
 * Fallback mapper for anything not caught by a more-specific
 * {@link ExceptionMapper}. Returns a generic 500 without leaking the stack
 * trace to the client; the full exception is logged server-side.
 *
 * {@link WebApplicationException}s are passed through unchanged so
 * framework-raised errors (404 from unknown routes, 415 from wrong
 * content-type, etc.) keep their original response.
 */
@Provider
public class GenericExceptionMapper implements ExceptionMapper<RuntimeException> {

    private static final Logger LOG = Logger.getLogger(GenericExceptionMapper.class);

    @Override
    public Response toResponse(RuntimeException ex) {
        if (ex instanceof WebApplicationException wae) {
            return wae.getResponse();
        }
        LOG.error("Unhandled exception reaching REST boundary", ex);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .type(MediaType.APPLICATION_JSON)
                .entity(ApiError.of("INTERNAL_ERROR", "An unexpected error occurred"))
                .build();
    }
}
