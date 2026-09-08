package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.BlokDeclarationsDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokGameDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokNamesDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokRoundDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokScoresDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokSessionDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokSessionSummaryDto;
import hr.mrodek.apps.bela_turniri.dtos.SaveBlokSessionRequest;
import hr.mrodek.apps.bela_turniri.model.BlokSession;
import hr.mrodek.apps.bela_turniri.repository.BlokSessionRepository;
import hr.mrodek.apps.bela_turniri.repository.BlokSessionSummaryRow;
import hr.mrodek.apps.bela_turniri.services.BlokHistoryService;
import hr.mrodek.apps.bela_turniri.services.CurrentUser;
import io.quarkus.test.TestTransaction;
import io.quarkus.test.junit.QuarkusMock;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.WebApplicationException;
import org.hibernate.SessionFactory;
import org.hibernate.resource.jdbc.spi.StatementInspector;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Coverage for "Povijest blokova na profilu" ({@code BLOK-HISTORY.md} §3).
 *
 * <p>What is worth testing here, and why:
 *
 * <ol>
 *   <li><b>The changeset applied</b>, including the {@code (user_uid,
 *       session_id)} unique constraint, which is the entire idempotency
 *       story: without it a retry silently duplicates.</li>
 *   <li><b>Every endpoint is closed to anonymous callers.</b> This is private
 *       data that is hidden even on another user's profile page.</li>
 *   <li><b>A re-POST of the same {@code sessionId} returns the same record</b>
 *       — the behaviour the blok's retry loop depends on — and, since §5.1,
 *       <b>updates it</b> when the series has grown, while {@code uuid} and
 *       {@code createdAt} stay put so a share link already sent survives.</li>
 *   <li><b>Sharing (§5.2)</b>: a token issued twice is the same token, the
 *       public read works with a token and never with a uuid, and a revoked
 *       link is a 404.</li>
 *   <li><b>Another user's uuid is a 404, not a 403</b> (§3.2): the existence
 *       of someone else's record must not leak.</li>
 *   <li><b>The listing never selects {@code payload}</b>, asserted against the
 *       real generated SQL. A regression is invisible from the DTO and would
 *       drag every stored games blob through memory to render a list of
 *       scores.</li>
 *   <li><b>The payload really is jsonb</b>, and the String↔jsonb mapping
 *       stores a JSON document rather than a JSON-encoded string.</li>
 *   <li><b>The §3.3 limits answer bare codes</b>, since the SPA compares them
 *       literally.</li>
 * </ol>
 *
 * <p>The endpoints themselves are {@code @Authenticated} and this project has
 * no Firebase test-token scaffolding, so 3, 4, 6 and 7 drive
 * {@link BlokHistoryService} directly with a stand-in {@link CurrentUser} —
 * the same code path the resource methods call, inside a real transaction
 * against the real docker-compose Postgres. Every writing test is
 * {@code @TestTransaction}, so nothing survives the run.
 */
@QuarkusTest
class BlokHistoryControllerTest {

    @Inject EntityManager em;
    @Inject BlokHistoryService history;
    @Inject BlokSessionRepository repo;
    @Inject com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    /** Flip {@link #asUser} to change who the service thinks is calling. */
    public static class SwitchableUser extends CurrentUser {
        volatile String uid = "test-uid-a";

        @Override public String requireUid() { return uid; }
        @Override public Optional<String> uid() { return Optional.ofNullable(uid); }
        @Override public String uidOrNull() { return uid; }
        @Override public boolean isAnonymous() { return uid == null; }
        @Override public boolean isAdmin() { return false; }
        @Override public String displayName() { return "Test"; }
    }

    private SwitchableUser me;

    @BeforeEach
    void installCaller() {
        me = new SwitchableUser();
        QuarkusMock.installMockForType(me, CurrentUser.class);
    }

    private void asUser(String uid) {
        me.uid = uid;
    }

    /* ---------- 1. migration ---------- */

    @Test
    void changesetCreatedTableSequenceAndTheIdempotencyConstraint() {
        assertEquals(1L, count("""
                select count(*) from information_schema.tables
                where table_name = 'blok_sessions'
                """), "blok_sessions table missing — changeset did not apply");

        assertEquals(1L, count("""
                select count(*) from information_schema.sequences
                where sequence_name = 'seq_blok_sessions_id'
                """), "sequence named in @SequenceGenerator missing");

        // The whole reliability story: without this, a retried upload
        // duplicates instead of returning the record it already stored.
        String indexDef = (String) em.createNativeQuery("""
                        select indexdef from pg_indexes
                        where indexname = 'uq_blok_sessions_user_session'
                        """)
                .getSingleResult();
        assertTrue(indexDef.contains("UNIQUE"), () -> "not unique: " + indexDef);
        assertTrue(indexDef.contains("user_uid") && indexDef.contains("session_id"),
                () -> "not keyed on (user_uid, session_id): " + indexDef);

        // §3.1 says jsonb, and the ON CONFLICT insert casts to it explicitly.
        assertEquals("jsonb", em.createNativeQuery("""
                        select data_type from information_schema.columns
                        where table_name = 'blok_sessions' and column_name = 'payload'
                        """).getSingleResult().toString().toLowerCase(Locale.ROOT));
    }

