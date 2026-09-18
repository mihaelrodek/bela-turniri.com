package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.services.ShellRenderService;
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@code GET /seed?path=…} — the first-screen data seed
 * ({@link ShellRenderService} / {@link ShellController}).
 *
 * <p>What is actually worth asserting here is the CONTRACT the SPA depends on,
 * not the row contents: the listing seed has to carry the same three payloads
 * the three {@code qk} entries on {@code TournamentsPage} expect, the detail
 * seed has to echo back the exact URL segment it was keyed by, the response
 * has to be publicly cacheable, and a 404 must not be.
 *
 * <p>Runs against the docker-compose Postgres (devservices disabled), fixtures
 * committed in {@code @BeforeEach} and cleaned up in {@code @AfterEach} — same
 * pattern as {@link TournamentSearchControllerTest}. The service memo is
 * cleared around every test because its 20 s TTL is longer than the suite.
 */
@QuarkusTest
class ShellSeedTest {

    @Inject
    EntityManager em;

    @Inject
    ShellRenderService shell;

    private final String suffix = UUID.randomUUID().toString().substring(0, 8);

    private Long upcomingId;
    private Long finishedId;

    private String upcomingName;
    private String finishedName;
    private String upcomingSlug;

    @BeforeEach
    void setUp() {
        upcomingName = "SeedNadolazeci" + suffix;
        finishedName = "SeedZavrseni" + suffix;
        upcomingSlug = "seed-nadolazeci-" + suffix.toLowerCase();

        QuarkusTransaction.requiringNew().run(() -> {
            upcomingId = persist(upcomingName, upcomingSlug, TournamentStatus.DRAFT,
                    OffsetDateTime.now().plusDays(3));
            finishedId = persist(finishedName, "seed-zavrseni-" + suffix.toLowerCase(),
                    TournamentStatus.FINISHED, OffsetDateTime.now().minusDays(3));
        });
        shell.clearCache();
    }

    @AfterEach
    void cleanUp() {
        shell.clearCache();
        QuarkusTransaction.requiringNew().run(() ->
                em.createNativeQuery("delete from tournaments where id in (:ids)")
                        .setParameter("ids", List.of(upcomingId, finishedId))
                        .executeUpdate());
    }

    private Long persist(String name, String slug, TournamentStatus status, OffsetDateTime startAt) {
        Tournaments t = new Tournaments();
        t.setName(name);
        t.setSlug(slug);
        t.setLocation("Seedgrad " + suffix);
        t.setStatus(status);
        t.setCreatedByUid("shell-seed-test-organiser");
        t.setCreatedAt(OffsetDateTime.now());
        t.setStartAt(startAt);
        em.persist(t);
        em.flush();
        return t.getId();
    }

    /* ─────────────────────────── listing seed ─────────────────────────── */

    @Test
    void listingSeedCarriesTheThreeFirstScreenQueries() {
        var json = given().queryParam("path", "/turniri").when()
                .get("/seed")
                .then().statusCode(200)
                .extract().jsonPath();

        // qk.tournaments({ status: "upcoming" })
        assertTrue(json.getList("upcoming.name").contains(upcomingName),
                "upcoming bucket must carry the not-finished fixture");
        assertTrue(!json.getList("upcoming.name").contains(finishedName),
                "a FINISHED tournament never belongs in the upcoming bucket");

        // qk.tournaments({ status: "finished", limit: 6 }) — the page size is
        // echoed so the client builds the key without duplicating the constant.
        assertEquals(ShellRenderService.FINISHED_PREVIEW_LIMIT, json.getInt("finishedLimit"));
        assertTrue(json.getList("finished").size() <= ShellRenderService.FINISHED_PREVIEW_LIMIT,
                "the finished preview must not exceed the page size it advertises");

        // qk.tournamentsCount("finished")
        assertTrue(json.getLong("finishedTotal") >= 1L,
                "the finished total must count at least the fixture");

        // Card shape: the mapper the REST list endpoint uses, verbatim.
        assertNotNull(json.getString("upcoming.find { it.name == '" + upcomingName + "' }.uuid"));
        assertEquals("/turniri", json.getString("path"));
        assertTrue(json.getLong("generatedAt") > 0L, "generatedAt drives react-query's updatedAt");
        assertNull(json.get("details"), "the listing seed carries no detail payload");
    }

