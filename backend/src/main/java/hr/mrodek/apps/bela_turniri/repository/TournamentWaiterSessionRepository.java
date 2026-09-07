package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.TournamentWaiterSession;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

import java.time.OffsetDateTime;
import java.util.Optional;

@ApplicationScoped
public class TournamentWaiterSessionRepository
        implements AppRepository<TournamentWaiterSession, Long> {

    /** Session behind a bearer token, or empty. Backed by the unique index on {@code token}. */
    public Optional<TournamentWaiterSession> findByToken(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        return find("token = ?1", token).firstResultOptional();
    }

    /**
     * Drop every session of a tournament — the whole revocation mechanism.
     * Called when the organiser regenerates the code, which is the only way
     * waiter access is ever withdrawn.
     */
    public long deleteByTournamentId(Long tournamentId) {
        if (tournamentId == null) return 0;
        return delete("tournamentId = ?1", tournamentId);
    }

    /**
     * Drop every session minted from one waiter's code — the per-waiter
     * revoke. Every device that person's code was typed into stops working
     * on its next request; nobody else's session is touched.
     */
    public long deleteByWaiterId(Long waiterId) {
        if (waiterId == null) return 0;
        return delete("waiterId = ?1", waiterId);
    }

    /**
     * Stamp {@code last_used_at} on one session.
     *
     * <p>{@code REQUIRES_NEW} on purpose. This is an activity marker, not
     * part of anyone's business transaction: the read-only bill endpoints
     * that call it run outside a transaction entirely (a bulk update would
     * otherwise throw), and on the mutating endpoints a failed touch must
     * never be able to roll back the drink the waiter just recorded.
     */
    @Transactional(Transactional.TxType.REQUIRES_NEW)
    public void touchLastUsed(Long id, OffsetDateTime at) {
        if (id == null) return;
        update("lastUsedAt = ?1 where id = ?2", at, id);
    }
}
