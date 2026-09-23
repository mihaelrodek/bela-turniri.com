package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.GameResultPlayer;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class GameResultPlayerRepository implements AppRepository<GameResultPlayer, Long> {

    /**
     * One tally row per category actually played by a user.
     *
     * @param targetScore 163, 501, 701 or 1001
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
     *
     * <p>ELIGIBLE ONLY (2026-09-22). This is the personal, competitive record
     * — the one shown on the profile — so it keeps counting exactly the games
     * §8.1 always let it count. Since that date the reporter also sends the
     * ineligible ones (a person with three bots, a demo-lobby table) for the
     * admin analytics, and {@code g.eligible = true} is what stops them from
     * silently inflating anybody's win/loss record. A NULL never matches, and
     * the changeset backfilled every pre-existing row to TRUE.
     */
    public List<TargetScoreTally> tallyByTargetScore(String uid) {
        List<Object[]> rows = getEntityManager().createQuery("""
                        select g.targetScore,
                               count(p),
                               sum(case when p.won = true then 1 else 0 end)
                        from GameResultPlayer p
                        join p.gameResult g
                        where p.uid = :uid
                          and g.eligible = true
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

    /**
     * One row of the admin "who played" list — an account or a named guest.
     *
     * <p>ANALYTICS VIEW: {@code games}/{@code wins} count every RECORDED game
     * (§8.7), including the ones played against bots or against the demo
     * lobby, because the point of this list is "who has actually been on the
     * site". {@code rankedGames}/{@code rankedWins} are the §8.1-eligible
     * subset — the same number the player's own profile shows — so the admin
     * sees both without either one having to lie.
     *
     * @param uid          Firebase UID of a real account, or NULL for a guest
     *                     row (guests are grouped by {@code name} instead)
     * @param name         display name; NULL for an account row, where the
     *                     caller resolves the name from the profile instead
     * @param games        finished games recorded for it, eligible or not
     * @param wins         of those, games won
     * @param rankedGames  of those, the §8.1-eligible ones
     * @param rankedWins   of the eligible ones, games won
     * @param lastPlayedAt the newest {@code game_results.played_at} among them
     */
    public record PlayerTally(String uid, String name, long games, long wins,
                              long rankedGames, long rankedWins, OffsetDateTime lastPlayedAt) {}

    /**
     * The busiest real accounts, most games first.
     *
     * <p>ONE grouped query for the whole list — the per-player extras (name,
     * karma, abandons) are looked up in bulk by the caller from the uids this
     * returns, so no part of the admin list fans out per player.
     *
     * <p>{@code uid is not null} is the entire "real account" filter: a bot
     * seat has no uid by construction and a guest seat is rejected at write
     * time if it carries one ({@code GameStatsService.validateSeats}). The
     * {@code is_bot = false} clause is therefore redundant and deliberately
     * left in anyway — it is free (the rows are already loaded) and it keeps
     * the query honest if a future seat kind ever gets both.
     *
     * <p>NOT filtered by {@code eligible}: this is the analytics list, and
     * hiding a person's bot games here is precisely the bug this replaces.
     * The eligible subset travels alongside in {@code rankedGames}.
     *
     * @param limit hard cap on returned rows; the caller reports the true
     *              distinct total separately via {@link #countDistinctPlayers()}
     */
    public List<PlayerTally> topPlayers(int limit) {
        List<Object[]> rows = getEntityManager().createQuery("""
                        select p.uid,
                               count(p),
                               sum(case when p.won = true then 1 else 0 end),
                               sum(case when g.eligible = true then 1 else 0 end),
                               sum(case when g.eligible = true and p.won = true then 1 else 0 end),
                               max(g.playedAt)
                        from GameResultPlayer p
                        join p.gameResult g
                        where p.uid is not null and p.bot = false
                        group by p.uid
                        order by count(p) desc, max(g.playedAt) desc
                        """, Object[].class)
                .setMaxResults(Math.max(1, limit))
                .getResultList();

        List<PlayerTally> out = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            out.add(new PlayerTally(
                    (String) row[0], null,
                    ((Number) row[1]).longValue(),
                    asLong(row[2]), asLong(row[3]), asLong(row[4]),
                    (OffsetDateTime) row[5]));
        }
        return out;
    }

    /**
     * The busiest GUESTS, grouped by the name they played under.
     *
     * <p>A guest has no identifier by design — {@code GameStatsService}
     * rejects a guest seat that carries a uid — so the name is the only thing
     * there is to group by, and two different people who both typed "Ivan"
     * merge into one row. That is a real limitation of guest play, not a bug
     * to be fixed here, and the admin UI says so in a note.
     *
     * <p>Seats recorded before 2026-09-22 have no {@code player_name} at all
     * and are therefore absent from this list; they still show up in
     * {@link #anonymousSeatTally()}'s guest counters.
     */
    public List<PlayerTally> topGuests(int limit) {
        List<Object[]> rows = getEntityManager().createQuery("""
                        select p.playerName,
                               count(p),
                               sum(case when p.won = true then 1 else 0 end),
                               sum(case when g.eligible = true then 1 else 0 end),
                               sum(case when g.eligible = true and p.won = true then 1 else 0 end),
                               max(g.playedAt)
                        from GameResultPlayer p
                        join p.gameResult g
                        where p.uid is null and p.bot = false
                          and p.playerName is not null
                        group by p.playerName
                        order by count(p) desc, max(g.playedAt) desc
                        """, Object[].class)
                .setMaxResults(Math.max(1, limit))
                .getResultList();

        List<PlayerTally> out = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            out.add(new PlayerTally(
                    null, (String) row[0],
                    ((Number) row[1]).longValue(),
                    asLong(row[2]), asLong(row[3]), asLong(row[4]),
                    (OffsetDateTime) row[5]));
        }
        return out;
    }

    /**
     * How many distinct real accounts appear in any recorded game.
     *
     * <p>Analytics view, so deliberately NOT filtered by {@code eligible}:
     * somebody who has only ever played against bots has still played.
     */
    public long countDistinctPlayers() {
        return getEntityManager().createQuery("""
                        select count(distinct p.uid)
                        from GameResultPlayer p
                        where p.uid is not null and p.bot = false
                        """, Long.class)
                .getSingleResult();
    }

    /**
     * Seats played by someone who is NOT a real account, split by kind.
     *
     * <p>Aggregate counters only, and deliberately unfiltered by
     * {@code eligible} — this is the analytics side. Guest seats from before
     * 2026-09-22 carry no name and can only ever be counted here; newer guest
     * seats are ALSO listed by name via {@link #topGuests(int)}, so the two
     * numbers overlap on purpose (seats vs. people).
     *
     * @return {@code [guestSeats, guestWins, botSeats, demoSeats]}
     */
    public long[] anonymousSeatTally() {
        Object[] row = getEntityManager().createQuery("""
                        select sum(case when p.uid is null and p.bot = false then 1 else 0 end),
                               sum(case when p.uid is null and p.bot = false and p.won = true then 1 else 0 end),
                               sum(case when p.bot = true and (p.playerKind is null or p.playerKind <> 'DEMO') then 1 else 0 end),
                               sum(case when p.playerKind = 'DEMO' then 1 else 0 end)
                        from GameResultPlayer p
                        """, Object[].class)
                .getSingleResult();
        return new long[]{ asLong(row[0]), asLong(row[1]), asLong(row[2]), asLong(row[3]) };
    }

    private static long asLong(Object value) {
        return value == null ? 0L : ((Number) value).longValue();
    }

    /**
     * Finished games this user actually played inside a time window.
     *
     * <p>Used by the karma popup (2026-09-21): "napustio X od Y partija u
     * zadnjih 30 dana", where Y is this count plus the abandons.
     *
     * <p>ELIGIBLE ONLY. Until 2026-09-22 that was true by construction — the
     * game server reported nothing else — and the comment here said so. Now
     * that §8.7 also records games played against bots and demo people, the
     * filter has to be written out, because letting a bot game into the
     * denominator would quietly soften everyone's abandon rate.
     *
     * <p>A bot seat carries a NULL uid and can never match, so no
     * {@code is_bot} filter is needed.
     */
    public long countGamesSince(String uid, OffsetDateTime since) {
        if (uid == null || uid.isBlank()) return 0;
        return getEntityManager().createQuery("""
                        select count(p)
                        from GameResultPlayer p
                        join p.gameResult g
                        where p.uid = :uid
                          and g.playedAt > :since
                          and g.eligible = true
                        """, Long.class)
                .setParameter("uid", uid)
                .setParameter("since", since)
                .getSingleResult();
    }

    /**
     * The same count for many uids in ONE query, so a caller holding a list of
     * seats never fans out into a query per player. Uids with no games in the
     * window are absent from the map and read as zero.
     *
     * <p>Same {@code eligible = true} filter as the single-uid version, for
     * the same reason — the two must not disagree about what a "game played"
     * is, or the karma popup would contradict itself between the seat pill
     * and the profile card.
     */
    public Map<String, Long> countGamesSinceByUid(Collection<String> uids, OffsetDateTime since) {
        if (uids == null || uids.isEmpty()) return Map.of();
        List<Object[]> rows = getEntityManager().createQuery("""
                        select p.uid, count(p)
                        from GameResultPlayer p
                        join p.gameResult g
                        where p.uid in :uids
                          and g.playedAt > :since
                          and g.eligible = true
                        group by p.uid
                        """, Object[].class)
                .setParameter("uids", uids)
                .setParameter("since", since)
                .getResultList();

        Map<String, Long> out = new HashMap<>(rows.size());
        for (Object[] row : rows) {
            out.put((String) row[0], ((Number) row[1]).longValue());
        }
        return out;
    }
}
