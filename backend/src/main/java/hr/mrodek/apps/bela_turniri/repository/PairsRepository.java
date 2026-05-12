package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.Pairs;
import io.quarkus.panache.common.Parameters;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;

import java.util.Collection;
import java.util.List;

@ApplicationScoped
public class PairsRepository implements AppRepository<Pairs, Long> {

    /**
     * CDI-injected {@link EntityManager} for tuple-shaped projections that
     * Panache's entity-only {@code find()} can't express (e.g. GROUP BY
     * returning {@code Object[]} rows). Same EM instance Panache uses
     * internally.
     */
    @Inject EntityManager em;

    public List<Pairs> findByTournament_Id(Long tournamentId) {
        return list("tournament.id", tournamentId);
    }

    /** Single-pair lookup by claim token (the share URL). */
    public java.util.Optional<Pairs> findByClaimToken(String token) {
        if (token == null || token.isBlank()) return java.util.Optional.empty();
        return find("claimToken", token).firstResultOptional();
    }

    /**
     * True if the given user has at least one Pair with the given name
     * (case-insensitive, trimmed) where a partner has claimed co-ownership
     * via the share link. Used by the preset DELETE flow to prevent the
     * owner from removing a name that's anchoring someone else's history.
     */
    public boolean existsClaimedPairForUserByName(String userUid, String name) {
        if (userUid == null || name == null) return false;
        String needle = name.trim().toLowerCase();
        if (needle.isEmpty()) return false;
        return count(
                "submittedByUid = ?1 and coSubmittedByUid is not null " +
                "and lower(trim(name)) = ?2",
                userUid, needle
        ) > 0;
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
    public List<Pairs> findMyParticipations(String uid, Collection<String> presetNames) {
        if (uid == null || uid.isBlank()) return List.of();

        List<String> lowered = presetNames == null
                ? List.of()
                : presetNames.stream()
                        .filter(s -> s != null && !s.isBlank())
                        .map(s -> s.trim().toLowerCase())
                        .toList();

        // Build the JPQL dynamically — the OR-by-name clause is only added
        // when the user has saved pair-name presets. Stays on Panache:
        // entity-shaped result, full "from" prefix tells Panache this is
        // a complete query, named params via Parameters builder.
        // Co-owned pairs (claimed via the share link) also count — they
        // show on the claimer's profile just like their own self-registrations.
        StringBuilder jpql = new StringBuilder("""
                from Pairs p
                join fetch p.tournament t
                where p.submittedByUid = :uid
                   or p.coSubmittedByUid = :uid
                """);
        Parameters params = Parameters.with("uid", uid);
        if (!lowered.isEmpty()) {
            jpql.append(" or (p.submittedByUid is null and p.coSubmittedByUid is null and lower(trim(p.name)) in :names)");
            params = params.and("names", lowered);
        }
        jpql.append(" order by t.startAt desc nulls last");

        return list(jpql.toString(), params);
    }

    public boolean existsByTournament_IdAndPaidFalse(Long tournamentId) {
        return count("tournament.id = ?1 and paid = false", tournamentId) > 0;
    }

    /**
     * Returns rows of {@code [tournamentId, count]} for the given tournament
     * ids. Tuple-shaped projection — Panache {@code find()} is entity-shaped
     * and can't return {@code Object[]} from GROUP BY, so this goes through
     * the injected EntityManager.
     */
    @SuppressWarnings("unchecked")
    public List<Object[]> countByTournamentIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return em.createQuery("""
                        select p.tournament.id, count(p)
                        from Pairs p
                        where p.tournament.id in :ids
                        group by p.tournament.id
                        """)
                .setParameter("ids", ids)
                .getResultList();
    }
}
