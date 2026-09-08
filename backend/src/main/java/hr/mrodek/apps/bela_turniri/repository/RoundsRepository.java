package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.Rounds;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@ApplicationScoped
public class RoundsRepository implements AppRepository<Rounds, Long> {

    public List<Rounds> findByTournamentOrderByNumberAsc(Tournaments t) {
        return list("tournament", Sort.by("number").ascending(), t);
    }

    public Optional<Rounds> findTopByTournamentOrderByNumberDesc(Tournaments t) {
        return find("tournament", Sort.by("number").descending(), t).firstResultOptional();
    }

    public List<Rounds> findByTournament_Id(Long tournamentId) {
        return list("tournament.id", tournamentId);
    }

    public List<Rounds> findByTournament_IdOrderByNumberAsc(Long tournamentId) {
        return list("tournament.id", Sort.by("number").ascending(), tournamentId);
    }

    public void deleteByTournament(Tournaments t) {
        delete("tournament", t);
    }

    /**
     * For each of the given tournaments, the number of its <b>active</b>
     * round — the highest-numbered one that is not {@code COMPLETED} — or no
     * entry at all when it has none.
     *
     * <p>There is no "is active" flag anywhere ({@code BLOK-LINK.md} §1), and
     * "the last round" is not the same question: the newest round can
     * legitimately be completed while an older one was reopened by a
     * re-score, and an older one can still be open while a newer one is
     * drawn. Both directions matter to {@code GET /blok-links/suggestions},
     * which must offer a player only the table they are at <em>now</em>.
     *
     * <p>One grouped query for the whole batch, because a player can be
     * registered on several tournaments at once and the alternative is a
     * round listing per tournament.
     */
    public Map<Long, Integer> findActiveRoundNumbers(Collection<Long> tournamentIds) {
        if (tournamentIds == null || tournamentIds.isEmpty()) return Map.of();
        List<Object[]> rows = getEntityManager().createQuery("""
                        select r.tournament.id, max(r.number) from Rounds r
                        where r.tournament.id in :tids
                          and r.status <> hr.mrodek.apps.bela_turniri.enums.RoundStatus.COMPLETED
                        group by r.tournament.id
                        """, Object[].class)
                .setParameter("tids", tournamentIds)
                .getResultList();

        Map<Long, Integer> out = new HashMap<>(rows.size());
        for (Object[] r : rows) {
            out.put(((Number) r[0]).longValue(), ((Number) r[1]).intValue());
        }
        return out;
    }
}
