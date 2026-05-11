package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import io.quarkus.panache.common.Page;
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

    public Optional<Tournaments> findBySlug(String slug) {
        if (slug == null || slug.isBlank()) return Optional.empty();
        return find("slug", slug).firstResultOptional();
    }

    /**
     * Resolve a path-segment that can be either a UUID (legacy URLs, action
     * endpoints) or a slug (new pretty URLs). Slug is tried after UUID parsing
     * fails so we don't pay an extra DB hit on the common UUID path.
     */
    public Optional<Tournaments> findByUuidOrSlug(String idOrSlug) {
        if (idOrSlug == null || idOrSlug.isBlank()) return Optional.empty();
        try {
            UUID uuid = UUID.fromString(idOrSlug);
            return findByUuid(uuid);
        } catch (IllegalArgumentException ignored) {
            // Not a UUID — fall through to slug lookup.
        }
        return findBySlug(idOrSlug);
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

    /**
     * "Finished" listing is gated on explicit {@code status == FINISHED} now,
     * not on the start date. A tournament's clock can pass {@code startAt}
     * while the organizer is still entering results — those rows belong in
     * the in-progress bucket, not under "Završeni". Paged so the SPA can
     * lazy-load older results behind a "Učitaj više" button.
     */
    public List<Tournaments> findFinishedPaged(int offset, int limit) {
        return find("status = ?1",
                Sort.by("startAt").descending(),
                TournamentStatus.FINISHED)
                .page(Page.of(offset / Math.max(1, limit), Math.max(1, limit)))
                .list();
    }

    public long countFinished() {
        return count("status = ?1", TournamentStatus.FINISHED);
    }

    /**
     * "Upcoming / in progress" listing — anything not yet {@code FINISHED}.
     * Mirrors the user's mental model where any tournament not explicitly
     * marked finished is treated as still alive, regardless of whether its
     * scheduled start has passed.
     */
    public List<Tournaments> findNotFinishedOrderByStartAtAsc() {
        return list("status <> ?1",
                Sort.by("startAt").ascending(),
                TournamentStatus.FINISHED);
    }
}
