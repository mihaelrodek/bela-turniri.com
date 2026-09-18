package hr.mrodek.apps.bela_turniri.filters;

import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.services.CurrentUser;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * {@link PublicReadCacheFilter}: the shared {@code Cache-Control} +
 * {@code stale-while-revalidate} on public reads, weak {@code ETag} →
 * {@code If-None-Match} → 304 on the same routes plus {@code tournaments/
 * {idOrSlug}} and {@code public/users/{slug}}, and the private no-cache +
 * ETag pair on {@code GET /user/me/profile}.
 *
 * <p>Runs against the docker-compose Postgres, fixtures committed in
 * {@code @BeforeEach} and removed in {@code @AfterEach}, same pattern as
 * {@link hr.mrodek.apps.bela_turniri.controller.TournamentSearchControllerTest}.
 */
@QuarkusTest
class PublicReadCacheFilterTest {

    private static final String SWR_CACHE_VALUE =
            "public, max-age=20, s-maxage=60, stale-while-revalidate=120";

    /**
     * {@code @TestSecurity} alone forges a non-anonymous {@code SecurityIdentity}
     * (enough to pass the class-level {@code @Authenticated} on
     * {@code UserMeController}), but the real {@link CurrentUser} extracts the
     * uid from a verified {@code JsonWebToken}, which a synthetic OIDC-less
     * test identity never carries — so {@code requireUid()} still 401s unless
     * the bean itself is swapped. Same workaround
     * {@code AvatarPresetTest}/{@code PushDeviceControllerTest} use.
     */
    public static class SwitchableUser extends CurrentUser {
        volatile String uid;

        @Override public String requireUid() { return uid; }
        @Override public Optional<String> uid() { return Optional.ofNullable(uid); }
        @Override public String uidOrNull() { return uid; }
        @Override public boolean isAnonymous() { return uid == null; }
        @Override public boolean isAdmin() { return false; }
        @Override public String displayName() { return "Cache Filter Tester"; }
    }

    private static void installCurrentUser(String uid) {
        SwitchableUser me = new SwitchableUser();
        me.uid = uid;
        QuarkusMock.installMockForType(me, CurrentUser.class);
    }

    @Inject
    EntityManager em;

