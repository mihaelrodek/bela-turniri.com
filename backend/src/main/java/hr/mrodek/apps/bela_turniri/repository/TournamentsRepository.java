package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.Tournaments;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class TournamentsRepository implements AppRepository<Tournaments, Long> {

    public Optional<Tournaments> findByUuid(UUID uuid) {
        return find("uuid", uuid).firstResultOptional();
    }

    public boolean existsByUuid(UUID uuid) {
        return count("uuid", uuid) > 0;
    }

    public List<Tournaments> findByStartAtBeforeOrderByStartAtDesc(OffsetDateTime now) {
        return list("startAt < ?1", Sort.by("startAt").descending(), now);
    }

    public List<Tournaments> findByStartAtGreaterThanEqualOrderByStartAtAsc(OffsetDateTime now) {
        return list("startAt >= ?1", Sort.by("startAt").ascending(), now);
    }
}
