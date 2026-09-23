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
                                         Short dealsCount,
                                         boolean eligible) {
        int inserted = getEntityManager().createNativeQuery("""
                        insert into game_results
                            (uuid, played_at, target_score, winner_team, score_a, score_b, deals_count, eligible)
                        values (:uuid, :playedAt, :targetScore, :winnerTeam, :scoreA, :scoreB, :dealsCount, :eligible)
                        on conflict (uuid) do nothing
                        """)
                .setParameter("uuid", uuid)
                .setParameter("playedAt", playedAt)
                .setParameter("targetScore", targetScore)
                .setParameter("winnerTeam", winnerTeam)
                .setParameter("scoreA", scoreA)
                .setParameter("scoreB", scoreB)
                .setParameter("dealsCount", dealsCount)
                .setParameter("eligible", eligible)
                .executeUpdate();
        if (inserted == 0) return Optional.empty();
        return findIdByUuid(uuid);
    }

    /**
     * Two admin-analytics counters about the COMPANY a real person kept,
     * folded into one query because they read the same rows.
     *
     * <ul>
     *   <li>{@code demoGames} — recorded games with at least one DEMO seat: a
     *       real person played against the demo lobby's fake people. Before
     *       2026-09-22 these were never reported at all, which is half of why
     *       the dashboard showed nobody.</li>
     *   <li>{@code botOnlyGames} — recorded games that §8.1 rejected and that
     *       held no fake person: a real person alone with bots. Defined by
     *       what the game was NOT eligible for rather than by counting bots,
     *       so it cannot drift away from the eligibility rule.</li>
     * </ul>
     *
     * <p>Counted over recorded games, so both are 0 for any database whose
     * rows all predate the change — nothing false is ever reported.
     *
     * @return {@code [demoGames, botOnlyGames]}
     */
    public long[] companyGameTally() {
        Object[] row = getEntityManager().createQuery("""
                        select sum(case when exists (
                                     select 1 from GameResultPlayer d
                                     where d.gameResult = g and d.playerKind = 'DEMO')
                                   then 1 else 0 end),
                               sum(case when g.eligible = false and not exists (
                                     select 1 from GameResultPlayer d
                                     where d.gameResult = g and d.playerKind = 'DEMO')
                                   then 1 else 0 end)
                        from GameResult g
                        """, Object[].class)
                .getSingleResult();
        return new long[]{ asLong(row[0]), asLong(row[1]) };
    }

    private static long asLong(Object value) {
        return value == null ? 0L : ((Number) value).longValue();
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
