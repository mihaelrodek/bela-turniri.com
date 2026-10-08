package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.dtos.BrDtos;
import hr.mrodek.apps.bela_turniri.dtos.BrResultReportRequest;
import hr.mrodek.apps.bela_turniri.services.BrRatingEngine;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;

import java.time.*;
import java.util.*;

/** BR owns its tables. Every writer takes the same DB lock in the caller's transaction. */
@ApplicationScoped
public class BrRatingRepository {
    @Inject EntityManager em;

    public record StoredRating(String uid, String name, double mu, double sigma, int br,
                               int bestBr, int games, int wins, OffsetDateTime lastPlayedAt) {}

    public void lock() {
        // Serialises overlapping matches, calibration, snapshots and season rollover across backend replicas.
        query("select id from br_control where id = 1 for update", Map.of()).getSingleResult();
    }

    public Optional<Boolean> duplicate(UUID matchId, String report) {
        var rows = query("select report = cast(:report as jsonb) from br_matches where match_id = :id",
                Map.of("id", matchId, "report", report)).getResultList();
        return rows.isEmpty() ? Optional.empty() : Optional.of(Boolean.TRUE.equals(rows.getFirst()));
    }

    public void season(String id, OffsetDateTime start, OffsetDateTime end) {
        execute("""
                insert into br_seasons(id, starts_at, ends_at) values (:id, :start, :end)
                on conflict (id) do nothing
                """, Map.of("id", id, "start", start, "end", end));
    }

    public String reviewFlag(BrResultReportRequest body, String roster) {
        // Review signal, not proof of abuse: repeat opponents are normal in a small community.
        long count = ((Number) query("""
                select count(*) from br_matches
                where outcome <> 'CANCELLED' and finished_at >= :fromTime and finished_at <= :toTime
                  and report -> 'players' @> cast(:roster as jsonb)
                """, Map.of("fromTime", body.finishedAt().minusHours(24), "toTime", body.finishedAt(),
                "roster", roster)).getSingleResult()).longValue();
        return count >= 3 ? "REPEATED_ROSTER_24H" : null;
    }

    public void match(UUID id, String season, BrResultReportRequest body, String report, String flag) {
        var params = new HashMap<String, Object>();
        params.put("id", id); params.put("season", season); params.put("room", body.roomId());
        params.put("start", body.startedAt()); params.put("end", body.finishedAt());
        params.put("outcome", body.outcome()); params.put("winner", body.winnerTeam());
        params.put("policy", body.policyVersion()); params.put("algorithm", BrRatingEngine.VERSION);
        params.put("flag", flag); params.put("report", report);
        execute("""
                insert into br_matches(match_id, season_id, room_id, started_at, finished_at,
                    outcome, winner_team, policy_version, algorithm_version, review_flag, report)
                values (:id, :season, :room, :start, :end, :outcome, :winner, :policy, :algorithm, :flag,
                    cast(:report as jsonb))
                """, params);
    }

    public StoredRating ensureRating(BrResultReportRequest.Player p) {
        execute("insert into br_ratings(uid, player_name) values (:uid, :name) on conflict (uid) do nothing",
                Map.of("uid", p.uid(), "name", p.name()));
        return stored(p.uid()).orElseThrow();
    }

    public Optional<StoredRating> stored(String uid) {
        List<?> rows = query("""
                select uid, player_name, mu, sigma, br, best_br, games, wins, last_played_at
                from br_ratings where uid = :uid
                """, Map.of("uid", uid)).getResultList();
        if (rows.isEmpty()) return Optional.empty();
        Object[] r = (Object[]) rows.getFirst();
        return Optional.of(new StoredRating((String) r[0], (String) r[1], num(r[2]).doubleValue(),
                num(r[3]).doubleValue(), integer(r[4]), integer(r[5]), integer(r[6]), integer(r[7]), time(r[8])));
    }

