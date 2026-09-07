package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.MatchDrink;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import io.quarkus.panache.common.Parameters;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Collection;
import java.util.List;

@ApplicationScoped
public class MatchDrinkRepository implements PanacheRepository<MatchDrink> {

    public List<MatchDrink> findByMatchId(Long matchId) {
        return list("match.id = ?1 order by id", matchId);
    }

    /**
     * Drinks for a whole batch of matches in one query. The invoice list
     * used to call {@link #findByMatchId(Long)} inside its loop — one
     * SELECT per match the user has ever played. Callers group the result
     * by {@code getMatch().getId()}.
     */
    public List<MatchDrink> findByMatchIds(Collection<Long> matchIds) {
        if (matchIds == null || matchIds.isEmpty()) return List.of();
        return list("""
                from MatchDrink d
                where d.match.id in :ids
                order by d.match.id asc, d.id asc
                """, Parameters.with("ids", matchIds));
    }
}
