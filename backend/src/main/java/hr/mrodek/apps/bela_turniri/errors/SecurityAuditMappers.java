package hr.mrodek.apps.bela_turniri.errors;

import hr.mrodek.apps.bela_turniri.services.MessageService;
import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
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
 * Audit + envelope mappers for the security exceptions Quarkus raises itself.
 *
 * <p>{@link GenericExceptionMapper} audit-logs every 401/403 that reaches it,
 * but it never sees these: {@code @Authenticated} / {@code @RolesAllowed}
 * denials are thrown as {@code io.quarkus.security.UnauthorizedException} and
 * {@code io.quarkus.security.ForbiddenException}, which are plain
 * {@link RuntimeException}s (not {@code WebApplicationException}s) and are
 * handled by Quarkus' own built-in mappers before ours gets a chance. The
 * result was a blind spot exactly where it matters most — the framework-level
 * auth gate — so IDOR / credential-stuffing probing against annotated
 * endpoints left no trace at all.
 *
 * <p>Registering at {@link Priorities#USER} (5000) beats the built-in security
 * mappers, which sit at a higher (= weaker) priority value. Both mappers emit
 * the same {@code AUTHZ} WARN line as {@link GenericExceptionMapper} and
 * return the standard {@link ApiError} envelope so the SPA can render the
 * failure like any other error.
 *
 * <p>{@code AuthenticationFailedException} is deliberately NOT mapped here:
 * its built-in mapper drives the OIDC challenge (the {@code WWW-Authenticate}
 * header), and overriding it would break token-expiry handling.
 */
public final class SecurityAuditMappers {

    private static final Logger LOG = Logger.getLogger(SecurityAuditMappers.class);

    private SecurityAuditMappers() {
    }

    /** Shared audit line — identical in shape to the one in {@link GenericExceptionMapper}. */
    private static void audit(int status, UriInfo uriInfo, Request request, JsonWebToken jwt, Throwable ex) {
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
        LOG.warnf("AUTHZ %d %s %s subject=%s reason=%s",
                status, method, path, sub, ex.getMessage());
    }

    private static Response envelope(Response.Status status, String code, String message) {
        return Response.status(status)
                .type(MediaType.APPLICATION_JSON)
                .entity(ApiError.of(code, message))
                .build();
    }

    /** Anonymous caller hit an {@code @Authenticated} endpoint → 401. */
    @Provider
    @Priority(Priorities.USER)
    public static class UnauthorizedMapper
            implements ExceptionMapper<io.quarkus.security.UnauthorizedException> {

        @Context UriInfo uriInfo;
        @Context Request request;
        @Inject JsonWebToken jwt;
        @Inject MessageService messages;

        @Override
        public Response toResponse(io.quarkus.security.UnauthorizedException ex) {
            audit(401, uriInfo, request, jwt, ex);
            return envelope(Response.Status.UNAUTHORIZED, "UNAUTHORIZED", messages.t("error.unauthorized"));
        }
    }

    /** Signed-in caller lacked the required role → 403. */
    @Provider
    @Priority(Priorities.USER)
    public static class ForbiddenMapper
            implements ExceptionMapper<io.quarkus.security.ForbiddenException> {

        @Context UriInfo uriInfo;
        @Context Request request;
        @Inject JsonWebToken jwt;
        @Inject MessageService messages;

        @Override
        public Response toResponse(io.quarkus.security.ForbiddenException ex) {
            audit(403, uriInfo, request, jwt, ex);
            return envelope(Response.Status.FORBIDDEN, "FORBIDDEN", messages.t("error.forbidden"));
        }
    }
}
