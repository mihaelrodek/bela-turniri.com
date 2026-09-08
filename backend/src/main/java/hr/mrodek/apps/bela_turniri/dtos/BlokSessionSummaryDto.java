package hr.mrodek.apps.bela_turniri.dtos;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One row of {@code GET /user/me/blok-history} — a series without its games.
 * {@code BLOK-HISTORY.md} §3.2.
 *
 * <pre>
 * {
 *   "uuid":       "3f2a…",
 *   "sessionId":  "b7c0…",
 *   "startedAt":  "2026-09-08T19:00:00+02:00",   // ISO-8601
 *   "finishedAt": "2026-09-08T23:40:00+02:00",   // ISO-8601, may be null
 *   "target":      1001,
 *   "gameEndRule": "prolaz",                      // "dosta" | "prolaz" — §5.5
 *   "names":       { "us": "", "them": "" },      // "" = render MI / VI
 *   "gamesUs":     4,
 *   "gamesThem":   3,
 *   "gamesCount":  7,
 *   "createdAt":   "2026-09-08T23:40:03+02:00"    // ISO-8601, when uploaded
 * }
 * </pre>
 *
 * <p>The listing never reads the {@code payload} column: the query is a JPQL
 * constructor projection over the summary columns into
 * {@code BlokSessionSummaryRow}, which is then mapped here. The intermediate
 * row exists only because JPQL cannot construct the nested {@code names}
 * object, and {@code names} is nested because that is the shape §2.3 sends on
 * the way in — a screen rendering a series should not have to know which
 * direction the data was travelling.
 *
 * <p><b>Times are ISO-8601 here, epoch ms in the POST body.</b> These are real
 * timestamptz columns and every date in this SPA is formatted from an ISO
 * string ({@code utils/format.ts}); the epoch ms in §2.3 is the blok's own
 * internal representation on the way in. Times <em>inside</em> {@code games}
 * stay epoch ms, because that is stored payload handed back verbatim.
 *
 * <p>{@code gamesUs + gamesThem} need not equal {@code gamesCount}: a series
 * can end with a game abandoned before anyone reached the target.
 */
public record BlokSessionSummaryDto(
        UUID uuid,
        /** The client's id for the series — lets the blok recognise its own upload. */
        String sessionId,
        OffsetDateTime startedAt,
        OffsetDateTime finishedAt,
        Integer target,
        /**
         * {@code "dosta"} | {@code "prolaz"} — the rule this series' games end
         * under (§5.5), so a row can print "Do 1001 · prolaz" <b>without</b>
         * the listing ever touching the payload. It is a real column for that
         * reason; per game the rule lives inside the payload, because the
         * player may change it mid-series, and this carries the newest game's.
         * Never null.
         */
        String gameEndRule,
        /** Side names; {@code ""} means "render the translated MI / VI". Never null. */
        BlokNamesDto names,
        /** The series result — the 4 in "4 : 3". */
        Integer gamesUs,
        /** The series result — the 3 in "4 : 3". */
        Integer gamesThem,
        Integer gamesCount,
        /** When the series was uploaded. The list is ordered by this, newest first. */
        OffsetDateTime createdAt
) {}
