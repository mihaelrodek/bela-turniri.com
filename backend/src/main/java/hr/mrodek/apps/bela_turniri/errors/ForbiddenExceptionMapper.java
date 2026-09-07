package hr.mrodek.apps.bela_turniri.errors;

import hr.mrodek.apps.bela_turniri.services.MessageService;
import jakarta.inject.Inject;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Request;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.logging.Logger;

/**
 * Surfaces the message of a JAX-RS {@link ForbiddenException} to the client.
 *
 * <p>{@code new ForbiddenException("…")} builds a 403 with an EMPTY body, so
 * every ownership denial thrown from {@code TournamentAccess.assertCanEdit}
 * and the controllers reached the SPA without the {@link ApiError} envelope
 * and rendered as a generic failure. This mapper is more specific than
 * {@link GenericExceptionMapper}, which would otherwise pass the bodyless
 * response straight through, so the toast finally shows the real reason.
 *
 * <p>Because this mapper now wins over the generic one, the {@code AUTHZ}
 * audit line it used to emit for 403s is reproduced here in the same shape.
 * Framework-level denials ({@code io.quarkus.security.ForbiddenException})
 * are handled separately in {@link SecurityAuditMappers}.
 */
@Provider
public class ForbiddenExceptionMapper implements ExceptionMapper<ForbiddenException> {

    private static final Logger LOG = Logger.getLogger(ForbiddenExceptionMapper.class);

    /** Message JAX-RS auto-generates when the exception was built without one. */
    private static final String DEFAULT_JAXRS_MESSAGE = "HTTP 403 Forbidden";

    @Context UriInfo uriInfo;
    @Context Request request;
    @Inject JsonWebToken jwt;
    @Inject MessageService messages;

    @Override
    public Response toResponse(ForbiddenException ex) {
        String msg = ex.getMessage();
        if (msg == null || msg.isBlank() || DEFAULT_JAXRS_MESSAGE.equals(msg)) {
            msg = messages.t("error.forbidden");
        }
        String method = "?";
        String path = "?";
        try {
            if (request != null) method = request.getMethod();
            if (uriInfo != null) path = uriInfo.getPath();
        } catch (RuntimeException ignored) {
            // Both are request-scoped; outside a request they throw.
        }
        String sub = "anon";
        try {
            if (jwt != null && jwt.getSubject() != null) sub = jwt.getSubject();
        } catch (RuntimeException ignored) {
            // No request context / no token — stay anonymous.
        }
        LOG.warnf("AUTHZ 403 %s %s subject=%s reason=%s", method, path, sub, msg);
        return Response.status(Response.Status.FORBIDDEN)
                .type(MediaType.APPLICATION_JSON)
                .entity(ApiError.of("FORBIDDEN", msg))
                .build();
    }
}
