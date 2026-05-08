package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.enums.MatchStatus;
import hr.mrodek.apps.bela_turniri.model.Matches;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Rounds;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import io.quarkus.hibernate.orm.panache.Panache;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class MatchesRepository implements AppRepository<Matches, Long> {

    public List<Matches> findByRound(Rounds round) {
        return list("round", round);
    }

    /**
     * Round number of the pair's last FINISHED loss in the given tournament,
     * or {@code null} if none found. Scalar projection, so we go through
     * EntityManager rather than Panache's entity-shaped {@code find()}.
     */
    public Integer findLastLossRoundNumber(Tournaments tournament, Pairs pair) {
        return Panache.getEntityManager().createQuery("""
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
        return Panache.getEntityManager().createQuery("""
                        select m from Matches m
                        join fetch m.round r
                        left join fetch m.pair1
                        left join fetch m.pair2
                        where m.pair1.id = :pid or m.pair2.id = :pid
                        order by r.number asc, m.tableNo asc nulls last, m.id asc
                        """, Matches.class)
                .setParameter("pid", pairId)
                .getResultList();
    }
}
