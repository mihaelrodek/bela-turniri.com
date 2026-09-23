package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.repository.GameReplayRepository;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.StreamingOutput;

import java.io.BufferedWriter;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.UUID;

/**
 * "Zapisi partija" — the owner's export of full game replays
 * (game/README.md §8.8, game/BOT.md → "Zapisi partija").
 *
 * <p>ADMIN ONLY, and not part of any UI: this is a dump you pipe into a file
 * and study offline. A replay names every card in every hand of games other
 * people played, which is exactly why it never goes anywhere near a player-
 * facing endpoint.
 *
 * <h2>Why JSON Lines and not a JSON array</h2>
 * One complete document per line, newest first. A 500-game dump is then
 * readable with {@code jq -c}, {@code head}, a shell loop or a streaming
 * parser without holding the whole array in memory, and appending a later
 * dump to an earlier file is just {@code cat}. It also lets the response be
 * streamed row by row instead of being assembled first.
 *
 * <p>Each line is an ENVELOPE — {@code resultId}, {@code playedAt},
 * {@code botVersion}, {@code sizeBytes}, {@code replay} — rather than the
 * bare document, so a line identifies its game (the {@code resultId} is what
 * {@code GET /admin/game-replays/{resultId}} takes) without the reader having
 * to trust that the document repeats it.
 *
 * <p>The stored JSON is written through VERBATIM, never re-serialised: it was
 * validated as JSON by Postgres on the way in, and re-parsing it here would
 * only risk changing it. The one thing that must be true of it — that it
 * contains no raw newline — is guaranteed by {@code jsonb}, which normalises
 * the document and escapes every control character inside strings.
 */
@Path("/admin/game-replays")
@RolesAllowed("admin")
public class AdminGameReplaysController {

    /** Rows per dump when the caller says nothing. */
    private static final int DEFAULT_LIMIT = 500;
    /** Hard ceiling; a bigger archive is fetched in several `since`/`until` windows. */
    private static final int MAX_LIMIT = 5000;

    @Inject GameReplayRepository replays;

    /**
     * Newest replays first, as {@code application/x-ndjson}.
     *
     * @param since ISO-8601 instant; games played before it are skipped (inclusive)
     * @param until ISO-8601 instant; games played at or after it are skipped (exclusive)
     * @param limit 1..{@value #MAX_LIMIT}, default {@value #DEFAULT_LIMIT}
     */
    @GET
    @Produces("application/x-ndjson")
    @Transactional
    public Response export(@QueryParam("since") String since,
                           @QueryParam("until") String until,
                           @QueryParam("limit") @DefaultValue("" + DEFAULT_LIMIT) int limit) {
        int capped = limit <= 0 ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);
        // Fetched inside the transaction, streamed after it: the list is a
        // projection of plain values (no entities, no lazy proxies), so
        // nothing here needs a session once the rows are in hand.
        var rows = replays.export(parse(since, "since"), parse(until, "until"), capped);

        StreamingOutput body = out -> {
            try (Writer w = new BufferedWriter(new OutputStreamWriter(out, StandardCharsets.UTF_8))) {
                for (var row : rows) {
                    w.write("{\"resultId\":\"");
                    w.write(row.resultId().toString());
                    w.write("\",\"playedAt\":\"");
                    w.write(row.playedAt().toString());
                    w.write("\",\"botVersion\":");
                    w.write(row.botVersion() == null ? "null" : "\"" + row.botVersion() + "\"");
                    w.write(",\"sizeBytes\":");
                    w.write(row.sizeBytes() == null ? "null" : String.valueOf(row.sizeBytes()));
                    w.write(",\"replay\":");
                    w.write(row.replay());
                    w.write("}\n");
                }
            }
        };
        return Response.ok(body)
                // A dump, not a page: name it so a browser-issued request
                // lands as a file rather than as a wall of text.
                .header("Content-Disposition", "attachment; filename=\"game-replays.ndjson\"")
                .build();
    }

    /** One game's replay, by the reporter's {@code resultId}. */
    @GET
    @Path("/{resultId}")
    @Produces(MediaType.APPLICATION_JSON)
    @Transactional
    public Response one(@PathParam("resultId") String resultId) {
        UUID uuid;
        try {
            uuid = UUID.fromString(resultId.trim());
        } catch (RuntimeException e) {
            throw new BadRequestException("resultId is not a valid UUID");
        }
        var row = replays.findByResultUuid(uuid)
                .orElseThrow(() -> new NotFoundException("no replay for this game"));
        // The bare document this time: a single-game fetch is read by a human
        // or piped straight into a scenario test, and the envelope would only
        // be in the way.
        return Response.ok(row.replay(), MediaType.APPLICATION_JSON_TYPE).build();
    }

    /** An absent bound is null (unbounded); a malformed one is a 400, not a silent ignore. */
    private static OffsetDateTime parse(String raw, String field) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return OffsetDateTime.parse(raw.trim());
        } catch (DateTimeParseException e) {
            throw new BadRequestException(field + " must be an ISO-8601 timestamp, e.g. 2026-09-01T00:00:00Z");
        }
    }
}
