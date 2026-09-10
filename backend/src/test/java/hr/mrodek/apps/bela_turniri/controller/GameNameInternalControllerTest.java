package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.services.GameNameService;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

/**
 * "Ime za igru" — the in-game name and the once-a-week rule that guards it
 * (CLAUDE.md → Game; the table's own rationale is in
 * {@code db/changelog/game_names.xml}).
 *
 * <p>The cases worth pinning are the ones a client can actually hit: the
 * shared-secret gate, the first set, the refusal inside the window with the
 * instant it may next be changed, the set once that window has passed, the two
 * shapes of bad name, and — the reason this table is keyed on the game
 * server's uid rather than on a profile — a GUEST going through the same path
 * end to end.
 *
 * <p>Runs against the real docker-compose Postgres (devservices are disabled),
 * so every test deletes the rows it wrote: the same database holds real local
 * data.
 */
@QuarkusTest
class GameNameInternalControllerTest {

    /** The %dev,test fallback in application.properties. */
    private static final String TOKEN = "dev-secret-change-me";

    /** Unique per run, so a leftover row from an earlier run cannot match. */
    private final String userUid = "test-user-" + UUID.randomUUID();
    private final String guestUid = "guest:" + "a".repeat(64);

    @Inject EntityManager em;

    @AfterEach
    void cleanUp() {
        QuarkusTransaction.requiringNew().run(() -> em
                .createNativeQuery("delete from game_names where game_uid in (:uids)")
                .setParameter("uids", List.of(userUid, guestUid))
                .executeUpdate());
    }

    @Test
    void refusesWithoutTheSharedSecret() {
        given().contentType(ContentType.JSON).body("{\"name\":\"Ivan\"}")
                .when().put("/internal/profiles/" + userUid + "/game-name")
                .then().statusCode(401);
        given().when().get("/internal/profiles/" + userUid)
                .then().statusCode(401);
    }

    @Test
    void setsTheNameTheFirstTimeAndReadsItBack() {
        set(userUid, "Ivan").then().statusCode(200)
                .body("gameName", is("Ivan"))
                .body("nextChangeAt", notNullValue());

        get(userUid).then().statusCode(200).body("gameName", is("Ivan"));
    }

    @Test
    void refusesASecondChangeInsideTheWindowAndSaysWhenItMayChange() {
        set(userUid, "Ivan").then().statusCode(200);

        set(userUid, "Marko").then().statusCode(409)
                .body("code", is("GAME_NAME_RATE_LIMITED"))
                .body("details.nextChangeAt", notNullValue());

        // And nothing moved: the refusal is not a write.
        get(userUid).then().statusCode(200).body("gameName", is("Ivan"));
    }

    @Test
    void allowsTheChangeOnceTheWindowHasPassed() {
        set(userUid, "Ivan").then().statusCode(200);

        // Age the row past the window rather than waiting seven days for it.
        QuarkusTransaction.requiringNew().run(() -> em
                .createNativeQuery("update game_names set changed_at = :then where game_uid = :uid")
                .setParameter("then", OffsetDateTime.now()
                        .minus(GameNameService.CHANGE_INTERVAL).minusMinutes(1))
                .setParameter("uid", userUid)
                .executeUpdate());

        set(userUid, "Marko").then().statusCode(200).body("gameName", is("Marko"));
        get(userUid).then().statusCode(200).body("gameName", is("Marko"));
    }

    @Test
    void refusesABlankNameAndOneOverSixteenCharacters() {
        set(userUid, "   ").then().statusCode(400);
        set(userUid, "a".repeat(GameNameService.MAX_NAME_LENGTH + 1)).then().statusCode(400);
        // Neither attempt created a row, so the first real set is still free.
        get(userUid).then().statusCode(200).body("gameName", nullValue());
    }

    @Test
    void aGuestGoesThroughTheSamePathEndToEnd() {
        set(guestUid, "Gost").then().statusCode(200).body("gameName", is("Gost"));
        get(guestUid).then().statusCode(200).body("gameName", is("Gost"));
        // The window covers a guest exactly as it covers an account: that
        // browser secret is the only stable identity a guest has.
        set(guestUid, "Drugi").then().statusCode(409)
                .body("code", is("GAME_NAME_RATE_LIMITED"));
    }

    private static io.restassured.response.Response set(String uid, String name) {
        return given().header("X-Internal-Token", TOKEN)
                .contentType(ContentType.JSON)
                .body("{\"name\":\"" + name + "\"}")
                .when().put("/internal/profiles/" + uid + "/game-name");
    }

    private static io.restassured.response.Response get(String uid) {
        return given().header("X-Internal-Token", TOKEN)
                .when().get("/internal/profiles/" + uid);
    }
}
