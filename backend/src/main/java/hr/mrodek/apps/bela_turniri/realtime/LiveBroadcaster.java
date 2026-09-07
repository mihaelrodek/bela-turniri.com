package hr.mrodek.apps.bela_turniri.realtime;

import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Status;
import jakarta.transaction.Synchronization;
import jakarta.transaction.TransactionSynchronizationRegistry;
import org.jboss.logging.Logger;

import java.util.UUID;

/**
 * Pushes "this tournament changed" pings to every {@link LiveSocket} client
 * connected for that tournament. The payload is deliberately tiny — clients
 * refetch the real data over the existing REST endpoints — which keeps this
 * decoupled from every DTO and lets the same fetch/merge path drive both the
 * polled fallback and the instant push.
 *
 * <h2>Why the send is deferred to after commit</h2>
 * Every caller is inside an open transaction on a request thread. A client
 * that refetches the instant it receives the ping would otherwise race the
 * commit and read pre-write state — worse than not pinging at all, because
 * the stale read then sticks until the next poll. So the send is hung off an
 * interposed {@link Synchronization} and only fires on
 * {@link Status#STATUS_COMMITTED}. This mirrors
 * {@code services.PushService#dispatch}; keep the two in step.
 *
 * <p>Sends are best-effort per connection: a socket that is closing or
 * failing is skipped, never propagated back to the caller. Announcing a score
 * must not be able to fail the write that produced it.
 */
@ApplicationScoped
public class LiveBroadcaster {

    private static final Logger LOG = Logger.getLogger(LiveBroadcaster.class);

    /** Match scores, match finish, drinks, bill paid. */
    public static final String SCOPE_MATCH = "match";
    /** Round drawn, round finished, round reset. */
    public static final String SCOPE_ROUND = "round";
    /** Pair roster: add, rename, approve, paid, delete, self-registration, repassage. */
    public static final String SCOPE_PAIRS = "pairs";
    /** Tournament-level: start, finish, podium, reset. */
    public static final String SCOPE_TOURNAMENT = "tournament";

    /**
     * Tournament-indexed view of the open sockets. Deliberately NOT
     * {@code OpenConnections}: iterating every connection on the server and
     * string-comparing its path param made one score entry cost O(all
     * sockets), so every idle or abandoned socket slowed down every real
     * write. See {@link LiveConnections}.
     */
    @Inject
    LiveConnections connections;

    /**
     * Lets us detect an in-flight JTA transaction and hook after-commit
     * without the caller having to pass anything in.
     */
    @Inject
    TransactionSynchronizationRegistry txRegistry;

    /**
     * Tell every viewer of {@code tournamentUuid} that something in
     * {@code scope} changed. Safe to call from inside a {@code @Transactional}
     * method — the actual send waits for commit. Never throws.
     *
     * @param tournamentUuid the tournament's UUID (not its slug — the socket
     *                       path is keyed on the uuid the client read off the
     *                       tournament DTO)
     * @param scope          one of {@link #SCOPE_MATCH}, {@link #SCOPE_ROUND},
     *                       {@link #SCOPE_PAIRS}, {@link #SCOPE_TOURNAMENT}
     */
    public void notifyTournament(String tournamentUuid, String scope) {
        if (tournamentUuid == null || tournamentUuid.isBlank()) return;

        // Both values are enumerable and machine-generated, never user input:
        // the uuid must parse as a UUID and the scope must be one of the four
        // constants above. That is what makes the hand-built JSON below safe —
        // there is no string in the payload a user could have authored, so no
        // escaping question arises. Anything else is a programming error and
        // is dropped rather than emitted.
        final String uuid;
        try {
            uuid = UUID.fromString(tournamentUuid).toString();
        } catch (IllegalArgumentException e) {
            LOG.debugf("Live: ignoring broadcast for non-uuid tournament ref '%s'", tournamentUuid);
            return;
        }
        if (!SCOPE_MATCH.equals(scope) && !SCOPE_ROUND.equals(scope)
                && !SCOPE_PAIRS.equals(scope) && !SCOPE_TOURNAMENT.equals(scope)) {
            LOG.debugf("Live: ignoring broadcast with unknown scope '%s'", scope);
            return;
        }

        final String json = "{\"type\":\"live-update\",\"tournamentUuid\":\""
                + uuid + "\",\"scope\":\"" + scope + "\"}";

        dispatch(uuid, json);
    }

    /* ===================== dispatch ===================== */

    /**
     * Send now only when there is genuinely no JTA transaction in progress;
     * with an active transaction the send is deferred to after a successful
     * commit. Any other status (marked for rollback, rolling back, preparing,
     * …) means the change behind the ping may never land, so it is dropped.
     */
    private void dispatch(String uuid, String json) {
        int status;
        try {
            status = (txRegistry == null)
                    ? Status.STATUS_NO_TRANSACTION
                    : txRegistry.getTransactionStatus();
        } catch (Exception e) {
            // Registry unusable — treat as "no transaction" and send inline.
            LOG.debugf(e, "Live: transaction registry unavailable, sending inline");
            send(uuid, json);
            return;
        }

        if (status == Status.STATUS_NO_TRANSACTION) {
            send(uuid, json);
            return;
        }

        if (status != Status.STATUS_ACTIVE) {
            LOG.debugf("Live: dropping ping for %s, transaction status %d", uuid, status);
            return;
        }

        try {
            txRegistry.registerInterposedSynchronization(new Synchronization() {
                @Override
                public void beforeCompletion() {
                    // nothing — all the work is post-commit
                }

                @Override
                public void afterCompletion(int st) {
                    if (st == Status.STATUS_COMMITTED) send(uuid, json);
                }
            });
        } catch (Exception e) {
            // Could not hook into the commit — dropping is safer than pinging
            // something the transaction may still roll back.
            LOG.warnf(e, "Live: could not register commit hook for %s, dropping ping", uuid);
        }
    }

    /**
     * Fan out to the sockets watching this tournament — a map lookup, so the
     * cost is the size of that tournament's audience and nothing else. Every
     * failure mode here (closed socket, backpressure, a connection torn down
     * mid-iteration) is swallowed: the write already committed and the
     * client's poll remains the safety net.
     */
    private void send(String uuid, String json) {
        try {
            for (WebSocketConnection c : connections.forTournament(uuid)) {
                try {
                    if (c.isClosed()) continue;
                    c.sendText(json).subscribe().with(ok -> { }, failure -> { });
                } catch (Exception e) {
                    // Connection is closing/closed — skip it.
                }
            }
        } catch (Exception e) {
            LOG.debugf(e, "Live: broadcast failed for %s", uuid);
        }
    }
}
