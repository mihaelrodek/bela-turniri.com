package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.model.GameName;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.PushSubscription;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * "Obriši račun" — {@code DELETE /user/me} (App Store guideline 5.1.1(v)).
 *
 * <p>What is worth pinning here:
 *
 * <ol>
 *   <li><b>It is ANONYMISATION, not erasure.</b> The per-table checklist in
 *       {@code AccountDeletionService} is the contract; {@link #deletingAnAccountAnonymisesEveryTable()}
 *       asserts every line of it, including the ones that must NOT change —
 *       the pair row, its submitter uid, and the tournament.</li>
 *   <li><b>The profile row and its slug SURVIVE.</b> Dropping them would put
 *       the slug back in the pool and hand every old link to the next person
 *       who happens to normalise to it.</li>
 *   <li><b>A second DELETE is 204, not 404</b> — the caller is asking "make
 *       sure this is gone", and it is.</li>
 *   <li><b>{@code POST /user/me/sync} answers 410 {@code ACCOUNT_DELETED}</b>
 *       instead of lazily re-creating the profile. Without this, deletion
 *       would mean "logged out until you sign in again".</li>
 *   <li><b>The public profile 404s</b>, and <b>the pairs list still renders</b>
 *       with the deleted-user label rather than a blank or a 500.</li>
 *   <li><b>Anonymous callers get 401.</b></li>
 * </ol>
 *
 * <p>The Firebase Auth half is NOT exercised: no service account is configured
 * in tests, so {@code AccountDeletionService} logs one WARN and returns — which
 * is the documented behaviour and is what the 204 below proves.
 *
 * <p>{@code @TestSecurity} gets past the {@code @Authenticated} gate and a
 * stand-in {@link CurrentUser} supplies the uid, the same {@code QuarkusMock}
 * pattern {@code PushDeviceControllerTest} uses. Runs against the
 * docker-compose Postgres, so every fixture is deleted again afterwards.
 */
@QuarkusTest
class AccountDeletionTest {

    /** Flip {@link #uid} to change (or remove) the caller. */
    public static class SwitchableUser extends CurrentUser {
        volatile String uid;

        @Override public String requireUid() { return uid; }
        @Override public Optional<String> uid() { return Optional.ofNullable(uid); }
        @Override public String uidOrNull() { return uid; }
        @Override public boolean isAnonymous() { return uid == null; }
        @Override public boolean isAdmin() { return false; }
        @Override public String displayName() { return "Test Player"; }
    }

    @Inject EntityManager em;

    private SwitchableUser me;
    private final String uid = "del-user-" + UUID.randomUUID();
    private final String organiserUid = "del-org-" + UUID.randomUUID();
    private final String slug = "del-slug-" + UUID.randomUUID();
    private final String endpoint = "https://fcm.googleapis.com/fcm/send/" + UUID.randomUUID();
    private final String fcmToken = "del-token-" + UUID.randomUUID();
    private final UUID blokUuid = UUID.randomUUID();

    private Long tournamentId;
    private String tournamentUuid;
    private Long pairId;

    @BeforeEach
    void setUp() {
        me = new SwitchableUser();
        me.uid = uid;
        QuarkusMock.installMockForType(me, CurrentUser.class);

        QuarkusTransaction.requiringNew().run(() -> {
            UserProfile p = new UserProfile();
            p.setUserUid(uid);
            p.setDisplayName("Marko Marković");
            p.setSlug(slug);
            p.setPhone("991234567");
            p.setPhoneCountry("+385");
            p.setAvatarPreset("kralj");
            p.setLocale("hr");
            p.setColorMode("dark");
            em.persist(p);

            PushSubscription sub = new PushSubscription();
            sub.setUserUid(uid);
            sub.setEndpoint(endpoint);
            sub.setP256dh("p256dh-test");
            sub.setAuth("auth-test");
            em.persist(sub);

            GameName gn = new GameName();
            gn.setGameUid(uid);
            gn.setName("Marko");
            gn.setChangedAt(OffsetDateTime.now());
            em.persist(gn);

            Tournaments t = new Tournaments();
            t.setName("Account deletion test " + UUID.randomUUID());
            t.setStatus(TournamentStatus.DRAFT);
            t.setCreatedByUid(organiserUid);
            t.setCreatedAt(OffsetDateTime.now());
            em.persist(t);
            em.flush();
            tournamentId = t.getId();
            tournamentUuid = t.getUuid().toString();

            Pairs pair = new Pairs();
            pair.setTournament(t);
            pair.setName("Marko i Ivan");
            pair.setSubmittedByUid(uid);
            pair.setContactPhone("+385991234567");
            em.persist(pair);
            em.flush();
            pairId = pair.getId();

            // Native, because blok_sessions.payload is jsonb and the column
            // needs an explicit cast; BlokSessionRepository writes it the same
            // way for the same reason.
            em.createNativeQuery("""
                            insert into blok_sessions
                                (id, uuid, session_id, user_uid, target, game_end_rule,
                                 games_us, games_them, games_count, payload)
                            values (nextval('seq_blok_sessions_id'), :uuid, :sid, :uid, 1001, 'ALL',
                                 0, 0, 0, cast('{}' as jsonb))
                            """)
                    .setParameter("uuid", blokUuid)
                    .setParameter("sid", "del-session")
                    .setParameter("uid", uid)
                    .executeUpdate();

            // A native FCM device, inserted natively for the same reason the
            // push-device test does: the table is tiny and the entity adds nothing.
            em.createNativeQuery("""
                            insert into push_devices (user_uid, platform, token)
                            values (:uid, 'ios', :token)
                            """)
                    .setParameter("uid", uid)
                    .setParameter("token", fcmToken)
                    .executeUpdate();
        });
    }

    @AfterEach
    void cleanUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            em.createNativeQuery("delete from pairs where tournament_id = :id")
                    .setParameter("id", tournamentId).executeUpdate();
            em.createNativeQuery("delete from tournaments where id = :id")
                    .setParameter("id", tournamentId).executeUpdate();
            em.createNativeQuery("delete from blok_sessions where user_uid = :uid")
                    .setParameter("uid", uid).executeUpdate();
            em.createNativeQuery("delete from push_devices where user_uid = :uid")
                    .setParameter("uid", uid).executeUpdate();
            em.createNativeQuery("delete from push_subscriptions where user_uid = :uid")
                    .setParameter("uid", uid).executeUpdate();
            em.createNativeQuery("delete from game_names where game_uid = :uid")
                    .setParameter("uid", uid).executeUpdate();
            em.createNativeQuery("delete from user_blocks where blocker_uid = :uid or blocked_uid = :uid")
                    .setParameter("uid", uid).executeUpdate();
            em.createNativeQuery("delete from user_profiles where user_uid in (:uids)")
                    .setParameter("uids", List.of(uid, organiserUid)).executeUpdate();
        });
    }

    /* ---------- 1. the migration ---------- */

    @Test
    void changesetAddedTheDeletedAtColumn() {
        assertEquals(1L, scalar("""
                select count(*) from information_schema.columns
                where table_name = 'user_profiles' and column_name = 'deleted_at'
                """), "deleted_at missing — changeset 2026-09-13-account-deletion did not apply");
    }

    /* ---------- 2. the whole checklist ---------- */

    @Test
    @TestSecurity(user = "deleter")
    void deletingAnAccountAnonymisesEveryTable() {
        given().when().delete("/user/me").then().statusCode(204);

        // --- kept, and emptied ---
        assertEquals(1L, scalar("select count(*) from user_profiles where user_uid = '" + uid + "'"),
                "the profile row must SURVIVE — dropping it would re-issue the slug");
        assertNotNull(one("select deleted_at from user_profiles where user_uid = '" + uid + "'"),
                "deleted_at not stamped");
        assertNull(one("select display_name from user_profiles where user_uid = '" + uid + "'"));
        assertNull(one("select phone from user_profiles where user_uid = '" + uid + "'"));
        assertNull(one("select phone_country from user_profiles where user_uid = '" + uid + "'"));
        assertNull(one("select avatar_preset from user_profiles where user_uid = '" + uid + "'"));
        assertNull(one("select locale from user_profiles where user_uid = '" + uid + "'"));
        assertNull(one("select color_mode from user_profiles where user_uid = '" + uid + "'"));
        assertEquals(slug, one("select slug from user_profiles where user_uid = '" + uid + "'"),
                "the slug must be kept so old links 404 instead of pointing at someone new");

        // --- gone ---
        assertEquals(0L, scalar("select count(*) from push_subscriptions where user_uid = '" + uid + "'"));
        assertEquals(0L, scalar("select count(*) from push_devices where user_uid = '" + uid + "'"));
        assertEquals(0L, scalar("select count(*) from blok_sessions where user_uid = '" + uid + "'"));
        assertEquals(0L, scalar("select count(*) from game_names where game_uid = '" + uid + "'"));

        // --- other people's history, untouched ---
        assertEquals(1L, scalar("select count(*) from pairs where id = " + pairId),
                "the pair must stay — other people played against it");
        assertNull(one("select contact_phone from pairs where id = " + pairId),
                "the pair's phone is the one PII field on a row we keep");
        assertEquals(uid, one("select submitted_by_uid from pairs where id = " + pairId),
                "the opaque uid stays so the 'Prijavio' enrichment still finds a row");
        assertEquals(1L, scalar("select count(*) from tournaments where id = " + tournamentId));
    }

    /* ---------- 3. idempotency ---------- */

    @Test
    @TestSecurity(user = "deleter")
    void aSecondDeleteIsStillTwoOhFour() {
        given().when().delete("/user/me").then().statusCode(204);
        given().when().delete("/user/me").then().statusCode(204);
        assertEquals(1L, scalar("select count(*) from user_profiles where user_uid = '" + uid + "'"));
    }

    /* ---------- 4. sync must not resurrect the account ---------- */

    @Test
    @TestSecurity(user = "deleter")
    void syncAfterDeletionIsGone() {
        given().when().delete("/user/me").then().statusCode(204);

        given().contentType(ContentType.JSON)
                .body("{\"displayName\":\"Marko Marković\"}")
                .when().post("/user/me/sync")
                .then().statusCode(410).body(containsString("ACCOUNT_DELETED"));

        assertNull(one("select display_name from user_profiles where user_uid = '" + uid + "'"),
                "sync re-filled a deleted profile");
    }

    /* ---------- 5. the public profile is gone ---------- */

    @Test
    @TestSecurity(user = "deleter")
    void publicProfileOfADeletedAccountIsNotFound() {
        given().when().get("/public/users/" + slug).then().statusCode(200);
        given().when().delete("/user/me").then().statusCode(204);
        given().when().get("/public/users/" + slug).then().statusCode(404);
    }

    /* ---------- 6. lists still render, with the label ---------- */

    @Test
    @TestSecurity(user = "deleter")
    void pairsListRendersTheDeletedUserLabel() {
        given().when().delete("/user/me").then().statusCode(204);

        given().when().get("/tournaments/" + tournamentUuid + "/pairs")
                .then().statusCode(200)
                // Croatian is the default locale, so this is the hr bundle's
                // profile.deletedUser. The point is that the row renders at all.
                .body(containsString("Obrisani korisnik"))
                .body(containsString("Marko i Ivan"));
    }

    /* ---------- 7. anonymous ---------- */

    @Test
    void anonymousCannotDeleteAnAccount() {
        given().when().delete("/user/me").then().statusCode(401);
        assertNull(one("select deleted_at from user_profiles where user_uid = '" + uid + "'"));
    }

    /* ---------- helpers ---------- */

    private long scalar(String sql) {
        return ((Number) em.createNativeQuery(sql).getSingleResult()).longValue();
    }

    /** First column of the single row, or null. */
    private Object one(String sql) {
        var rows = em.createNativeQuery(sql).getResultList();
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * Presets are the one table the original checklist skipped. Ownership
     * decides: sole-owned goes, co-owned is handed over, and a co-ownership
     * of somebody else's preset is simply dropped.
     */
    @Test
    @TestSecurity(user = "test", roles = {})
    void pairPresetsFollowOwnership() {
        final String partner = "del-partner-" + UUID.randomUUID();
        final UUID solo = UUID.randomUUID();
        final UUID shared = UUID.randomUUID();
        final UUID theirs = UUID.randomUUID();
        QuarkusTransaction.requiringNew().run(() -> {
            // `id` comes from the entity's Hibernate sequence, not a column
            // default, so a raw insert has to draw it explicitly.
            em.createNativeQuery("insert into user_pair_presets (id, uuid, user_uid, name, hidden, archived, co_owner_uid, claim_token)"
                            + " values (nextval('seq_user_pair_presets_id'), :u1, :me, 'Marko & Pero', false, false, null, :tok),"
                            + " (nextval('seq_user_pair_presets_id'), :u2, :me, 'Marko & Ana', false, false, :partner, null),"
                            + " (nextval('seq_user_pair_presets_id'), :u3, :partner, 'Ana & Marko', false, false, :me, null)")
                    .setParameter("u1", solo).setParameter("u2", shared).setParameter("u3", theirs)
                    .setParameter("me", uid).setParameter("partner", partner)
                    .setParameter("tok", "claim-" + UUID.randomUUID())
                    .executeUpdate();
            em.createNativeQuery("update user_pair_presets set archive_request_by_uid = :me where uuid = :u3")
                    .setParameter("me", uid).setParameter("u3", theirs).executeUpdate();
        });
        try {
            given().when().delete("/user/me").then().statusCode(204);

            assertEquals(0L, scalar("select count(*) from user_pair_presets where uuid = '" + solo + "'"),
                    "a preset owned by the deleter alone is deleted");
            assertEquals(partner, one("select user_uid from user_pair_presets where uuid = '" + shared + "'"),
                    "a co-owned preset is handed to the co-owner");
            assertNull(one("select co_owner_uid from user_pair_presets where uuid = '" + shared + "'"));
            assertEquals(partner, one("select user_uid from user_pair_presets where uuid = '" + theirs + "'"),
                    "somebody else's preset stays theirs");
            assertNull(one("select co_owner_uid from user_pair_presets where uuid = '" + theirs + "'"),
                    "the deleter's co-ownership link is dropped");
            assertNull(one("select archive_request_by_uid from user_pair_presets where uuid = '" + theirs + "'"));
            assertEquals(0L, scalar("select count(*) from user_pair_presets where user_uid = '" + uid + "' or co_owner_uid = '" + uid + "'"),
                    "no preset references the deleted uid any more");
        } finally {
            QuarkusTransaction.requiringNew().run(() -> em.createNativeQuery(
                            "delete from user_pair_presets where uuid in (:a, :b, :c)")
                    .setParameter("a", solo).setParameter("b", shared).setParameter("c", theirs)
                    .executeUpdate());
        }
    }
}
