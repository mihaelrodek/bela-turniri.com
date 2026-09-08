package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.GameStatsDto;
import hr.mrodek.apps.bela_turniri.services.GameStatsService;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Covers the three behaviours the online-game statistics contract
 * (game/README.md §8) actually rests on: the shared-secret gate, the
 * idempotent replay, and the per-category grouping.
 *
 * <p>Runs against the real docker-compose Postgres (devservices are disabled),
 * so every test cleans up the rows it wrote — the same database holds real
 * local data.
 */
@QuarkusTest
class GameResultsInternalControllerTest {

    private static final String PATH = "/internal/game-results";
    /** The %dev,test fallback in application.properties. */
    private static final String TOKEN = "dev-secret-change-me";

    /** Unique per run so a leftover row from an earlier run can never match. */
    private final String uidA = "test-uid-a-" + UUID.randomUUID();
    private final String uidB = "test-uid-b-" + UUID.randomUUID();

    @Inject GameStatsService gameStats;
    @Inject EntityManager em;

    @AfterEach
    void cleanUp() {
        QuarkusTransaction.requiringNew().run(() -> em.createNativeQuery("""
                        delete from game_results g
                        where exists (select 1 from game_result_players p
                                      where p.game_result_id = g.id
                                        and p.uid in (:uids))
                        """)
                .setParameter("uids", java.util.List.of(uidA, uidB))
                .executeUpdate());
    }

    @Test
    void acceptsGuestWithoutSavingBrowserIdentity() {
        String body = payload(UUID.randomUUID().toString(), 501, "A", uidA)
                .replace("\"uid\":\"" + uidB + "-opp\",\"isBot\":false", "\"uid\":null,\"isBot\":false,\"isGuest\":true");
        post(body).then().statusCode(200).body("recorded", is(true));
        assertEquals(0, statsFor(uidB + "-opp").global().games());
    }

    /* ===================== auth ===================== */

    @Test
    void rejectsMissingToken() {
        given().contentType(ContentType.JSON)
                .body(payload(UUID.randomUUID().toString(), 501, "A", uidA))
                .when().post(PATH)
                .then().statusCode(401)
                .body("code", is("UNAUTHORIZED"));
    }

    @Test
    void rejectsWrongToken() {
        given().contentType(ContentType.JSON)
                .header("X-Internal-Token", TOKEN + "x")
                .body(payload(UUID.randomUUID().toString(), 501, "A", uidA))
                .when().post(PATH)
                .then().statusCode(401);
    }

    /**
     * The token must be checked BEFORE the body, otherwise an unauthenticated
     * caller learns the DTO's field names from the 400.
     */
    @Test
    void rejectsMissingTokenBeforeValidatingTheBody() {
        given().contentType(ContentType.JSON)
                .body("{\"resultId\":\"not-a-uuid\"}")
                .when().post(PATH)
                .then().statusCode(401);
    }

    /* ===================== idempotency ===================== */

    @Test
    void duplicateResultIdIsRecordedOnlyOnce() {
        String resultId = UUID.randomUUID().toString();

        post(payload(resultId, 1001, "A", uidA)).then()
                .statusCode(200)
                .body("recorded", is(true));

        // Same id, same body — the reporter never saw our first response.
        post(payload(resultId, 1001, "A", uidA)).then()
                .statusCode(200)
                .body("recorded", is(false));

        assertEquals(1, countResults(resultId), "the game must be stored exactly once");
        assertEquals(4, countPlayers(resultId), "four seats, no duplicates from the replay");

        // And the replay must not have inflated the statistics.
        GameStatsDto stats = statsFor(uidA);
        assertEquals(1, stats.global().games());
        assertEquals(1, stats.global().wins());
    }

    /* ===================== grouped stats ===================== */

    @Test
    void talliesPerCategoryAndGlobally() {
        // uidA: seat 0, team A. 501 -> win, 501 -> loss, 1001 -> win.
        post(payload(UUID.randomUUID().toString(), 501, "A", uidA)).then().statusCode(200);
        post(payload(UUID.randomUUID().toString(), 501, "B", uidA)).then().statusCode(200);
        post(payload(UUID.randomUUID().toString(), 1001, "A", uidA)).then().statusCode(200);

        GameStatsDto stats = statsFor(uidA);

        assertEquals(3, stats.global().games());
        assertEquals(2, stats.global().wins());
        assertEquals(1, stats.global().losses());
        assertEquals(0.667, stats.global().winRate(), 0.0005);

        var s501 = stats.byTargetScore().get("501");
        assertEquals(2, s501.games());
        assertEquals(1, s501.wins());
        assertEquals(1, s501.losses());
        assertEquals(0.5, s501.winRate(), 0.0005);

        var s1001 = stats.byTargetScore().get("1001");
        assertEquals(1, s1001.games());
        assertEquals(1, s1001.wins());
        assertEquals(1.0, s1001.winRate(), 0.0005);

        // A category with no games is omitted, not emitted as zeros (§8.5).
        assertFalse(stats.byTargetScore().containsKey("701"),
                "unplayed categories must be absent from byTargetScore");
        assertEquals(2, stats.byTargetScore().size());

        // The bot seats in the same games must not have been credited to anyone,
        // and an unrelated uid sees an all-zero global with no categories.
        GameStatsDto empty = statsFor(uidB);
        assertEquals(0, empty.global().games());
        assertEquals(0, empty.global().wins());
        assertEquals(0.0, empty.global().winRate(), 0.0005);
        assertTrue(empty.byTargetScore().isEmpty());
    }

