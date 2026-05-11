package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.TournamentDrinkPrice;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class TournamentDrinkPriceRepository implements PanacheRepository<TournamentDrinkPrice> {

    public List<TournamentDrinkPrice> findByTournamentId(Long tournamentId) {
        return list("tournament.id = ?1 order by sortOrder, id", tournamentId);
    }

    public long deleteByTournamentId(Long tournamentId) {
        return delete("tournament.id", tournamentId);
    }
}
