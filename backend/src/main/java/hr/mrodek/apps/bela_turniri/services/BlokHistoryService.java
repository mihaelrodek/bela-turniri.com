package hr.mrodek.apps.bela_turniri.services;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import hr.mrodek.apps.bela_turniri.dtos.BlokDeclarationsDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokGameDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokRoundDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokScoresDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokSessionDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokSessionSummaryDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokShareDto;
import hr.mrodek.apps.bela_turniri.dtos.SaveBlokSessionRequest;
import hr.mrodek.apps.bela_turniri.errors.ApiCodes;
import hr.mrodek.apps.bela_turniri.mappers.BlokSessionMapper;
import hr.mrodek.apps.bela_turniri.model.BlokSession;
import hr.mrodek.apps.bela_turniri.realtime.BlokShareBroadcaster;
import hr.mrodek.apps.bela_turniri.repository.BlokSessionRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.NotFoundException;
import org.jboss.logging.Logger;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * "Povijest blokova na profilu" — the whole domain of
 * {@code BLOK-HISTORY.md} §3.
 *
 * <p>A player's local bela blok uploads one <em>series</em> when they press
 * "Resetiraj": every game played at that table since the last reset, each with
 * all of its deals. It is a <b>personal scorepad</b> and is read by nothing
 * else in this application — not {@code Matches}, not tournament results, not
 * player statistics. That is why the numbers are stored as the client computed
 * them (the bela rules live in the TypeScript engine that drew the screen, and
 * a Java port would be a second source of truth for data nobody else consumes)
 * and why the checks below are about <em>size and nonsense</em>, not about
 * trusting the result.
 *
 * <h2>An upload is an UPSERT (§5.1) — the reliability story</h2>
 * Two different things bring the same {@code sessionId} back:
 *
 * <ul>
 *   <li><b>A retry.</b> The blok keeps an unconfirmed upload in
 *       {@code localStorage} and sends it again on the next launch, so the
 *       second POST must answer <b>200 with the same record</b> — not a
 *       duplicate, not a 409.</li>
 *   <li><b>A longer series (§5.1).</b> The player now presses "Spremi i
 *       započni novu" when starting each game, so the same series arrives
 *       repeatedly, one game bigger every time. The second POST must
 *       <b>refresh</b> the stored record.</li>
 * </ul>
 *
 * <p>Both are the same write: {@code INSERT … ON CONFLICT (user_uid,
 * session_id) DO UPDATE}, in {@link BlokSessionRepository#upsertAndRead}, then
 * a read-back of the stored row. A retry with an identical body updates the
 * row to what it already said, which is indistinguishable from doing nothing.
 * There is no read-then-decide step left, so there is no window to lose: one
 * statement, arbitrated by the unique index rather than by application timing,
 * and native for the reason {@link IdempotencyService} documents — a JPA
 * unique-constraint violation dooms the persistence context, and this code has
 * to keep reading afterwards to answer 200. See that repository method for the
 * concurrency argument in full.
 *
 * <p><b>{@code uuid} and {@code created_at} survive the update</b>, along with
 * {@code share_token} and {@code started_at}: they are not in the conflict's
 * SET list. A share link handed out mid-series has to keep working (§5.2), and
 * the listing's sort key must not jump every time the player starts a game.
 *
 * <p>No {@code @Transactional} here, deliberately: the resource methods are
 * already transactional and this service is called inside their transaction,
 * the same convention {@link BlokLinkService} and {@code TournamentPairService}
 * follow.
 *
 * <h2>Ownership (§3.2)</h2>
 * Every owner-facing query goes through {@code currentUser.requireUid()};
 * nothing in the request body is ever consulted for ownership. A uuid
 * belonging to someone else answers <b>404, never 403</b> — the repository's
 * owner-facing lookups have no un-scoped variant to get wrong, so a foreign
 * row is simply not found and the caller cannot learn that it exists.
 *
 * <h2>The game-end rule travels (§5.5)</h2>
 * A game ends either by {@code dosta} (first side past the target wins) or by
 * {@code prolaz} (the crossing side must have called that deal and passed it),
 * and <b>two games with identical deals have different winners under the
 * two</b>. Since the winners here are the client's and are never recomputed,
 * a stored {@code winner} without its rule is not checkable by anyone reading
 * the record later — on the profile or through a shared link. So the rule is
 * stored per game inside the payload (the player can change the setting
 * mid-series) and once more as the {@code game_end_rule} column, which is the
 * series-level value the listing needs while still never reading the payload.
 * {@link #endRule} maps everything that is not {@code dosta} to
 * {@code prolaz}, the §5.5 default, and never throws — see it for why this
 * one field is not validated like the rest.
 *
 * <h2>Sharing (§5.2)</h2>
 * {@link #getShared} is the one read here with no caller at all. It is keyed
 * on {@code share_token} — a separate {@code SecureRandom} string, never the
 * record's {@code uuid} — because since §5.1 a series is uploaded the moment
 * the player starts a new game, so <b>every record exists without its owner
 * ever having agreed to publish it</b>, while the uuid appears in the owner's
 * own URLs and in every response they receive. Keying the public route on the
 * uuid would make a guessed or leaked id an exposure; the token is the
 * consent, absent until {@link #share} mints it and gone again after
 * {@link #unshare}. The public answer also drops the record's own identifiers
 * — see {@link #getShared}.
 *
 * <p>There is a <b>second</b> way consent is given, added by
 * {@code BLOK-LINK.md} §6.2: linking the blok to a table of a tournament. The
 * organiser and everyone holding the link must be able to open that scorepad,
 * so {@link #shareSeries} mints the token on the player's behalf when a score
 * is written through an approved link. It goes through the very same
 * {@link #issueOrReturn}, so the two paths cannot mint competing tokens, and
 * it is keyed on {@code (owner uid, client session id)} so a link can only
 * ever publish the series of the player who made it. Nothing else mints:
 * listing links reads tokens and never creates them.
 *
 * <h2>Realtime (§5.7)</h2>
 * Everything that changes what a share link shows tells
 * {@link BlokShareBroadcaster} — {@link #save} when the series grows,
 * {@link #unshare} and {@link #delete} when the link dies. The broadcast is
 * keyed on the {@code share_token}, so a series that has never been shared
 * announces nothing to nobody, and it is deferred to after this transaction
 * commits, so a rolled-back save wakes no one. Nothing about the change
 * travels in the frame: the viewer refetches
 * {@code GET /blok-share/{token}} — {@link #getShared} — which is where the
 * token is validated, once, for both the socket and the read.
 */
@ApplicationScoped
public class BlokHistoryService {

    private static final Logger LOG = Logger.getLogger(BlokHistoryService.class);

    /* ---- §3.3 limits. Bare codes; the SPA compares them literally. ---- */

    /** Games in one series. */
    static final int MAX_GAMES = 50;
    /** Deals in one game. */
    static final int MAX_ROUNDS_PER_GAME = 300;
    /** Serialised payload, in bytes. */
    static final int MAX_PAYLOAD_BYTES = 256 * 1024;
    /** Length of the client's series id. */
    static final int MAX_SESSION_ID = 64;

    /**
     * Bound on a single deal's card points and on one declaration, exactly as
     * §3.3 writes it. Both are per-deal values: real bela caps card points at
     * 162 and the biggest declaration at 1001-point belot variants is far
     * under this, so the limit only catches garbage.
     */
    static final int MAX_DEAL_POINTS = 1000;

    /**
     * Bound on a game's running {@code totals}. <b>Deliberately not the
     * 0..1000 of §3.3</b>: a game is played TO 1001, so a finished game's
     * winning total is 1001 or more by definition and the contract's figure
     * cannot apply to this field without rejecting every ordinary game. It is
     * a size guard — 300 deals × 1000 points is the theoretical ceiling — not
     * a rule check. See the report accompanying this feature.
     */
    static final int MAX_GAME_TOTAL = 1_000_000;

    /** Points a game is played to. Blok offers 501 / 1001 / 2001; this is slack. */
    static final int MAX_TARGET = 100_000;

    /** Declarations announced by one side in one deal. Real bela never nears this. */
    static final int MAX_DECLARATIONS_PER_SIDE = 50;

    /** Column width of {@code name_us} / {@code name_them}. */
    static final int MAX_NAME = 60;

    /** Column width of {@code id} inside a stored game — a client-side React key. */
    static final int MAX_GAME_ID = 64;

    /* ---- Listing paging ---- */

    static final int DEFAULT_LIMIT = 20;
    static final int MAX_LIMIT = 100;

    /* ---- Enumerations, kept as plain strings on the wire (§2.3) ---- */

    private static final Set<String> SIDES = Set.of("us", "them");
    private static final Set<String> TRUMPS = Set.of("HERC", "KARA", "PIK", "TREF");
    /** The four chairs, named as the blok names them (BLOK.md §3.3.4). */
    private static final Set<String> DEALER_SEATS =
            Set.of("self", "partner", "leftOpponent", "rightOpponent");

    /**
     * How a game ends — {@code BLOK-HISTORY.md} §5.5. Under {@code dosta} the
     * first side past the target wins; under {@code prolaz} the crossing side
     * must have called that deal and passed it.
     */
    static final String END_RULE_DOSTA = "dosta";

    /** The default since §5.5, and what an absent or unknown value means. */
    static final String END_RULE_PROLAZ = "prolaz";

    /**
     * Epoch ms outside this window is treated as "the client does not know".
     * Guards the {@code Instant.ofEpochMilli} conversion against a long that
     * would overflow {@code OffsetDateTime}, and against a phone whose clock
     * is set to 1970 or 2999 writing a nonsense date into the profile.
     */
    private static final long MIN_EPOCH_MS = 946_684_800_000L;    // 2000-01-01
    private static final long MAX_EPOCH_MS = 4_102_444_800_000L;  // 2100-01-01

    @Inject BlokSessionRepository repo;
    @Inject BlokSessionMapper mapper;
    @Inject CurrentUser currentUser;
    @Inject MessageService messages;
    @Inject ObjectMapper json;
    @Inject BlokShareBroadcaster liveBlok;

    /* ===================== Save — §3.2 POST, §3.3 limits ===================== */

    /**
     * Store one series, or bring the one already filed under this
     * {@code sessionId} up to date. Always 200 (see
     * {@code BlokHistoryController} for why a fresh insert is not 201).
     *
     * <p><b>The second POST of a series is no longer a no-op (§5.1.)</b> The
     * player presses "Spremi i započni novu" when starting each game, so the
     * same {@code sessionId} comes back one game longer and the stored record
     * has to follow: payload, both tallies, {@code gamesCount},
     * {@code finishedAt}, the names, {@code target} and {@code gameEndRule}
     * are all rewritten. The
     * record's {@code uuid} and {@code createdAt} are not — a share link
     * already sent points at that uuid, and §5.1 requires it to survive the
     * update. That is enforced in the SQL, by leaving both columns out of the
     * conflict's SET list, not by a comparison here.
     *
     * <p>Everything is validated and normalised <b>before</b> anything is
     * written, and an update is as much untrusted user JSON as an insert: the
     * §3.3 limits below run on every call, on the same path, and the games are
     * re-serialised from this application's own records, so the text that
     * reaches the jsonb column is known-good, carries no fields the client
     * invented, and has been measured against the 256 KB cap in its persisted
     * form rather than in whatever the client sent. A record that already
     * exists cannot be widened by a later oversized upload — the write never
     * happens.
     */
    public BlokSessionDto save(SaveBlokSessionRequest body) {
        String uid = currentUser.requireUid();

        if (body == null) throw ApiCodes.badRequest("INVALID_SESSION_ID");

        String sessionId = normaliseSessionId(body.sessionId());
        int target = normaliseTarget(body.target());
        List<BlokGameDto> games = normaliseGames(body.games(), target);
        String payload = serialisePayload(games);

        BlokSession s = new BlokSession();
        // Only used when this call is the INSERT; on the conflict path
        // Postgres discards both and the stored record keeps its own.
        s.setUuid(UUID.randomUUID());
        s.setCreatedAt(OffsetDateTime.now());
        s.setSessionId(sessionId);
        s.setUserUid(uid);
        s.setStartedAt(toInstant(body.startedAt()));
        s.setFinishedAt(toInstant(body.finishedAt()));
        s.setTarget(target);
        s.setGameEndRule(seriesEndRule(body.gameEndRule(), games));
        s.setNameUs(trimTo(body.names() == null ? null : body.names().us(), MAX_NAME));
        s.setNameThem(trimTo(body.names() == null ? null : body.names().them(), MAX_NAME));
        s.setGamesUs(countWins(games, "us"));
        s.setGamesThem(countWins(games, "them"));
        s.setGamesCount(games.size());
        s.setPayload(payload);

        // One statement, then a read-back of whatever is actually stored — so
        // the response carries the database's uuid and created_at (this call's
        // on an insert, the existing record's on an update), which is exactly
        // what a later GET will show. Under a concurrent double-submit both
        // callers end up reading the same row; see the repository method.
        BlokSession stored = repo.upsertAndRead(s)
                // Only reachable if the row was deleted between the write and
                // the read. Fail loudly rather than telling the blok "saved"
                // and letting it drop its local copy.
                .orElseThrow(() -> new IllegalStateException(messages.t("blokSession.saveFailed")));

        // §5.7: wake everyone holding the share link. The stored row's token is
        // the right one to use rather than anything computed here — the upsert
        // deliberately leaves share_token out of its SET list, so this is
        // whatever the record actually carries, and it is null for the ordinary
        // unshared series, which makes this a no-op. The ping itself waits for
        // this transaction to commit; see BlokShareBroadcaster.
        liveBlok.notifySession(stored.getShareToken());

        return toDto(stored);
    }

    /* ===================== Reads — §3.2 ===================== */

    /**
     * The caller's series, newest (most recently uploaded) first, without the
     * payload — {@link BlokSessionRepository#findSummaries} is a column
     * projection, not an entity query.
     *
     * <p>{@code limit} and {@code offset} are clamped rather than rejected: a
     * stale client asking for 5000 rows gets 100, which is friendlier than a
     * 400 the profile screen would have to explain.
     */
    public List<BlokSessionSummaryDto> list(Integer limit, Integer offset) {
        String uid = currentUser.requireUid();
        int lim = clamp(limit == null ? DEFAULT_LIMIT : limit, 1, MAX_LIMIT);
        int off = Math.max(0, offset == null ? 0 : offset);
        return repo.findSummaries(uid, lim, off);
    }

    /**
     * One full series. A uuid that is unknown <em>or</em> belongs to another
     * user answers the same 404 — §3.2 is explicit that the existence of
     * someone else's record must not leak.
     */
    public BlokSessionDto get(UUID uuid) {
        String uid = currentUser.requireUid();
        return repo.findOwn(uid, uuid)
                .map(this::toDto)
                .orElseThrow(() -> new NotFoundException(messages.t("blokSession.notFound")));
    }

    /**
     * Delete one of the caller's own series. Someone else's is a 404, as above.
     *
     * <p>The token is read first so §5.7's broadcast can name it: deleting a
     * shared series kills its link exactly as {@link #unshare} does, and a
     * viewer sitting on the page has to find out. The extra lookup buys that on
     * a path a user takes once in a while; the delete itself is still the
     * owner-scoped one, so the 404 story is unchanged.
     */
    public void delete(UUID uuid) {
        String uid = currentUser.requireUid();
        String token = repo.findOwn(uid, uuid).map(BlokSession::getShareToken).orElse(null);
        if (repo.deleteOwn(uid, uuid) == 0) {
            throw new NotFoundException(messages.t("blokSession.notFound"));
        }
        liveBlok.notifyRevoked(token);
    }

    /* ===================== Sharing — §5.2 ===================== */

    /**
     * Publish one of the caller's own series and return its share token,
     * minting one only if the record does not already have it.
     *
     * <p><b>Issuing twice must not invalidate a link already sent.</b> The
     * player shares the running series with the table, then keeps playing —
     * every "Spremi i započni novu" re-uploads the same record, and the SPA
     * may well ask to share it again. Returning the existing token makes that
     * a no-op instead of a quiet betrayal of everyone holding the old link.
     * Only {@link #unshare} ever changes a token, and only to null.
     *
     * <p>The token comes from {@link ClaimTokens} — 24 {@code SecureRandom}
     * bytes, base64-url, the same generator the pair and preset claim links
     * use — and is <em>not</em> derived from the record's uuid: see this
     * class's javadoc for why that distinction is the whole point.
     *
     * <p>Ownership is the ordinary {@link BlokSessionRepository#findOwn}
     * lookup, so someone else's uuid is a 404 rather than a 403 here too. The
     * assignment is a plain setter on the managed entity; the resource
     * method's transaction flushes it.
     */
    public BlokShareDto share(UUID uuid) {
        String uid = currentUser.requireUid();
        BlokSession s = repo.findOwn(uid, uuid)
                .orElseThrow(() -> new NotFoundException(messages.t("blokSession.notFound")));

        return new BlokShareDto(issueOrReturn(s));
    }

    /**
     * Publish a series identified by its <b>owner and client series id</b>
     * rather than by the record's uuid, and hand back the token.
     *
     * <p>This is {@code BLOK-LINK.md} §6.2's half of sharing: linking a blok
     * to a table in a tournament <em>is</em> the player's consent to publish
     * that scorepad, so {@code BlokLinkService} calls this when a score is
     * written through an approved link. It is the same issue-or-return
     * mechanism {@link #share(UUID)} uses — deliberately the same method, so
     * a link can never mint a second token beside one the owner already
     * handed out.
     *
     * <p>Two things make it safe to call without a {@code currentUser} check:
     * <ul>
     *   <li>The lookup is {@link BlokSessionRepository#findBySessionId}, keyed
     *       on {@code (user_uid, session_id)}. The caller passes the uid, and
     *       the only uid {@code BlokLinkService} ever passes is the link's own
     *       {@code requestedByUid} — so a series can only be published by the
     *       player who linked it, never by the organiser and never by a
     *       stranger who guessed a series id.</li>
     *   <li>It mints <b>nothing</b> when there is no such series: an unknown
     *       (uid, sessionId) is a null, not a new record. §6.2 says the score
     *       still goes in when the series has not been uploaded yet.</li>
     * </ul>
     *
     * @return the live token, or null when this user has no such series yet
     */
    public String shareSeries(String userUid, String sessionId) {
        if (userUid == null || userUid.isBlank() || sessionId == null || sessionId.isBlank()) {
            return null;
        }
        return repo.findBySessionId(userUid, sessionId.trim())
                .map(this::issueOrReturn)
                .orElse(null);
    }

    /**
     * Live share tokens for a batch of links' series, keyed by
     * {@link BlokSessionRepository#shareTokenKey(String, String)}.
     *
     * <p><b>Reads only — it never mints.</b> That is the difference from
     * {@link #shareSeries}: listing links is not consent to publish anything,
     * so a series that has no token keeps having none and its link simply
     * reports {@code shareToken: null}. Minting happens on exactly one path,
     * the score write.
     */
    public Map<String, String> lookupShareTokens(Collection<String> sessionIds) {
        return repo.findShareTokensBySessionIds(sessionIds);
    }

    /**
     * The record's token, minting one only if it has none. The single place a
     * blok share token is ever created, so {@link #share(UUID)} (the owner
     * pressing "Podijeli") and {@link #shareSeries} (a linked table's record
     * becoming public, §6.2) cannot drift apart — and neither can replace a
     * token already sent to somebody. Only {@link #unshare} ever changes one,
     * and only to null.
     */
    private String issueOrReturn(BlokSession s) {
        if (s.getShareToken() == null || s.getShareToken().isBlank()) {
            s.setShareToken(ClaimTokens.generate());
            LOG.debugf("Blok series %s is now shared", s.getUuid());
        }
        return s.getShareToken();
    }

    /**
     * Stop sharing: the token is dropped and {@code GET /blok-share/{token}}
     * starts answering 404 for everyone holding the old link.
     *
     * <p>Idempotent — revoking a record that was never shared is a successful
     * no-op, because the state the caller asked for ("this is not shared") is
     * the state they get. A 404 is reserved for the record itself being
     * unknown or someone else's, exactly as everywhere else here.
     */
    public void unshare(UUID uuid) {
        String uid = currentUser.requireUid();
        BlokSession s = repo.findOwn(uid, uuid)
                .orElseThrow(() -> new NotFoundException(messages.t("blokSession.notFound")));
        String revoked = s.getShareToken();
        s.setShareToken(null);
        // §5.7: ping the sockets opened under the old token and then close
        // them. The ping only fires after this transaction commits, so by the
        // time a viewer refetches the token really is gone and they get the
        // 404 that drives the "this link no longer works" screen. Revoking
        // something that was never shared broadcasts nothing.
        liveBlok.notifyRevoked(revoked);
    }

    /**
     * The public read behind a share link — {@code GET /blok-share/{token}},
     * no authentication, no caller.
     *
     * <p>Two things make that safe:
     *
     * <ul>
     *   <li><b>The key is the token, never the uuid.</b> The lookup matches on
     *       {@code share_token} alone, so a record's uuid — which the owner
     *       sees in their own URLs and in every response — cannot reach this
     *       endpoint at all. A uuid passed here is simply a token that matches
     *       nothing: 404, the same answer as a revoked or invented one, so the
     *       endpoint never confirms that a record exists.</li>
     *   <li><b>Nothing about the owner is in the answer.</b> The shape is the
     *       §3.2 detail — same field names, same order — but with
     *       {@code uuid} and {@code sessionId} blanked: the first is the
     *       owner's private handle to the record, the second the id in their
     *       phone's storage, and a viewer needs neither to read a scorepad.
     *       Everything identifying was never in this DTO to begin with: no
     *       uid, no e-mail, no display name, no profile slug. What is left is
     *       the series result, the games and their deals, and the two side
     *       names the player typed themselves (§5.2).</li>
     * </ul>
     */
    public BlokSessionDto getShared(String token) {
        BlokSession s = repo.findByShareToken(token)
                .orElseThrow(() -> new NotFoundException(messages.t("blokSession.notFound")));

        BlokSessionDto owned = toDto(s);
        return new BlokSessionDto(
                null,   // the owner's handle to the record — not the viewer's business
                null,   // the client-side series id, meaningless off that phone
                owned.startedAt(), owned.finishedAt(), owned.target(),
                // §5.5: the rule travels to the public view too. A shared
                // scorepad whose winners cannot be checked against the rule
                // they were played under is exactly what §5.5 forbids, and the
                // rule says nothing whatsoever about who owns the record.
                owned.gameEndRule(),
                owned.names(),
                owned.gamesUs(), owned.gamesThem(), owned.gamesCount(), owned.createdAt(),
                owned.games());
    }

    /* ===================== Payload ===================== */

    /**
     * Entity → full DTO, parsing the stored games back out of the jsonb text.
     *
     * <p>A payload that will not parse is served as an empty game list rather
     * than a 500: the summary columns still describe the series correctly, and
     * a history row that renders "4 : 3" with no detail beats a profile
     * section that cannot load at all. It can only happen if the column was
     * written by something other than {@link #serialisePayload}.
     */
    private BlokSessionDto toDto(BlokSession s) {
        return mapper.toDto(s, parsePayload(s));
    }

    private List<BlokGameDto> parsePayload(BlokSession s) {
        String raw = s.getPayload();
        if (raw == null || raw.isBlank()) return List.of();
        try {
            List<BlokGameDto> games = json.readValue(raw, new TypeReference<List<BlokGameDto>>() {});
            return games == null ? List.of() : games;
        } catch (Exception e) {
            LOG.warnf(e, "Unreadable blok payload on session %s", s.getUuid());
            return List.of();
        }
    }

    /**
     * The normalised games as the JSON text that goes into the column, checked
     * against the 256 KB cap in exactly that form (§3.3: "payload veći od
     * 256 KB nakon serijalizacije"). Measured in <b>bytes of UTF-8</b>, not
     * characters — the player's side names and any future string field can be
     * multi-byte, and the cap protects storage, not screen width.
     */
    private String serialisePayload(List<BlokGameDto> games) {
        String payload;
        try {
            payload = json.writeValueAsString(games);
        } catch (Exception e) {
            // Only reachable if our own records stop being serialisable.
            throw ApiCodes.badRequest("INVALID_PAYLOAD");
        }
        if (payload.getBytes(StandardCharsets.UTF_8).length > MAX_PAYLOAD_BYTES) {
            throw ApiCodes.badRequest("PAYLOAD_TOO_LARGE");
        }
        return payload;
    }

    /* ===================== Validation — §3.3 ===================== */

    /** Non-blank and at most 64 characters, or {@code INVALID_SESSION_ID}. */
    private static String normaliseSessionId(String raw) {
        if (raw == null) throw ApiCodes.badRequest("INVALID_SESSION_ID");
        String s = raw.trim();
        if (s.isEmpty() || s.length() > MAX_SESSION_ID) {
            throw ApiCodes.badRequest("INVALID_SESSION_ID");
        }
        return s;
    }

    private static int normaliseTarget(Integer raw) {
        if (raw == null || raw < 1 || raw > MAX_TARGET) {
            throw ApiCodes.badRequest("INVALID_TARGET");
        }
        return raw;
    }

    /**
     * Rebuild every game from scratch, rejecting anything §3.3 forbids and
     * dropping anything the client invented.
     *
     * <p>Rebuilding rather than validating-in-place is the point: what is
     * persisted is this application's own records re-serialised, so the jsonb
     * column can only ever contain the documented shape. An extra field in the
     * request is ignored by Jackson on the way in and simply does not exist on
     * the way out.
     */
    private List<BlokGameDto> normaliseGames(List<BlokGameDto> raw, int sessionTarget) {
        if (raw == null || raw.isEmpty()) {
            // A series with no games is not worth a history row, and the blok
            // has no reason to send one: §2.2 archives the current game only
            // when it has deals, so an untouched table produces nothing.
            throw ApiCodes.badRequest("NO_GAMES");
        }
        if (raw.size() > MAX_GAMES) throw ApiCodes.badRequest("TOO_MANY_GAMES");

        List<BlokGameDto> out = new ArrayList<>(raw.size());
        for (BlokGameDto g : raw) {
            if (g == null) throw ApiCodes.badRequest("INVALID_GAMES");
            out.add(normaliseGame(g, sessionTarget));
        }
        return out;
    }

    private BlokGameDto normaliseGame(BlokGameDto g, int sessionTarget) {
        List<BlokRoundDto> rawRounds = g.rounds() == null ? List.of() : g.rounds();
        if (rawRounds.size() > MAX_ROUNDS_PER_GAME) throw ApiCodes.badRequest("TOO_MANY_ROUNDS");

        List<BlokRoundDto> rounds = new ArrayList<>(rawRounds.size());
        for (BlokRoundDto r : rawRounds) {
            if (r == null) throw ApiCodes.badRequest("INVALID_GAMES");
            rounds.add(normaliseRound(r));
        }

        Integer gameTarget = g.target() == null ? sessionTarget : g.target();
        if (gameTarget < 1 || gameTarget > MAX_TARGET) throw ApiCodes.badRequest("INVALID_TARGET");

        return new BlokGameDto(
                // The id is a client-side list key and nothing else, so a
                // missing or oversized one is repaired rather than rejected:
                // failing a whole upload over a React key would lose real data.
                gameId(g.id()),
                epochOrNull(g.createdAt()),
                epochOrNull(g.finishedAt()),
                gameTarget,
                endRule(g.gameEndRule()),
                dealerSeat(g.dealer()),
                side(g.winner(), true),
                totals(g.totals()),
                List.copyOf(rounds));
    }

    private BlokRoundDto normaliseRound(BlokRoundDto r) {
        return new BlokRoundDto(
                // A deal always has a caller — §2.3 types it non-nullable.
                side(r.caller(), false),
                cards(r.cards()),
                declarations(r.declarations()),
                side(r.stiglja(), true),
                trump(r.trump()));
    }

    /** {@code "us"} / {@code "them"}, and null when {@code nullable}. */
    private static String side(String raw, boolean nullable) {
        if (raw == null || raw.isBlank()) {
            if (nullable) return null;
            throw ApiCodes.badRequest("INVALID_SIDE");
        }
        String s = raw.trim();
        if (!SIDES.contains(s)) throw ApiCodes.badRequest("INVALID_SIDE");
        return s;
    }

    /**
     * The seat that dealt a game's first deal, or null (BLOK.md §3.3.4).
     *
     * <p>Nullable on purpose and unrecognised values are dropped rather than
     * refused: this is a label on a record the server never acts on, and an
     * upload carrying real deals must not fail over the name of a chair.
     * Records written before the field existed simply have none.
     */
    private static String dealerSeat(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        return DEALER_SEATS.contains(s) ? s : null;
    }

    /**
     * How a game ends — {@code "dosta"} or {@code "prolaz"} (§5.5).
     *
     * <p><b>Never throws.</b> Anything that is not {@code dosta} — absent,
     * blank, misspelt, a value some future client invents — becomes
     * {@code prolaz}, the default §5.5 gives an absent field. The rule is a
     * <em>label on a record</em>: the server stores it so a reader can check
     * the client's {@code winner} against it, and acts on it nowhere. Rejecting
     * an unknown value would break an older or newer client's upload and lose
     * a real scorepad, to gain nothing at all — unlike {@code trump} or
     * {@code side}, which name things the payload's own structure depends on.
     *
     * <p>Trimmed and case-folded before the comparison, so {@code " Dosta"}
     * from a hand-rolled client is honoured rather than silently flipped to
     * the other rule.
     */
    private static String endRule(String raw) {
        if (raw == null) return END_RULE_PROLAZ;
        return END_RULE_DOSTA.equals(raw.trim().toLowerCase(Locale.ROOT))
                ? END_RULE_DOSTA : END_RULE_PROLAZ;
    }

    /**
     * The series-level rule that goes into the column the listing reads.
     *
     * <p>The client may send one explicitly; when it does not, this is the
     * <b>newest game's</b> rule — the setting in force for the series as it
     * now stands, the same thing {@code target} says beside it. Per game the
     * rule stays in the payload, because a player who changes the setting
     * mid-series leaves games behind that were decided under the old one, and
     * §5.5 exists precisely so those games' winners stay checkable.
     *
     * <p>{@code games} is never empty here — {@link #normaliseGames} rejects
     * an empty series with {@code NO_GAMES} — but the fallback is written out
     * anyway rather than left to an index-out-of-bounds.
     */
    private static String seriesEndRule(String requested, List<BlokGameDto> games) {
        if (requested != null && !requested.isBlank()) return endRule(requested);
        if (games.isEmpty()) return END_RULE_PROLAZ;
        return endRule(games.get(games.size() - 1).gameEndRule());
    }

    private static String trump(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String s = raw.trim().toUpperCase();
        if (!TRUMPS.contains(s)) throw ApiCodes.badRequest("INVALID_TRUMP");
        return s;
    }

    /** A game's running total: bounded generously — see {@link #MAX_GAME_TOTAL}. */
    private static BlokScoresDto totals(BlokScoresDto raw) {
        if (raw == null) return new BlokScoresDto(0, 0);
        return new BlokScoresDto(
                bounded(raw.us(), MAX_GAME_TOTAL),
                bounded(raw.them(), MAX_GAME_TOTAL));
    }

    /** One deal's card points: the literal 0..1000 of §3.3. */
    private static BlokScoresDto cards(BlokScoresDto raw) {
        if (raw == null) return new BlokScoresDto(0, 0);
        return new BlokScoresDto(
                bounded(raw.us(), MAX_DEAL_POINTS),
                bounded(raw.them(), MAX_DEAL_POINTS));
    }

    /**
     * Whole numbers only, {@code 0..max}. Null becomes 0 so the payload never
     * carries a hole the profile would have to render as "null : 40"; anything
     * out of range is {@code INVALID_SCORE}.
     *
     * <p>"Not a whole number" is enforced by the type: the field is
     * {@code Integer}, so {@code 91.5} fails Jackson deserialisation before it
     * reaches here and answers 400 through the standard envelope.
     */
    private static Integer bounded(Integer v, int max) {
        if (v == null) return 0;
        if (v < 0 || v > max) throw ApiCodes.badRequest("INVALID_SCORE");
        return v;
    }

    private static BlokDeclarationsDto declarations(BlokDeclarationsDto raw) {
        if (raw == null) return new BlokDeclarationsDto(List.of(), List.of());
        return new BlokDeclarationsDto(declarationList(raw.us()), declarationList(raw.them()));
    }

    /** Each declaration is a whole number 0..1000 (§3.3), and there are few of them. */
    private static List<Integer> declarationList(List<Integer> raw) {
        if (raw == null || raw.isEmpty()) return List.of();
        if (raw.size() > MAX_DECLARATIONS_PER_SIDE) throw ApiCodes.badRequest("INVALID_DECLARATION");
        List<Integer> out = new ArrayList<>(raw.size());
        for (Integer d : raw) {
            if (d == null || d < 0 || d > MAX_DEAL_POINTS) {
                throw ApiCodes.badRequest("INVALID_DECLARATION");
            }
            out.add(d);
        }
        return List.copyOf(out);
    }

    /* ===================== Small helpers ===================== */

    /** The series result: how many games this side won. §3.1's {@code games_us}. */
    private static int countWins(List<BlokGameDto> games, String sideName) {
        int n = 0;
        for (BlokGameDto g : games) {
            if (sideName.equals(g.winner())) n++;
        }
        return n;
    }

    /** Epoch ms → instant, or null when absent or plainly wrong. */
    private static OffsetDateTime toInstant(Long epochMs) {
        Long ms = epochOrNull(epochMs);
        return ms == null ? null : Instant.ofEpochMilli(ms).atOffset(ZoneOffset.UTC);
    }

    private static Long epochOrNull(Long epochMs) {
        if (epochMs == null) return null;
        if (epochMs < MIN_EPOCH_MS || epochMs > MAX_EPOCH_MS) return null;
        return epochMs;
    }

    private static String gameId(String raw) {
        if (raw == null || raw.isBlank()) return UUID.randomUUID().toString();
        String s = raw.trim();
        return s.length() <= MAX_GAME_ID ? s : s.substring(0, MAX_GAME_ID);
    }

    private static String trimTo(String s, int max) {
        if (s == null) return null;
        String t = s.trim();
        if (t.isEmpty()) return null;
        return t.length() <= max ? t : t.substring(0, max);
    }

    private static int clamp(int v, int min, int max) {
        return Math.max(min, Math.min(max, v));
    }
}
