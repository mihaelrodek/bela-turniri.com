package hr.mrodek.apps.bela_turniri.errors;

import hr.mrodek.apps.bela_turniri.services.MessageService;
import jakarta.inject.Inject;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;

import java.util.Set;

/**
 * Same job as {@link NotFoundExceptionMapper} (which handles
 * {@link java.util.NoSuchElementException}) but for the JAX-RS
 * {@link NotFoundException} that most controllers throw directly —
 * {@code throw new NotFoundException("Tournament not found")}.
 *
 * <p>Why it is needed: {@code NotFoundException} is a
 * {@link jakarta.ws.rs.WebApplicationException}, so without this mapper it
 * fell through {@link GenericExceptionMapper}'s pass-through branch and the
 * client got a 404 with an EMPTY body — no {@code ApiError} envelope at all,
 * and the message ("Tournament not found") was dropped on the floor. The SPA
 * expects the envelope on every error status.
 *
 * <p>This also catches the framework's own "no resource matched this path"
 * 404, which arrives with the auto-generated message {@code "HTTP 404 Not
 * Found"}; that one is replaced by the localised fallback so nothing
 * English-language ever reaches a user-facing toast.
 */
@Provider
public class WebNotFoundExceptionMapper implements ExceptionMapper<NotFoundException> {

    private static final Logger LOG = Logger.getLogger(WebNotFoundExceptionMapper.class);

    /**
     * Messages the framework generates itself when nothing in our code chose
     * one: the JAX-RS default, and RESTEasy Reactive's own text for "no
     * resource matched this path". Both are English and would otherwise be
     * rendered verbatim in a user-facing toast, so they are swapped for the
     * localised fallback.
     */
    private static final Set<String> FRAMEWORK_MESSAGES = Set.of(
            "HTTP 404 Not Found",
            "Unable to find matching target resource method");

    @Inject MessageService messages;

    @Override
    public Response toResponse(NotFoundException ex) {
        String msg = ex.getMessage();
        if (msg == null || msg.isBlank() || FRAMEWORK_MESSAGES.contains(msg)) {
            msg = messages.t("error.notFound");
        }
        LOG.debugf("404 NOT_FOUND: %s", msg);
        return Response.status(Response.Status.NOT_FOUND)
                .type(MediaType.APPLICATION_JSON)
                .entity(ApiError.of("NOT_FOUND", msg))
                .build();
    }
}
