package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.RepassagePurchase;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class RepassagePurchaseRepository implements AppRepository<RepassagePurchase, Long> {

    public List<RepassagePurchase> findByTournamentAndPairOrderByPaidAtAsc(Tournaments tournament, Pairs pair) {
        return list("tournament = ?1 and pair = ?2", Sort.by("paidAt").ascending(), tournament, pair);
    }
}
