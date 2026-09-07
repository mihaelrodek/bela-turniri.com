package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.TournamentWaiter;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class TournamentWaiterRepository implements AppRepository<TournamentWaiter, Long> {

    /** Active waiters of a tournament, oldest invite first — the organiser's list. */
    public List<TournamentWaiter> findActiveByTournamentId(Long tournamentId) {
        if (tournamentId == null) return List.of();
        return find("tournamentId = ?1 and revokedAt is null order by createdAt", tournamentId).list();
    }

    /**
     * One ACTIVE waiter, scoped to the tournament it belongs to — the
     * IDOR-safe lookup for a single revoke. Scoped by tournament so an
     * organiser cannot revoke (or learn the existence of) a waiter row of a
     * tournament they don't own by guessing ids; scoped to active so a
     * repeat revoke of the same id answers 404 rather than silently
     * succeeding twice.
     */
    public Optional<TournamentWaiter> findActiveByIdAndTournamentId(Long id, Long tournamentId) {
        if (id == null || tournamentId == null) return Optional.empty();
        return find("id = ?1 and tournamentId = ?2 and revokedAt is null", id, tournamentId)
                .firstResultOptional();
    }

    /** The active (not revoked) waiter this code redeems to, or empty. */
    public Optional<TournamentWaiter> findActiveByTournamentIdAndCode(Long tournamentId, String code) {
        if (tournamentId == null || code == null) return Optional.empty();
        return find("tournamentId = ?1 and code = ?2 and revokedAt is null", tournamentId, code)
                .firstResultOptional();
    }

    /** True when some ACTIVE waiter of this tournament already holds this code — the retry check on invite. */
    public boolean activeCodeInUse(Long tournamentId, String code) {
        if (tournamentId == null || code == null) return false;
        return count("tournamentId = ?1 and code = ?2 and revokedAt is null", tournamentId, code) > 0;
    }

    /** Revoke every active waiter of a tournament in one statement — the "revoke all" bulk action. */
    public long revokeAllByTournamentId(Long tournamentId, OffsetDateTime at) {
        if (tournamentId == null) return 0;
        return update("revokedAt = ?1 where tournamentId = ?2 and revokedAt is null", at, tournamentId);
    }
}
