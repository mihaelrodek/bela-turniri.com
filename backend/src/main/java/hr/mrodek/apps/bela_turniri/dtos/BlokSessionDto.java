package hr.mrodek.apps.bela_turniri.dtos;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * The full series: everything in {@link BlokSessionSummaryDto} plus the games
 * and their deals. Returned by {@code POST /user/me/blok-history} and
 * {@code GET /user/me/blok-history/{uuid}} — {@code BLOK-HISTORY.md} §3.2.
 *
 * <pre>
 * {
 *   "uuid":       "3f2a…",
 *   "sessionId":  "b7c0…",
 *   "startedAt":  "2026-09-08T19:00:00+02:00",
 *   "finishedAt": "2026-09-08T23:40:00+02:00",
 *   "target":      1001,
 *   "gameEndRule": "prolaz",                       // "dosta" | "prolaz" — §5.5
 *   "names":       { "us": "", "them": "" },
 *   "gamesUs":     4,
 *   "gamesThem":   3,
 *   "gamesCount":  7,
 *   "createdAt":   "2026-09-08T23:40:03+02:00",
 *   "games":       [ … ]     // BlokGameDto, in the order they were played
 * }
 * </pre>
 *
 * <p>The first eleven components are identical, in name and order, to
 * {@link BlokSessionSummaryDto}: a client that has a summary row can render
 * the opened series without re-deriving anything.
 *
 * <p>{@code gameEndRule} here is the <b>series-level</b> rule — the newest
 * game's, for the "Do 1001 · prolaz" label. Each entry of {@code games}
 * carries its own, which is what a reader needs to check that game's
 * {@code winner} (§5.5).
 *
 * <p>{@code games} is the stored payload, parsed back. Its timestamps are
 * epoch ms (they were never columns); the session's own dates above are
 * ISO-8601. See {@link BlokSessionSummaryDto} for why.
 */
public record BlokSessionDto(
        UUID uuid,
        String sessionId,
        OffsetDateTime startedAt,
        OffsetDateTime finishedAt,
        Integer target,
        /** {@code "dosta"} | {@code "prolaz"}, series level. Never null. */
        String gameEndRule,
        BlokNamesDto names,
        Integer gamesUs,
        Integer gamesThem,
        Integer gamesCount,
        OffsetDateTime createdAt,
        /** Every game of the series, oldest first. Never null; never empty. */
        List<BlokGameDto> games
) {}
