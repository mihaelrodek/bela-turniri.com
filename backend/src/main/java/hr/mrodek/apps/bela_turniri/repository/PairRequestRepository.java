package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.enums.PairRequestStatus;
import hr.mrodek.apps.bela_turniri.model.PairRequest;
import io.quarkus.panache.common.Sort;
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
        return list("from PairRequest order by createdAt desc");
    }

    public List<PairRequest> findByStatus(PairRequestStatus status) {
        return list("status = ?1", Sort.by("createdAt").descending(), status);
    }

    public List<PairRequest> findByTournament_Id(Long tournamentId) {
        return list("tournament.id = ?1", Sort.by("createdAt").descending(), tournamentId);
    }
}
