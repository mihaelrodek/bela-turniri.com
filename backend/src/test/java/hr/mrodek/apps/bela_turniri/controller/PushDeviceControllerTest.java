package hr.mrodek.apps.bela_turniri.controller;

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

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Native push registration — {@code PUT /push/device} and
 * {@code DELETE /push/device/{token}}, plus the {@code /user/me/push/device}
 * aliases the native shells call (task N3.1).
 *
 * <p>What is worth pinning here:
 *
 * <ol>
 *   <li><b>The changeset applied</b> — table, unique token, user index. The
 *       uniqueness of {@code token} is the whole reassignment story below:
 *       without it a phone handed to a second person would deliver to both.</li>
 *   <li><b>Registration is an upsert</b>: 201 the first time, 200 on the
 *       re-registration the shell performs on every cold start, and never a
 *       second row.</li>
 *   <li><b>A token that moves between users is REASSIGNED</b>, not duplicated
 *       and not refused — the previous owner must stop receiving on it.</li>
 *   <li><b>Deleting someone else's token is a 404</b>, indistinguishable from
 *       an unknown one, so a leaked token cannot be used to probe for or
 *       silence another account's phone.</li>
 *   <li><b>An unsupported platform is a 400</b>, and writes nothing.</li>
 *   <li><b>Both URL prefixes reach the same rows</b> — they delegate to one
 *       service and must not drift.</li>
 *   <li><b>Anonymous callers get 401</b>: guests have no native push.</li>
 * </ol>
 *
 * <p>{@code @TestSecurity} gets past the {@code @Authenticated} gate (this
 * project has no Firebase test-token scaffolding), and a stand-in
 * {@link CurrentUser} supplies the UID the rows are keyed on — the same
 * {@code QuarkusMock} pattern {@code BlokHistoryControllerTest} uses. The
 * request itself still runs through the real JAX-RS pipeline, so the status
 * codes and the bean-validation 400 are the real ones.
 *
 * <p>Runs against the docker-compose Postgres (devservices are disabled), so
 * every test deletes the rows it wrote: the same database holds real local
 * data.
 */
@QuarkusTest
class PushDeviceControllerTest {

    /** Flip {@link #asUser} to change who the endpoints think is calling. */
    public static class SwitchableUser extends CurrentUser {
        volatile String uid = "test-uid-a";

        @Override public String requireUid() { return uid; }
        @Override public Optional<String> uid() { return Optional.ofNullable(uid); }
        @Override public String uidOrNull() { return uid; }
        @Override public boolean isAnonymous() { return uid == null; }
        @Override public boolean isAdmin() { return false; }
        @Override public String displayName() { return "Test"; }
    }

    /** Unique per run, so a leftover row from an earlier run cannot match. */
    private final String uidA = "test-user-" + UUID.randomUUID();
    private final String uidB = "test-user-" + UUID.randomUUID();
    private final String token = "test-fcm-token-" + UUID.randomUUID();

    @Inject EntityManager em;

    private SwitchableUser me;

    @BeforeEach
    void installCaller() {
        me = new SwitchableUser();
        me.uid = uidA;
        QuarkusMock.installMockForType(me, CurrentUser.class);
    }

    private void asUser(String uid) {
        me.uid = uid;
    }

    @AfterEach
    void cleanUp() {
        QuarkusTransaction.requiringNew().run(() -> em
                .createNativeQuery("delete from push_devices where user_uid in (:uids)")
                .setParameter("uids", List.of(uidA, uidB))
                .executeUpdate());
    }

    /* ---------- 1. migration ---------- */

    @Test
    void changesetCreatedTheTableTheUniqueTokenAndTheUserIndex() {
        assertEquals(1L, count("""
                select count(*) from information_schema.tables
                where table_name = 'push_devices'
                """), "push_devices table missing — changeset 2026-09-10-push-devices did not apply");

        // Reassignment only has one possible outcome because of this.
        assertEquals(1L, count("""
                select count(*) from pg_indexes
                where indexname = 'uq_push_devices_token' and indexdef like '%UNIQUE%'
                """), "unique index on token missing");

        assertEquals(1L, count("""
                select count(*) from pg_indexes
                where indexname = 'idx_push_devices_user_uid'
                """), "fan-out index on user_uid missing");
    }

    /* ---------- 2. upsert ---------- */

    @Test
    @TestSecurity(user = "test", roles = {})
    void registersOnceAndRefreshesOnEveryColdStart() {
        register(token, "android", "hr", "1.0.0").then().statusCode(201);

        // The shell re-registers the same token on every launch: same row, 200.
        register(token, "android", "hr", "1.0.1").then().statusCode(200);

        assertEquals(1L, devicesOf(uidA), "re-registration duplicated the device");
        assertEquals("1.0.1", (String) em.createNativeQuery(
                        "select app_version from push_devices where token = :t")
                .setParameter("t", token).getSingleResult(),
                "refresh did not update the row");
    }

