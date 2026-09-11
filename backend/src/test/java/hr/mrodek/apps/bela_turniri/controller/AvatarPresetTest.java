package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.services.AvatarPresetService;
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

import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * "Odaberi lika" — a drawn character instead of an uploaded photo
 * ({@link AvatarPresetService}, changeset {@code 2026-09-10-avatar-preset}).
 *
 * <p>What is worth pinning here:
 *
 * <ol>
 *   <li><b>The two assignment implementations agree.</b> The face a profile
 *       starts with is computed in Java for new rows and in SQL for the
 *       backfill. If those ever disagree, a restored dump silently reshuffles
 *       everyone's face — and nothing else in the system would notice.</li>
 *   <li><b>A new profile gets one, and keeps it.</b> Deterministic-from-uid is
 *       the whole point: two syncs must not produce two faces.</li>
 *   <li><b>The PUT contract</b> — a known id persists, {@code ""} clears, an
 *       unknown id is a 400 whose body is the bare code the SPA keys on, and
 *       an omitted field changes nothing.</li>
 *   <li><b>Precedence</b>: an uploaded photo wins, and uploading one clears the
 *       stored character outright.</li>
 *   <li><b>The game server can see it</b> — it renders seats itself and has no
 *       URL to fall back on.</li>
 * </ol>
 *
 * <p>{@code @TestSecurity} gets past the {@code @Authenticated} gate and a
 * stand-in {@link CurrentUser} supplies the UID, the same pattern
 * {@code PushDeviceControllerTest} uses. Runs against the docker-compose
 * Postgres and MinIO (devservices are disabled), so every test deletes the
 * rows it wrote.
 */
@QuarkusTest
class AvatarPresetTest {

    /** The %dev,test fallback in application.properties. */
    private static final String INTERNAL_TOKEN = "dev-secret-change-me";

    /** A real 1×1 PNG — StorageService decides the type from magic bytes. */
    private static final byte[] ONE_PIXEL_PNG = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    public static class SwitchableUser extends CurrentUser {
        volatile String uid;

        @Override public String requireUid() { return uid; }
        @Override public Optional<String> uid() { return Optional.ofNullable(uid); }
        @Override public String uidOrNull() { return uid; }
        @Override public boolean isAnonymous() { return uid == null; }
        @Override public boolean isAdmin() { return false; }
        @Override public String displayName() { return "Test"; }
    }

    /** Unique per run, so a leftover row from an earlier run cannot match. */
    private final String uid = "test-user-" + UUID.randomUUID();

    @Inject EntityManager em;
    @Inject AvatarPresetService presets;

    private SwitchableUser me;

    @BeforeEach
    void installCaller() {
        me = new SwitchableUser();
        me.uid = uid;
        QuarkusMock.installMockForType(me, CurrentUser.class);
    }

