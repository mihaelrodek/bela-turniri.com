package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@code GET /tournaments?status=finished&q=...} — the "Završeni turniri"
 * search group on the tournaments page. Before this, a finished tournament's
 * name only turned up in search if it happened to already be on the loaded
 * page of the paginated finished list; {@code q} lets the SPA ask the server
 * directly instead.
 *
 * <p>Runs against the docker-compose Postgres (devservices disabled), fixtures
 * committed in {@code @BeforeEach} and cleaned up in {@code @AfterEach} — same
 * pattern as {@link SelfRegisterAnonymousTest}.
 */
@QuarkusTest
class TournamentSearchControllerTest {

    @Inject
    EntityManager em;

    private final String suffix = UUID.randomUUID().toString();
    private Long matchByNameId;
    private Long matchByLocationId;
    private Long noMatchId;
    private Long notFinishedId;

    private String nameNeedle;
    private String locationNeedle;

    @BeforeEach
    void setUp() {
        nameNeedle = "Kupovacki" + suffix;
        locationNeedle = "Podkukavica" + suffix;

        QuarkusTransaction.requiringNew().run(() -> {
            matchByNameId = persist(nameNeedle, "Neko drugo mjesto " + suffix, TournamentStatus.FINISHED);
            matchByLocationId = persist("Turnir bez veze " + suffix, locationNeedle, TournamentStatus.FINISHED);
            noMatchId = persist("Sasvim drugi naziv " + suffix, "Sasvim drugo mjesto " + suffix, TournamentStatus.FINISHED);
            // Same needle, but not finished — must never show up in a
            // finished-status search no matter how good the text match is.
            notFinishedId = persist(nameNeedle + "-notfinished", "x", TournamentStatus.STARTED);
        });
    }

    @AfterEach
    void cleanUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            em.createNativeQuery("delete from tournaments where id in (:ids)")
                    .setParameter("ids", List.of(matchByNameId, matchByLocationId, noMatchId, notFinishedId))
                    .executeUpdate();
        });
    }

    private Long persist(String name, String location, TournamentStatus status) {
        Tournaments t = new Tournaments();
        t.setName(name);
        t.setLocation(location);
        t.setStatus(status);
        t.setCreatedByUid("search-test-organiser");
        t.setCreatedAt(OffsetDateTime.now());
        t.setStartAt(OffsetDateTime.now().minusDays(1));
        em.persist(t);
        em.flush();
        return t.getId();
    }

    @Test
    void matchesByName() {
        given().when()
                .get("/tournaments?status=finished&q=" + encode(nameNeedle))
                .then().statusCode(200)
                .body("uuid", org.hamcrest.Matchers.hasSize(1))
                .body("[0].name", org.hamcrest.Matchers.equalTo(nameNeedle));
    }

    @Test
    void matchesByLocationCaseInsensitively() {
        given().when()
                // Different case than stored — must still match (lower() both sides).
                .get("/tournaments?status=finished&q=" + encode(locationNeedle.toUpperCase()))
                .then().statusCode(200)
                .body("location", org.hamcrest.Matchers.hasItem(locationNeedle));
    }

    @Test
    void noMatchReturnsEmpty() {
        given().when()
                .get("/tournaments?status=finished&q=" + encode("NoSuchTournament" + suffix))
                .then().statusCode(200)
                .body("$", org.hamcrest.Matchers.empty());
    }

    @Test
    void queryShorterThanTwoCharsIsIgnored() {
        // A single character would otherwise ILIKE-match half the table —
        // below MIN_QUERY_LENGTH the filter is dropped entirely, so this
        // returns the (unfiltered) finished list, which must include all
        // three finished fixtures from setUp().
        String body = given().when()
                .get("/tournaments?status=finished&q=" + encode(suffix.substring(0, 1)) + "&limit=1000")
                .then().statusCode(200)
                .extract().asString();
        assertTrue(body.contains(nameNeedle), "1-char q should be ignored, not filtered on");
        assertTrue(body.contains(locationNeedle), "1-char q should be ignored, not filtered on");
    }

    @Test
    void countEndpointHonoursTheSameFilter() {
        long total = given().when()
                .get("/tournaments/count?status=finished&q=" + encode(nameNeedle))
                .then().statusCode(200)
                .extract().jsonPath().getLong("total");
        assertEquals(1L, total);
    }

    private static String encode(String s) {
        return java.net.URLEncoder.encode(s, java.nio.charset.StandardCharsets.UTF_8);
    }
}