    /** §5.2's changeset: the share token column and its unique index. */
    @Test
    void shareChangesetAddedANullableUniqueShareToken() {
        Object[] col = (Object[]) em.createNativeQuery("""
                        select data_type, character_maximum_length, is_nullable
                        from information_schema.columns
                        where table_name = 'blok_sessions' and column_name = 'share_token'
                        """).getSingleResult();
        assertEquals("character varying", col[0].toString());
        assertEquals(48, ((Number) col[1]).intValue(), "§5.2 fixes the column at varchar(48)");
        // NULL is "not shared", which is every record's state until the owner
        // asks. A NOT NULL here would have forced a token onto records nobody
        // consented to publish.
        assertEquals("YES", col[2].toString(), "share_token must be nullable — NULL = not shared");

        String indexDef = (String) em.createNativeQuery("""
                        select indexdef from pg_indexes
                        where indexname = 'uq_blok_sessions_share_token'
                        """).getSingleResult();
        assertTrue(indexDef.contains("UNIQUE"), () -> "not unique: " + indexDef);
        assertTrue(indexDef.contains("share_token"), () -> "not keyed on share_token: " + indexDef);
    }

    private long count(String sql) {
        return ((Number) em.createNativeQuery(sql).getSingleResult()).longValue();
    }

    /* ---------- 2. closed to anonymous callers ---------- */

    @Test
    void anonymousIsRejectedEverywhere() {
        given().when().get("/user/me/blok-history").then().statusCode(401);
        given().when().get("/user/me/blok-history?limit=5&offset=0").then().statusCode(401);

        given().contentType(ContentType.JSON)
                .body("{\"sessionId\":\"x\",\"target\":1001,\"games\":[]}")
                .when().post("/user/me/blok-history").then().statusCode(401);

        String uuid = UUID.randomUUID().toString();
        given().when().get("/user/me/blok-history/" + uuid).then().statusCode(401);
        // No Content-Type on purpose: the class-level @Consumes(JSON) would
        // otherwise answer 415 before auth ran. See the controller.
        given().when().delete("/user/me/blok-history/" + uuid).then().statusCode(401);

        // §5.2: issuing and revoking a share link are the owner's, and only
        // the owner's. Both are sent bodyless and Content-Type-less, which is
        // why both carry @Consumes(WILDCARD) — a 415 here would mean the auth
        // check never ran.
        given().when().post("/user/me/blok-history/" + uuid + "/share").then().statusCode(401);
        given().when().delete("/user/me/blok-history/" + uuid + "/share").then().statusCode(401);
    }

    /**
     * The public read is public — and reachable by token only.
     *
     * <p>Over real HTTP with no credentials, so it pins the one thing the
     * service-level tests cannot: that {@code GET /blok-share/{token}} carries
     * no {@code @Authenticated}. 404 rather than 401 is the whole assertion —
     * an anonymous caller got as far as the lookup.
     *
     * <p>The second call is §5.2's actual security property: the record's own
     * uuid, which the owner sees in their URLs and in every response, is just
     * a token that matches nothing. Nothing here can distinguish "no such
     * record" from "that record is not shared".
     */
    @Test
    void thePublicShareReadIsAnonymousAndUuidsAreNotTokens() {
        given().when().get("/blok-share/" + "nosuchtoken0000000000000000000000")
                .then().statusCode(404);
        given().when().get("/blok-share/" + UUID.randomUUID())
                .then().statusCode(404);
    }

    /* ---------- 3. the idempotent re-POST ---------- */

    @Test
    @TestTransaction
    void resendingTheSameSessionIdReturnsTheSameRecord() {
        asUser("test-uid-a");
        String sessionId = "sess-" + UUID.randomUUID();

        BlokSessionDto first = history.save(series(sessionId));
        BlokSessionDto again = history.save(series(sessionId));

        assertEquals(first.uuid(), again.uuid(),
                "a retried upload must be the same record, not a new one");
        assertEquals(first.createdAt(), again.createdAt());
        // `names` is nested and never null on the wire: an unnamed side is ""
        // ("render the translated MI / VI"), not null. Both directions of §2.3
        // use the same shape.
        assertNotNull(first.names());
        assertEquals("", first.names().us());
        assertEquals("", first.names().them());

        assertEquals(4, first.gamesUs(), "series score counted from the per-game winners");
        assertEquals(3, first.gamesThem());
        assertEquals(7, first.gamesCount());
        assertEquals(7, again.games().size());

        assertEquals(1L, count("""
                select count(*) from blok_sessions
                where user_uid = 'test-uid-a' and session_id = '""" + sessionId + "'"),
                "the second POST stored a duplicate row");
    }

    /* ---------- 3b. §5.1: the re-POST UPDATES, keeping uuid and createdAt ---------- */

