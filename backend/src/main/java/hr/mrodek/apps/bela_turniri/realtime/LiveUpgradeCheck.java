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

import java.util.UUID;
import java.util.concurrent.Executor;

/**
 * Admission control for {@link LiveSocket}: decides whether an HTTP upgrade
 * to {@code /api/live/{tournamentUuid}} is allowed to become a websocket.
 *
 * <p>Before this existed the handshake accepted <em>any</em> string as the
 * tournament uuid, resolved nothing, and then held the connection open
 * indefinitely. Three consequences, all fixed here:
 *
 * <ol>
 *   <li><b>Junk uuids parked forever.</b> {@code /ws/live/anything} produced
 *       a permanent, memory-holding connection that no broadcast would ever
 *       target. Now the uuid must parse and must resolve to a live
 *       tournament, or the handshake is refused with 404.</li>
 *   <li><b>No concurrency ceiling.</b> Caddy's {@code ws} zone limits
 *       handshake RATE, which is no defence against a client that opens
 *       sockets slowly and never closes them; and websockets-next 3.15 has
 *       no {@code max-concurrent-connections} setting of its own (see
 *       {@link LiveConnections}). A global cap and a per-tournament cap are
 *       enforced here, both configurable.</li>
 *   <li><b>Every parked socket taxed every write.</b> Fan-out is now indexed
 *       by tournament — see {@link LiveConnections}.</li>
 * </ol>
 *
 * <h2>Why the check lives here and not in {@code @OnOpen}</h2>
 * An {@code @OnOpen} callback runs <em>after</em> the handshake has already
 * succeeded, so the best it can do is answer 101 and immediately close —
 * the connection is allocated, the client sees a successful upgrade, and a
 * retry loop happily does it again. {@link HttpUpgradeCheck} runs before the
 * upgrade and can decline it outright with a real HTTP status, which is both
 * cheaper and something a client can act on. Verified behaviour: an unknown
 * uuid answers 404 and never reaches 101.
 *
 * <h2>Threading</h2>
 * {@code perform} is invoked on the Vert.x event loop, so the (blocking)
 * database lookup is pushed onto the worker pool and the result is emitted
 * back on the original Vert.x context — websockets-next completes the
 * upgrade in this subscriber, and that must happen on the connection's own
 * context. The cheap checks (uuid shape, connection counts) run inline and
 * short-circuit before any of that machinery is set up.
 */
@ApplicationScoped
public class LiveUpgradeCheck implements HttpUpgradeCheck {

    private static final Logger LOG = Logger.getLogger(LiveUpgradeCheck.class);

    @Inject LiveConnections connections;
    @Inject LiveTournamentResolver resolver;

    /**
     * Server-wide ceiling on simultaneous live sockets. Sized well above any
     * plausible real audience (the whole app serves a few dozen concurrent
     * tournaments) and well below what the event loop and file-descriptor
     * budget can carry, so it sheds an abusive client long before the box
     * notices.
     */
    @ConfigProperty(name = "live.max-connections", defaultValue = "2000")
    int maxConnections;

    /**
     * Per-tournament ceiling. Without it a single host could still fill the
     * global budget through one valid uuid and starve every other
     * tournament's viewers.
     */
    @ConfigProperty(name = "live.max-connections-per-tournament", defaultValue = "200")
    int maxConnectionsPerTournament;

    @Override
    public boolean appliesTo(String endpointId) {
        return LiveSocket.ENDPOINT_ID.equals(endpointId);
    }

    @Override
    public Uni<CheckResult> perform(HttpUpgradeContext context) {
        String uuidText = lastPathSegment(context.httpRequest().path());
        UUID uuid = parseUuid(uuidText);
        if (uuid == null) {
            LOG.debugf("Live: refusing handshake, '%s' is not a uuid", uuidText);
            return CheckResult.rejectUpgrade(404);
        }
        String key = uuid.toString();

        if (connections.total() >= maxConnections) {
            LOG.warnf("Live: refusing handshake for %s, server cap of %d live sockets reached",
                    key, maxConnections);
            return CheckResult.rejectUpgrade(503);
        }
        if (connections.countFor(key) >= maxConnectionsPerTournament) {
            LOG.warnf("Live: refusing handshake for %s, per-tournament cap of %d reached",
                    key, maxConnectionsPerTournament);
            return CheckResult.rejectUpgrade(503);
        }

        // The counts above are read a moment before the socket registers
        // itself in LiveSocket#onOpen, so genuinely simultaneous handshakes
        // on different event loops can overshoot a cap by the number in
        // flight. That is deliberate — this is admission control, not a
        // semaphore, and serialising the upgrade would cost far more than an
        // overshoot of a few sockets. Keeping @OnOpen @NonBlocking shrinks
        // the window to the upgrade itself; measured against the packaged
        // app, back-to-back handshakes are already refused exactly at the
        // cap.

        Executor backOnVertxContext = vertxContextExecutor();
        return Uni.createFrom().item(() -> resolver.exists(uuid))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool())
                .emitOn(backOnVertxContext)
                .map(exists -> {
                    if (exists) return CheckResult.permitUpgradeSync();
                    // Same status the REST endpoints give for an unknown
                    // tournament. Nothing is leaked: the caller already had
                    // to supply the uuid to ask.
                    LOG.debugf("Live: refusing handshake, no live tournament %s", key);
                    return CheckResult.rejectUpgradeSync(404);
                })
                .onFailure().recoverWithItem(t -> {
                    // The database is unreachable or the lookup blew up.
                    // Refuse rather than admit an unverified socket; the SPA
                    // falls back to polling, which is exactly the degraded
                    // mode this feature was designed around.
                    LOG.warnf(t, "Live: could not resolve tournament %s, refusing handshake", key);
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
     * The socket path is {@code /api/live/{tournamentUuid}} and this check
     * only ever applies to that endpoint, so the uuid is the final segment.
     * A trailing slash or an empty path yields null and is refused.
     */
    private static String lastPathSegment(String path) {
        if (path == null || path.isBlank()) return null;
        int slash = path.lastIndexOf('/');
        String segment = (slash < 0) ? path : path.substring(slash + 1);
        return segment.isBlank() ? null : segment;
    }

    private static UUID parseUuid(String text) {
        if (text == null) return null;
        try {
            return UUID.fromString(text);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
