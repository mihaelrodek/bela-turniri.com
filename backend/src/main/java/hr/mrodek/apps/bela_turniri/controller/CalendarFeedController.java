package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.repository.TournamentsRepository;
import hr.mrodek.apps.bela_turniri.services.CalendarFeedRenderService;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.List;

/**
 * Anonymous, subscribable iCalendar feed of upcoming tournaments.
 *
 * <p>Endpoint: {@code GET /api/calendar/tournaments.ics}. Unlike the
 * one-shot download built by {@code frontend/src/utils/ics.ts}
 * ("Dodaj u kalendar" on a single tournament), a user subscribes to this
 * URL once (as {@code webcal://…} in Google/Apple Calendar) and the client
 * re-fetches it on its own schedule, so newly created tournaments keep
 * appearing without any further action. The two builders intentionally
 * share the same escaping/folding/UTC conventions — see
 * {@link #escapeText}, {@link #fold} and {@link #fmtUtc} below, which
 * mirror {@code esc}, {@code fold} and {@code fmtUtc} in {@code ics.ts}.
 *
 * <p><b>RFC 5545 correctness matters more than anything else here</b>: a
 * malformed feed is silently rejected by Google Calendar with no error the
 * user ever sees, so every text property goes through {@link #escapeText}
 * and every line goes through {@link #fold} before being written.
 *
 * <p>The feed is capped at {@link #MAX_EVENTS} tournaments (soonest first)
 * so a subscription can never grow unbounded — a calendar app re-fetching
 * this URL forever must always get a small, fast response.
 */
@Path("/calendar")
public class CalendarFeedController {

    @Inject
    TournamentsRepository tournamentsRepo;

    @Inject
    CalendarFeedRenderService renderCache;

    @ConfigProperty(name = "app.public-base-url", defaultValue = "https://bela-turniri.com")
    String publicBaseUrl;

    /** Bounded feed size — see class javadoc. */
    private static final int MAX_EVENTS = 200;

    /** Shared-cache lifetime, matching the 15-minute Caffeine TTL on {@code calendar-feed}. */
    private static final String FEED_CACHE_CONTROL = "public, max-age=900, s-maxage=900";

    @GET
    @Path("/tournaments.ics")
    public Response tournamentsIcs(@HeaderParam("If-None-Match") String ifNoneMatch) {
        String base = publicBaseUrl.replaceAll("/+$", "");
        // Memoised for 15 minutes: calendar clients poll this URL on their
        // own schedule (often hourly), independently, for every subscriber —
        // the rendered body is identical for all of them.
        String body = renderCache.feed(base, () -> render(base));

        // ETag over the rendered body (not the request) so it changes only
        // when the feed's content actually changes, letting well-behaved
        // clients skip re-downloading an unchanged calendar.
        String etag = "\"" + sha256Hex(body) + "\"";

        if (etagMatches(ifNoneMatch, etag)) {
            return Response.notModified()
                    .header("Cache-Control", FEED_CACHE_CONTROL)
                    .header("ETag", etag)
                    .build();
        }

        return Response.ok(body)
                .header("Content-Type", "text/calendar; charset=utf-8")
                .header("Content-Disposition", "inline; filename=\"bela-turniri.ics\"")
                .header("Cache-Control", FEED_CACHE_CONTROL)
                .header("ETag", etag)
                .build();
    }

    /* ───────────────────── rendering (cache-miss only) ───────────────────── */

    private static final DateTimeFormatter UTC_STAMP = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");

