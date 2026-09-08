package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.GameResult;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class GameResultRepository implements AppRepository<GameResult, Long> {

    /**
     * Insert a reported game, or do nothing if its {@code uuid} is already
     * recorded. Returns the row id on a fresh insert, {@link Optional#empty()}
     * when this was a replay.
     *
     * <p>Native {@code INSERT … ON CONFLICT DO NOTHING} rather than
     * {@code persist()} + catching the unique violation, for exactly the
     * reason spelled out in {@code IdempotencyService}: a JPA constraint
     * violation dooms the persistence context, so the "already recorded, just
     * answer false" branch would have no working session left to run in. Here
     * the conflict simply produces an update count of 0 and never throws.
     *
     * <p>Two statements instead of {@code … RETURNING id}: a native query
     * that both mutates and returns rows is not portably expressible through
     * Hibernate's {@code executeUpdate}/{@code getResultList} split, and the
     * follow-up lookup is a single hit on the unique index we just used.
     *
     * <p>Must run inside the caller's transaction, so a rolled-back report
     * leaves no row and the next retry can insert normally.
     */
    public Optional<Long> insertIfAbsent(UUID uuid,
                                         OffsetDateTime playedAt,
                                         short targetScore,
                                         String winnerTeam,
                                         int scoreA,
                                         int scoreB,
                                         Short dealsCount) {
        int inserted = getEntityManager().createNativeQuery("""
                        insert into game_results
                            (uuid, played_at, target_score, winner_team, score_a, score_b, deals_count)
                        values (:uuid, :playedAt, :targetScore, :winnerTeam, :scoreA, :scoreB, :dealsCount)
                        on conflict (uuid) do nothing
                        """)
                .setParameter("uuid", uuid)
                .setParameter("playedAt", playedAt)
                .setParameter("targetScore", targetScore)
                .setParameter("winnerTeam", winnerTeam)
                .setParameter("scoreA", scoreA)
                .setParameter("scoreB", scoreB)
                .setParameter("dealsCount", dealsCount)
                .executeUpdate();
        if (inserted == 0) return Optional.empty();
        return findIdByUuid(uuid);
    }

    /** Row id for a reported game uuid, if it has been recorded. */
    public Optional<Long> findIdByUuid(UUID uuid) {
        return getEntityManager()
                .createQuery("select g.id from GameResult g where g.uuid = :uuid", Long.class)
                .setParameter("uuid", uuid)
                .getResultStream()
                .findFirst();
    }
}
