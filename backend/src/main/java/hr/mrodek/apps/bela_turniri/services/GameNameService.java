package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.errors.ApiCodes;
import hr.mrodek.apps.bela_turniri.errors.ApiError;
import hr.mrodek.apps.bela_turniri.model.GameName;
import hr.mrodek.apps.bela_turniri.repository.GameNameRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * The rules behind a player's <em>ime za igru</em>: who may set one, what it
 * may look like, and how often it may change.
 *
 * <h2>Who calls this</h2>
 * Only {@code GameProfilesInternalController}, i.e. only the Node game server.
 * Half the players this serves are guests, whose identity exists nowhere but
 * in that server's memory and in the browser secret it derives
 * {@code guest:<64 hex>} from — so there is no signed-in request the backend
 * could have authenticated instead.
 *
 * <p>That also makes the uid <b>untrusted input from another service</b>. It
 * is shape- and length-checked here, before it reaches a query or a column.
 *
 * <h2>Once every 7 days</h2>
 * A name above a seat is how opponents recognise each other between games;
 * one that changes every hand is a way to dodge that recognition. The limit is
 * measured from {@link GameName#getChangedAt()}, so a refusal costs nothing
 * and the clock only moves when a change is actually accepted. The FIRST name
 * a uid ever sets is always allowed — there is no previous change to count
 * from, and a player who has never picked a name would otherwise be locked out
 * of picking one.
 */
@ApplicationScoped
public class GameNameService {

    /**
     * The protocol's {@code LIMITS.playerNameMax} (game/packages/protocol).
     * Hard-coded rather than shared, because the two runtimes have no build
     * dependency on each other; changing it means changing both, plus the
     * {@code game_names.name} column width.
     *
     * <p>Counted in Java {@code char}s, which are UTF-16 code units — exactly
     * what JavaScript's {@code String.length} counts, so a name the game
     * client accepted is a name this accepts.
     */
    public static final int MAX_NAME_LENGTH = 16;

    /** How long a player must wait between name changes. */
    public static final Duration CHANGE_INTERVAL = Duration.ofDays(7);

    /**
     * Same width as {@code game_result_players.uid} and the {@code game_uid}
     * column: a Firebase UID is 28 characters and {@code guest:} + 64 hex is
     * 70, so this is a cap on nonsense rather than a real limit.
     */
    private static final int MAX_UID_LENGTH = 128;

    /**
     * The two id shapes the game server can present. Guests are pinned to the
     * exact {@code guest:} + 64 hex form the server derives them in; anything
     * else must look like a Firebase UID, which is an opaque token of URL-safe
     * characters. Nothing else is allowed anywhere near the key of a row we
     * store on someone's behalf.
     */
    private static final Pattern GUEST_UID = Pattern.compile("guest:[0-9a-fA-F]{64}");
    private static final Pattern ACCOUNT_UID = Pattern.compile("[A-Za-z0-9_-]{1,128}");

    @Inject GameNameRepository gameNames;

    /**
     * The in-game name for a player, or {@code null} when they have not set
     * one — including when the uid is not a shape we could have stored.
     *
     * <p>Returns {@code null} rather than throwing on a malformed uid: the
     * only reader is the seat-rendering endpoint, whose contract is "200 with
     * nulls, the caller falls back to what it already knows".
     */
    public String nameFor(String gameUid) {
        if (!isValidUid(gameUid)) return null;
        return gameNames.findByGameUid(gameUid).map(GameName::getName).orElse(null);
    }

    /**
     * Set (or change) a player's in-game name.
     *
     * <p>Re-submitting the identical name is a no-op that succeeds without
     * touching {@code changedAt}. The game server retries a write whose
     * response it never saw, and that retry must not cost the player a week.
     *
     * @return the stored row, so the caller can tell the player when they may
     *         next change it
     * @throws WebApplicationException 400 for a bad uid or name, 409 when the
     *         7-day rule refuses (carrying the instant it lifts)
     */
    public GameName set(String gameUid, String rawName) {
        if (!isValidUid(gameUid)) throw ApiCodes.badRequest("INVALID_GAME_UID");

        String name = normalise(rawName);
        if (name.isEmpty()) throw ApiCodes.badRequest("GAME_NAME_REQUIRED");
        if (name.length() > MAX_NAME_LENGTH) throw ApiCodes.badRequest("GAME_NAME_TOO_LONG");

        OffsetDateTime now = OffsetDateTime.now();
        Optional<GameName> existing = gameNames.findByGameUid(gameUid);
        if (existing.isEmpty()) {
            GameName fresh = new GameName();
            fresh.setGameUid(gameUid);
            fresh.setName(name);
            fresh.setChangedAt(now);
            return gameNames.save(fresh);
        }

        GameName row = existing.get();
        if (name.equals(row.getName())) return row;

        OffsetDateTime nextChangeAt = nextChangeAt(row);
        if (now.isBefore(nextChangeAt)) throw rateLimited(nextChangeAt);

        row.setName(name);
        row.setChangedAt(now);
        return gameNames.save(row);
    }

    /** When the player holding this row may next change their name. */
    public static OffsetDateTime nextChangeAt(GameName row) {
        return row.getChangedAt().plus(CHANGE_INTERVAL);
    }

    /**
     * Trim, and drop anything the renderer at the far end has no business
     * receiving. Control characters (newlines, bidi overrides, the odd stray
     * NUL) are stripped rather than rejected: they are never something a
     * player typed on purpose, so a name that is fine once they are gone
     * should just work.
     */
    private static String normalise(String raw) {
        if (raw == null) return "";
        StringBuilder out = new StringBuilder(raw.length());
        raw.codePoints()
                .filter(cp -> !Character.isISOControl(cp))
                .forEach(out::appendCodePoint);
        return out.toString().trim();
    }

    /** True for a Firebase UID or a well-formed {@code guest:<64 hex>} id. */
    private static boolean isValidUid(String uid) {
        if (uid == null || uid.isBlank() || uid.length() > MAX_UID_LENGTH) return false;
        return GUEST_UID.matcher(uid).matches() || ACCOUNT_UID.matcher(uid).matches();
    }

    /**
     * 409 with the {@link ApiError} envelope — the same shape
     * {@link InternalTokenGuard} answers its 401 in, so the game server has
     * one body to parse for every refusal from these endpoints.
     *
     * <p>Deliberately NOT {@code ApiCodes.conflict("...")}: those bare-string
     * bodies exist so the SPA can compare {@code res.data} against a literal,
     * and a bare string has nowhere to put the one thing this refusal is
     * useless without — WHEN the player may try again. The code still travels
     * in {@code code}, and {@code details.nextChangeAt} carries the instant
     * both as ISO-8601 and as epoch milliseconds so the caller can render a
     * countdown without parsing anything.
     *
     * <p>{@code Retry-After} is set for the same reason, in the standard
     * place, for any caller that already understands it.
     *
     * <p>English, like the other internal-endpoint messages: the reader is a
     * server and its log. The player-facing wording belongs to the game
     * client, which has the code and the timestamp to build it from.
     */
    private static WebApplicationException rateLimited(OffsetDateTime nextChangeAt) {
        long seconds = Math.max(0, Duration.between(OffsetDateTime.now(), nextChangeAt).toSeconds());
        ApiError body = ApiError.of(
                "GAME_NAME_RATE_LIMITED",
                "The in-game name can only be changed once every "
                        + CHANGE_INTERVAL.toDays() + " days.",
                Map.of("nextChangeAt", List.of(
                        nextChangeAt.toInstant().toString(),
                        Long.toString(nextChangeAt.toInstant().toEpochMilli()))));
        return new WebApplicationException(
                Response.status(Response.Status.CONFLICT)
                        .type(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.RETRY_AFTER, seconds)
                        .entity(body)
                        .build());
    }
}
