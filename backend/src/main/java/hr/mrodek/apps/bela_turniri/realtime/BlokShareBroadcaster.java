package hr.mrodek.apps.bela_turniri.realtime;

import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Status;
import jakarta.transaction.Synchronization;
import jakarta.transaction.TransactionSynchronizationRegistry;
import org.jboss.logging.Logger;

/**
 * Pushes "this shared scorepad changed" pings to every
 * {@link BlokShareSocket} client connected for that share token —
 * {@code BLOK-HISTORY.md} §5.7.
 *
 * <p>The blok twin of {@link LiveBroadcaster}. The payload is deliberately
 * tiny — in fact it is a <b>constant</b>, {@code {"type":"live-update",
 * "scope":"blok"}} — and carries neither the token nor anything about the
 * series. Clients refetch the real data over the public
 * {@code GET /blok-share/{token}}, which validates the token itself, so this
 * class is decoupled from every DTO and the same fetch path drives both the
 * instant push and the fallback refetch. There is exactly one socket per
 * scorepad on a viewer's page, so a frame that says only "refetch" is
 * unambiguous.
 *
 * <p><b>Why the token is not echoed back in the frame.</b> It would tell the
 * client nothing it did not already type into the URL, and putting a secret in
 * a payload makes it something that can be logged, forwarded or accidentally
 * rendered. Leaving it out also means the frame contains no string that came
 * from anywhere but this file, which is what makes the hand-built JSON below
 * safe without an escaping question ever arising.
 *
 * <h2>Why the send is deferred to after commit</h2>
 * Every caller is inside an open transaction on a request thread. A client
 * that refetches the instant it receives the ping would otherwise race the
 * commit and read pre-write state — worse than not pinging at all, because the
 * stale read then sticks until something else changes. So the send is hung off
 * an interposed {@link Synchronization} and only fires on
 * {@link Status#STATUS_COMMITTED}: <b>a rolled-back save wakes nobody</b>.
 * This mirrors {@link LiveBroadcaster#notifyTournament} and
 * {@code services.PushService#dispatch}; keep the three in step.
 *
 * <p>The dispatch logic is duplicated from {@link LiveBroadcaster} rather than
 * shared, on purpose: extracting it would mean editing the transaction
 * handling of the tournament socket, whose only real proof is a live client,
 * to gain forty lines. The two are short, identical in shape and documented as
 * a pair.
 *
 * <p>Sends are best-effort per connection: a socket that is closing or failing
 * is skipped, never propagated back to the caller. Announcing a saved game
 * must not be able to fail the write that produced it.
 */
@ApplicationScoped
public class BlokShareBroadcaster {

    private static final Logger LOG = Logger.getLogger(BlokShareBroadcaster.class);

    /**
     * The entire wire protocol. {@code type} matches what the SPA's
     * {@code useLiveSocket} already switches on; {@code scope} says which
     * feature it came from, so a future frame on this socket can be
     * distinguished without a version negotiation.
     */
    static final String FRAME = "{\"type\":\"live-update\",\"scope\":\"blok\"}";

    @Inject
    BlokShareConnections connections;

    /**
     * Lets us detect an in-flight JTA transaction and hook after-commit
     * without the caller having to pass anything in.
     */
    @Inject
    TransactionSynchronizationRegistry txRegistry;

    /**
     * Tell everyone watching this shared scorepad that it changed. Safe to
     * call from inside a {@code @Transactional} method — the actual send waits
     * for commit. Never throws.
     *
     * <p>A null or blank token is a no-op, which is the ordinary case: a series
     * that has never been shared has no token, nobody can be connected to it
     * (the upgrade check resolves the token against the database), and its
     * saves are nobody's business. That is the whole of "only shared sessions
     * are broadcast for" — it falls out of the key rather than needing a
     * check.
     *
     * @param shareToken the series' live {@code share_token}, or null when it
     *                   is not shared
     */
    public void notifySession(String shareToken) {
        if (shareToken == null || shareToken.isBlank()) return;
        dispatch(shareToken, false);
    }