    public void adjustment(UUID match, String season, BrResultReportRequest.Player p, StoredRating before,
                           double mu, double sigma, int br, boolean won, OffsetDateTime playedAt) {
        var params = new HashMap<String, Object>();
        params.put("match", match); params.put("season", season); params.put("uid", p.uid());
        params.put("name", p.name()); params.put("seat", p.seat()); params.put("won", won);
        params.put("muBefore", before.mu()); params.put("sigmaBefore", before.sigma());
        params.put("brBefore", before.br()); params.put("mu", mu); params.put("sigma", sigma);
        params.put("br", br); params.put("win", won ? 1 : 0); params.put("played", playedAt);
        execute("""
                insert into br_rating_changes(match_id, uid, seat, won, mu_before, sigma_before,
                    br_before, mu_after, sigma_after, br_after)
                values (:match, :uid, :seat, :won, :muBefore, :sigmaBefore, :brBefore, :mu, :sigma, :br)
                """, params);
        execute("""
                update br_ratings set player_name = :name, mu = :mu, sigma = :sigma, br = :br,
                    best_br = greatest(best_br, :br), games = games + 1, wins = wins + :win,
                    last_played_at = greatest(last_played_at, :played) where uid = :uid
                """, params);
        execute("""
                insert into br_season_standings(season_id, uid, games, wins, br, best_br, last_played_at)
                values (:season, :uid, 1, :win, :br, :br, :played)
                on conflict (season_id, uid) do update set
                    games = br_season_standings.games + 1, wins = br_season_standings.wins + :win,
                    br = :br, best_br = greatest(br_season_standings.best_br, :br),
                    last_played_at = greatest(br_season_standings.last_played_at, :played)
                """, params);
    }

    public void refreshAwards(OffsetDateTime now) {
        // Rebuild tiny podiums from season records; late durable reports correct the archived podium too.
        execute("delete from br_season_awards where season_id in (select id from br_seasons where ends_at <= :now)",
                Map.of("now", now));
        execute("""
                insert into br_season_awards(season_id, place, uid, br, games, wins)
                select season_id, place, uid, br, games, wins from (
                    select s.*, row_number() over (partition by s.season_id order by s.br desc, s.games desc, s.uid) place
                    from br_season_standings s join br_seasons season on season.id = s.season_id
                    where season.ends_at <= :now and s.games >= 20
                      and s.last_played_at >= season.ends_at - interval '30 days'
                ) ranked where place <= 3
                """, Map.of("now", now));
    }

    public BrDtos.Ranking ranking(int offset, int limit, OffsetDateTime now) {
        Map<String, Object> params = Map.of("cutoff", now.minusDays(30));
        long total = num(query("select count(*) from br_ratings where games >= 20 and last_played_at >= :cutoff",
                params).getSingleResult()).longValue();
        List<?> rows = query("""
                select uid, player_name, mu, sigma, br, best_br, games, wins, last_played_at,
                       row_number() over (order by br desc, games desc, uid) place
                from br_ratings where games >= 20 and last_played_at >= :cutoff
                order by br desc, games desc, uid
                """, params).setFirstResult(offset).setMaxResults(limit).getResultList();
        var players = rows.stream().map(raw -> {
            Object[] r = (Object[]) raw;
            var stored = new StoredRating((String) r[0], (String) r[1], num(r[2]).doubleValue(), num(r[3]).doubleValue(),
                    integer(r[4]), integer(r[5]), integer(r[6]), integer(r[7]), time(r[8]));
            return dto(stored, num(r[9]).longValue(), total, now);
        }).toList();
        return new BrDtos.Ranking(total, players);
    }

    public BrDtos.Rating rating(String uid, OffsetDateTime now) {
        var r = stored(uid).orElse(null);
        if (r == null) return null;
        Object[] placement = (Object[]) query("""
                select count(*) + 1,
                    (select count(*) from br_ratings where games >= 20 and last_played_at >= :cutoff)
                from br_ratings where games >= 20 and last_played_at >= :cutoff
                  and (br > :br or (br = :br and games > :games) or (br = :br and games = :games and uid < :uid))
                """, Map.of("cutoff", now.minusDays(30), "br", r.br(), "games", r.games(), "uid", uid)).getSingleResult();
        Long place = r.games() >= 20 && r.lastPlayedAt() != null && !r.lastPlayedAt().isBefore(now.minusDays(30))
                ? num(placement[0]).longValue() : null;
        return dto(r, place, num(placement[1]).longValue(), now);
    }

    private BrDtos.Rating dto(StoredRating r, Long place, long population, OffsetDateTime now) {
        boolean active = r.lastPlayedAt() != null && !r.lastPlayedAt().isBefore(now.minusDays(30));
        return new BrDtos.Rating(r.uid(), r.name(), r.br(), r.bestBr(), r.games(), r.wins(), r.games() - r.wins(),
                r.mu(), r.sigma(), r.games() >= 20, active, place,
                BrRatingEngine.title(place == null ? 0 : place, population, r.games()), r.lastPlayedAt());
    }

