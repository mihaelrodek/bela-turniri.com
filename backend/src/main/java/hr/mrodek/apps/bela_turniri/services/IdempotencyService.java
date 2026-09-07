package hr.mrodek.apps.bela_turniri.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import hr.mrodek.apps.bela_turniri.errors.ApiError;
import hr.mrodek.apps.bela_turniri.model.ProcessedOperation;
import hr.mrodek.apps.bela_turniri.repository.ProcessedOperationRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;

/**
 * At-most-once execution for writes the SPA may have to replay.
 *
 * <p>Why this exists: the organiser enters scores from a phone in a café or
 * hall with bad Wi-Fi. A score typed while the connection is down is queued
 * in the browser and re-sent later — possibly several times, because the
 * SPA cannot tell "the request never arrived" from "the response never came
 * back". Without a server-side memory, the second attempt would apply the
 * mutation a second time: a drink added twice, a match re-scored, a paid
 * flag flipped back.
 *
 * <p>The contract is a single header, {@code X-Client-Op-Id}, carrying a
 * UUID the SPA mints once per queued operation and keeps across retries.
 * A blank or absent header means "not idempotent": the work runs normally
 * and nothing is stored, so every non-queued caller is unaffected.
 *
 * <h2>How the race is handled</h2>
 * The naive shape — run the work, then insert the marker, catch the unique
 * violation — cannot recover in JPA: a constraint violation dooms the
 * persistence context, so the fallback read has nowhere to run. Instead the
 * marker is CLAIMED first, with a native
 * {@code INSERT … ON CONFLICT DO NOTHING} that never throws:
 *
 * <ol>
 *   <li>a committed row for this op id → return its stored status + body
 *       verbatim, work never runs;</li>
 *   <li>claim wins (1 row inserted) → run the work, stamp status + body
 *       onto the claim, return. Both live in the CALLER's transaction, so a
 *       mutation that rolls back takes its "already done" marker with it;</li>
 *   <li>claim loses (0 rows) → a concurrent replay of the same op id got
 *       there first. Postgres makes the conflicting insert wait for that
 *       transaction to finish, so by the time we get 0 rows the winner has
 *       committed and a re-read returns its response. In the rare case it
 *       is still invisible we answer 409 rather than run the work twice.</li>
 * </ol>
 *
 * <p>The op id is scoped to the UID <b>and the route</b> that first used it.
 * A row belonging to someone else, or recorded against a different endpoint,
 * is never replayed back to the current caller; such a call simply runs its
 * own work, unrecorded. Neither case can happen by accident with v4 UUIDs —
 * they fire when a client reuses an id, which is precisely the regression
 * worth defending against, because "the stored 204 came back and my score
 * was never applied" is invisible to the user.
 */
@ApplicationScoped
public class IdempotencyService {

    private static final Logger LOG = Logger.getLogger(IdempotencyService.class);

    /** How long a replay marker stays useful. Far longer than any real outage. */
    private static final int RETENTION_DAYS = 7;

    /** Opportunistic prune cadence — see {@link #pruneOccasionally()}. */
    private static final long PRUNE_INTERVAL_MS = 60 * 60 * 1000L;

    /** Sentinel status on a claim row whose work has not finished yet. */
    private static final int STATUS_IN_PROGRESS = 0;

    /**
     * Wall clock of the last prune attempt in THIS JVM. There is no
     * {@code quarkus-scheduler} on the classpath, so the cleanup rides
     * along on ordinary traffic instead of a cron.
     */
    private static final AtomicLong lastPruneAt = new AtomicLong(0);

    @Inject ProcessedOperationRepository repo;
    @Inject EntityManager em;
    @Inject ObjectMapper mapper;
    @Inject MessageService messages;

    /**
     * Run {@code work} at most once for {@code clientOpId}.
     *
     * <p>Must be called from an already-transactional context (every
     * mutating resource method in this app is {@code @Transactional}); the
     * marker and the mutation then commit or roll back together.
     *
     * @param clientOpId the {@code X-Client-Op-Id} header, or null/blank for
     *                   a normal non-idempotent call
     * @param uid        Firebase UID of the caller (may be null)
     * @param endpoint   stable route label ("PUT /tournaments/{uuid}/…").
     *                   Part of the replay identity, not just diagnostics:
     *                   a stored answer is only replayed to the same route
     * @param work       the mutation, returning the response to remember
     */
    public Response execute(String clientOpId, String uid, String endpoint, Supplier<Response> work) {
        if (clientOpId == null || clientOpId.isBlank()) {
            return work.get();
        }
        String opId = clientOpId.trim();
        if (opId.length() > 100) {
            // Longer than the column: treat as garbage rather than truncating
            // into a possible collision with a legitimate id.
            return work.get();
        }

        Optional<ProcessedOperation> existing = repo.findByClientOpId(opId);
        if (existing.isPresent()) {
            return replay(existing.get(), uid, endpoint, opId, work);
        }

        int claimed = claim(opId, uid, endpoint);
        if (claimed == 0) {
            // Someone else owns this op id. Re-read: after ON CONFLICT DO
            // NOTHING released us, the winner is normally committed.
            Optional<ProcessedOperation> winner = repo.findByClientOpId(opId);
            if (winner.isPresent()) {
                return replay(winner.get(), uid, endpoint, opId, work);
            }
            LOG.warnf("Idempotent op %s on %s is claimed but not readable — answering 409", opId, endpoint);
            return Response.status(Response.Status.CONFLICT)
                    .type(MediaType.APPLICATION_JSON)
                    .entity(ApiError.of("OPERATION_IN_PROGRESS",
                            messages.t("operation.inProgress")))
                    .build();
        }

        Response response = work.get();
        repo.recordOutcome(opId, response.getStatus(), serialise(response, endpoint));
        pruneOccasionally();
        return response;
    }

