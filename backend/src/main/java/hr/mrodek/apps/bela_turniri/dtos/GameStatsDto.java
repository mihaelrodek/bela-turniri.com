package hr.mrodek.apps.bela_turniri.dtos;

import java.util.Map;

/**
 * The signed-in user's online-game record (game/README.md §8.5).
 *
 * <pre>
 * { "global":       { "games": 42, "wins": 25, "losses": 17, "winRate": 0.595 },
 *   "byTargetScore": { "501": { … }, "701": { … }, "1001": { … } } }
 * </pre>
 *
 * <p>{@code byTargetScore} is keyed by the category as a STRING ("501" /
 * "701" / "1001") because that is what §8.5 puts on the wire, and a JSON
 * object cannot have numeric keys anyway.
 *
 * <p>Categories the user has never played are <b>omitted</b> rather than
 * emitted as zero rows: the profile card renders one tile per entry, and a
 * "0 games, 0% win rate" tile for a mode nobody in this account has ever
 * opened is noise the frontend would only have to filter back out.
 * {@code global} is always present, all zeros for a user with no eligible
 * games.
 */
public record GameStatsDto(
        Bucket global,
        Map<String, Bucket> byTargetScore
) {

    /**
     * @param winRate wins / games, rounded to three decimals; {@code 0} when
     *                no games were played (rather than null or NaN, so the
     *                client never has to special-case the empty state)
     */
    public record Bucket(
            long games,
            long wins,
            long losses,
            double winRate
    ) {
        public static Bucket of(long games, long wins) {
            long losses = games - wins;
            double rate = games == 0 ? 0d : Math.round((double) wins / games * 1000d) / 1000d;
            return new Bucket(games, wins, losses, rate);
        }
    }
}
