package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.model.PushDevice;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The native (FCM) half of the push fan-out (task N3.1).
 *
 * <p>Two things are worth proving without a Firebase project:
 *
 * <ol>
 *   <li><b>Unconfigured is a clean no-op.</b> No service account is set in the
 *       test profile, so {@link FcmSender} must report itself disabled, refuse
 *       to send, and — crucially — {@link PushService} must still run without
 *       throwing, because every write in the app calls it.</li>
 *   <li><b>A dead token deletes its row.</b> FCM's UNREGISTERED is the
 *       equivalent of Web Push's 410, and without this the table accumulates
 *       tokens that can never be delivered to. Driven through a stand-in
 *       {@link FcmSender} installed with {@code QuarkusMock} — the pattern
 *       already used for {@code CurrentUser} — so the real fan-out code path
 *       (after-commit hook, daemon pool, cleaner) is the one under test.</li>
 * </ol>
 *
 * <p>Runs against the docker-compose Postgres, and deletes what it writes.
 */
@QuarkusTest
class FcmSenderTest {

    /** How long to wait for the after-commit fan-out to reach the database. */
    private static final long AWAIT_MILLIS = 5_000;

    /**
     * Stand-in sender: reports enabled, records calls, returns a fixed verdict.
     *
     * <p>{@code @Vetoed} because {@link FcmSender}'s {@code @ApplicationScoped}
     * is {@code @Inherited}: without it this subclass is discovered as a second
     * bean of the same type and every injection point becomes ambiguous. The
     * instance still reaches the container through
     * {@code QuarkusMock.installMockForType}.
     */
    @jakarta.enterprise.inject.Vetoed
    public static class StubFcmSender extends FcmSender {
        volatile Result verdict = Result.OK;
        final List<String> sentTokens = new CopyOnWriteArrayList<>();

        @Override public boolean isEnabled() { return true; }

        @Override
        public Result send(String token, String platform, PushService.PushPayload payload) {
            sentTokens.add(token);
            return verdict;
        }
    }

    private final String uid = "test-user-" + UUID.randomUUID();

    @Inject EntityManager em;
    @Inject PushService pushService;
    @Inject FcmSender realSender;

    @AfterEach
    void cleanUp() {
        QuarkusTransaction.requiringNew().run(() -> em
                .createNativeQuery("delete from push_devices where user_uid = :uid")
                .setParameter("uid", uid)
                .executeUpdate());
    }

    /* ---------- 1. unconfigured ---------- */

    @Test
    void withNoServiceAccountTheSenderIsDisabledAndSendingIsANoOp() {
        assertFalse(realSender.isEnabled(),
                "the test profile sets no service account, so FCM must be disabled");

        assertEquals(FcmSender.Result.DISABLED,
                realSender.send("any-token", "ios",
                        new PushService.PushPayload("T", "B", "/turniri")),
                "a disabled sender must not attempt a send");

        // And the fan-out as a whole survives it: with neither VAPID keys nor
        // FCM configured in the test profile, sendToUser has nothing to do and
        // must simply return. Every write in the app calls this.
        pushService.sendToUser(uid, new PushService.PushPayload("T", "B", "/turniri"));
    }

    /* ---------- 2. dead-token cleanup ---------- */

    @Test
    void anUnregisteredTokenIsDeleted() {
        StubFcmSender stub = new StubFcmSender();
        stub.verdict = FcmSender.Result.DEAD_TOKEN;
        QuarkusMock.installMockForType(stub, FcmSender.class);

        String token = insertDevice();

        // Inside a transaction, so the send goes through the real after-commit
        // hook rather than the inline path.
        QuarkusTransaction.requiringNew().run(() -> pushService.sendToUser(
                uid, new PushService.PushPayload("Runda 1", "A vs B", "/turniri/x")));

        assertTrue(awaitDeviceCount(0),
                "UNREGISTERED did not drop the device row (still " + devices() + ")");
        assertEquals(List.of(token), stub.sentTokens, "the token was not sent to");
    }

    @Test
    void anAcceptedSendKeepsTheRowAndStampsLastSeen() {
        StubFcmSender stub = new StubFcmSender();
        stub.verdict = FcmSender.Result.OK;
        QuarkusMock.installMockForType(stub, FcmSender.class);

        insertDevice();
        // A stale lastSeenAt we can watch move.
        QuarkusTransaction.requiringNew().run(() -> em
                .createNativeQuery("update push_devices set last_seen_at = :then where user_uid = :uid")
                .setParameter("then", OffsetDateTime.now().minusDays(30))
                .setParameter("uid", uid)
                .executeUpdate());

        QuarkusTransaction.requiringNew().run(() -> pushService.sendToUser(
                uid, new PushService.PushPayload("Runda 1", "A vs B", "/turniri/x")));

        assertTrue(awaitLastSeenWithinTheHour(), "a successful send did not stamp lastSeenAt");
        assertEquals(1L, devices(), "a successful send deleted the device");
    }

    /* ---------- helpers ---------- */

    private String insertDevice() {
        String token = "test-fcm-token-" + UUID.randomUUID();
        QuarkusTransaction.requiringNew().run(() -> {
            PushDevice d = new PushDevice();
            d.setUserUid(uid);
            d.setToken(token);
            d.setPlatform(PushDevice.PLATFORM_ANDROID);
            em.persist(d);
        });
        return token;
    }

    private long devices() {
        return QuarkusTransaction.requiringNew().call(() -> ((Number) em.createNativeQuery(
                        "select count(*) from push_devices where user_uid = :uid")
                .setParameter("uid", uid).getSingleResult()).longValue());
    }

    /** The fan-out is asynchronous by design, so poll rather than assert once. */
    private boolean awaitDeviceCount(long expected) {
        return await(() -> devices() == expected);
    }

    private boolean awaitLastSeenWithinTheHour() {
        return await(() -> QuarkusTransaction.requiringNew().call(() -> ((Number) em.createNativeQuery("""
                        select count(*) from push_devices
                        where user_uid = :uid and last_seen_at > now() - interval '1 hour'
                        """).setParameter("uid", uid).getSingleResult()).longValue() == 1L));
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
