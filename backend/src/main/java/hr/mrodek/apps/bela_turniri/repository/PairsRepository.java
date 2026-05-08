package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.Pairs;
import io.quarkus.hibernate.orm.panache.Panache;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class PairsRepository implements AppRepository<Pairs, Long> {

    public List<Pairs> findByTournament_Id(Long tournamentId) {
        return list("tournament.id", tournamentId);
    }

    /**
     * Pairs the user has played as. We match in two ways:
     *   - direct: pair was self-registered with the user's UID, OR
     *   - by-name: pair has no submittedByUid (organizer-added or pre-self-register
     *     legacy) AND its name matches one of the user's saved pair-presets,
     *     case-insensitive.
     *
     * The by-name fallback covers tournaments that finished before self-register
     * existed, plus organizers who add their own pair via "Dodaj par" — they
     * still want to see those in their personal history.
     *
     * Pass an empty list of presets to skip the by-name OR clause entirely.
     */
    @SuppressWarnings("unchecked")
    public List<Pairs> findMyParticipations(String uid, java.util.Collection<String> presetNames) {
        if (uid == null || uid.isBlank()) return List.of();

        java.util.List<String> lowered = presetNames == null
                ? java.util.List.of()
                : presetNames.stream()
                        .filter(s -> s != null && !s.isBlank())
                        .map(s -> s.trim().toLowerCase())
                        .toList();

        StringBuilder jpql = new StringBuilder("""
                SELECT p FROM Pairs p
                JOIN FETCH p.tournament t
                WHERE p.submittedByUid = :uid
                """);
        if (!lowered.isEmpty()) {
            jpql.append(
                    " OR (p.submittedByUid IS NULL AND LOWER(TRIM(p.name)) IN :names)");
        }
        jpql.append(" ORDER BY t.startAt DESC NULLS LAST");

        var q = Panache.getEntityManager().createQuery(jpql.toString())
                .setParameter("uid", uid);
        if (!lowered.isEmpty()) q.setParameter("names", lowered);
        return q.getResultList();
    }

    public boolean existsByTournament_IdAndPaidFalse(Long tournamentId) {
        return count("tournament.id = ?1 and paid = false", tournamentId) > 0;
    }

    /**
     * Returns rows of [tournamentId, count] for the given tournament ids.
     * Implemented via {@code EntityManager} because Panache {@code find()} is
     * entity-shaped and not suited for projections / GROUP BY.
     */
    @SuppressWarnings("unchecked")
    public List<Object[]> countByTournamentIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return Panache.getEntityManager().createQuery("""
                        SELECT p.tournament.id, COUNT(p)
                        FROM Pairs p
                        WHERE p.tournament.id IN :ids
                        GROUP BY p.tournament.id
                        """)
                .setParameter("ids", ids)
                .getResultList();
    }
}