    /**
     * The behaviour §5.1 changed. A series used to be uploaded once, at the
     * end; the player now presses "Spremi i započni novu" when starting each
     * game, so the SAME sessionId comes back one game longer and the stored
     * record has to follow.
     *
     * <p>The two things that must NOT follow are {@code uuid} and
     * {@code createdAt}: a share link already sent points at that uuid, and
     * {@code createdAt} is the history listing's sort key. Both are kept out
     * of the SQL conflict's SET list, and both are asserted here.
     */
    @Test
    @TestTransaction
    void reUploadingAGrownSeriesUpdatesTheRecordWithoutChangingItsIdentity() {
        asUser("test-uid-a");
        String sessionId = "sess-" + UUID.randomUUID();

        // Three games in, 2 : 1, still playing — no finish time yet.
        List<BlokGameDto> sofar = new ArrayList<>(
                List.of(game("us", 3), game("them", 3), game("us", 3)));
        BlokSessionDto first = history.save(seriesOf(sessionId, sofar, null, "Mi", "Vi"));

        assertEquals(2, first.gamesUs());
        assertEquals(1, first.gamesThem());
        assertEquals(3, first.gamesCount());
        assertEquals(3, first.games().size());

        // The player starts a fourth game, so the whole series is uploaded
        // again — now four games, 2 : 2, with the names edited in between.
        sofar.add(game("them", 3));
        BlokSessionDto second = history.save(
                seriesOf(sessionId, sofar, 1_757_299_000_000L, "Ekipa A", "Ekipa B"));

        // Identity survived…
        assertEquals(first.uuid(), second.uuid(),
                "the uuid changed — every share link already sent would be dead");
        assertEquals(first.createdAt(), second.createdAt(),
                "createdAt changed — the history listing would reshuffle on every game");
        assertEquals(first.sessionId(), second.sessionId());
        assertEquals(first.startedAt(), second.startedAt(),
                "startedAt is a fact about the first game; a later upload cannot know it better");

        // …and everything the client can change was refreshed.
        assertEquals(2, second.gamesUs());
        assertEquals(2, second.gamesThem());
        assertEquals(4, second.gamesCount());
        assertEquals(4, second.games().size(), "the fourth game never reached the payload");
        assertEquals("Ekipa A", second.names().us());
        assertEquals("Ekipa B", second.names().them());
        assertNotNull(second.finishedAt(), "finishedAt was not updated");

        // Still one row, and the DB agrees with the response — not just the
        // in-memory entity Hibernate happened to be holding.
        assertEquals(1L, count("""
                select count(*) from blok_sessions
                where user_uid = 'test-uid-a' and session_id = '""" + sessionId + "'"));
        assertEquals(4L, ((Number) em.createNativeQuery(
                        "select jsonb_array_length(payload) from blok_sessions where uuid = :u")
                .setParameter("u", first.uuid()).getSingleResult()).longValue(),
                "the stored jsonb was not rewritten");

        // A fresh read through the ordinary owner endpoint shows the update.
        BlokSessionDto reread = history.get(first.uuid());
        assertEquals(4, reread.games().size());
        assertEquals(4, reread.gamesCount());
    }

    /**
     * §3.3 applies to the update path exactly as it does to the insert: an
     * update is as much untrusted user JSON. A record that already exists must
     * not be widened past the limits by a later upload.
     */
    @Test
    @TestTransaction
    void anUpdateIsValidatedLikeAnInsert() {
        asUser("test-uid-a");
        String sessionId = "sess-" + UUID.randomUUID();
        BlokSessionDto first = history.save(series(sessionId));

        assertCode("TOO_MANY_GAMES", () -> history.save(seriesOf(sessionId,
                java.util.Collections.nCopies(51, game("us", 1)), null, "", "")));
        assertCode("INVALID_TRUMP", () -> history.save(seriesOf(sessionId,
                List.of(gameWithTrump("SRCE")), null, "", "")));
        assertCode("PAYLOAD_TOO_LARGE", () -> history.save(seriesOf(sessionId,
                java.util.Collections.nCopies(50, game("us", 300)), null, "", "")));

        // …and none of that touched the stored record.
        BlokSessionDto still = history.get(first.uuid());
        assertEquals(7, still.gamesCount());
        assertEquals(7, still.games().size());
    }

    /* ---------- 4. someone else's uuid is a 404, never a 403 ---------- */

    @Test
    @TestTransaction
    void anotherUsersRecordIsInvisible() {
        asUser("test-uid-a");
        BlokSessionDto mine = history.save(series("sess-" + UUID.randomUUID()));
        UUID uuid = mine.uuid();

        asUser("test-uid-b");
        // Not a ForbiddenException: 403 would confirm the record exists.
        assertThrows(NotFoundException.class, () -> history.get(uuid));
        assertThrows(NotFoundException.class, () -> history.delete(uuid));
        assertTrue(history.list(50, 0).isEmpty(), "another user's series leaked into the listing");

        // …and an id that never existed is answered exactly the same way.
        UUID nobodys = UUID.randomUUID();
        assertThrows(NotFoundException.class, () -> history.get(nobodys));

        asUser("test-uid-a");
        List<BlokSessionSummaryDto> ours = history.list(50, 0);
        BlokSessionSummaryDto row = ours.stream().filter(s -> uuid.equals(s.uuid())).findFirst()
                .orElseThrow(() -> new AssertionError("the owner cannot see their own series"));
        // The listing carries the nested names too, folded in memory from the
        // projected columns — never by going back for the payload.
        assertNotNull(row.names());
        assertEquals(4, row.gamesUs());
        assertEquals(3, row.gamesThem());
    }

