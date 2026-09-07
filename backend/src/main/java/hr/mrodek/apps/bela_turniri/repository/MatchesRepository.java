package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.enums.MatchStatus;
import hr.mrodek.apps.bela_turniri.model.Matches;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Rounds;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import io.quarkus.panache.common.Parameters;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;

import java.util.List;

@ApplicationScoped
public class MatchesRepository implements AppRepository<Matches, Long> {

    /**
     * CDI-injected {@link EntityManager} for the rare scalar/projection query
     * Panache's entity-shaped {@code find()} can't express. Same EM instance
     * Panache uses internally — preferred over {@code Panache.getEntityManager()}
     * because injection is the standard Quarkus + Hibernate ORM pattern and
     * is easier to mock if we ever add tests against this repo.
     */
    @Inject EntityManager em;

    public List<Matches> findByRound(Rounds round) {
        return list("round", round);
    }

    /**
     * Round number of the pair's last FINISHED loss in the given tournament,
     * or {@code null} if none found. Scalar projection, so we go through
     * EntityManager rather than Panache's entity-shaped {@code find()}.
     */
    public Integer findLastLossRoundNumber(Tournaments tournament, Pairs pair) {
        return em.createQuery("""
                        select max(m.round.number)
                        from Matches m
                        where m.tournament = :t
                          and m.status = hr.mrodek.apps.bela_turniri.enums.MatchStatus.FINISHED
                          and (
                                (m.pair1 = :p and m.winnerPair = m.pair2)
                             or (m.pair2 = :p and m.winnerPair = m.pair1)
                          )
                        """, Integer.class)
                .setParameter("t", tournament)
                .setParameter("p", pair)
                .getSingleResult();
    }

    public List<Matches> findByTournament_Id(Long tournamentId) {
        return list("tournament.id", tournamentId);
    }

    /**
     * Every match of a tournament, with round and both pairs already
     * fetched, ordered by round then table. Replaces the
     * "one findByRound() per round, then let the mapper walk the LAZY
     * pairs" pattern in {@code RoundService.listByTournamentUuid} — that
     * was 1 + rounds + (2 × matches) queries for a page that renders in
     * one. Callers group by round id in Java.
     */
    public List<Matches> findByTournament_IdWithRoundAndPairs(Long tournamentId) {
        if (tournamentId == null) return List.of();
        return list("""
                from Matches m
                join fetch m.round r
                left join fetch m.pair1
                left join fetch m.pair2
                where m.tournament.id = :tid
                order by r.number asc, m.tableNo asc nulls last, m.id asc
                """, Parameters.with("tid", tournamentId));
    }

    /**
     * Every non-BYE match the user played, on either side of either pair,
     * as primary submitter or claimed co-owner. Fetches everything the
     * invoice list dereferences (tournament, round, both pairs, winner) so
     * building the list doesn't fire a query per row per association.
     */
    public List<Matches> findParticipantMatchesWithDetails(String uid) {
        if (uid == null || uid.isBlank()) return List.of();
        return list("""
                from Matches m
                join fetch m.tournament
                left join fetch m.round
                left join fetch m.pair1 p1
                left join fetch m.pair2 p2
                left join fetch m.winnerPair
                where (p1.submittedByUid = :uid or p1.coSubmittedByUid = :uid
                    or p2.submittedByUid = :uid or p2.coSubmittedByUid = :uid)
                  and m.pair2 is not null
                """, Parameters.with("uid", uid));
    }

    public List<Matches> findByRound_Id(Long roundId) {
        return list("round.id", roundId);
    }

    public void deleteByTournament(Tournaments t) {
        delete("tournament", t);
    }

    public void deleteByRound(Rounds r) {
        delete("round", r);
    }

    public List<Matches> findByRound_IdOrderByTableNoAsc(Long roundId) {
        return list("round.id", Sort.by("tableNo").ascending(), roundId);
    }

    public List<Matches> findByTournament_IdAndStatus(Long tournamentId, MatchStatus status) {
        return list("tournament.id = ?1 and status = ?2", tournamentId, status);
    }

    /**
     * Every match the given pair was on either side of, ordered by round
     * number then table number — i.e. how the day actually played out.
     * Eager-fetches round + the opponents so the caller doesn't N+1 when
     * rendering history rows.
     */
    public List<Matches> findByPairId(Long pairId) {
        if (pairId == null) return List.of();
        // Full JPQL via Panache's list(...) — entity-shaped, so we can stay
        // on Panache rather than dropping to EntityManager. The "from" prefix
        // tells Panache this is a complete query, not a where-clause shortcut.
        return list("""
                from Matches m
                join fetch m.round r
                left join fetch m.pair1
                left join fetch m.pair2
                where m.pair1.id = :pid or m.pair2.id = :pid
                order by r.number asc, m.tableNo asc nulls last, m.id asc
                """, Parameters.with("pid", pairId));
    }
}
