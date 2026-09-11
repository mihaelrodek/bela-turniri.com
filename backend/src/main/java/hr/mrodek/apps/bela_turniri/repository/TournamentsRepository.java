package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
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

    /**
     * List queries all go through {@code TournamentMapper}, which builds the
     * poster URL from {@code t.getResource().getId()}. The association is
     * LAZY, so without this fetch join every card on every listing costs an
     * extra SELECT. It's a to-one join, so it also stays safe to paginate in
     * SQL (no in-memory pagination the way a collection fetch would force).
     */
    public List<Tournaments> findByStartAtBeforeOrderByStartAtDesc(OffsetDateTime now) {
        return list("""
                from Tournaments t
                left join fetch t.resource
                where t.startAt < ?1
                order by t.startAt desc
                """, now);
    }

    public List<Tournaments> findByStartAtGreaterThanEqualOrderByStartAtAsc(OffsetDateTime now) {
        return list("""
                from Tournaments t
                left join fetch t.resource
                where t.startAt >= ?1
                order by t.startAt asc
                """, now);
    }

    /**
     * Ids of tournaments that have a location but no coordinates yet — the
     * work list for the {@code /geocode-missing} backfill. Returns ids only
     * so the (slow, sleep-throttled) loop can run without a transaction and
     * without holding entities across it.
     */
    public List<Long> findIdsNeedingGeocode() {
        return getEntityManager().createQuery("""
                        select t.id
                        from Tournaments t
                        where t.location is not null
                          and t.location <> ''
                          and (t.latitude is null or t.longitude is null)
                        order by t.id asc
                        """, Long.class)
                .getResultList();
    }

    /**
     * "Finished" listing is gated on explicit {@code status == FINISHED} now,
     * not on the start date. A tournament's clock can pass {@code startAt}
     * while the organizer is still entering results — those rows belong in
     * the in-progress bucket, not under "Završeni". Paged so the SPA can
     * lazy-load older results behind a "Učitaj više" button.
     */
    public List<Tournaments> findFinishedPaged(int offset, int limit) {
        return findFinishedPaged(offset, limit, null);
    }

    /**
     * Same as {@link #findFinishedPaged(int, int)}, plus an optional
     * case-insensitive name-or-location filter for the "Završeni turniri"
     * search group on the tournaments page. {@code q} is expected already
     * trimmed and length-checked by the controller (blank/short queries mean
     * "no filter" here too, so this stays safe to call directly).
     */
    public List<Tournaments> findFinishedPaged(int offset, int limit, String q) {
        String pattern = likePattern(q);
        String hql = "from Tournaments t left join fetch t.resource where t.status = ?1"
                + (pattern != null
                        ? " and (lower(t.name) like ?2 escape '\\' or lower(t.location) like ?2 escape '\\')"
                        : "")
                + " order by t.startAt desc";
        var query = pattern != null
                ? find(hql, TournamentStatus.FINISHED, pattern)
                : find(hql, TournamentStatus.FINISHED);
        return query.range(Math.max(0, offset), lastIndex(offset, limit)).list();
    }

    /**
     * Builds a {@code lower(column) like ?} pattern for a search box query:
     * lower-cased and wrapped in {@code %...%}, with {@code %}, {@code _} and
     * the escape character itself backslash-escaped so user-typed wildcards
     * can't widen the match. Returns {@code null} for a blank/absent query so
     * callers can skip the filter clause entirely instead of matching
     * everything with {@code %%}.
     *
     * <p>Plain {@code lower()} rather than Postgres {@code ILIKE} — case
     * folding works the same everywhere and there's no
     * {@code CREATE EXTENSION unaccent} in the changelog yet, so this is
     * intentionally NOT accent-insensitive ("čevap" won't match "cevap").
     */
    private static String likePattern(String q) {
        if (q == null) return null;
        String trimmed = q.trim();
        if (trimmed.isEmpty()) return null;
        String escaped = trimmed
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
        return "%" + escaped.toLowerCase() + "%";
    }

    /**
     * Inclusive end index for a {@code range(first, last)} window.
     *
     * <p>Both paged finders used to say {@code Page.of(offset / limit, limit)},
     * which can only ever express a window starting on a multiple of the page
     * size: {@code offset=25, limit=20} floored to page 1 and returned rows
     * 20-39, so the caller silently re-received five rows it already had and
     * never saw the last five of the page it asked for. {@code range} takes
     * the offset literally. Saturating arithmetic because
     * {@code TournamentController.list} passes {@code Integer.MAX_VALUE} as
     * the "no limit" sentinel.
     */
    private static int lastIndex(int offset, int limit) {
        long first = Math.max(0, offset);
        long span = Math.max(1L, (long) limit);
        return (int) Math.min(first + span - 1L, Integer.MAX_VALUE);
    }

    public long countFinished() {
        return countFinished(null);
    }

    /** Same as {@link #countFinished()}, filtered by the same name-or-location
     *  pattern as {@link #findFinishedPaged(int, int, String)} — feeds the
     *  "prikaži još" button under the finished-search group. */
    public long countFinished(String q) {
        String pattern = likePattern(q);
        if (pattern == null) {
            return count("status = ?1", TournamentStatus.FINISHED);
        }
        return count("status = ?1 and (lower(name) like ?2 escape '\\' or lower(location) like ?2 escape '\\')",
                TournamentStatus.FINISHED, pattern);
    }

    /**
     * "Upcoming / in progress" listing — anything not yet {@code FINISHED}.
     * Mirrors the user's mental model where any tournament not explicitly
     * marked finished is treated as still alive, regardless of whether its
     * scheduled start has passed.
     */
    public List<Tournaments> findNotFinishedOrderByStartAtAsc() {
        return list("""
                from Tournaments t
                left join fetch t.resource
                where t.status <> ?1
                order by t.startAt asc
                """, TournamentStatus.FINISHED);
    }

    /**
     * Paged variant of {@link #findByStartAtGreaterThanEqualOrderByStartAtAsc}.
     * The SEO preview pages only ever render the first 30 upcoming
     * tournaments, but were loading every future row and then calling
     * {@code subList(0, 30)} — the DB did all the work and the JVM threw it
     * away. LIMIT in SQL instead.
     *
     * <p>Same {@code left join fetch t.resource} as the other listings so the
     * poster URL doesn't cost an extra SELECT per row; safe to paginate in SQL
     * because it is a to-one association.
     */
    public List<Tournaments> findUpcomingPaged(OffsetDateTime from, int offset, int limit) {
        return find("""
                from Tournaments t
                left join fetch t.resource
                where t.startAt >= ?1
                order by t.startAt asc
                """, from)
                .range(Math.max(0, offset), lastIndex(offset, limit))
                .list();
    }

    /**
     * Tournaments the given Firebase UID created — feeds the "Učitaj iz
     * predloška" picker on the create-tournament wizard, so an organiser can
     * seed a new tournament from one they ran before instead of retyping
     * kotizacija/nagrade/kontakt every time.
     */
    public List<Tournaments> findByCreatedByUidOrderByStartAtDesc(String uid) {
        return list("""
                from Tournaments t
                left join fetch t.resource
                where t.createdByUid = ?1
                order by t.startAt desc
                """, uid);
    }
}
