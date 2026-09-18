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

    private io.restassured.response.ValidatableResponse post(String body) {
        return given().contentType(ContentType.JSON)
                .header("X-Internal-Token", TOKEN)
                .body(body)
                .when().post("/internal/game-reliability-events")
                .then();
    }
}
