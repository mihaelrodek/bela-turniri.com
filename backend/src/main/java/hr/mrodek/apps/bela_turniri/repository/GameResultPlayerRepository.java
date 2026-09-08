package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.GameResultPlayer;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class GameResultPlayerRepository implements AppRepository<GameResultPlayer, Long> {

    /**
     * One tally row per category actually played by a user.
     *
     * @param targetScore 501, 701 or 1001
     * @param games       games played in that category
     * @param wins        of those, games won
     */
    public record TargetScoreTally(int targetScore, long games, long wins) {
        public long losses() {
            return games - wins;
        }
    }

    /**
     * Per-category game/win counts for one Firebase UID.
     *
     * <p>Deliberately ONE query for the whole statistics endpoint: the global
     * row and every win rate are folded up in Java from these (at most three)
     * tallies, because a second "and now without the filter" query would read
     * the same rows again and could, under a concurrent insert, disagree with
     * the per-category numbers it is supposed to be the sum of.
     *
     * <p>{@code won} is denormalised onto the player row, so the join to
     * {@code game_results} exists only to reach {@code target_score} — the
     * filter itself is served by {@code idx_game_result_players_uid}.
     *
     * <p>Bot seats have a NULL uid and can never match a real UID, so no
     * explicit {@code is_bot} filter is needed here.
     */
    public List<TargetScoreTally> tallyByTargetScore(String uid) {
        List<Object[]> rows = getEntityManager().createQuery("""
                        select g.targetScore,
                               count(p),
                               sum(case when p.won = true then 1 else 0 end)
                        from GameResultPlayer p
                        join p.gameResult g
                        where p.uid = :uid
                        group by g.targetScore
                        order by g.targetScore
                        """, Object[].class)
                .setParameter("uid", uid)
                .getResultList();

        List<TargetScoreTally> out = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            // Widths vary by dialect/provider (smallint -> Short, sum -> Long
            // or BigInteger), so normalise through Number rather than casting.
            out.add(new TargetScoreTally(
                    ((Number) row[0]).intValue(),
                    ((Number) row[1]).longValue(),
                    row[2] == null ? 0L : ((Number) row[2]).longValue()));
        }
        return out;
    }
}