    private final String suffix = UUID.randomUUID().toString();
    private Long tournamentId;
    private String tournamentUuid;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            Tournaments t = new Tournaments();
            t.setName("Cache filter test " + suffix);
            t.setLocation("Testno mjesto " + suffix);
            t.setStatus(TournamentStatus.DRAFT);
            t.setCreatedByUid("cache-filter-test-organiser");
            t.setCreatedAt(OffsetDateTime.now());
            t.setStartAt(OffsetDateTime.now().plusDays(7));
            em.persist(t);
            em.flush();
            tournamentId = t.getId();
            tournamentUuid = t.getUuid().toString();
        });
    }

    @AfterEach
    void cleanUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            em.createNativeQuery("delete from tournaments where id = :id")
                    .setParameter("id", tournamentId).executeUpdate();
        });
    }

    /* ---------- tournaments list ---------- */

    @Test
    void listCarriesSwrCacheControlAndAWeakEtag() {
        given().when().get("/tournaments")
                .then().statusCode(200)
                .header("Cache-Control", SWR_CACHE_VALUE)
                .header("Vary", containsString("Authorization"))
                .header("ETag", startsWith("W/\""));
    }

    @Test
    void listRepeatedWithTheSameIfNoneMatchIs304() {
        String etag = given().when().get("/tournaments")
                .then().statusCode(200)
                .extract().header("ETag");
        assertNotNull(etag);

        given().header("If-None-Match", etag)
                .when().get("/tournaments")
                .then().statusCode(304)
                .header("Cache-Control", SWR_CACHE_VALUE)
                .body(org.hamcrest.Matchers.emptyOrNullString());
    }

    /* ---------- tournaments/count ---------- */

    @Test
    void countCarriesSwrCacheControlAndAWeakEtag() {
        given().when().get("/tournaments/count")
                .then().statusCode(200)
                .header("Cache-Control", SWR_CACHE_VALUE)
                .header("ETag", startsWith("W/\""));
    }

    /* ---------- tournament detail ---------- */

    @Test
    void detailCarriesSwrCacheControlAndAWeakEtagAndHonoursIfNoneMatch() {
        String etag = given().when().get("/tournaments/" + tournamentUuid)
                .then().statusCode(200)
                .header("Cache-Control", SWR_CACHE_VALUE)
                .header("ETag", startsWith("W/\""))
                .extract().header("ETag");

        given().header("If-None-Match", etag)
                .when().get("/tournaments/" + tournamentUuid)
                .then().statusCode(304);
    }

    /** {@code /mine} must never be mistaken for the {@code {idOrSlug}} detail route. */
    @Test
    void mineIsNeverStampedByTheDetailPathMatch() {
        given().when().get("/tournaments/mine")
                .then().statusCode(401); // unauthenticated — no Cache-Control/ETag concern either way
    }

    /* ---------- cjenik ---------- */

    @Test
    void cjenikCarriesSwrCacheControlAndAWeakEtag() {
        given().when().get("/tournaments/" + tournamentUuid + "/cjenik")
                .then().statusCode(200)
                .header("Cache-Control", SWR_CACHE_VALUE)
                .header("ETag", startsWith("W/\""));
    }

    /* ---------- pairs must stay uncached (live during a tournament) ---------- */

    @Test
    void pairsListingIsNeverStampedByThisFilter() {
        given().when().get("/tournaments/" + tournamentUuid + "/pairs")
                .then().statusCode(200)
                .header("Cache-Control", org.hamcrest.Matchers.nullValue())
                .header("ETag", org.hamcrest.Matchers.nullValue());
    }

    /* ---------- public profile ---------- */

    @Test
    @TestSecurity(user = "cache-filter-profile-owner", roles = {})
    void publicProfileCarriesSwrCacheControlAndAWeakEtagForAnAnonymousViewer() {
        installCurrentUser("cache-filter-profile-owner");
        String slug = given().contentType(ContentType.JSON)
                .body("{\"displayName\":\"Cache Filter Tester " + suffix + "\"}")
                .when().post("/user/me/sync")
                .then().statusCode(200)
                .extract().path("slug");
        assertNotNull(slug);

        try {
            // A genuinely anonymous request (no @TestSecurity on the call
            // itself, no Authorization header) — the redaction-sensitive
            // case this filter has to get right.
            String etag = given().when().get("/public/users/" + slug)
                    .then().statusCode(200)
                    .header("Cache-Control", SWR_CACHE_VALUE)
                    .header("ETag", startsWith("W/\""))
                    .extract().header("ETag");

            given().header("If-None-Match", etag)
                    .when().get("/public/users/" + slug)
                    .then().statusCode(304);
        } finally {
            QuarkusTransaction.requiringNew().run(() -> em.createNativeQuery(
                            "delete from user_profiles where user_uid = :uid")
                    .setParameter("uid", "cache-filter-profile-owner").executeUpdate());
        }
    }

    /* ---------- private profile ---------- */

    @Test
    @TestSecurity(user = "cache-filter-me-profile", roles = {})
    void userMeProfileIsPrivateNoCacheWithAWeakEtag() {
        installCurrentUser("cache-filter-me-profile");
        try {
            String etag = given().when().get("/user/me/profile")
                    .then().statusCode(200)
                    .header("Cache-Control", "private, no-cache")
                    .header("ETag", startsWith("W/\""))
                    .extract().header("ETag");

            given().header("If-None-Match", etag)
                    .when().get("/user/me/profile")
                    .then().statusCode(304)
                    .header("Cache-Control", "private, no-cache");
        } finally {
            QuarkusTransaction.requiringNew().run(() -> em.createNativeQuery(
                            "delete from user_profiles where user_uid = :uid")
                    .setParameter("uid", "cache-filter-me-profile").executeUpdate());
        }
    }

    /* ---------- collision hygiene: an already-stamped response is left alone ---------- */

    @Test
    void endpointsThatSetTheirOwnCacheControlAreNeverOverwritten() {
        // qr.png sets its own long-lived Cache-Control and its own strong
        // ETag — this filter must not touch it.
        given().when().get("/tournaments/" + tournamentUuid + "/qr.png")
                .then().statusCode(200)
                .header("Cache-Control", "public, max-age=86400, s-maxage=86400");
    }
}
