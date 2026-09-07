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
 * One redeemed waiter code — in practice, "this phone behind the bar is
 * logged in as a waiter for this tournament".
 *
 * <p>Sessions are rows rather than signed tokens for one reason:
 * revocation. A waiter credential lives on a borrowed device in a public
 * venue and the organiser must be able to cut it off instantly, so
 * regenerating the tournament's code deletes every session row for that
 * tournament. A stateless token could not be withdrawn without inventing an
 * expiry, and an expiry is exactly the wrong shape here — a tournament runs
 * for one evening and the credential should die when the organiser says so,
 * not on a timer.
 *
 * <p>{@code token} is the bearer credential the device sends back in the
 * {@code X-Waiter-Token} header, minted by
 * {@link hr.mrodek.apps.bela_turniri.services.ClaimTokens}. It is never
 * logged in full and never returned in a bill DTO.
 *
 * <p>The tournament is a bare id for the same reason as in
 * {@link TournamentWaiterAccess}: {@link Tournaments} is soft-delete
 * filtered, and a session must compare against a tournament the caller
 * already resolved, not resolve one of its own.
 */
@Entity
@Table(name = "tournament_waiter_session")
@Getter @Setter @NoArgsConstructor
public class TournamentWaiterSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** FK to {@code tournaments(id)}. A token is valid for this tournament only. */
    @Column(name = "tournament_id", nullable = false)
    private Long tournamentId;

    /**
     * FK to {@code tournament_waiter(id)} — which named credential this
     * session was redeemed from. What lets a single revoke drop one
     * waiter's devices without touching anyone else's.
     */
    @Column(name = "waiter_id")
    private Long waiterId;

    /** Opaque 32-character URL-safe credential. Unique across all tournaments. */
    @Column(name = "token", nullable = false, length = 64, unique = true)
    private String token;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    /**
     * Best-effort "still in use" stamp, for an organiser wondering how many
     * devices are live. Written at most once a minute per session — a bar
     * shift would otherwise turn every bill refresh into a row update.
     */
    @Column(name = "last_used_at")
    private OffsetDateTime lastUsedAt;
}