    public List<BrDtos.Change> history(String uid, int offset, int limit) {
        List<?> rows = query("""
                select m.match_id, m.season_id, m.outcome, c.won, c.br_before, c.br_after,
                       c.mu_before, c.sigma_before, c.mu_after, c.sigma_after, m.finished_at,
                       m.review_flag, m.algorithm_version
                from br_rating_changes c join br_matches m on m.match_id = c.match_id
                where c.uid = :uid order by m.id desc
                """, Map.of("uid", uid)).setFirstResult(offset).setMaxResults(limit).getResultList();
        return rows.stream().map(raw -> {
            Object[] r = (Object[]) raw;
            return new BrDtos.Change(r[0].toString(), (String) r[1], (String) r[2], (Boolean) r[3], integer(r[4]),
                    integer(r[5]), integer(r[5]) - integer(r[4]), num(r[6]).doubleValue(), num(r[7]).doubleValue(),
                    num(r[8]).doubleValue(), num(r[9]).doubleValue(), time(r[10]), (String) r[11], (String) r[12]);
        }).toList();
    }

    public List<BrDtos.Season> seasons(OffsetDateTime now, int limit) {
        List<?> rows = query("select id, starts_at, ends_at from br_seasons order by starts_at desc", Map.of())
                .setMaxResults(limit).getResultList();
        return rows.stream().map(raw -> {
            Object[] r = (Object[]) raw;
            return new BrDtos.Season((String) r[0], time(r[1]), time(r[2]), !time(r[2]).isAfter(now));
        }).toList();
    }

    public BrDtos.SeasonRanking standings(String season, int offset, int limit, OffsetDateTime now) {
        var params = Map.<String, Object>of("season", season, "now", now);
        String eligible = """
                from br_season_standings s join br_seasons se on se.id = s.season_id
                join br_ratings r on r.uid = s.uid
                where s.season_id = :season and s.games >= 20
                  and s.last_played_at >= least(se.ends_at, :now) - interval '30 days'
                """;
        long total = num(query("select count(*) " + eligible, params).getSingleResult()).longValue();
        List<?> rows = query("""
                select s.uid, r.player_name, row_number() over (order by s.br desc, s.games desc, s.uid),
                       s.br, s.best_br, s.games, s.wins, s.last_played_at
                """ + eligible + " order by s.br desc, s.games desc, s.uid", params)
                .setFirstResult(offset).setMaxResults(limit).getResultList();
        return new BrDtos.SeasonRanking(season, total, rows.stream().map(raw -> {
            Object[] r = (Object[]) raw;
            return new BrDtos.Standing((String) r[0], (String) r[1], num(r[2]).longValue(), integer(r[3]),
                    integer(r[4]), integer(r[5]), integer(r[6]), time(r[7]));
        }).toList());
    }

    public List<BrDtos.Award> awards(int offset, int limit) {
        List<?> rows = query("""
                select a.season_id, a.place, a.uid, r.player_name, a.br, a.games, a.wins, a.awarded_at
                from br_season_awards a join br_ratings r on r.uid = a.uid
                order by a.season_id desc, a.place
                """, Map.of()).setFirstResult(offset).setMaxResults(limit).getResultList();
        return rows.stream().map(raw -> {
            Object[] r = (Object[]) raw;
            return new BrDtos.Award((String) r[0], integer(r[1]), (String) r[2], (String) r[3], integer(r[4]),
                    integer(r[5]), integer(r[6]), time(r[7]));
        }).toList();
    }

    private Query query(String sql, Map<String, Object> params) {
        Query query = em.createNativeQuery(sql);
        // Some write statements intentionally share one parameter bag; bind only parameters that this query uses.
        for (var parameter : query.getParameters()) query.setParameter(parameter.getName(), params.get(parameter.getName()));
        return query;
    }
    private void execute(String sql, Map<String, Object> params) { query(sql, params).executeUpdate(); }
    private static Number num(Object value) { return (Number) value; }
    private static int integer(Object value) { return num(value).intValue(); }
    private static OffsetDateTime time(Object value) {
        if (value == null) return null;
        if (value instanceof OffsetDateTime t) return t;
        if (value instanceof Instant t) return t.atOffset(ZoneOffset.UTC);
        if (value instanceof java.sql.Timestamp t) return t.toInstant().atOffset(ZoneOffset.UTC);
        throw new IllegalStateException("Unexpected BR timestamp type: " + value.getClass());
    }
}