    @AfterEach
    void cleanUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            @SuppressWarnings("unchecked")
            List<Number> resourceIds = em.createNativeQuery(
                            "select avatar_resource_id from user_profiles"
                                    + " where user_uid = :uid and avatar_resource_id is not null")
                    .setParameter("uid", uid).getResultList();
            em.createNativeQuery("delete from user_profiles where user_uid = :uid")
                    .setParameter("uid", uid).executeUpdate();
            for (Number id : resourceIds) {
                em.createNativeQuery("delete from resources where id = :id")
                        .setParameter("id", id.longValue()).executeUpdate();
            }
        });
    }

    /* ---------- 1. migration ---------- */

    @Test
    void changesetAddedTheColumn() {
        assertEquals(1L, count("""
                select count(*) from information_schema.columns
                where table_name = 'user_profiles' and column_name = 'avatar_preset'
                """), "avatar_preset missing — changeset 2026-09-10-avatar-preset did not apply");
    }

    /* ---------- 2. the two implementations of the same function ---------- */

    /**
     * The backfill's SQL and {@link AvatarPresetService#defaultFor} must land
     * on the same face for the same uid. This runs the changeset's own
     * expression — copied verbatim, MD5 and the bit(28) width included — for a
     * sample of uids and compares it with what Java picks.
     */
    @Test
    void theSqlBackfillAndDefaultForAgree() {
        for (int i = 0; i < 50; i++) {
            String sample = "uid-sample-" + i + "-" + UUID.randomUUID();
            String fromSql = (String) em.createNativeQuery("""
                            select (array[
                                'kralj','baba','decko','dida','baka','gazda','konobar','cura',
                                'momak','kibic','gospon','sudac','teta','profa','mornar','seka'
                            ])[(('x' || substr(md5(:uid), 1, 7))::bit(28)::bigint % 16) + 1]
                            """)
                    .setParameter("uid", sample).getSingleResult();
            assertEquals(fromSql, presets.defaultFor(sample),
                    "SQL backfill and AvatarPresetService.defaultFor disagree for " + sample);
        }
    }

    /**
     * The backfill STATEMENT, not just its expression: an existing photo-less
     * row gets the face {@link AvatarPresetService#defaultFor} would give it,
     * and re-running writes nothing. The live database happened to contain no
     * eligible row when the changeset first ran, so without this the WHERE
     * clause would never have been exercised anywhere.
     */
    @Test
    void theBackfillStatementFillsAPhotolessRowAndIsIdempotent() {
        QuarkusTransaction.requiringNew().run(() -> em.createNativeQuery(
                        "insert into user_profiles (user_uid, display_name, slug)"
                                + " values (:uid, 'Backfill Tester', :slug)")
                .setParameter("uid", uid)
                .setParameter("slug", "backfill-" + uid)
                .executeUpdate());

        assertEquals(1, runBackfill(), "the backfill skipped an eligible row");
        assertEquals(presets.defaultFor(uid), storedPreset(),
                "the backfill picked a different face than defaultFor");

        assertEquals(0, runBackfill(), "re-running the backfill rewrote a row it had already filled");
        assertEquals(presets.defaultFor(uid), storedPreset());
    }

    /** Verbatim copy of the changeset's UPDATE; returns rows touched. */
    private int runBackfill() {
        return QuarkusTransaction.requiringNew().call(() -> em.createNativeQuery("""
                update user_profiles
                set avatar_preset = (array[
                    'kralj','baba','decko','dida','baka','gazda','konobar','cura',
                    'momak','kibic','gospon','sudac','teta','profa','mornar','seka'
                ])[(('x' || substr(md5(user_uid), 1, 7))::bit(28)::bigint % 16) + 1]
                where avatar_preset is null
                  and avatar_resource_id is null
                  and user_uid = :uid
                """).setParameter("uid", uid).executeUpdate());
    }

    /** Deterministic, and always something the renderer knows. */
    @Test
    void defaultForIsStableAndAlwaysAKnownPreset() {
        String first = presets.defaultFor(uid);
        assertEquals(first, presets.defaultFor(uid));
        assertTrue(presets.isValid(first), "defaultFor produced an id outside PRESETS: " + first);
        assertEquals(16, AvatarPresetService.PRESETS.size(), "PRESETS drifted from the 16 drawn faces");
    }

    /* ---------- 3. a new profile gets a face, and keeps it ---------- */

    @Test
    @TestSecurity(user = "test", roles = {})
    void aNewProfileGetsAPresetAndTheSameOneOnEveryFurtherSync() {
        String assigned = sync().then().statusCode(200)
                .body("avatarPreset", notNullValue())
                .extract().path("avatarPreset");

        assertEquals(presets.defaultFor(uid), assigned, "the row did not get defaultFor's face");

        // The frontend calls /sync on every login. A second call must not
        // reshuffle the face.
        sync().then().statusCode(200).body("avatarPreset", is(assigned));
        getProfile().then().statusCode(200).body("avatarPreset", is(assigned));
    }

    /* ---------- 4. the PUT contract ---------- */

    @Test
    @TestSecurity(user = "test", roles = {})
    void putStoresAKnownIdAndLeavesItAloneWhenTheFieldIsOmitted() {
        sync().then().statusCode(200);

        put("{\"avatarPreset\":\"konobar\"}").then().statusCode(200)
                .body("avatarPreset", is("konobar"));
        assertEquals("konobar", storedPreset());

        // A client that only edits the phone must not wipe the choice.
        put("{\"phone\":\"0911234567\"}").then().statusCode(200)
                .body("avatarPreset", is("konobar"));
        assertEquals("konobar", storedPreset());
    }

    @Test
    @TestSecurity(user = "test", roles = {})
    void putWithAnUnknownIdIsA400CarryingTheBareCode() {
        sync().then().statusCode(200);
        String before = storedPreset();

        put("{\"avatarPreset\":\"kapetan-nemo\"}").then().statusCode(400)
                .body(is("INVALID_AVATAR_PRESET"));

        assertEquals(before, storedPreset(), "a refused PUT still changed the stored preset");
    }

    @Test
    @TestSecurity(user = "test", roles = {})
    void putWithAnEmptyStringClearsIt() {
        sync().then().statusCode(200);
        put("{\"avatarPreset\":\"seka\"}").then().statusCode(200);

        put("{\"avatarPreset\":\"\"}").then().statusCode(200)
                .body("avatarPreset", nullValue());
        assertEquals(null, storedPreset());

        // And it stays cleared: the default is only assigned when the row is
        // first created, never handed back on a later request.
        sync().then().statusCode(200).body("avatarPreset", nullValue());
    }

    /* ---------- 5. precedence ---------- */

    @Test
    @TestSecurity(user = "test", roles = {})
    void uploadingAPhotoClearsThePresetAndThePhotoWins() {
        sync().then().statusCode(200);
        put("{\"avatarPreset\":\"kralj\"}").then().statusCode(200);

        given().multiPart("avatar", "face.png", ONE_PIXEL_PNG, "image/png")
                .when().post("/user/me/avatar")
                .then().statusCode(200)
                .body("avatarUrl", notNullValue())
                .body("avatarPreset", nullValue());

        assertEquals(null, storedPreset(), "the photo upload left the character on the row");
        getProfile().then().statusCode(200)
                .body("avatarUrl", notNullValue())
                .body("avatarPreset", nullValue());
    }

    /**
     * WHICHEVER THE USER CHOSE LAST is what the DTO reports (2026-09-11).
     * Neither kind outranks the other on its own — the ordering falls out of
     * one write rule: uploading a photo clears the preset, while picking a
     * character leaves the photo file alone. So a row carrying BOTH can only
     * mean the character was picked after the photo, and both fields are
     * reported: the client draws the character, and the photo is still there
     * to go back to.
     */
    @Test
    @TestSecurity(user = "test", roles = {})
    void aRowCarryingBothKeepsThePhotoAndReportsTheCharacterTheUserPickedLast() {
        sync().then().statusCode(200);
        given().multiPart("avatar", "face.png", ONE_PIXEL_PNG, "image/png")
                .when().post("/user/me/avatar").then().statusCode(200);

        // Picking a character on top of the photo — the normal path now, not a
        // corrupt row: the photo is out-ranked, never deleted.
        put("{\"avatarPreset\":\"baba\"}").then().statusCode(200)
                .body("avatarUrl", notNullValue())
                .body("avatarPreset", is("baba"));

        // Letting go of the character brings the photo back, without a re-upload.
        put("{\"avatarPreset\":\"\"}").then().statusCode(200)
                .body("avatarUrl", notNullValue())
                .body("avatarPreset", nullValue());
    }

    /* ---------- 6. the game server's view ---------- */

    @Test
    @TestSecurity(user = "test", roles = {})
    void theInternalProfileEndpointExposesThePreset() {
        sync().then().statusCode(200);
        put("{\"avatarPreset\":\"mornar\"}").then().statusCode(200);

        given().header("X-Internal-Token", INTERNAL_TOKEN)
                .when().get("/internal/profiles/" + uid)
                .then().statusCode(200)
                .body("avatarPreset", is("mornar"))
                // The existing fields are untouched.
                .body("avatarUrl", nullValue())
                .body("displayName", notNullValue());
    }

    @Test
    void theInternalEndpointAnswersNullForAUidWithNoProfile() {
        given().header("X-Internal-Token", INTERNAL_TOKEN)
                .when().get("/internal/profiles/nobody-" + UUID.randomUUID())
                .then().statusCode(200)
                .body("avatarPreset", nullValue());
    }

    /* ---------- 7. the public profile page ---------- */

    @Test
    @TestSecurity(user = "test", roles = {})
    void thePublicProfileExposesThePreset() {
        String slug = sync().then().statusCode(200).extract().path("slug");
        assertNotNull(slug);
        put("{\"avatarPreset\":\"profa\"}").then().statusCode(200);

        given().when().get("/public/users/" + slug)
                .then().statusCode(200)
                .body("avatarPreset", is("profa"));
    }

    /* ---------- helpers ---------- */

    private io.restassured.response.Response sync() {
        return given().contentType(ContentType.JSON)
                .body("{\"displayName\":\"Preset Tester\"}")
                .when().post("/user/me/sync");
    }

    private io.restassured.response.Response getProfile() {
        return given().when().get("/user/me/profile");
    }

    private io.restassured.response.Response put(String body) {
        return given().contentType(ContentType.JSON).body(body)
                .when().put("/user/me/profile");
    }

    private String storedPreset() {
        return QuarkusTransaction.requiringNew().call(() -> (String) em.createNativeQuery(
                        "select avatar_preset from user_profiles where user_uid = :uid")
                .setParameter("uid", uid).getSingleResult());
    }

    private long count(String sql) {
        return ((Number) em.createNativeQuery(sql).getSingleResult()).longValue();
    }

    @Test
    @TestSecurity(user = "test", roles = {})
    void removingThePhotoGivesTheFaceBack() {
        // Uploading a photo clears the preset outright, so a player who never
        // picked one would otherwise come out of "delete photo" with nothing
        // but initials. The delete restores the deterministic default.
        sync().then().statusCode(200);
        QuarkusTransaction.requiringNew().run(() -> em.createNativeQuery(
                        "update user_profiles set avatar_preset = null where user_uid = :uid")
                .setParameter("uid", uid).executeUpdate());

        String preset = given().when()
                .delete("/user/me/avatar")
                .then().statusCode(200)
                .extract().jsonPath().getString("avatarPreset");

        assertNotNull(preset, "deleting the photo must leave a face behind");
        assertEquals(presets.defaultFor(uid), preset);
    }
}
