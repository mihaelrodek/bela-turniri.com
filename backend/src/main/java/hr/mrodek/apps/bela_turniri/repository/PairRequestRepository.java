package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.enums.PairRequestStatus;
import hr.mrodek.apps.bela_turniri.model.PairRequest;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class PairRequestRepository implements AppRepository<PairRequest, Long> {

    public Optional<PairRequest> findByUuid(UUID uuid) {
        return find("uuid", uuid).firstResultOptional();
    }

    public List<PairRequest> findAllOrderByCreatedDesc() {
        return list("from PairRequest pr left join fetch pr.tournament order by pr.createdAt desc");
    }

    public List<PairRequest> findByStatus(PairRequestStatus status) {
        return list("from PairRequest pr left join fetch pr.tournament where pr.status = ?1 order by pr.createdAt desc", status);
    }

    public List<PairRequest> findByTournament_Id(Long tournamentId) {
        return list("from PairRequest pr left join fetch pr.tournament where pr.tournament.id = ?1 order by pr.createdAt desc", tournamentId);
    }
}