    /* ---------- 5. the listing must not read the payload ---------- */

    /**
     * Runs the repository's own listing JPQL under a Hibernate
     * {@link StatementInspector} and inspects the SQL Hibernate actually
     * emitted. Asserted rather than assumed because a {@code @Basic(fetch =
     * LAZY)} on a jsonb column does NOT defer without bytecode enhancement —
     * the reason this listing is a constructor projection in the first place.
     */
    @Test
    void listingSqlNeverSelectsThePayload() {
        List<String> statements = new ArrayList<>();
        StatementInspector spy = sql -> {
            statements.add(sql);
            return sql;
        };

        SessionFactory sf = em.getEntityManagerFactory().unwrap(SessionFactory.class);
        try (var session = sf.withOptions().statementInspector(spy).openSession()) {
            session.createQuery(BlokSessionRepository.SUMMARY_JPQL, BlokSessionSummaryRow.class)
                    .setParameter("uid", "test-uid-nobody")
                    .setMaxResults(20)
                    .getResultList();
        }

        assertFalse(statements.isEmpty(), "the statement inspector saw nothing");
        for (String sql : statements) {
            assertFalse(sql.toLowerCase(Locale.ROOT).contains("payload"),
                    () -> "the history listing selected the jsonb payload:\n" + sql);
        }
        // Sanity: it really did read the summary columns.
        assertTrue(statements.stream().anyMatch(s -> s.toLowerCase(Locale.ROOT).contains("games_us")),
                () -> "expected the summary columns in:\n" + statements);
    }

    /* ---------- 6. the payload is real jsonb ---------- */

    @Test
    @TestTransaction
    void payloadRoundTripsAsRealJsonb() {
        asUser("test-uid-a");
        String sessionId = "sess-" + UUID.randomUUID();
        BlokSessionDto saved = history.save(series(sessionId));

        // A jsonb column holding a DOCUMENT, not a JSON-encoded string: if the
        // String mapping had gone through Jackson the column would contain
        // "\"[{...}]\"" and jsonb_typeof would say 'string'.
        Object type = em.createNativeQuery(
                        "select jsonb_typeof(payload) from blok_sessions where uuid = :u")
                .setParameter("u", saved.uuid())
                .getSingleResult();
        assertEquals("array", type.toString());

        Object winner = em.createNativeQuery(
                        "select payload -> 0 ->> 'winner' from blok_sessions where uuid = :u")
                .setParameter("u", saved.uuid())
                .getSingleResult();
        assertEquals("us", winner.toString(), "the stored JSON is not addressable by Postgres");

        // …and it comes back through the entity mapping unchanged.
        em.clear();
        BlokSession row = repo.findOwn("test-uid-a", saved.uuid()).orElseThrow();
        assertNotNull(row.getPayload());
        assertTrue(row.getPayload().trim().startsWith("["), () -> "payload: " + row.getPayload());

        BlokSessionDto reread = history.get(saved.uuid());
        assertEquals(7, reread.games().size());
        assertEquals("HERC", reread.games().get(0).rounds().get(0).trump());
        assertEquals(List.of(20, 50), reread.games().get(0).rounds().get(0).declarations().us());
        // Payload timestamps stay epoch ms — they were never columns.
        assertEquals(1_757_280_000_000L, reread.games().get(0).createdAt());
    }

    /* ---------- 7. the §3.3 limits, as bare codes ---------- */

    @Test
    @TestTransaction
    void inputLimitsAnswerBareCodes() {
        asUser("test-uid-a");

        assertCode("INVALID_SESSION_ID", () -> history.save(withSessionId("")));
        assertCode("INVALID_SESSION_ID", () -> history.save(withSessionId("x".repeat(65))));
        assertCode("NO_GAMES", () -> history.save(withGames(List.of())));
        assertCode("TOO_MANY_GAMES",
                () -> history.save(withGames(java.util.Collections.nCopies(51, game("us", 1)))));
        assertCode("TOO_MANY_ROUNDS",
                () -> history.save(withGames(List.of(game("us", 301)))));
        assertCode("INVALID_SIDE",
                () -> history.save(withGames(List.of(gameWithCaller("them-ish")))));
        assertCode("INVALID_TRUMP",
                () -> history.save(withGames(List.of(gameWithTrump("SRCE")))));
        assertCode("INVALID_SCORE",
                () -> history.save(withGames(List.of(gameWithCards(1001)))));
        assertCode("INVALID_DECLARATION",
                () -> history.save(withGames(List.of(gameWithDeclaration(1001)))));
        assertCode("INVALID_TARGET", () -> history.save(withTarget(0)));

        // §3.3's 256 KB, measured on the serialized payload. 50 games × 300
        // deals is comfortably over it while staying inside the count limits,
        // which is the point: the size cap is the backstop the counts alone
        // do not provide.
        assertCode("PAYLOAD_TOO_LARGE",
                () -> history.save(withGames(java.util.Collections.nCopies(50, game("us", 300)))));
    }

