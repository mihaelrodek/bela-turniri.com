package hr.mrodek.apps.bela_turniri.errors;

import hr.mrodek.apps.bela_turniri.services.MessageService;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;

import java.util.NoSuchElementException;

/**
 * Turns NoSuchElementException into a clean 404.
 *
 * <p>The JAX-RS {@link jakarta.ws.rs.NotFoundException} that controllers
 * throw directly is handled by {@link WebNotFoundExceptionMapper} instead —
 * one mapper per exception type is a JAX-RS constraint.
 */
@Provider
public class NotFoundExceptionMapper implements ExceptionMapper<NoSuchElementException> {

    private static final Logger LOG = Logger.getLogger(NotFoundExceptionMapper.class);

    @Inject MessageService messages;

    @Override
    public Response toResponse(NoSuchElementException ex) {
        // Localised fallback: the frontend renders ApiError.message verbatim
        // in a toast, so an English default would leak into the UI — and a
        // Croatian one would leak into a Slovenian client's UI.
        String msg = (ex.getMessage() != null && !ex.getMessage().isBlank())
                ? ex.getMessage() : messages.t("error.notFound");
        LOG.debugf("404 NOT_FOUND: %s", msg);
        return Response.status(Response.Status.NOT_FOUND)
                .type(MediaType.APPLICATION_JSON)
                .entity(ApiError.of("NOT_FOUND", msg))
                .build();
    }
}
