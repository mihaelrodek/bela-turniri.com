package hr.mrodek.apps.bela_turniri.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * One row per client-generated operation id that has already been applied.
 *
 * <p>The organiser runs the tournament from a phone in a hall with bad
 * Wi-Fi. The SPA therefore queues score/bill/kotizacija writes locally and
 * replays them when the connection comes back — and a replay must never
 * double-apply. Every queued write carries an {@code X-Client-Op-Id}
 * header; this table remembers the ones the server has seen, together with
 * the exact status + body it answered, so a replay gets the identical
 * answer without re-running the mutation.
 *
 * <p>Deliberately generic (endpoint + opaque body) rather than a
 * {@code client_op_id} column per entity: the queued mutations are
 * heterogeneous (match score, drinks, paid flags) and each new one would
 * otherwise mean another column, another unique index and another
 * hand-rolled lookup.
 *
 * <p>Rows are written by {@code IdempotencyService} inside the SAME
 * transaction as the mutation they describe, so a rolled-back mutation can
 * never leave an "already done" marker behind. They are pruned after 7
 * days — far longer than any realistic offline outage, short enough that
 * the table stays small.
 */
@Entity
@Table(name = "processed_operations")
@Getter @Setter @NoArgsConstructor
public class ProcessedOperation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * The client's operation id — a UUID minted by the SPA when the write
     * was enqueued. Unique across all users: a v4 UUID does not collide,
     * and a global unique index is what makes the insert itself the
     * concurrency gate (see IdempotencyService).
     */
    @Column(name = "client_op_id", nullable = false, length = 100, unique = true)
    private String clientOpId;

    /** Firebase UID of the caller that first ran this operation. */
    @Column(name = "user_uid", length = 64)
    private String userUid;

    /** Human-readable route, e.g. {@code "PUT /tournaments/{uuid}/rounds/{roundId}/matches/{matchId}"}. */
    @Column(name = "endpoint", length = 200)
    private String endpoint;

    /**
     * HTTP status the original call answered with. {@code 0} is the
     * "claimed, still running" sentinel written before the work runs; it is
     * only ever visible inside the owning transaction, because a failure
     * rolls the whole row back.
     */
    @Column(name = "http_status", nullable = false)
    private int httpStatus;

    /** Serialised response body, or null for a no-content answer. */
    @Column(name = "response_body", columnDefinition = "text")
    private String responseBody;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;
}