    /**
     * A game's running total legitimately passes 1000 — a game is played TO
     * 1001 — so the 0..1000 of §3.3 applies to a deal's card points and to a
     * declaration, not to {@code totals}. Pinned so nobody "fixes" the bound
     * and breaks every ordinary game.
     */
    @Test
    @TestTransaction
    void aFinishedGameTotalAboveOneThousandIsAccepted() {
        asUser("test-uid-a");
        BlokSessionDto saved = history.save(series("sess-" + UUID.randomUUID()));
        assertEquals(1012, saved.games().get(0).totals().us());
    }

    /* ---------- 8. the frozen wire shape ---------- */

    /**
     * Two frontend agents are coding against these field names, so pin them.
     *
     * <p>The one asymmetry worth remembering: the session's own dates are
     * ISO-8601 (they are real timestamptz columns, and every date in the SPA is
     * formatted from an ISO string by {@code utils/format.ts}), while the
     * timestamps <em>inside</em> {@code games} stay epoch ms because that is
     * stored payload handed back exactly as §2.3 sent it.
     */
    @Test
    @TestTransaction
    void responseFieldNamesAreTheOnesTheFrontendCodedAgainst() throws Exception {
        asUser("test-uid-a");
        BlokSessionDto dto = history.save(series("sess-" + UUID.randomUUID()));
        String out = objectMapper.writeValueAsString(dto);

        for (String field : List.of("uuid", "sessionId", "startedAt", "finishedAt", "target",
                "gameEndRule", "names", "gamesUs", "gamesThem", "gamesCount", "createdAt",
                "games")) {
            assertTrue(out.contains("\"" + field + "\":"), () -> "missing " + field + " in " + out);
        }
        assertTrue(out.contains("\"names\":{\"us\":\"\",\"them\":\"\"}"), () -> out);
        // §5.5, at both levels: the series' rule and each game's own.
        assertTrue(out.contains("\"gameEndRule\":\"prolaz\""), () -> out);

        // ISO at the session level…
        assertTrue(out.contains("\"startedAt\":\"20"),
                () -> "session dates must serialise as ISO-8601 strings: " + out);
        // …epoch ms inside the payload.
        assertTrue(out.contains("\"createdAt\":1757280000000"),
                () -> "game timestamps must stay epoch ms: " + out);

        String listRow = objectMapper.writeValueAsString(history.list(1, 0).get(0));
        assertTrue(listRow.contains("\"gameEndRule\":\"prolaz\""),
                () -> "the listing cannot print \"Do 1001 · prolaz\": " + listRow);
        assertFalse(listRow.contains("\"games\""), () -> "the summary leaked the games: " + listRow);
        assertFalse(listRow.contains("payload"), () -> "the summary leaked the payload: " + listRow);
    }

    /* ---------- 9. §5.2: sharing by link ---------- */

    /**
     * Issuing a token twice must return the SAME token.
     *
     * <p>Not a nicety: the player shares the running series with the table and
     * keeps playing, so this is called again and again against a record whose
     * link is already in somebody's chat. A fresh token on every call would
     * quietly kill every link already sent.
     */
    @Test
    @TestTransaction
    void issuingTheShareTokenTwiceReturnsTheSameToken() {
        asUser("test-uid-a");
        BlokSessionDto saved = history.save(series("sess-" + UUID.randomUUID()));

        String first = history.share(saved.uuid()).token();
        assertNotNull(first);
        assertFalse(first.isBlank());
        assertFalse(first.contains(saved.uuid().toString()),
                "the token must not be derived from the uuid");
        assertTrue(first.length() <= 48, () -> "wider than the column: " + first);

        String again = history.share(saved.uuid()).token();
        assertEquals(first, again, "re-issuing minted a new token and killed the link already sent");

        // Saving the series again — which the blok does at the start of every
        // game (§5.1) — must not disturb it either.
        history.save(series(saved.sessionId()));
        assertEquals(first, history.share(saved.uuid()).token(),
                "the upsert overwrote share_token; every shared link would break mid-series");
    }

