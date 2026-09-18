package hr.mrodek.apps.bela_turniri.controller;

import com.google.firebase.messaging.Message;
import hr.mrodek.apps.bela_turniri.model.PushDevice;
import hr.mrodek.apps.bela_turniri.services.FcmSender;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusMock;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@code POST /internal/live-activity} (game/README.md §3 "Live Activity").
 *
 * <p>What is pinned: the shared-secret gate behaves like its siblings (flat
 * 401, before any body validation); a valid body is 202 and an invalid one a
 * 400; with FCM unconfigured nothing is attempted and nothing throws; and the
 * Android path reaches android rows only, deleting a dead one. No real FCM or
 * APNs delivery is possible here — the sender is a stand-in installed with
 * {@code QuarkusMock}, the pattern {@code FcmSenderTest} uses.
 *
 * <p>Runs against the docker-compose Postgres and deletes what it writes.
 */
@QuarkusTest
class LiveActivityInternalControllerTest {

    private static final String PATH = "/internal/live-activity";
    /** The %dev,test fallback in application.properties. */
    private static final String TOKEN = "dev-secret-change-me";
    private static final long AWAIT_MILLIS = 5_000;

    /** {@code @Vetoed}: see {@code FcmSenderTest.StubFcmSender} for why. */
    @jakarta.enterprise.inject.Vetoed
    public static class StubFcmSender extends FcmSender {
        volatile Result verdict = Result.OK;
        final List<String> sentTokens = new CopyOnWriteArrayList<>();
        final List<String> sentPlatforms = new CopyOnWriteArrayList<>();

        @Override public boolean isEnabled() { return true; }

        @Override
        public Result sendMessage(String token, String platform, Message message) {
            sentTokens.add(token);
            sentPlatforms.add(platform);
            return verdict;
        }
    }

    private final String uid = "test-user-" + UUID.randomUUID();

    @Inject EntityManager em;
    @Inject FcmSender realSender;

    @AfterEach
    void cleanUp() {
        QuarkusTransaction.requiringNew().run(() -> em
                .createNativeQuery("delete from push_devices where user_uid = :uid")
                .setParameter("uid", uid)
                .executeUpdate());
    }

    /* ---------- auth ---------- */

    @Test
    void rejectsMissingToken() {
        given().contentType(ContentType.JSON).body(body("update"))
                .when().post(PATH)
                .then().statusCode(401).body("code", is("UNAUTHORIZED"));
    }

    @Test
    void rejectsWrongTokenBeforeLookingAtTheBody() {
        given().contentType(ContentType.JSON).header("X-Internal-Token", TOKEN + "x")
                .body("{\"event\":\"nonsense\"}")
                .when().post(PATH)
                .then().statusCode(401);
    }

    /* ---------- validation ---------- */

    @Test
    void refusesAnInvalidBody() {
        post(body("start")).then().statusCode(400);
        post(body("update").replace("\"phase\":\"playing\"", "\"phase\":\"lobby\"")).then().statusCode(400);
        post(body("update").replace("\"trump\":\"PIK\"", "\"trump\":\"SPADES\"")).then().statusCode(400);
        post("{\"uid\":\"" + uid + "\",\"event\":\"update\"}").then().statusCode(400);
    }

    /* ---------- FCM disabled ---------- */

    @Test
    void acceptsAValidBodyAndIsANoOpWithoutFcm() {
        assertFalse(realSender.isEnabled(), "the test profile sets no service account");
        insertDevice(PushDevice.PLATFORM_ANDROID);
        post(body("update")).then().statusCode(202);
        post(body("end").replace("\"winner\":null", "\"winner\":\"us\"")).then().statusCode(202);
        assertEquals(1L, devices(), "a disabled sender must leave the device alone");
    }

    /* ---------- android path ---------- */

    @Test
    void sendsToAndroidDevicesOnlyAndDropsADeadOne() {
        StubFcmSender stub = new StubFcmSender();
        stub.verdict = FcmSender.Result.DEAD_TOKEN;
        QuarkusMock.installMockForType(stub, FcmSender.class);

        String android = insertDevice(PushDevice.PLATFORM_ANDROID);
        String ios = insertDevice(PushDevice.PLATFORM_IOS);

        // No iOS activity token in the body, so iOS has nothing to receive.
        post(body("update")).then().statusCode(202);

        assertTrue(await(() -> devices() == 1L), "the dead android device was not dropped");
        assertEquals(List.of(android), stub.sentTokens);
        assertEquals(List.of(PushDevice.PLATFORM_ANDROID), stub.sentPlatforms);
        assertFalse(stub.sentTokens.contains(ios));
    }

    /* ---------- helpers ---------- */

    private io.restassured.response.Response post(String json) {
        return given().contentType(ContentType.JSON).header("X-Internal-Token", TOKEN)
                .body(json).when().post(PATH);
    }

    private String body(String event) {
        return """
                {"uid":"%s","event":"%s","state":{"roomId":"r-1","phase":"playing","scoreUs":312,
                "scoreThem":140,"target":1001,"yourTurn":true,"turnSeat":2,"turnDeadline":1757770000000,
                "trump":"PIK","winner":null}}
                """.formatted(uid, event);
    }

    private String insertDevice(String platform) {
        String token = "test-fcm-token-" + UUID.randomUUID();
        QuarkusTransaction.requiringNew().run(() -> {
            PushDevice d = new PushDevice();
            d.setUserUid(uid);
            d.setToken(token);
            d.setPlatform(platform);
            em.persist(d);
        });
        return token;
    }

    private long devices() {
        return QuarkusTransaction.requiringNew().call(() -> ((Number) em.createNativeQuery(
                        "select count(*) from push_devices where user_uid = :uid")
                .setParameter("uid", uid).getSingleResult()).longValue());
    }

    private static boolean await(java.util.function.BooleanSupplier condition) {
        long deadline = System.currentTimeMillis() + AWAIT_MILLIS;
        while (System.currentTimeMillis() < deadline) {
            if (condition.getAsBoolean()) return true;
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        return condition.getAsBoolean();
    }
}