    /* ===================== internals ===================== */

    /**
     * Rebuild the stored answer. The body is replayed as the raw JSON text
     * that was sent the first time, so the client cannot tell a replay from
     * the original — which is the whole point.
     */
    private Response replay(ProcessedOperation row, String uid, String endpoint,
                            String opId, Supplier<Response> work) {
        if (row.getUserUid() != null && uid != null && !row.getUserUid().equals(uid)) {
            // Not this caller's operation. Don't hand them someone else's
            // response body, and don't record theirs under a taken id.
            LOG.warnf("Client op id %s replayed by a different user — running unrecorded", opId);
            return work.get();
        }
        if (row.getEndpoint() != null && endpoint != null && !row.getEndpoint().equals(endpoint)) {
            // Same op id, different route. The stored answer belongs to a
            // DIFFERENT mutation and replaying it here would silently skip
            // this one: a stored 204 from the pair-paid toggle handed back
            // for a score update reads as success while the score was never
            // applied. The client mints these ids, so a buggy queue that
            // reuses one across two operations must degrade to "runs twice"
            // (visible, recoverable) rather than "never runs" (invisible).
            // Same branch the cross-user mismatch takes: run the work and
            // record nothing, since the id is already spoken for.
            LOG.warnf("Client op id %s first seen on '%s', now replayed on '%s' — running unrecorded",
                    opId, row.getEndpoint(), endpoint);
            return work.get();
        }
        if (row.getHttpStatus() == STATUS_IN_PROGRESS) {
            // Only reachable if a claim somehow committed without its
            // outcome. Never serve an empty body as if it were the answer.
            return Response.status(Response.Status.CONFLICT)
                    .type(MediaType.APPLICATION_JSON)
                    .entity(ApiError.of("OPERATION_IN_PROGRESS",
                            messages.t("operation.inProgress")))
                    .build();
        }
        Response.ResponseBuilder rb = Response.status(row.getHttpStatus());
        if (row.getResponseBody() != null) {
            rb.entity(row.getResponseBody()).type(MediaType.APPLICATION_JSON);
        }
        return rb.build();
    }

    /**
     * Insert the claim row. Native SQL rather than {@code persist()} because
     * {@code ON CONFLICT DO NOTHING} must NOT throw: a JPA constraint
     * violation would doom the transaction and leave us unable to read the
     * winner's row.
     */
    private int claim(String opId, String uid, String endpoint) {
        return em.createNativeQuery("""
                        insert into processed_operations
                            (client_op_id, user_uid, endpoint, http_status, created_at)
                        values (:opId, :uid, :endpoint, :status, :createdAt)
                        on conflict (client_op_id) do nothing
                        """)
                .setParameter("opId", opId)
                .setParameter("uid", uid)
                .setParameter("endpoint", endpoint)
                .setParameter("status", STATUS_IN_PROGRESS)
                .setParameter("createdAt", OffsetDateTime.now())
                .executeUpdate();
    }

    /**
     * Serialise the response entity to the JSON the client will receive.
     * A null entity (204) stores null. A serialisation failure is never
     * allowed to fail the mutation — the marker just loses its body and a
     * replay would re-run, which is the pre-existing behaviour.
     */
    private String serialise(Response response, String endpoint) {
        Object entity = response == null ? null : response.getEntity();
        if (entity == null) return null;
        if (entity instanceof String s) return s;
        try {
            return mapper.writeValueAsString(entity);
        } catch (Exception e) {
            LOG.warnf(e, "Could not store idempotent response body for %s", endpoint);
            return null;
        }
    }

    /**
     * Delete markers older than {@link #RETENTION_DAYS}, at most once an
     * hour per JVM. This runs inside the caller's transaction: if that
     * transaction rolls back the prune is simply skipped and the next
     * request picks it up, which is why the timestamp is only advanced
     * before the attempt (a rolled-back prune costs one wasted hour, never
     * correctness).
     */
    private void pruneOccasionally() {
        long now = System.currentTimeMillis();
        long last = lastPruneAt.get();
        if (now - last < PRUNE_INTERVAL_MS) return;
        if (!lastPruneAt.compareAndSet(last, now)) return;
        try {
            long removed = repo.deleteOlderThan(OffsetDateTime.now().minusDays(RETENTION_DAYS));
            if (removed > 0) LOG.infof("Pruned %d expired idempotency markers", removed);
        } catch (Exception e) {
            LOG.warn("Idempotency prune failed", e);
        }
    }
}
