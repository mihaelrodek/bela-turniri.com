package hr.mrodek.apps.bela_turniri.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * One named waiter ("konobar") credential for a tournament.
 *
 * <p>Supersedes {@code TournamentWaiterAccess}: that table held exactly one
 * live code per tournament, keyed by the tournament id itself. A real venue
 * has several people behind the bar, and the organiser wants to hand each of
 * them their own code — so they can be told apart in the list, and so
 * revoking the one who left doesn't cut off everyone else. Hence a surrogate
 * key and a {@code name}: several rows per tournament now, not one.
 *
 * <p>{@code revoked_at} is the whole revocation story, same shape as
 * regeneration used to be but scoped to one row instead of the whole
 * tournament: withdrawing a single waiter's access sets this timestamp and
 * deletes their {@link TournamentWaiterSession} rows, everyone else's
 * sessions untouched. The row itself is never deleted — a revoked code must
 * not become redeemable again just because its row disappeared and the same
 * four letters got handed out later.
 *
 * <p>The tournament is a bare id, not a {@code @ManyToOne}, for the same
 * reason as its predecessor: {@link Tournaments} carries
 * {@code @SQLRestriction("is_deleted = false")}, and every caller already
 * holds the tournament row via {@code TournamentAccess}.
 */
@Entity
@Table(name = "tournament_waiter")
@Getter @Setter @NoArgsConstructor
public class TournamentWaiter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tournament_id", nullable = false)
    private Long tournamentId;

    /** The label the organiser typed when inviting — shown back in the waiter list. */
    @Column(name = "name", nullable = false, length = 60)
    private String name;

    /** Four uppercase letters, {@code I}/{@code O} excluded — see {@code WaiterAccessService.ALPHABET}. */
    @Column(name = "code", nullable = false, length = 4)
    private String code;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    /** Null while active. Set once by a revoke, never cleared. */
    @Column(name = "revoked_at")
    private OffsetDateTime revokedAt;

    /**
     * The "head waiter" flag. False for an ordinary waiter (bills only);
     * true also unlocks {@code PUT /tournaments/{idOrSlug}/cjenik} for this
     * one credential — see {@code WaiterAccessService#authorizeCjenikAccess}.
     * Nothing else an organiser can do is reachable this way; the price
     * list is the one write a real venue plausibly needs mid-evening.
     */
    @Column(name = "can_edit_cjenik", nullable = false)
    private boolean canEditCjenik;
}