    /** Build the full VCALENDAR text. Called only on a cache miss. */
    private String render(String base) {
        // Reuses the existing "upcoming, paged" finder — it already does
        // `left join fetch t.resource`, respects the entity's
        // `@SQLRestriction("is_deleted = false")` soft-delete filter, and
        // orders soonest-first, which is exactly the bounded, cheap query
        // this feed needs.
        List<Tournaments> tournaments =
                tournamentsRepo.findUpcomingPaged(OffsetDateTime.now(), 0, MAX_EVENTS);

        OffsetDateTime dtstamp = OffsetDateTime.now();
        StringBuilder sb = new StringBuilder(2048 + tournaments.size() * 512);

        appendLine(sb, "BEGIN:VCALENDAR");
        appendLine(sb, "VERSION:2.0");
        appendLine(sb, "PRODID:-//bela-turniri.com//Bela Turniri//HR");
        appendLine(sb, "CALSCALE:GREGORIAN");
        appendLine(sb, "METHOD:PUBLISH");
        // Non-standard but what Google Calendar and Apple Calendar actually
        // read to name the subscribed calendar and default its timezone.
        appendLine(sb, fold("X-WR-CALNAME:" + escapeText("Bela turniri")));
        appendLine(sb, "X-WR-TIMEZONE:Europe/Zagreb");

        for (Tournaments t : tournaments) {
            appendEvent(sb, t, base, dtstamp);
        }

        appendLine(sb, "END:VCALENDAR");
        return sb.toString();
    }

    private void appendEvent(StringBuilder sb, Tournaments t, String base, OffsetDateTime dtstamp) {
        // Defensive: every persisted tournament has uuid + startAt, but skip
        // rather than emit a broken VEVENT if either is ever missing.
        if (t.getUuid() == null || t.getStartAt() == null) return;

        String key = (t.getSlug() != null && !t.getSlug().isBlank()) ? t.getSlug() : t.getUuid().toString();
        String url = base + "/turniri/" + key;

        appendLine(sb, "BEGIN:VEVENT");
        // Stable UID: tournament uuid + fixed domain suffix. Must never
        // change between fetches, or every calendar client that already
        // imported this event would treat the next fetch as a brand-new one
        // and duplicate it instead of updating in place.
        appendLine(sb, fold("UID:" + t.getUuid() + "@bela-turniri.com"));
        appendLine(sb, "DTSTAMP:" + fmtUtc(dtstamp));
        appendLine(sb, "DTSTART:" + fmtUtc(t.getStartAt()));
        // Tournaments has no stored end time. Default duration: 3 hours,
        // matching frontend/src/utils/ics.ts's single-event "Dodaj u
        // kalendar" download (`start + 3h`) so both feeds render the same
        // apparent length for the same tournament. Emitted in UTC (`...Z`)
        // so no VTIMEZONE block is needed and every client localises it
        // correctly on its own.
        OffsetDateTime end = t.getStartAt().plusHours(3);
        appendLine(sb, "DTEND:" + fmtUtc(end));
        appendLine(sb, fold("SUMMARY:" + escapeText(t.getName() != null ? t.getName() : "Bela turnir")));
        if (t.getLocation() != null && !t.getLocation().isBlank()) {
            appendLine(sb, fold("LOCATION:" + escapeText(t.getLocation().trim())));
        }
        appendLine(sb, fold("URL:" + url));
        appendLine(sb, fold("DESCRIPTION:" + escapeText(buildDescription(t, url))));
        appendLine(sb, "END:VEVENT");
    }

    /** Short plain-text description: location, entry price, deep link. */
    private String buildDescription(Tournaments t, String url) {
        StringBuilder sb = new StringBuilder();
        if (t.getLocation() != null && !t.getLocation().isBlank()) {
            sb.append(t.getLocation().trim()).append("\n");
        }
        BigDecimal entry = t.getEntryPrice() != null ? t.getEntryPrice() : BigDecimal.ZERO;
        sb.append("Kotizacija: ").append(formatEur(entry)).append(" €\n");
        sb.append(url);
        return sb.toString();
    }

    /** "10" instead of "10.00" but "10.50" stays "10.50". */
    private static String formatEur(BigDecimal v) {
        BigDecimal stripped = v.stripTrailingZeros();
        if (stripped.scale() < 0) stripped = stripped.setScale(0, RoundingMode.UNNECESSARY);
        return stripped.toPlainString();
    }

