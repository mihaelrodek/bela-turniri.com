package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.services.GameAnalyticsService;
import hr.mrodek.apps.bela_turniri.services.GameReliabilityService;
import hr.mrodek.apps.bela_turniri.services.GameStatsService;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;

@QuarkusTest
class GameAnalyticsControllerTest {
    private static final String TOKEN = "dev-secret-change-me";
    private final String prefix = "analytics-test-" + UUID.randomUUID();
    private final String runId = UUID.randomUUID().toString();
    /** Unique per run, so a leftover row from an earlier run can never match. */
    private final String playerUid = "analytics-player-" + UUID.randomUUID();

    @Inject EntityManager em;
    @Inject GameAnalyticsService analytics;
    @Inject GameStatsService gameStats;

    @AfterEach
    void cleanUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            em.createNativeQuery("delete from game_analytics_events where event_id like :prefix")
                    .setParameter("prefix", prefix + "%")
                    .executeUpdate();
            em.createNativeQuery("""
                            delete from game_results g
                            where exists (select 1 from game_result_players p
                                          where p.game_result_id = g.id and p.uid = :uid)
                            """)
                    .setParameter("uid", playerUid)
                    .executeUpdate();
        });
    }

    @Test
    @TestSecurity(user = "admin", roles = {"admin"})
    void recordsIdempotentlyAndReturnsAdminOnlyAggregate() {
        var before = QuarkusTransaction.requiringNew().call(analytics::aggregate);
        post("room", null, "ROOM_CREATED", "{\"targetScore\":1001}")
                .then().statusCode(200).body("recorded", is(true));
        String started = """
                {"targetScore":1001,"private":false,
                 "seats":[{"kind":"PLAYER"},{"kind":"PLAYER"},{"kind":"BOT"},{"kind":"BOT"}]}
                """;
        post("started", runId, "GAME_STARTED", started)
                .then().statusCode(200).body("recorded", is(true));
        post("started", runId, "GAME_STARTED", started)
                .then().statusCode(200).body("recorded", is(false));
        String completed = """
                {"targetScore":1001,"durationMs":120000,"autoPlayedActions":2,
                 "deals":[
                   {"trump":"HERC","passed":true,"callPosition":1,
                    "declarationPoints":{"A":20,"B":0},"stiglja":null,"belot":null},
                   {"trump":"PIK","passed":false,"callPosition":4,
                    "declarationPoints":{"A":0,"B":50},"stiglja":"B","belot":"A"}
                 ]}
                """;
        post("completed", runId, "GAME_COMPLETED", completed)
                .then().statusCode(200).body("recorded", is(true));

        given().when().get("/admin/game-analytics").then()
                .statusCode(200)
                .body("summary.roomsCreated", equalTo((int) before.summary().roomsCreated() + 1))
                .body("summary.gamesStarted", equalTo((int) before.summary().gamesStarted() + 1))
                .body("summary.completed", equalTo((int) before.summary().completed() + 1))
                .body("summary.abandoned", equalTo((int) before.summary().abandoned()))
                .body("details.deals", equalTo((int) before.details().deals() + 2))
                .body("details.declarationPoints", equalTo((int) before.details().declarationPoints() + 70))
                .body("details.stiglja", equalTo((int) before.details().stiglja() + 1))
                .body("details.belot", equalTo((int) before.details().belot() + 1))
                .body("details.mixedGames", equalTo((int) before.details().mixedGames() + 1));
    }

    @Test
    void intakeChecksSecretAndAdminReadIsPrivate() {
        given().contentType(ContentType.JSON).body("{}").post("/internal/game-analytics")
                .then().statusCode(401);
        given().get("/admin/game-analytics").then().statusCode(401);
        // The "who played" sibling is the more sensitive of the two (it names
        // accounts), so it gets its own anonymous check rather than riding on
        // the class-level @RolesAllowed being assumed to cover it.
        given().get("/admin/game-analytics/players").then().statusCode(401);
    }

    /**
     * The per-player list: a recorded game must make its human seats appear
     * with the right tallies, while the bot seats stay out of the list and
     * land in the anonymous counter instead.
     */
    @Test
    @TestSecurity(user = "admin", roles = {"admin"})
    void playersListNamesRealAccountsAndCountsTheRest() {
        long playersBefore = QuarkusTransaction.requiringNew()
                .call(() -> gameStats.adminPlayers(1).totalPlayers());

        String body = """
                {"resultId":"%s","playedAt":"2026-09-17T19:30:00Z","targetScore":501,
                 "winnerTeam":"A","scoreA":501,"scoreB":300,"dealsCount":9,
                 "players":[{"seat":0,"team":"A","uid":"%s","isBot":false},
                            {"seat":1,"team":"B","uid":null,"isBot":false,"isGuest":true},
                            {"seat":2,"team":"A","uid":null,"isBot":true},
                            {"seat":3,"team":"B","uid":null,"isBot":true}]}
                """.formatted(UUID.randomUUID(), playerUid);
        given().contentType(ContentType.JSON)
                .header("X-Internal-Token", TOKEN)
                .body(body).post("/internal/game-results")
                .then().statusCode(200).body("recorded", is(true));

        given().when().get("/admin/game-analytics/players?limit=1000").then()
                .statusCode(200)
                .body("limit", equalTo(1000))
                .body("totalPlayers", equalTo((int) playersBefore + 1))
                .body("players.find { it.uid == '" + playerUid + "' }.games", equalTo(1))
                .body("players.find { it.uid == '" + playerUid + "' }.wins", equalTo(1))
                .body("players.find { it.uid == '" + playerUid + "' }.losses", equalTo(0))
                // No profile row and no in-game name for this uid: the name
                // falls back to a shortened uid rather than being null.
                .body("players.find { it.uid == '" + playerUid + "' }.name",
                        equalTo(playerUid.substring(0, 8) + "…"))
                .body("players.find { it.uid == '" + playerUid + "' }.karma",
                        equalTo(GameReliabilityService.MAX_KARMA));
    }

    private io.restassured.response.Response post(String suffix, String eventRunId, String type, String data) {
        String run = eventRunId == null ? "null" : "\"" + eventRunId + "\"";
        String body = """
                {"eventId":"%s-%s","runId":%s,"type":"%s",
                 "occurredAt":"2026-09-17T19:00:00Z","data":%s}
                """.formatted(prefix, suffix, run, type, data);
        return given().contentType(ContentType.JSON)
                .header("X-Internal-Token", TOKEN)
                .body(body).post("/internal/game-analytics");
    }
}
