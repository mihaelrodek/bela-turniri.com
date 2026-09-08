package hr.mrodek.apps.bela_turniri.realtime;

import io.quarkus.websockets.next.HttpUpgradeCheck;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import io.vertx.core.Context;
import io.vertx.core.Vertx;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.util.concurrent.Executor;

/**
 * Admission control for {@link BlokShareSocket}: decides whether an HTTP
 * upgrade to {@code /api/live/blok/{token}} is allowed to become a websocket.
 *
 * <p>Modelled on {@link LiveUpgradeCheck}, and it exists for the same three
 * reasons that one does — junk keys must not park a connection forever, there
 * must be a concurrency ceiling (websockets-next 3.15 has no
 * {@code max-concurrent-connections} of its own; see {@link LiveConnections}),
 * and fan-out must stay indexed rather than server-wide.
 *
 * <h2>Refuse, do not accept-and-go-silent</h2>
 * A token that names nothing — invented, mistyped, or <b>revoked while the
 * link was in someone's chat history</b> — is refused with <b>404 before the
 * handshake completes</b>. Doing it in {@code @OnOpen} would be too late: that
 * callback runs after the upgrade has already succeeded, so the best it could
 * do is answer 101 and immediately close, which allocates the connection, tells
 * the client the upgrade worked, and invites a retry loop to do it again.
 * {@link HttpUpgradeCheck} declines with a real HTTP status the client can act
 * on — and 404 is the same answer {@code GET /blok-share/{token}} gives, so a
 * revoked link is consistently "gone" on both channels and nothing here ever
 * confirms that a record exists.
 *
 * <h2>Two checks, cheapest first</h2>
 * <ol>
 *   <li><b>Shape.</b> A share token is {@code ClaimTokens.generate()} output:
 *       24 {@code SecureRandom} bytes, base64-url without padding, so 32
 *       characters drawn from {@code [A-Za-z0-9_-]}. Anything else cannot
 *       match a stored token, so it is rejected without touching the database
 *       — which is what keeps a scan of the path from costing a query per
 *       attempt. The bound is the column width (48) rather than the exact 32
 *       so a future longer token does not silently stop connecting.
 *       Percent-encoded input is rejected by the same rule; no correct client
 *       produces it, because every character in the alphabet above is left
 *       untouched by {@code encodeURIComponent}, and refusing it is what keeps
 *       the string this check validates byte-identical to the one
 *       {@code connection.pathParam("token")} later registers under.</li>
 *   <li><b>Existence.</b> The token must currently name a shared series —
 *       {@link BlokShareResolver}, on the worker pool.</li>
 * </ol>
 *
 * <h2>Caps</h2>
 * Separate from the tournament socket's, because the audiences are different
 * sizes: a tournament is watched by a venue, a shared scorepad by the four
 * people at one table and whoever they sent the link to.
 *
 * <h2>Threading</h2>
 * {@code perform} is invoked on the Vert.x event loop, so the (blocking)
 * database lookup is pushed onto the worker pool and the result is emitted
 * back on the original Vert.x context — websockets-next completes the upgrade
 * in this subscriber, and that must happen on the connection's own context.
 * The cheap checks (token shape, connection counts) run inline and
 * short-circuit before any of that machinery is set up.
 */
@ApplicationScoped
public class BlokShareUpgradeCheck implements HttpUpgradeCheck {

    private static final Logger LOG = Logger.getLogger(BlokShareUpgradeCheck.class);

    /**
     * Upper bound on the token in the path: the width of
     * {@code blok_sessions.share_token}. A longer segment cannot be a stored
     * token, so it is refused before the query.
     */
    static final int MAX_TOKEN_LENGTH = 48;

    @Inject BlokShareConnections connections;
    @Inject BlokShareResolver resolver;

    /**
     * Server-wide ceiling on simultaneous blok-share sockets. Sized well above
     * any plausible real audience and well below what the event loop and
     * file-descriptor budget can carry, so it sheds an abusive client long
     * before the box notices.
     */
    @ConfigProperty(name = "blok-live.max-connections", defaultValue = "1000")
    int maxConnections;

    /**
     * Per-scorepad ceiling. Without it a single host could fill the global
     * budget through one valid token — and a share link is precisely the kind
     * of thing that gets forwarded — starving every other scorepad's viewers.
     */
    @ConfigProperty(name = "blok-live.max-connections-per-session", defaultValue = "50")
    int maxConnectionsPerSession;

