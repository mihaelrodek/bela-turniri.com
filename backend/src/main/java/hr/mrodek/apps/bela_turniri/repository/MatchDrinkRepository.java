package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.MatchDrink;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class MatchDrinkRepository implements PanacheRepository<MatchDrink> {

    public List<MatchDrink> findByMatchId(Long matchId) {
        return list("match.id = ?1 order by id", matchId);
    }
}
