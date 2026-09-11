package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.services.CurrentUser;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * "Prijavi para za turnir" WITHOUT signing in —
 * {@code POST /tournaments/{uuid}/pairs/self-register} with no bearer token.
 *
 * <p>What is worth pinning here:
 *
 * <ol>
 *   <li><b>The phone is mandatory anonymously</b> ({@code CONTACT_PHONE_REQUIRED})
 *       and optional when signed in. It is the only way an organiser can reach a
 *       registration that belongs to no account.</li>
 *   <li><b>The row lands ownerless and pending</b>, with a claim URL in the
 *       reply — the submitter's only handle on it.</li>
 *   <li><b>The phone NEVER appears in the public pairs list</b> and DOES appear
 *       for the organiser. This is the whole exposure rule; the list endpoint is
 *       anonymous-readable, so a regression here is a PII leak, not a bug.</li>
 *   <li><b>Duplicates by (name, phone) are refused</b>, since there is no uid to
 *       key on.</li>
 *   <li><b>Anonymous submissions are throttled per IP</b> — the organiser's
 *       approval is the real defence, this only stops scripted floods.</li>
 *   <li><b>The signed-in path is unchanged</b>: owner stamped, no phone needed.</li>
 * </ol>
 *
 * <p>{@code @TestSecurity} + a stand-in {@link CurrentUser} are how this project
 * fakes an identity (no Firebase test-token scaffolding); the anonymous tests
 * install a {@code CurrentUser} whose uid is null, which is exactly what a
 * tokenless request produces.
 *
 * <p>Runs against the docker-compose Postgres (devservices are disabled), so
 * fixtures are committed and deleted again in {@code @AfterEach}.
 */
@QuarkusTest
class SelfRegisterAnonymousTest {

    /** Flip {@link #uid} to switch between an anonymous and a signed-in caller. */
    public static class SwitchableUser extends CurrentUser {
        volatile String uid = null;
        volatile boolean admin = false;

        @Override public Optional<String> uid() { return Optional.ofNullable(uid); }
        @Override public String uidOrNull() { return uid; }
        @Override public boolean isAnonymous() { return uid == null; }
        @Override public boolean isAdmin() { return admin; }
        @Override public String displayName() { return "Test"; }
    }

    @Inject EntityManager em;

    private SwitchableUser me;
    private Long tournamentId;
    private String tournamentUuid;
    private final String organiserUid = "selfreg-organiser-" + UUID.randomUUID();
    private final String playerUid = "selfreg-player-" + UUID.randomUUID();

    @BeforeEach
    void setUp() {
        me = new SwitchableUser();
        me.uid = null;
        QuarkusMock.installMockForType(me, CurrentUser.class);

        QuarkusTransaction.requiringNew().run(() -> {
            Tournaments t = new Tournaments();
            t.setName("Self-register test " + UUID.randomUUID());
            t.setStatus(TournamentStatus.DRAFT);
            t.setCreatedByUid(organiserUid);
            t.setCreatedAt(OffsetDateTime.now());
            em.persist(t);
            em.flush();
            tournamentId = t.getId();
            tournamentUuid = t.getUuid().toString();
        });
    }