    @Override
    public boolean appliesTo(String endpointId) {
        return BlokShareSocket.ENDPOINT_ID.equals(endpointId);
    }

    @Override
    public Uni<CheckResult> perform(HttpUpgradeContext context) {
        String token = tokenOf(context.httpRequest() == null ? null : context.httpRequest().path());
        if (token == null) {
            // Deliberately not logged at anything above debug and deliberately
            // without the offending value: the path segment on this route is a
            // secret, and a rejected one is often a real token that was
            // mistyped by one character.
            LOG.debug("Blok live: refusing handshake, path segment is not a share-token shape");
            return CheckResult.rejectUpgrade(404);
        }

        if (connections.total() >= maxConnections) {
            LOG.warnf("Blok live: refusing handshake, server cap of %d blok sockets reached",
                    maxConnections);
            return CheckResult.rejectUpgrade(503);
        }
        if (connections.countFor(token) >= maxConnectionsPerSession) {
            LOG.warnf("Blok live: refusing handshake, per-scorepad cap of %d reached",
                    maxConnectionsPerSession);
            return CheckResult.rejectUpgrade(503);
        }

        // The counts above are read a moment before the socket registers
        // itself in BlokShareSocket#onOpen, so genuinely simultaneous
        // handshakes on different event loops can overshoot a cap by the number
        // in flight. That is deliberate — this is admission control, not a
        // semaphore, and serialising the upgrade would cost far more than an
        // overshoot of a few sockets. Keeping @OnOpen @NonBlocking shrinks the
        // window to the upgrade itself.

        Executor backOnVertxContext = vertxContextExecutor();
        return Uni.createFrom().item(() -> resolver.isShared(token))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool())
                .emitOn(backOnVertxContext)
                .map(shared -> {
                    if (shared) return CheckResult.permitUpgradeSync();
                    // Same status GET /blok-share/{token} gives, so a revoked
                    // link is "gone" identically on both channels. Nothing is
                    // leaked: the caller already had to supply the token to
                    // ask, and the answer is the same for a token that never
                    // existed and one that was revoked a second ago.
                    LOG.debug("Blok live: refusing handshake, token names no shared series");
                    return CheckResult.rejectUpgradeSync(404);
                })
                .onFailure().recoverWithItem(t -> {
                    // The database is unreachable or the lookup blew up.
                    // Refuse rather than admit an unverified socket; the SPA
                    // falls back to refetching, which is exactly the degraded
                    // mode this feature was designed around.
                    LOG.warnf(t, "Blok live: could not resolve share token, refusing handshake");
                    return CheckResult.rejectUpgradeSync(503);
                });
    }

    /**
     * Emit back onto the Vert.x context that invoked us, so websockets-next
     * finishes the upgrade on the right thread. Falls back to running inline
     * if there is somehow no current context (tests, a future caller off the
     * event loop).
     */
    private static Executor vertxContextExecutor() {
        Context vertxContext = Vertx.currentContext();
        if (vertxContext == null) return Runnable::run;
        return command -> vertxContext.runOnContext(ignored -> command.run());
    }

    /**
     * The token from {@code /api/live/blok/{token}}, or null when the path
     * cannot be one.
     *
     * <p>Package-private and static so it can be tested without CDI, a Vert.x
     * context or a database: this is the half of the check that must reject
     * garbage before a query is ever issued.
     */
    static String tokenOf(String path) {
        if (path == null || path.isBlank()) return null;
        int slash = path.lastIndexOf('/');
        String segment = (slash < 0) ? path : path.substring(slash + 1);
        return isTokenShape(segment) ? segment : null;
    }

    /**
     * Base64-url without padding, non-empty, no longer than the column. See
     * the class javadoc for why a percent-encoded or otherwise decorated
     * segment is refused rather than decoded.
     */
    private static boolean isTokenShape(String segment) {
        if (segment == null || segment.isEmpty() || segment.length() > MAX_TOKEN_LENGTH) return false;
        for (int i = 0; i < segment.length(); i++) {
            char c = segment.charAt(i);
            boolean ok = (c >= 'a' && c <= 'z')
                    || (c >= 'A' && c <= 'Z')
                    || (c >= '0' && c <= '9')
                    || c == '-' || c == '_';
            if (!ok) return false;
        }
        return true;
    }
}