    /**
     * The public read: reachable with the token, and never with the uuid.
     *
     * <p>The uuid half is the point of §5.2. Records exist without their owner
     * ever consenting to publish them, and the uuid appears in the owner's own
     * URLs and in every response they receive — so if the public route
     * accepted one, a leak or a guess would be an exposure. It matches on
     * {@code share_token} alone, so a uuid is simply a token that matches
     * nothing.
     */
    @Test
    @TestTransaction
    void thePublicReadTakesATokenAndNeverAUuid() {
        asUser("test-uid-a");
        BlokSessionDto saved = history.save(series("sess-" + UUID.randomUUID()));
        String token = history.share(saved.uuid()).token();

        BlokSessionDto shared = history.getShared(token);

        // The scorepad itself is all there.
        assertEquals(4, shared.gamesUs());
        assertEquals(3, shared.gamesThem());
        assertEquals(7, shared.gamesCount());
        assertEquals(7, shared.games().size());
        assertEquals("HERC", shared.games().get(0).rounds().get(0).trump());
        assertEquals(List.of(20, 50), shared.games().get(0).rounds().get(0).declarations().us());
        assertNotNull(shared.names());

        // …minus the owner's own handles to it.
        assertNull(shared.uuid(), "the public answer carried the record's uuid");
        assertNull(shared.sessionId(), "the public answer carried the client's series id");

        // Nothing that says who saved it — asserted on the serialised body,
        // because that is what actually leaves the server.
        String out = assertDoesNotThrowSerialised(shared);
        assertFalse(out.contains("test-uid-a"), () -> "the owner's uid leaked: " + out);
        for (String owner : List.of("userUid", "\"uid\"", "email", "displayName", "slug",
                "shareToken", token)) {
            assertFalse(out.contains(owner), () -> "the public body carried " + owner + ": " + out);
        }
        // The shape itself is still the §3.2 detail — same keys, so a client
        // written for the owner's view renders this unchanged.
        for (String field : List.of("uuid", "sessionId", "startedAt", "finishedAt", "target",
                "gameEndRule", "names", "gamesUs", "gamesThem", "gamesCount", "createdAt",
                "games")) {
            assertTrue(out.contains("\"" + field + "\":"), () -> "missing " + field + " in " + out);
        }
        assertTrue(out.contains("\"uuid\":null") && out.contains("\"sessionId\":null"), () -> out);

        // The uuid is not a token, and neither is anything else.
        assertThrows(NotFoundException.class, () -> history.getShared(saved.uuid().toString()));
        assertThrows(NotFoundException.class, () -> history.getShared("not-a-token"));
        assertThrows(NotFoundException.class, () -> history.getShared(""));
        assertThrows(NotFoundException.class, () -> history.getShared(null));
    }

    /** Revoking stops the link working — §5.2's "poveznica prestaje raditi". */
    @Test
    @TestTransaction
    void revokingTheShareLinkMakesItA404() {
        asUser("test-uid-a");
        BlokSessionDto saved = history.save(series("sess-" + UUID.randomUUID()));
        String token = history.share(saved.uuid()).token();
        assertEquals(7, history.getShared(token).games().size(), "the link never worked");

        history.unshare(saved.uuid());
        assertThrows(NotFoundException.class, () -> history.getShared(token),
                "the revoked link still resolves");

        // The record itself is untouched, and the owner can still read it.
        assertEquals(7, history.get(saved.uuid()).games().size());
        // Revoking again is a no-op, not a 404: the caller asked for a state
        // they already have.
        history.unshare(saved.uuid());

        // Sharing again mints a NEW token — the old one stays dead.
        String fresh = history.share(saved.uuid()).token();
        assertNotEquals(token, fresh, "a revoked token was handed back out");
        assertEquals(7, history.getShared(fresh).games().size());
        assertThrows(NotFoundException.class, () -> history.getShared(token));
    }

    /** Sharing and revoking are owner-only, and a stranger gets 404, never 403. */
    @Test
    @TestTransaction
    void sharingSomeoneElsesRecordIsA404() {
        asUser("test-uid-a");
        BlokSessionDto mine = history.save(series("sess-" + UUID.randomUUID()));
        UUID uuid = mine.uuid();

        asUser("test-uid-b");
        assertThrows(NotFoundException.class, () -> history.share(uuid));
        assertThrows(NotFoundException.class, () -> history.unshare(uuid));
        assertThrows(NotFoundException.class, () -> history.share(UUID.randomUUID()));
    }

    /** The owner's own responses must not carry the token around either. */
    @Test
    @TestTransaction
    void theShareTokenIsNotPartOfTheOwnerFacingShapes() throws Exception {
        asUser("test-uid-a");
        BlokSessionDto saved = history.save(series("sess-" + UUID.randomUUID()));
        history.share(saved.uuid());

        assertFalse(objectMapper.writeValueAsString(history.get(saved.uuid())).contains("hareToken"));
        assertFalse(objectMapper.writeValueAsString(history.list(1, 0).get(0)).contains("hareToken"));
    }

    /* ---------- 10. §5.5: the game-end rule travels ---------- */

    /**
     * The column exists, is NOT NULL, and defaults to {@code prolaz} — which
     * is also the backfill for every series stored before §5.5. A nullable
     * column would have been a second spelling of a value that already has
     * one, since §5.5 makes an absent rule <em>mean</em> {@code prolaz}.
     */
    @Test
    void endRuleChangesetAddedANotNullColumnDefaultingToProlaz() {
        Object[] col = (Object[]) em.createNativeQuery("""
                        select data_type, character_maximum_length, is_nullable, column_default
                        from information_schema.columns
                        where table_name = 'blok_sessions' and column_name = 'game_end_rule'
                        """).getSingleResult();
        assertEquals("character varying", col[0].toString());
        assertEquals(8, ((Number) col[1]).intValue(), "§5.5 fixes the column at varchar(8)");
        assertEquals("NO", col[2].toString(), "an absent rule MEANS prolaz — NULL is not a value");
        assertTrue(col[3] != null && col[3].toString().contains("prolaz"),
                () -> "the default is what backfills pre-§5.5 rows: " + col[3]);
    }

