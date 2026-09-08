package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.errors.ApiError;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.NotAuthorizedException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * The shared-secret gate in front of every {@code /api/internal/*} endpoint.
 *
 * <p>Callers are servers, not people: the Node game server reporting a
 * finished game ({@code /internal/game-results}) or asking who a player is
 * ({@code /internal/profiles/{uid}}). They hold no Firebase token, so OIDC is
 * never involved — this header check is the entire application-level gate.
 * Caddy also 404s {@code /api/internal/*} from the public internet, and the
 * real traffic never leaves the docker network; the secret is the second
 * layer, not the only one.
 *
 * <p>Extracted from {@code GameResultsInternalController} when the second
 * internal endpoint arrived: two copies of a constant-time comparison is
 * exactly the kind of thing that drifts, and only one of the copies would get
 * the fix.
 *
 * <p>The comparison is {@link MessageDigest#isEqual} on UTF-8 bytes rather
 * than {@link String#equals}: {@code equals} returns on the first differing
 * character, so its timing leaks the length of the matching prefix and a
 * caller who can retry cheaply can walk the secret out one byte at a time.
 *
 * <p>A blank configured secret means "refuse everything", never "accept
 * everything": a misconfigured prod deployment must lose game statistics and
 * fall back to token-claim names, not start answering unauthenticated callers.
 */
@ApplicationScoped
public class InternalTokenGuard {

    private static final Logger LOG = Logger.getLogger(InternalTokenGuard.class);

    /** Header every internal caller presents. */
    public static final String TOKEN_HEADER = "X-Internal-Token";

    /**
     * Shared secret, {@code GAME_RESULTS_TOKEN} (the name predates the second
     * endpoint; it is the one internal secret, not a per-endpoint one). No
     * {@code defaultValue} on purpose: prod must supply it or everything here
     * refuses. The dev/test fallback lives in {@code application.properties}
     * under the {@code %dev,test} prefix.
     */
    @ConfigProperty(name = "game.results.token")
    String expectedToken;

    /** Throws 401 unless {@code presented} matches the configured secret. */
    public void require(String presented) {
        if (expectedToken == null || expectedToken.isBlank()) {
            LOG.error("game.results.token is unset — refusing every /api/internal/* call. "
                    + "Set GAME_RESULTS_TOKEN on the backend and the game server.");
            throw unauthorized();
        }
        if (presented == null || presented.isEmpty()) {
            throw unauthorized();
        }
        boolean ok = MessageDigest.isEqual(
                presented.getBytes(StandardCharsets.UTF_8),
                expectedToken.getBytes(StandardCharsets.UTF_8));
        if (!ok) throw unauthorized();
    }

    /**
     * {@link NotAuthorizedException} with an explicit response, the same shape
     * {@code CurrentUser.requireUid()} builds: the single-String constructor
     * would treat its argument as a {@code WWW-Authenticate} challenge and
     * send an empty body. {@code GenericExceptionMapper} passes the response
     * through untouched and audit-logs the 401.
     *
     * <p>Deliberately English and deliberately vague: the only reader is the
     * game server's log, and saying which half was wrong helps nobody but
     * someone guessing the token.
     */
    private static NotAuthorizedException unauthorized() {
        return new NotAuthorizedException(
                Response.status(Response.Status.UNAUTHORIZED)
                        .type(MediaType.APPLICATION_JSON)
                        .entity(ApiError.of("UNAUTHORIZED", "Invalid or missing internal token."))
                        .build());
    }
}
