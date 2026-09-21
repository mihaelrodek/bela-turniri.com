package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.GameReliabilityDto;
import hr.mrodek.apps.bela_turniri.services.GameReliabilityService;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * The karma rule, as redesigned 2026-09-21: the score is DERIVED from the
 * event ledger ({@code 10 − abandons in the last 30 days}, floor 0), the event
 * id is still the idempotency boundary, and finishing games earns nothing.
 */
@QuarkusTest
class GameReliabilityInternalControllerTest {
    private static final String TOKEN = "dev-secret-change-me";
    private final String uid = "karma-test-" + UUID.randomUUID();

    @Inject EntityManager em;
    @Inject GameReliabilityService reliability;

    @AfterEach
    void cleanUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            em.createNativeQuery("delete from game_reliability_events where user_uid = :uid")
                    .setParameter("uid", uid).executeUpdate();
            em.createNativeQuery("delete from user_profiles where user_uid = :uid")
                    .setParameter("uid", uid).executeUpdate();
            // The player rows go with their parent: the FK is ON DELETE CASCADE.
            em.createNativeQuery("""
                            delete from game_results
                            where id in (select game_result_id from game_result_players where uid = :uid)
                            """)
                    .setParameter("uid", uid).executeUpdate();
        });
    }

    @Test
    void storesAnAbandonmentOnceAndChangesKarmaOnce() {
        String eventId = UUID.randomUUID().toString();
        String body = "{\"eventId\":\"" + eventId + "\",\"userUid\":\"" + uid
                + "\",\"eventType\":\"ABANDONED\"}";

        post(body).statusCode(200).body("recorded", is(true));
        post(body).statusCode(200).body("recorded", is(false));

        var value = read();
        assertEquals(1, value.abandons());
        assertEquals(1, value.recentAbandons());
        assertEquals(0, value.recentGames());
        assertEquals(GameReliabilityService.WINDOW_DAYS, value.windowDays());
        assertEquals(GameReliabilityService.DEFAULT_KARMA - GameReliabilityService.ABANDON_PENALTY,
                value.karma());
    }

    /**
     * The window is rolling per event: an abandonment older than
     * {@code WINDOW_DAYS} has already been paid for and must not weigh on the
     * score any more — while the LIFETIME counter still remembers it, because
     * the trail is shown rather than erased.
     */
    @Test
    void anAbandonmentOlderThanTheWindowStopsCounting() {
        String old = OffsetDateTime.now().minusDays(GameReliabilityService.WINDOW_DAYS + 1).toString();
        post("{\"eventId\":\"" + UUID.randomUUID() + "\",\"userUid\":\"" + uid
                + "\",\"eventType\":\"ABANDONED\",\"occurredAt\":\"" + old + "\"}")
                .statusCode(200).body("recorded", is(true));

        var aged = read();
        assertEquals(GameReliabilityService.MAX_KARMA, aged.karma());
        assertEquals(0, aged.recentAbandons());
        assertEquals(1, aged.abandons());

        // …and one inside the window still costs its point.
        abandonNow();
        var fresh = read();
        assertEquals(GameReliabilityService.MAX_KARMA - 1, fresh.karma());
        assertEquals(1, fresh.recentAbandons());
        assertEquals(2, fresh.abandons());
    }

    /** Eleven abandonments do not make karma negative. */
    @Test
    void karmaFloorsAtZero() {
        for (int i = 0; i < GameReliabilityService.MAX_KARMA + 1; i++) abandonNow();

        var value = read();
        assertEquals(0, value.karma());
        assertEquals(GameReliabilityService.MAX_KARMA + 1, value.recentAbandons());
        assertEquals(GameReliabilityService.MAX_KARMA + 1, value.abandons());
    }

    /**
     * Recovery is gone: finishing games no longer buys a point back. Recorded
     * games only ever move {@code recentGames}, which is the denominator of
     * "napustio X od Y partija", never the score.
     */
    @Test
    void finishedGamesDoNotChangeKarma() {
        abandonNow();
        assertEquals(GameReliabilityService.MAX_KARMA - 1, read().karma());

        recordFinishedGame();
        recordFinishedGame();
        recordFinishedGame();

        var value = read();
        assertEquals(GameReliabilityService.MAX_KARMA - 1, value.karma());
        assertEquals(1, value.recentAbandons());
        assertEquals(3, value.recentGames());
        assertEquals(GameReliabilityService.MAX_KARMA, value.maxKarma());
    }

    /* ===================== helpers ===================== */

    private void abandonNow() {
        post("{\"eventId\":\"" + UUID.randomUUID() + "\",\"userUid\":\"" + uid
                + "\",\"eventType\":\"ABANDONED\"}").statusCode(200);
    }

    /**
     * One finished game with this uid in seat 0, written straight to the two
     * result tables. Going through the reporting endpoint would drag in the
     * whole game-results payload for no gain: all this test needs is a row
     * that the window count can see, and cleaning up after itself is simpler
     * than sharing fixtures with {@code GameStatsService}'s own tests.
     */
    private void recordFinishedGame() {
        QuarkusTransaction.requiringNew().run(() -> {
            UUID resultUuid = UUID.randomUUID();
            em.createNativeQuery("""
                            insert into game_results
                                (uuid, played_at, target_score, winner_team, score_a, score_b)
                            values (:uuid, now(), 1001, 'A', 1001, 300)
                            """)
                    .setParameter("uuid", resultUuid)
                    .executeUpdate();
            em.createNativeQuery("""
                            insert into game_result_players (game_result_id, seat, team, uid, is_bot, won)
                            select id, 0, 'A', :uid, false, true from game_results where uuid = :uuid
                            """)
                    .setParameter("uid", uid)
                    .setParameter("uuid", resultUuid)
                    .executeUpdate();
        });
    }

    /**
     * Reliability as the database has it RIGHT NOW. A bare {@code forUser} in
     * the test method reads through the request-scoped persistence context
     * that Quarkus keeps open for the whole test, so after the first read it
     * hands back the same cached entity for ever (CI, 2026-09-20: "expected 10
     * but was 9"). A read inside its own transaction gets a fresh session.
     */
    private GameReliabilityDto read() {
        return QuarkusTransaction.requiringNew().call(() -> reliability.forUser(uid));
    }

    private io.restassured.response.ValidatableResponse post(String body) {
        return given().contentType(ContentType.JSON)
                .header("X-Internal-Token", TOKEN)
                .body(body)
                .when().post("/internal/game-reliability-events")
                .then();
    }
}