    private static void appendLine(StringBuilder sb, String line) {
        sb.append(line).append("\r\n");
    }

    /** RFC-5545 DATE-TIME in UTC: 20260105T140000Z. Clients localise on import. */
    private static String fmtUtc(OffsetDateTime dt) {
        return dt.withOffsetSameInstant(ZoneOffset.UTC).format(UTC_STAMP);
    }

    /**
     * Escape per RFC-5545 §3.3.11: backslash, semicolon and comma are
     * backslash-escaped, and newlines become the two-character sequence
     * {@code \n}. Without this a Croatian tournament name/location
     * containing a comma (routine — "Zagreb, Trešnjevka") makes strict
     * clients (iOS Calendar) refuse to parse the whole file. Mirrors
     * {@code esc} in {@code frontend/src/utils/ics.ts}.
     *
     * <p>Line breaks are normalised to {@code \n} FIRST. A name or location
     * pasted from a spreadsheet or a Word document routinely carries CRLF
     * (or, from old Mac exports, a lone CR); escaping only {@code \n} would
     * leave the bare carriage return in the middle of a content line, and a
     * raw CR inside a value is exactly what makes a strict parser reject the
     * whole calendar — the silent "Google Calendar won't subscribe" failure
     * this file's header warns about. The order matters: the backslash
     * escape runs before the newline escape (so the {@code \} we introduce
     * is not doubled), and the newline normalisation runs before both.
     */
    private static String escapeText(String s) {
        if (s == null) return "";
        return s
                .replace("\r\n", "\n")
                .replace("\r", "\n")
                .replace("\\", "\\\\")
                .replace("\n", "\\n")
                .replace(",", "\\,")
                .replace(";", "\\;");
    }

    /**
     * Fold a content line longer than 75 <b>octets</b> (RFC-5545 §3.1), by
     * inserting CRLF + a single space before continuing. Splitting on
     * octets rather than characters matters here specifically because
     * Croatian diacritics (č, ć, š, ž, đ) are multi-byte in UTF-8 — folding
     * on character count (as a naive port of the frontend's char-based
     * {@code fold} would) can still overshoot the octet cap. The split
     * point is additionally backed off so it never lands inside a
     * multi-byte UTF-8 sequence, which would otherwise corrupt the last
     * character of a chunk.
     */
    private static String fold(String line) {
        byte[] bytes = line.getBytes(StandardCharsets.UTF_8);
        if (bytes.length <= 75) return line;

        StringBuilder out = new StringBuilder(bytes.length + 16);
        int start = 0;
        boolean first = true;
        while (start < bytes.length) {
            // Continuation lines carry a leading space that counts toward
            // their own 75-octet budget, so they can hold one fewer octet
            // of actual content than the first line.
            int budget = first ? 75 : 74;
            int end = Math.min(start + budget, bytes.length);
            // Back off while the byte at `end` is a UTF-8 continuation byte
            // (10xxxxxx) so we never split a multi-byte character.
            while (end > start && end < bytes.length && (bytes[end] & 0xC0) == 0x80) {
                end--;
            }
            if (!first) out.append("\r\n ");
            out.append(new String(bytes, start, end - start, StandardCharsets.UTF_8));
            start = end;
            first = false;
        }
        return out.toString();
    }

    private static String sha256Hex(String body) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(body.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is guaranteed available on every JVM per the platform spec.
            throw new IllegalStateException(e);
        }
    }

    /**
     * Minimal If-None-Match evaluation: browsers/clients send back exactly
     * the ETag we gave them, but the header technically allows a
     * comma-separated list (and "*"). Mirrors {@code ResourceController}.
     */
    private static boolean etagMatches(String ifNoneMatch, String quotedEtag) {
        if (ifNoneMatch == null) return false;
        if ("*".equals(ifNoneMatch.trim())) return true;
        for (String candidate : ifNoneMatch.split(",")) {
            if (candidate.trim().equals(quotedEtag)) return true;
        }
        return false;
    }
}