    /**
     * The read side is registered and guarded. A real 200 cannot be asserted
     * here — it needs a Firebase-signed ID token, which the test has no way to
     * mint — so the payload shape is covered through {@link GameStatsService}
     * above and this only pins down that the route exists and is not public.
     */
    @Test
    void gameStatsRequiresAuth() {
        given().when().get("/user/me/game-stats").then().statusCode(401);
    }

    /* ===================== shape validation ===================== */

    @Test
    void rejectsAHumanSeatWithoutAUid() {
        String body = """
                {"resultId":"%s","playedAt":"2026-09-08T20:00:00Z","targetScore":501,
                 "winnerTeam":"A","scoreA":501,"scoreB":300,"dealsCount":8,
                 "players":[{"seat":0,"team":"A","uid":null,"isBot":false},
                            {"seat":1,"team":"B","uid":"%s","isBot":false},
                            {"seat":2,"team":"A","uid":null,"isBot":true},
                            {"seat":3,"team":"B","uid":null,"isBot":true}]}
                """.formatted(UUID.randomUUID(), uidB);
        post(body).then().statusCode(400);
    }

    @Test
    void rejectsADuplicateSeat() {
        String body = """
                {"resultId":"%s","playedAt":"2026-09-08T20:00:00Z","targetScore":501,
                 "winnerTeam":"A","scoreA":501,"scoreB":300,
                 "players":[{"seat":0,"team":"A","uid":"%s","isBot":false},
                            {"seat":0,"team":"B","uid":"%s","isBot":false},
                            {"seat":2,"team":"A","uid":null,"isBot":true},
                            {"seat":3,"team":"B","uid":null,"isBot":true}]}
                """.formatted(UUID.randomUUID(), uidA, uidB);
        post(body).then().statusCode(400);
    }

    @Test
    void rejectsAnUnknownTargetScore() {
        post(payload(UUID.randomUUID().toString(), 601, "A", uidA)).then().statusCode(400);
    }

    /* ===================== helpers ===================== */

    private static io.restassured.response.Response post(String body) {
        return given().contentType(ContentType.JSON)
                .header("X-Internal-Token", TOKEN)
                .body(body)
                .when().post(PATH);
    }

    /**
     * One human on team A (seat 0), one human on team B (seat 1), two bots —
     * eligible under §8.1, and the shape the game server sends most often.
     */
    private String payload(String resultId, int targetScore, String winnerTeam, String humanUid) {
        return """
                {"resultId":"%s","playedAt":"2026-09-08T20:00:00Z","targetScore":%d,
                 "winnerTeam":"%s","scoreA":%d,"scoreB":300,"dealsCount":9,
                 "players":[{"seat":0,"team":"A","uid":"%s","isBot":false},
                            {"seat":1,"team":"B","uid":"%s","isBot":false},
                            {"seat":2,"team":"A","uid":null,"isBot":true},
                            {"seat":3,"team":"B","uid":null,"isBot":true}]}
                """.formatted(resultId, targetScore, winnerTeam, targetScore, humanUid, uidB + "-opp");
    }

    private GameStatsDto statsFor(String uid) {
        return QuarkusTransaction.requiringNew().call(() -> gameStats.statsFor(uid));
    }

    private long countResults(String resultId) {
        return QuarkusTransaction.requiringNew().call(() -> ((Number) em
                .createNativeQuery("select count(*) from game_results where uuid = cast(:u as uuid)")
                .setParameter("u", resultId)
                .getSingleResult()).longValue());
    }

    private long countPlayers(String resultId) {
        return QuarkusTransaction.requiringNew().call(() -> ((Number) em.createNativeQuery("""
                        select count(*) from game_result_players p
                        join game_results g on g.id = p.game_result_id
                        where g.uuid = cast(:u as uuid)
                        """)
                .setParameter("u", resultId)
                .getSingleResult()).longValue());
    }
}