    /**
     * A rule sent as {@code "dosta"} comes back as {@code "dosta"} — per game
     * and in the series column.
     *
     * <p>This is the whole point of §5.5: the client computed the
     * {@code winner}, the server never recomputes it, and the very same deals
     * produce a different winner under the other rule. A record that lost the
     * rule is a record whose winner nobody can check afterwards.
     */
    @Test
    @TestTransaction
    void anExplicitDostaRoundTripsPerGameAndAtSeriesLevel() {
        asUser("test-uid-a");
        String sessionId = "sess-" + UUID.randomUUID();

        BlokSessionDto saved = history.save(seriesWithRule(sessionId, "dosta"));
        assertEquals("dosta", saved.gameEndRule(), "the series-level rule was lost");
        for (BlokGameDto g : saved.games()) {
            assertEquals("dosta", g.gameEndRule(), "a game lost the rule it was played under");
        }

        // Not just the in-memory DTO: the column and the jsonb both say so.
        assertEquals("dosta", em.createNativeQuery(
                        "select game_end_rule from blok_sessions where uuid = :u")
                .setParameter("u", saved.uuid()).getSingleResult().toString());
        assertEquals("dosta", em.createNativeQuery(
                        "select payload -> 0 ->> 'gameEndRule' from blok_sessions where uuid = :u")
                .setParameter("u", saved.uuid()).getSingleResult().toString());

        // …and through a fresh read and the listing, which never reads payload.
        assertEquals("dosta", history.get(saved.uuid()).gameEndRule());
        BlokSessionSummaryDto row = history.list(50, 0).stream()
                .filter(s -> saved.uuid().equals(s.uuid())).findFirst().orElseThrow();
        assertEquals("dosta", row.gameEndRule(), "the listing cannot label the row");
    }

    /**
     * §5.5's default, which is a CHANGE: a game stored without the field used
     * to mean {@code dosta} and now means {@code prolaz}.
     *
     * <p>And nonsense is not a 400. The rule is a label on a record the server
     * never acts on, so rejecting an unknown value would break an older or
     * newer client and lose a real scorepad to gain nothing.
     */
    @Test
    @TestTransaction
    void anAbsentOrNonsenseRuleReadsBackAsProlaz() {
        asUser("test-uid-a");

        // Absent — the fixture games carry no gameEndRule at all.
        BlokSessionDto absent = history.save(series("sess-" + UUID.randomUUID()));
        assertEquals("prolaz", absent.gameEndRule(), "§5.5 defaults the series to prolaz");
        for (BlokGameDto g : absent.games()) assertEquals("prolaz", g.gameEndRule());

        // Nonsense, per game and at series level — normalised, never rejected.
        BlokSessionDto junk = history.save(new SaveBlokSessionRequest(
                "sess-" + UUID.randomUUID(), 1001, "kako-god",
                BlokNamesDto.of("", ""), null, null,
                List.of(game("us", 2, "dostava"), game("them", 2, ""))));
        assertEquals("prolaz", junk.gameEndRule(), "an unknown series rule must not 400");
        for (BlokGameDto g : junk.games()) {
            assertEquals("prolaz", g.gameEndRule(), "an unknown per-game rule must not 400");
        }

        // Trimmed and case-folded rather than silently flipped to the other rule.
        BlokSessionDto loose = history.save(new SaveBlokSessionRequest(
                "sess-" + UUID.randomUUID(), 1001, null,
                BlokNamesDto.of("", ""), null, null,
                List.of(game("us", 2, "  Dosta "))));
        assertEquals("dosta", loose.gameEndRule());
        assertEquals("dosta", loose.games().get(0).gameEndRule());
    }

    /**
     * The rule follows a §5.1 re-upload: the player changes the setting in
     * "Postavke" and starts the next game, so the series column has to move to
     * the rule now in force while the games already played keep theirs.
     */
    @Test
    @TestTransaction
    void changingTheRuleMidSeriesKeepsEachGameOnTheRuleItWasPlayedUnder() {
        asUser("test-uid-a");
        String sessionId = "sess-" + UUID.randomUUID();

        history.save(seriesWithRule(sessionId, "dosta"));

        List<BlokGameDto> grown = new ArrayList<>(
                List.of(game("us", 2, "dosta"), game("them", 2, "dosta"), game("us", 2, "prolaz")));
        BlokSessionDto second = history.save(new SaveBlokSessionRequest(
                sessionId, 1001, null, BlokNamesDto.of("", ""),
                1_757_280_000_000L, null, grown));

        assertEquals("prolaz", second.gameEndRule(),
                "the series-level rule is the newest game's — the setting now in force");
        assertEquals("dosta", second.games().get(0).gameEndRule(),
                "an already-played game lost the rule its winner was decided by");
        assertEquals("prolaz", second.games().get(2).gameEndRule());
    }

    /**
     * The shared scorepad carries the rule too (§5.5: "ni na profilu ni na
     * dijeljenoj poveznici"), and still says nothing about who owns it.
     */
    @Test
    @TestTransaction
    void thePublicShareDtoCarriesTheRule() throws Exception {
        asUser("test-uid-a");
        BlokSessionDto saved = history.save(seriesWithRule("sess-" + UUID.randomUUID(), "dosta"));
        String token = history.share(saved.uuid()).token();

        BlokSessionDto shared = history.getShared(token);
        assertEquals("dosta", shared.gameEndRule(), "the shared record's winners are uncheckable");
        for (BlokGameDto g : shared.games()) assertEquals("dosta", g.gameEndRule());

        // Still nothing about the owner, and still no identifiers.
        String out = objectMapper.writeValueAsString(shared);
        assertNull(shared.uuid());
        assertNull(shared.sessionId());
        assertFalse(out.contains("test-uid-a"), () -> "the owner's uid leaked: " + out);
        assertTrue(out.contains("\"gameEndRule\":\"dosta\""), () -> out);
    }