    /**
     * The link has just been revoked (or the record deleted): ping, then close.
     *
     * <p>Both halves matter and the order is the point.
     *
     * <ul>
     *   <li><b>Ping first</b> so the viewer refetches immediately, gets the 404
     *       that {@code GET /blok-share/{token}} now answers, and shows the
     *       "this link no longer works" screen at once instead of sitting on a
     *       scorepad they are no longer allowed to see until they happen to
     *       reload. The frame itself discloses nothing — it is the same
     *       constant as any other change.</li>
     *   <li><b>Then close</b>, because the alternative is a connection parked
     *       forever on a key no broadcast can ever target again: the token is
     *       gone from the database, so nothing will wake it and nothing will
     *       hang up on it. That is exactly the "junk keys park a socket"
     *       failure {@link BlokShareUpgradeCheck} was written to prevent, and
     *       it would be reintroduced here through the back door. A client that
     *       reconnects out of habit is refused 404 at the handshake, which
     *       costs a rejected upgrade and no connection.</li>
     * </ul>
     *
     * <p>The close is chained onto the send's completion rather than issued
     * beside it, so the frame is on the wire before the socket goes away; it
     * runs on failure too, because a send that failed is a socket worth
     * closing regardless.
     */
    public void notifyRevoked(String shareToken) {
        if (shareToken == null || shareToken.isBlank()) return;
        dispatch(shareToken, true);
    }

    /* ===================== dispatch ===================== */

    /**
     * Send now only when there is genuinely no JTA transaction in progress;
     * with an active transaction the send is deferred to after a successful
     * commit. Any other status (marked for rollback, rolling back, preparing,
     * …) means the change behind the ping may never land, so it is dropped.
     */
    private void dispatch(String token, boolean thenClose) {
        int status;
        try {
            status = (txRegistry == null)
                    ? Status.STATUS_NO_TRANSACTION
                    : txRegistry.getTransactionStatus();
        } catch (Exception e) {
            // Registry unusable — treat as "no transaction" and send inline.
            LOG.debugf(e, "Blok live: transaction registry unavailable, sending inline");
            send(token, thenClose);
            return;
        }

        if (status == Status.STATUS_NO_TRANSACTION) {
            send(token, thenClose);
            return;
        }

        if (status != Status.STATUS_ACTIVE) {
            LOG.debugf("Blok live: dropping ping, transaction status %d", status);
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
                    if (st == Status.STATUS_COMMITTED) send(token, thenClose);
                }
            });
        } catch (Exception e) {
            // Could not hook into the commit — dropping is safer than pinging
            // something the transaction may still roll back.
            LOG.warnf(e, "Blok live: could not register commit hook, dropping ping");
        }
    }

    /**
     * Fan out to the sockets watching this scorepad — a map lookup, so the cost
     * is the size of that scorepad's audience and nothing else. Every failure
     * mode here (closed socket, backpressure, a connection torn down
     * mid-iteration) is swallowed: the write already committed and the client's
     * own refetch remains the safety net.
     */
    private void send(String token, boolean thenClose) {
        try {
            for (WebSocketConnection c : connections.forToken(token)) {
                try {
                    if (c.isClosed()) continue;
                    if (thenClose) {
                        c.sendText(FRAME).subscribe().with(ok -> closeQuietly(c), failure -> closeQuietly(c));
                    } else {
                        c.sendText(FRAME).subscribe().with(ok -> { }, failure -> { });
                    }
                } catch (Exception e) {
                    // Connection is closing/closed — skip it.
                }
            }
        } catch (Exception e) {
            LOG.debug("Blok live: broadcast failed", e);
        }
    }

    /**
     * Hang up without letting the attempt escape. {@code @OnClose} does the
     * bookkeeping — websockets-next fires it for every close, ours included —
     * so nothing is unregistered here.
     */
    private static void closeQuietly(WebSocketConnection c) {
        try {
            c.close().subscribe().with(ok -> { }, failure -> { });
        } catch (Exception e) {
            // Already gone.
        }
    }
}