    @Test
    void listingSeedMatchesTheRestListEndpointItStandsInFor() {
        // The whole point of the seed is that the client can drop it into the
        // cache untouched — so the bytes have to agree with the call it
        // replaces, field for field.
        String fromRest = given().when()
                .get("/tournaments?status=upcoming")
                .then().statusCode(200)
                .extract().jsonPath().getString("find { it.name == '" + upcomingName + "' }");
        String fromSeed = given().queryParam("path", "/turniri").when()
                .get("/seed")
                .then().statusCode(200)
                .extract().jsonPath().getString("upcoming.find { it.name == '" + upcomingName + "' }");
        assertEquals(fromRest, fromSeed);
    }

    @Test
    void rootPathIsSeededAsTheListing() {
        // "/" is a <Navigate to="/turniri" replace /> in App.tsx, so a cold
        // load there needs the same seed.
        given().queryParam("path", "/").when()
                .get("/seed")
                .then().statusCode(200)
                .body("path", org.hamcrest.Matchers.equalTo("/turniri"));
    }

    /* ─────────────────────────── detail seed ──────────────────────────── */

    @Test
    void detailSeedIsKeyedByTheUrlSegment() {
        given().queryParam("path", "/turniri/" + upcomingSlug).when()
                .get("/seed")
                .then().statusCode(200)
                // detailsKey is what lands in useParams and therefore in
                // qk.tournamentDetails(idOrSlug) — echoing it back is what
                // lets the client key the entry without re-parsing the URL.
                .body("detailsKey", org.hamcrest.Matchers.equalTo(upcomingSlug))
                .body("details.name", org.hamcrest.Matchers.equalTo(upcomingName))
                .body("details.uuid", org.hamcrest.Matchers.notNullValue());
    }

    @Test
    void detailSeedIgnoresTheSectionTab() {
        // /turniri/:uuid/:section? — the section is a tab within one page and
        // shares its data, so it must resolve to the same seed.
        given().queryParam("path", "/turniri/" + upcomingSlug + "/pari").when()
                .get("/seed")
                .then().statusCode(200)
                .body("detailsKey", org.hamcrest.Matchers.equalTo(upcomingSlug));
    }

    /* ─────────────────────────── cache headers ────────────────────────── */

    @Test
    void seedIsPubliclyCacheable() {
        String cc = given().queryParam("path", "/turniri").when()
                .get("/seed")
                .then().statusCode(200)
                .extract().header("Cache-Control");
        assertNotNull(cc, "the seed must advertise its own Cache-Control");
        assertTrue(cc.contains("public"), cc);
        assertTrue(cc.contains("max-age=20"), cc);
        assertTrue(cc.contains("s-maxage=60"), cc);
    }

    @Test
    void missingTournamentIs404AndNotCached() {
        var res = given().queryParam("path", "/turniri/nema-ovakvog-turnira-" + suffix).when()
                .get("/seed")
                .then().statusCode(404)
                .extract();
        assertNull(res.header("Cache-Control"),
                "a 404 must never be cached — the slug may exist a second later");
    }

    @Test
    void unseededPathIs400() {
        // Nothing is seeded for the create wizard or for unrelated routes;
        // saying so beats returning an empty payload the client would cache.
        given().queryParam("path", "/turniri/novi").when().get("/seed").then().statusCode(400);
        given().queryParam("path", "/karta").when().get("/seed").then().statusCode(400);
        given().when().get("/seed").then().statusCode(400);
    }

    /* ─────────────────────────── normalisation ────────────────────────── */

    @Test
    void normaliseCoversTheRoutesTheShellScriptFiresFor() {
        assertEquals("/turniri", ShellRenderService.normalise("/"));
        assertEquals("/turniri", ShellRenderService.normalise("/turniri"));
        assertEquals("/turniri", ShellRenderService.normalise("/turniri/"));
        assertEquals("/turniri", ShellRenderService.normalise("/turniri?q=abc"));
        assertEquals("/turniri/moj-turnir", ShellRenderService.normalise("/turniri/moj-turnir"));
        assertEquals("/turniri/moj-turnir", ShellRenderService.normalise("/turniri/moj-turnir/pari"));
        assertNull(ShellRenderService.normalise("/turniri/novi"));
        assertNull(ShellRenderService.normalise("/kalendar"));
        assertNull(ShellRenderService.normalise("turniri"));
        assertNull(ShellRenderService.normalise(null));
        // Path traversal / injection attempts never reach the repository.
        assertNull(ShellRenderService.normalise("/turniri/..%2f..%2fetc"));
        assertNull(ShellRenderService.normalise("/turniri/a b"));
    }

}