    private String assertDoesNotThrowSerialised(Object dto) {
        try {
            return objectMapper.writeValueAsString(dto);
        } catch (Exception e) {
            throw new AssertionError("the public DTO does not serialise", e);
        }
    }

    private static void assertCode(String expected, Runnable call) {
        WebApplicationException e = assertThrows(WebApplicationException.class, call::run,
                () -> "expected " + expected);
        assertEquals(400, e.getResponse().getStatus(), () -> "expected 400 for " + expected);
        assertEquals(expected, e.getResponse().getEntity(),
                "the SPA compares this body literally");
    }

    /* ---------- fixtures ---------- */

    /** The contract's own example: a series that ended 4 : 3, seven games. */
    private static SaveBlokSessionRequest series(String sessionId) {
        List<BlokGameDto> games = new ArrayList<>();
        for (int i = 0; i < 4; i++) games.add(game("us", 3));
        for (int i = 0; i < 3; i++) games.add(game("them", 3));
        return new SaveBlokSessionRequest(
                sessionId,
                1001,
                null,   // no series-level rule: the server takes the newest game's
                BlokNamesDto.of("", ""),
                1_757_280_000_000L,
                1_757_298_000_000L,
                games);
    }

    /**
     * A series under the caller's control — the §5.1 shape, where the same
     * sessionId is re-sent with one more game each time.
     */
    private static SaveBlokSessionRequest seriesOf(String sessionId, List<BlokGameDto> games,
                                                   Long finishedAt, String us, String them) {
        return new SaveBlokSessionRequest(
                sessionId, 1001, null, BlokNamesDto.of(us, them),
                1_757_280_000_000L, finishedAt, games);
    }

    /** The default fixture game: no {@code gameEndRule}, so it must read back "prolaz". */
    private static BlokGameDto game(String winner, int rounds) {
        return game(winner, rounds, null);
    }

    private static BlokGameDto game(String winner, int rounds, String endRule) {
        List<BlokRoundDto> deals = new ArrayList<>(rounds);
        for (int i = 0; i < rounds; i++) {
            deals.add(new BlokRoundDto(
                    "us",
                    new BlokScoresDto(92, 70),
                    new BlokDeclarationsDto(List.of(20, 50), List.of()),
                    null,
                    "HERC"));
        }
        return new BlokGameDto(
                UUID.randomUUID().toString(),
                1_757_280_000_000L,
                1_757_283_600_000L,
                1001,
                endRule,
                winner,
                new BlokScoresDto(1012, 786),
                deals);
    }

    private static BlokGameDto gameWithCaller(String caller) {
        return withFirstDeal(new BlokRoundDto(caller, new BlokScoresDto(92, 70),
                new BlokDeclarationsDto(List.of(), List.of()), null, "HERC"));
    }

    private static BlokGameDto gameWithTrump(String trump) {
        return withFirstDeal(new BlokRoundDto("us", new BlokScoresDto(92, 70),
                new BlokDeclarationsDto(List.of(), List.of()), null, trump));
    }

    private static BlokGameDto gameWithCards(int cards) {
        return withFirstDeal(new BlokRoundDto("us", new BlokScoresDto(cards, 70),
                new BlokDeclarationsDto(List.of(), List.of()), null, "HERC"));
    }

    private static BlokGameDto gameWithDeclaration(int value) {
        return withFirstDeal(new BlokRoundDto("us", new BlokScoresDto(92, 70),
                new BlokDeclarationsDto(List.of(value), List.of()), null, "HERC"));
    }

    private static BlokGameDto withFirstDeal(BlokRoundDto deal) {
        return new BlokGameDto("g1", 1_757_280_000_000L, null, 1001, null, "us",
                new BlokScoresDto(92, 70), List.of(deal));
    }

    private static SaveBlokSessionRequest withSessionId(String sessionId) {
        return new SaveBlokSessionRequest(sessionId, 1001, null,
                BlokNamesDto.of(null, null),
                null, null, List.of(game("us", 1)));
    }

    private static SaveBlokSessionRequest withGames(List<BlokGameDto> games) {
        return new SaveBlokSessionRequest("sess-" + UUID.randomUUID(), 1001, null,
                BlokNamesDto.of(null, null), null, null, games);
    }

    private static SaveBlokSessionRequest withTarget(int target) {
        return new SaveBlokSessionRequest("sess-" + UUID.randomUUID(), target, null,
                BlokNamesDto.of(null, null), null, null,
                List.of(game("us", 1)));
    }

    /** A series whose games all carry {@code endRule}, and nothing at series level. */
    private static SaveBlokSessionRequest seriesWithRule(String sessionId, String endRule) {
        return new SaveBlokSessionRequest(sessionId, 1001, null,
                BlokNamesDto.of("", ""), 1_757_280_000_000L, 1_757_298_000_000L,
                List.of(game("us", 2, endRule), game("them", 2, endRule)));
    }
}