    @Test
    @TestSecurity(user = "test", roles = {})
    void acceptsBothPlatformsCaseInsensitively() {
        register(token, "IOS", null, null).then().statusCode(201);
        assertEquals("ios", (String) em.createNativeQuery(
                        "select platform from push_devices where token = :t")
                .setParameter("t", token).getSingleResult());
    }

    /* ---------- 3. reassignment ---------- */

    @Test
    @TestSecurity(user = "test", roles = {})
    void aTokenThatMovesToAnotherUserIsReassignedNotDuplicated() {
        register(token, "ios", null, null).then().statusCode(201);

        // Same phone, second person signs in.
        asUser(uidB);
        register(token, "ios", null, null).then().statusCode(200);

        assertEquals(0L, devicesOf(uidA), "previous owner still receives on that device");
        assertEquals(1L, devicesOf(uidB));
    }

    /* ---------- 4. delete ---------- */

    @Test
    @TestSecurity(user = "test", roles = {})
    void deletesOwnTokenAndRefusesSomeoneElsesWithA404() {
        register(token, "android", null, null).then().statusCode(201);

        // Someone else's token: a 404, identical to an unknown one, so the
        // response never confirms the token exists under another account.
        asUser(uidB);
        given().when().delete("/push/device/" + token).then().statusCode(404);
        given().when().delete("/push/device/" + UUID.randomUUID()).then().statusCode(404);
        assertEquals(1L, devicesOf(uidA), "another user's delete removed the row");

        asUser(uidA);
        given().when().delete("/push/device/" + token).then().statusCode(204);
        assertEquals(0L, devicesOf(uidA));
    }

    /* ---------- 5. validation ---------- */

    @Test
    @TestSecurity(user = "test", roles = {})
    void refusesAnUnsupportedPlatformAndAMissingToken() {
        register(token, "windows", null, null).then().statusCode(400);
        register("", "android", null, null).then().statusCode(400);
        register(token, "", null, null).then().statusCode(400);
        assertEquals(0L, devicesOf(uidA), "a refused registration still wrote a row");
    }

    /* ---------- 6. the /user/me alias ---------- */

    @Test
    @TestSecurity(user = "test", roles = {})
    void theUserMeAliasReachesTheSameRow() {
        given().contentType(ContentType.JSON)
                .body(body(token, "ios", null, null))
                .when().put("/user/me/push/device")
                .then().statusCode(201);
        assertEquals(1L, devicesOf(uidA));

        // Registered through one prefix, removed through the other.
        given().when().delete("/user/me/push/device/" + token).then().statusCode(204);
        assertEquals(0L, devicesOf(uidA));
    }

    /* ---------- 7. guests ---------- */

    @Test
    void anonymousCallersGetA401OnEveryDeviceEndpoint() {
        // No @TestSecurity here: a guest has no bearer token, therefore no
        // Firebase UID, therefore no native push at all.
        given().contentType(ContentType.JSON).body(body(token, "ios", null, null))
                .when().put("/push/device").then().statusCode(401);
        given().when().delete("/push/device/" + token).then().statusCode(401);
        given().contentType(ContentType.JSON).body(body(token, "ios", null, null))
                .when().put("/user/me/push/device").then().statusCode(401);
    }

    /* ---------- helpers ---------- */

    private io.restassured.response.Response register(
            String token, String platform, String locale, String appVersion) {
        return given().contentType(ContentType.JSON)
                .body(body(token, platform, locale, appVersion))
                .when().put("/push/device");
    }

    private static String body(String token, String platform, String locale, String appVersion) {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"token\":").append(quote(token));
        sb.append(",\"platform\":").append(quote(platform));
        if (locale != null) sb.append(",\"locale\":").append(quote(locale));
        if (appVersion != null) sb.append(",\"appVersion\":").append(quote(appVersion));
        return sb.append("}").toString();
    }

    private static String quote(String s) {
        return s == null ? "null" : "\"" + s.replace("\"", "\\\"") + "\"";
    }

    private long devicesOf(String uid) {
        return ((Number) em.createNativeQuery(
                        "select count(*) from push_devices where user_uid = :uid")
                .setParameter("uid", uid).getSingleResult()).longValue();
    }

    private long count(String sql) {
        return ((Number) em.createNativeQuery(sql).getSingleResult()).longValue();
    }
}