    @AfterEach
    void cleanUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            em.createNativeQuery("delete from pairs where tournament_id = :id")
                    .setParameter("id", tournamentId).executeUpdate();
            em.createNativeQuery("delete from tournaments where id = :id")
                    .setParameter("id", tournamentId).executeUpdate();
            em.createNativeQuery("delete from user_pair_presets where user_uid = :uid")
                    .setParameter("uid", playerUid).executeUpdate();
            em.createNativeQuery("delete from user_profiles where user_uid in (:uids)")
                    .setParameter("uids", java.util.List.of(playerUid, organiserUid))
                    .executeUpdate();
        });
    }

    /* ---------- 1. the migration ---------- */

    @Test
    void changesetAddedTheContactPhoneColumn() {
        Object count = em.createNativeQuery("""
                select count(*) from information_schema.columns
                where table_name = 'pairs' and column_name = 'contact_phone'
                """).getSingleResult();
        assertEquals(1L, ((Number) count).longValue(),
                "contact_phone missing — changeset 2026-09-10-pairs-contact-phone did not apply");
    }

    /* ---------- 2. the phone is mandatory anonymously ---------- */

    @Test
    void anonymousRegistrationWithoutAPhoneIsRefused() {
        register("TEST anon bez broja", null, null)
                .then().statusCode(400).body(org.hamcrest.Matchers.containsString("CONTACT_PHONE_REQUIRED"));
        assertEquals(0L, pairCount(), "a refused registration still wrote a row");
    }

    /* ---------- 3. the happy anonymous path ---------- */

    @Test
    void anonymousRegistrationLandsOwnerlessPendingAndCarriesAClaimUrl() {
        Response res = register("TEST anon par", "0911234567", null);
        res.then().statusCode(201);

        assertTrue(res.jsonPath().getBoolean("pendingApproval"), "pair was not left pending");
        assertNull(res.jsonPath().getString("submittedByUid"), "anonymous pair got an owner");
        String claimUrl = res.jsonPath().getString("claimUrl");
        assertNotNull(claimUrl, "no claim URL — the submitter has no handle on the pair");
        assertTrue(claimUrl.contains("/preuzmi-par/"), "claim URL does not point at the claim route: " + claimUrl);

        // The number is stored normalised (digits, optional leading +).
        assertEquals("0911234567", storedPhone(res.jsonPath().getInt("id")));
    }

    /* ---------- 4. THE EXPOSURE RULE ---------- */

    @Test
    void thePhoneIsInvisibleToThePublicListAndVisibleToTheOrganiser() {
        int pairId = register("TEST anon par", "091 234 5678", null).then().statusCode(201)
                .extract().jsonPath().getInt("id");

        // Anonymous read of the public pairs list: no phone, anywhere.
        String anonBody = given().when().get("/tournaments/" + tournamentUuid + "/pairs")
                .then().statusCode(200).extract().asString();
        assertTrue(!anonBody.contains("0912345678") && !anonBody.contains("091 234 5678"),
                "the pairs list leaked a contact phone to an anonymous caller: " + anonBody);
        assertNull(given().when().get("/tournaments/" + tournamentUuid + "/pairs")
                        .then().extract().jsonPath().getString("find { it.id == " + pairId + " }.contactPhone"),
                "contactPhone was serialised for an anonymous caller");

        // The organiser (creator of this tournament) sees it.
        me.uid = organiserUid;
        String forOrganiser = given().when().get("/tournaments/" + tournamentUuid + "/pairs")
                .then().statusCode(200).extract()
                .jsonPath().getString("find { it.id == " + pairId + " }.contactPhone");
        assertEquals("0912345678", forOrganiser, "the organiser cannot see the number they must call");
    }

    /* ---------- 5. duplicates ---------- */

    @Test
    void theSameNameAndPhoneTwiceIsRefused() {
        register("TEST anon par", "0911234567", null).then().statusCode(201);
        register("test ANON par", "091 123 4567", null)
                .then().statusCode(409).body(org.hamcrest.Matchers.containsString("ALREADY_REGISTERED"));
        assertEquals(1L, pairCount(), "the duplicate was written anyway");

        // A different number is a different pair, not a duplicate.
        register("TEST anon par", "0997654321", null).then().statusCode(201);
    }

    /* ---------- 6. the throttle ---------- */

    @Test
    void aSixthAnonymousRegistrationFromOneIpIsRefused() {
        // Unique per run: the counter is a static, process-wide cache.
        String ip = "203.0.113." + (int) (Math.random() * 200 + 1) + ", 10.0.0.1";
        for (int i = 1; i <= 5; i++) {
            register("TEST anon par " + i, "09112345" + (10 + i), ip).then().statusCode(201);
        }
        register("TEST anon par 6", "0911234599", ip)
                .then().statusCode(409).body(org.hamcrest.Matchers.containsString("RATE_LIMITED"));
        assertEquals(5L, pairCount(), "the throttled registration still wrote a row");
    }

    /* ---------- 7. the signed-in path is unchanged ---------- */

    @Test
    @TestSecurity(user = "test", roles = {})
    void aSignedInRegistrationStillStampsTheOwnerAndNeedsNoPhone() {
        me.uid = playerUid;

        Response res = register("TEST signed par", null, null);
        res.then().statusCode(201);
        assertEquals(playerUid, res.jsonPath().getString("submittedByUid"));
        assertTrue(res.jsonPath().getBoolean("pendingApproval"));
        assertNull(res.jsonPath().getString("claimUrl"), "a signed-in reply should not carry a claim URL");

        // Same user, same name → still the (uid, name) duplicate rule.
        register("TEST signed par", null, null)
                .then().statusCode(409).body(org.hamcrest.Matchers.containsString("ALREADY_REGISTERED"));
    }

    /* ---------- helpers ---------- */

    private Response register(String name, String phone, String forwardedFor) {
        var req = given().contentType(ContentType.JSON);
        if (forwardedFor != null) req = req.header("X-Forwarded-For", forwardedFor);
        Map<String, Object> body = phone == null
                ? Map.of("name", name)
                : Map.of("name", name, "contactPhone", phone);
        return req.body(body).when().post("/tournaments/" + tournamentUuid + "/pairs/self-register");
    }

    private long pairCount() {
        return ((Number) em.createNativeQuery("select count(*) from pairs where tournament_id = :id")
                .setParameter("id", tournamentId).getSingleResult()).longValue();
    }

    private String storedPhone(int pairId) {
        return QuarkusTransaction.requiringNew().call(() -> {
            Pairs p = em.find(Pairs.class, (long) pairId);
            return p == null ? null : p.getContactPhone();
        });
    }
}
