package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.MatchScoreLink;
import io.quarkus.panache.common.Parameters;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Blok ↔ table links (see {@code BLOK-LINK.md}).
 *
 * <p>Every listing query join-fetches the whole graph the DTO dereferences —
 * tournament, match, round, both pairs and the "us" pair. Without it a
 * ten-row organiser list costs ~50 lazy loads, because the mapper reads a
 * name off each side of every match.
 *
 * <p>"Active" means {@code PENDING} or {@code APPROVED}: exactly the two
 * states the partial unique index {@code uq_msl_active_per_match} covers.
 */
@ApplicationScoped
public class MatchScoreLinkRepository implements AppRepository<MatchScoreLink, Long> {

    /** Shared prefix: the link plus everything a {@code BlokLinkDto} touches. */
    private static final String WITH_GRAPH = """
            from MatchScoreLink l
            join fetch l.tournament t
            join fetch l.match m
            join fetch m.round r
            left join fetch m.pair1
            left join fetch m.pair2
            join fetch l.usPair
            """;

    public Optional<MatchScoreLink> findByUuid(UUID uuid) {
        if (uuid == null) return Optional.empty();
        return find(WITH_GRAPH + " where l.uuid = :uuid", Parameters.with("uuid", uuid))
                .firstResultOptional();
    }

    /**
     * The link currently occupying this match's single active slot, if any.
     * Used to answer {@code LINK_EXISTS} before the database index has to.
     */
    public Optional<MatchScoreLink> findActiveByMatchId(Long matchId) {
        if (matchId == null) return Optional.empty();
        return find("""
                from MatchScoreLink l
                where l.match.id = :mid
                  and l.status in (hr.mrodek.apps.bela_turniri.enums.MatchScoreLinkStatus.PENDING,
                                   hr.mrodek.apps.bela_turniri.enums.MatchScoreLinkStatus.APPROVED)
                """, Parameters.with("mid", matchId)).firstResultOptional();
    }

    /**
     * Match ids of this tournament that already have an active link — one
     * query behind the whole {@code /blok-links/targets} listing, so the
     * "linkable" flag costs nothing per row.
     */
    public List<Long> findActiveMatchIdsByTournamentId(Long tournamentId) {
        if (tournamentId == null) return List.of();
        return getEntityManager().createQuery("""
                        select l.match.id from MatchScoreLink l
                        where l.tournament.id = :tid
                          and l.status in (hr.mrodek.apps.bela_turniri.enums.MatchScoreLinkStatus.PENDING,
                                           hr.mrodek.apps.bela_turniri.enums.MatchScoreLinkStatus.APPROVED)
                        """, Long.class)
                .setParameter("tid", tournamentId)
                .getResultList();
    }

    /**
     * Of the given match ids, the ones that already carry an active link —
     * the §8.1(5) filter behind {@code GET /blok-links/suggestions}, done in
     * one query instead of a probe per candidate.
     *
     * <p>Deliberately not {@link #findActiveMatchIdsByTournamentId}: a
     * suggestion set spans several tournaments (a player may be registered on
     * more than one), and asking per tournament would be one query per
     * tournament to answer a question about a handful of matches.
     */
    public List<Long> findActiveMatchIdsIn(java.util.Collection<Long> matchIds) {
        if (matchIds == null || matchIds.isEmpty()) return List.of();
        return getEntityManager().createQuery("""
                        select l.match.id from MatchScoreLink l
                        where l.match.id in :mids
                          and l.status in (hr.mrodek.apps.bela_turniri.enums.MatchScoreLinkStatus.PENDING,
                                           hr.mrodek.apps.bela_turniri.enums.MatchScoreLinkStatus.APPROVED)
                        """, Long.class)
                .setParameter("mids", matchIds)
                .getResultList();
    }

    /**
     * Every link of one tournament, PENDING first (that is the organiser's
     * to-do list), then newest first inside each group.
     */
    public List<MatchScoreLink> findByTournamentIdForOrganiser(Long tournamentId) {
        if (tournamentId == null) return List.of();
        return list(WITH_GRAPH + """
                where l.tournament.id = :tid
                order by case when l.status = hr.mrodek.apps.bela_turniri.enums.MatchScoreLinkStatus.PENDING
                              then 0 else 1 end asc,
                         l.createdAt desc, l.id desc
                """, Parameters.with("tid", tournamentId));
    }

    /** Every link the given player asked for, newest first. */
    public List<MatchScoreLink> findByRequestedByUid(String uid) {
        if (uid == null || uid.isBlank()) return List.of();
        return list(WITH_GRAPH + """
                where l.requestedByUid = :uid
                order by l.createdAt desc, l.id desc
                """, Parameters.with("uid", uid));
    }
}
