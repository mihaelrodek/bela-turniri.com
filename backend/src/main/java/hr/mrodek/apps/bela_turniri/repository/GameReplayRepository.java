package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.GameReplay;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Reads and writes for "zapisi partija" (game/README.md §8.8).
 *
 * <p>Three callers and no more: the intake ({@code GameStatsService.record}),
 * the admin export ({@code AdminGameReplaysController}) and the nightly
 * retention sweep. Nothing ever queries INSIDE the JSON document — that is
 * the whole premise of storing it as one jsonb blob — so there is no method
 * here that does.
 */
@ApplicationScoped
public class GameReplayRepository implements AppRepository<GameReplay, Long> {

    /** One line of the NDJSON export: the game's identity plus its document. */
    public record ExportRow(UUID resultId,
                            OffsetDateTime playedAt,
                            String botVersion,
                            Integer sizeBytes,
                            String replay) {}

    /**
     * Newest games first, optionally bounded by the game's {@code played_at}.
     *
     * <p>Ordered and filtered by {@code game_results.played_at} rather than
     * by the replay's own {@code created_at}: "since" means "games played
     * since", which is the question an owner dumping an archive is actually
     * asking, and the two differ by however long the report took to arrive.
     *
     * <p>A constructor projection, so the export never materialises entities
     * (or their lazy {@code GameResult} proxies) for rows it will stream
     * straight out as text.
     */
    public List<ExportRow> export(OffsetDateTime since, OffsetDateTime until, int limit) {
        return getEntityManager().createQuery("""
                        select new hr.mrodek.apps.bela_turniri.repository.GameReplayRepository$ExportRow(
                                   g.uuid, g.playedAt, r.botVersion, r.sizeBytes, r.replay)
                        from GameReplay r join r.gameResult g
                        where (:since is null or g.playedAt >= :since)
                          and (:until is null or g.playedAt < :until)
                        order by g.playedAt desc, r.id desc
                        """, ExportRow.class)
                .setParameter("since", since)
                .setParameter("until", until)
                .setMaxResults(limit)
                .getResultList();
    }

    /** The replay of one reported game, by the reporter's own {@code resultId}. */
    public Optional<ExportRow> findByResultUuid(UUID resultId) {
        return getEntityManager().createQuery("""
                        select new hr.mrodek.apps.bela_turniri.repository.GameReplayRepository$ExportRow(
                                   g.uuid, g.playedAt, r.botVersion, r.sizeBytes, r.replay)
                        from GameReplay r join r.gameResult g
                        where g.uuid = :resultId
                        """, ExportRow.class)
                .setParameter("resultId", resultId)
                .getResultStream()
                .findFirst();
    }

    /**
     * Delete replays of games played before {@code cutoff}.
     *
     * <p>A bulk statement: there is nothing to load, and pulling half a year
     * of documents into the persistence context to delete them one by one
     * would be the only slow way to do this. The {@code game_results} rows
     * themselves are NOT touched — the statistics are permanent, only the
     * research material expires.
     */
    public int deleteOlderThan(OffsetDateTime cutoff) {
        return getEntityManager().createQuery("""
                        delete from GameReplay r
                        where r.gameResult.id in (
                            select g.id from GameResult g where g.playedAt < :cutoff)
                        """)
                .setParameter("cutoff", cutoff)
                .executeUpdate();
    }
}
