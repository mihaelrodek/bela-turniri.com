package hr.mrodek.apps.bela_turniri.errors;

import hr.mrodek.apps.bela_turniri.services.MessageService;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
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
 * Fallback mapper for anything not caught by a more-specific
 * {@link ExceptionMapper}. Returns a generic 500 without leaking the stack
 * trace to the client; the full exception is logged server-side.
 *
 * <p>{@link WebApplicationException}s are passed through unchanged so
 * framework-raised errors (415 from wrong content-type, 405 from a wrong
 * verb, etc.) keep their original response — but the security-relevant
 * statuses (401 / 403) are also <em>audit-logged</em> at WARN with the
 * caller's JWT subject and the request path. Without this, credential
 * stuffing or IDOR probing against the ownership checks that every
 * controller does by hand would leave zero trace in our logs.
 *
 * <p>Note that 400 and 404 no longer reach the pass-through branch:
 * {@link BadRequestExceptionMapper} and {@link WebNotFoundExceptionMapper}
 * are more specific and re-wrap them into the {@link ApiError} envelope.
 */
@Provider
public class GenericExceptionMapper implements ExceptionMapper<RuntimeException> {

    private static final Logger LOG = Logger.getLogger(GenericExceptionMapper.class);

    @Context UriInfo uriInfo;
    @Context Request request;

    // Injected rather than read from SecurityIdentity because auth is lazy
    // (quarkus.http.auth.proactive=false): on an endpoint without
    // @Authenticated the identity stays anonymous even when a valid bearer
    // token was sent, but the JWT itself is still resolvable.
    @Inject JsonWebToken jwt;

    @Inject MessageService messages;

    @Override
    public Response toResponse(RuntimeException ex) {
        if (ex instanceof WebApplicationException wae) {
            int status = wae.getResponse().getStatus();
            // WARN (not DEBUG) so these stay visible at the prod INFO level.
            // The message carries no secret material — only the path, the
            // Firebase UID and the guard-clause text; tokens are never logged.
            if (status == 401 || status == 403) {
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
            return wae.getResponse();
        }
        LOG.error("Unhandled exception reaching REST boundary", ex);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .type(MediaType.APPLICATION_JSON)
                .entity(ApiError.of("INTERNAL_ERROR", messages.t("error.internal")))
                .build();
    }
}
