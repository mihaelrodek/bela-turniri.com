package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.ExtraBill;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class ExtraBillRepository implements PanacheRepository<ExtraBill> {

    /** Oldest first, so the "Ostalo" group keeps a stable order. */
    public List<ExtraBill> findByTournamentId(Long tournamentId) {
        return list("tournament.id = ?1 order by id", tournamentId);
    }
}
