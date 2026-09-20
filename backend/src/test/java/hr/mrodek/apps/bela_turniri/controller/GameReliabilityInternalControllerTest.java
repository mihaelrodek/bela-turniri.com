package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.services.GameReliabilityService;
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

/** The event id is the idempotency boundary for per-user abandonment counts. */
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
        });
    }

    @Test
    void storesAnAbandonmentOnceAndChangesKarmaOnce() {
        String eventId = UUID.randomUUID().toString();
        String body = "{\"eventId\":\"" + eventId + "\",\"userUid\":\"" + uid
                + "\",\"eventType\":\"ABANDONED\"}";

        post(body).statusCode(200).body("recorded", is(true));
        post(body).statusCode(200).body("recorded", is(false));

        var value = reliability.forUser(uid);
        assertEquals(1, value.abandons());
        assertEquals(GameReliabilityService.DEFAULT_KARMA - GameReliabilityService.ABANDON_PENALTY, value.karma());
    }

    /**
     * The 0..10 rule: one abandoned game costs a point, and it takes exactly
     * {@code GAMES_PER_RECOVERY} finished games to earn that point back — the
     * intermediate finished games must NOT move the number.
     */
    @Test
    void threeCompletedGamesGiveOnePointBack() {
        post("{\"eventId\":\"" + UUID.randomUUID() + "\",\"userUid\":\"" + uid
                + "\",\"eventType\":\"ABANDONED\"}").statusCode(200);
        assertEquals(GameReliabilityService.MAX_KARMA - 1, reliability.forUser(uid).karma());

        for (int i = 0; i < GameReliabilityService.GAMES_PER_RECOVERY - 1; i++) {
            QuarkusTransaction.requiringNew().run(() -> reliability.recordCompleted(uid));
            assertEquals(GameReliabilityService.MAX_KARMA - 1, reliability.forUser(uid).karma());
        }
        QuarkusTransaction.requiringNew().run(() -> reliability.recordCompleted(uid));
        assertEquals(GameReliabilityService.MAX_KARMA, reliability.forUser(uid).karma());

        // Already full: further finished games bank nothing.
        QuarkusTransaction.requiringNew().run(() -> reliability.recordCompleted(uid));
        assertEquals(GameReliabilityService.MAX_KARMA, reliability.forUser(uid).karma());
        assertEquals(GameReliabilityService.MAX_KARMA, reliability.forUser(uid).maxKarma());
    }

    private io.restassured.response.ValidatableResponse post(String body) {
        return given().contentType(ContentType.JSON)
                .header("X-Internal-Token", TOKEN)
                .body(body)
                .when().post("/internal/game-reliability-events")
                .then();
    }
}
