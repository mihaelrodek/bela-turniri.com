package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import hr.mrodek.apps.bela_turniri.services.ContentReportService;
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
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * User-content reports and blocks — App Store guideline 1.2.
 *
 * <p>What is worth pinning here:
 *
 * <ol>
 *   <li><b>A report needs a real target.</b> An unknown one is a 404, before
 *       the rate limit is charged, so a client cannot fill the queue with
 *       reports about nothing.</li>
 *   <li><b>You cannot report your own content</b> — never a moderation signal,
 *       and the cheapest way to bury the inbox.</li>
 *   <li><b>Ten per uid per hour</b>, then 429 {@code RATE_LIMITED}.</li>
 *   <li><b>The admin surface is admin-only</b> (403 otherwise) and resolve
 *       actually closes the row.</li>
 *   <li><b>A block hides the profile in BOTH directions</b> as a 404 —
 *       indistinguishable from a missing slug, so it never confirms the other
 *       account exists.</li>
 *   <li><b>A block filters the tournament listing for the blocker</b> and
 *       <b>changes nothing for an anonymous caller</b> — which is the property
 *       that keeps {@code PublicReadCacheFilter} safe.</li>
 *   <li><b>A blocked user's PAIRS are still listed.</b> Deliberate: the
 *       organiser needs the full roster and the other players need the draw.</li>
 * </ol>
 */
@QuarkusTest
class ContentReportAndBlockTest {

    /** Flip {@link #uid} to change (or remove) the caller. */
    public static class SwitchableUser extends CurrentUser {
        volatile String uid;
        volatile boolean admin = false;

        @Override public String requireUid() { return uid; }
        @Override public Optional<String> uid() { return Optional.ofNullable(uid); }
        @Override public String uidOrNull() { return uid; }
        @Override public boolean isAnonymous() { return uid == null; }
        @Override public boolean isAdmin() { return admin; }
        @Override public String displayName() { return "Test"; }
    }

    @Inject EntityManager em;

    private SwitchableUser me;

    private final String reporterUid = "rep-reporter-" + UUID.randomUUID();
    private final String ownerUid = "rep-owner-" + UUID.randomUUID();
    private final String ownerSlug = "rep-owner-slug-" + UUID.randomUUID();
    private final String reporterSlug = "rep-reporter-slug-" + UUID.randomUUID();

    /** Created by {@link #ownerUid} — the thing that gets reported and blocked. */
    private Long theirTournamentId;
    private String theirTournamentUuid;
    private String theirTournamentName;
    private Long theirPairId;

    /** Created by {@link #reporterUid} — the self-report case. */
    private Long myTournamentId;
    private String myTournamentUuid;

    @BeforeEach
    void setUp() {
        me = new SwitchableUser();
        me.uid = reporterUid;
        QuarkusMock.installMockForType(me, CurrentUser.class);
        // The hourly window is static and would otherwise leak between tests.
        ContentReportService.resetRateLimitForTests();

        theirTournamentName = "Report test THEIRS " + UUID.randomUUID();

        QuarkusTransaction.requiringNew().run(() -> {
            em.persist(profile(reporterUid, "Reporter", reporterSlug));
            em.persist(profile(ownerUid, "Owner", ownerSlug));

            Tournaments theirs = new Tournaments();
            theirs.setName(theirTournamentName);
            theirs.setStatus(TournamentStatus.DRAFT);
            theirs.setCreatedByUid(ownerUid);
            theirs.setCreatedAt(OffsetDateTime.now());
            em.persist(theirs);

            Tournaments mine = new Tournaments();
            mine.setName("Report test MINE " + UUID.randomUUID());
            mine.setStatus(TournamentStatus.DRAFT);
            mine.setCreatedByUid(reporterUid);
            mine.setCreatedAt(OffsetDateTime.now());
            em.persist(mine);
            em.flush();

            theirTournamentId = theirs.getId();
            theirTournamentUuid = theirs.getUuid().toString();
            myTournamentId = mine.getId();
            myTournamentUuid = mine.getUuid().toString();

            Pairs pair = new Pairs();
            pair.setTournament(theirs);
            pair.setName("Blokirani par");
            pair.setSubmittedByUid(ownerUid);
            em.persist(pair);
            em.flush();
            theirPairId = pair.getId();
        });
    }

    @AfterEach
    void cleanUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            em.createNativeQuery("delete from content_reports where reporter_uid in (:uids)")
                    .setParameter("uids", List.of(reporterUid, ownerUid)).executeUpdate();
            em.createNativeQuery("delete from user_blocks where blocker_uid in (:uids) or blocked_uid in (:uids)")
                    .setParameter("uids", List.of(reporterUid, ownerUid)).executeUpdate();
            em.createNativeQuery("delete from pairs where tournament_id in (:ids)")
                    .setParameter("ids", List.of(theirTournamentId, myTournamentId)).executeUpdate();
            em.createNativeQuery("delete from tournaments where id in (:ids)")
                    .setParameter("ids", List.of(theirTournamentId, myTournamentId)).executeUpdate();
            em.createNativeQuery("delete from user_profiles where user_uid in (:uids)")
                    .setParameter("uids", List.of(reporterUid, ownerUid)).executeUpdate();
        });
    }

    /* ---------- 1. the migrations ---------- */

    @Test
    void changesetsCreatedBothTablesAndTheirIndexes() {
        assertEquals(1L, scalar("""
                select count(*) from information_schema.tables where table_name = 'content_reports'
                """), "content_reports missing — changeset 2026-09-13-content-reports did not apply");
        assertEquals(1L, scalar("""
                select count(*) from information_schema.tables where table_name = 'user_blocks'
                """), "user_blocks missing — changeset 2026-09-13-user-blocks did not apply");
        assertEquals(1L, scalar("""
                select count(*) from pg_indexes where indexname = 'idx_content_reports_status_created'
                """), "the admin inbox's only index is missing");
        assertEquals(1L, scalar("""
                select count(*) from pg_indexes
                where indexname = 'pk_user_blocks' and indexdef like '%UNIQUE%'
                """), "the (blocker, blocked) primary key is what makes re-blocking a no-op");
    }

    /* ---------- 2. filing a report ---------- */

    @Test
    @TestSecurity(user = "reporter")
    void reportingSomebodyElsesTournamentIsCreated() {
        given().contentType(ContentType.JSON)
                .body(reportBody("TOURNAMENT", theirTournamentUuid, "SPAM", "reklama"))
                .when().post("/reports")
                .then().statusCode(201).body("id", notNullValue());

        assertEquals(1L, scalar("select count(*) from content_reports where reporter_uid = '"
                + reporterUid + "' and target_id = '" + theirTournamentUuid + "'"));
        assertEquals(1L, scalar("select count(*) from content_reports where reporter_uid = '"
                + reporterUid + "' and resolved_at is null"), "a fresh report must be open");
    }

    @Test
    @TestSecurity(user = "reporter")
    void reportingAPairAndAProfileAlsoWorks() {
        given().contentType(ContentType.JSON)
                .body(reportBody("PAIR", String.valueOf(theirPairId), "OFFENSIVE", null))
                .when().post("/reports").then().statusCode(201);
        given().contentType(ContentType.JSON)
                .body(reportBody("PROFILE", ownerUid, "PERSONAL_DATA", null))
                .when().post("/reports").then().statusCode(201);
        assertEquals(2L, scalar("select count(*) from content_reports where reporter_uid = '" + reporterUid + "'"));
    }

    @Test
    @TestSecurity(user = "reporter")
    void reportingSomethingThatDoesNotExistIsNotFound() {
        given().contentType(ContentType.JSON)
                .body(reportBody("TOURNAMENT", UUID.randomUUID().toString(), "SPAM", null))
                .when().post("/reports")
                .then().statusCode(404);
        assertEquals(0L, scalar("select count(*) from content_reports where reporter_uid = '" + reporterUid + "'"),
                "a refused report still wrote a row");
    }

    @Test
    @TestSecurity(user = "reporter")
    void reportingYourOwnContentIsRefused() {
        given().contentType(ContentType.JSON)
                .body(reportBody("TOURNAMENT", myTournamentUuid, "SPAM", null))
                .when().post("/reports")
                .then().statusCode(400).body(containsString("CANNOT_REPORT_SELF"));
    }

    @Test
    @TestSecurity(user = "reporter")
    void theEleventhReportInAnHourIsRateLimited() {
        for (int i = 0; i < ContentReportService.MAX_PER_WINDOW; i++) {
            given().contentType(ContentType.JSON)
                    .body(reportBody("TOURNAMENT", theirTournamentUuid, "SPAM", "br " + i))
                    .when().post("/reports")
                    .then().statusCode(201);
        }
        given().contentType(ContentType.JSON)
                .body(reportBody("TOURNAMENT", theirTournamentUuid, "SPAM", "jedanaesti"))
                .when().post("/reports")
                .then().statusCode(429).body(containsString("RATE_LIMITED"));

        assertEquals(ContentReportService.MAX_PER_WINDOW,
                (int) scalar("select count(*) from content_reports where reporter_uid = '" + reporterUid + "'"));
    }

    @Test
    void anonymousCannotReport() {
        given().contentType(ContentType.JSON)
                .body(reportBody("TOURNAMENT", theirTournamentUuid, "SPAM", null))
                .when().post("/reports")
                .then().statusCode(401);
    }

    /* ---------- 3. the admin surface ---------- */

    @Test
    @TestSecurity(user = "admin", roles = {"admin"})
    void adminCanListCountAndResolve() {
        Long id = fileOneReportDirectly();

        given().when().get("/admin/reports?status=open")
                .then().statusCode(200)
                .body("find { it.id == " + id + " }.targetLabel", equalTo(theirTournamentName));

        long openBefore = countFrom("/admin/reports/count?status=open");
        assertTrue(openBefore >= 1, "the open badge must see the report");

        given().contentType(ContentType.JSON)
                .body("{\"resolution\":\"ACTIONED\",\"note\":\"turnir obrisan\"}")
                .when().post("/admin/reports/" + id + "/resolve")
                .then().statusCode(200)
                .body("resolution", equalTo("ACTIONED"))
                .body("resolvedAt", notNullValue())
                .body("adminNote", equalTo("turnir obrisan"));

        given().when().get("/admin/reports?status=open")
                .then().statusCode(200)
                .body("id", not(org.hamcrest.Matchers.hasItem(id.intValue())));
        assertEquals(openBefore - 1, countFrom("/admin/reports/count?status=open"));
    }

    @Test
    @TestSecurity(user = "reporter")
    void aPlainUserCannotReachTheAdminSurface() {
        given().when().get("/admin/reports").then().statusCode(403);
        given().when().get("/admin/reports/count").then().statusCode(403);
        given().contentType(ContentType.JSON).body("{\"resolution\":\"DISMISSED\"}")
                .when().post("/admin/reports/1/resolve").then().statusCode(403);
    }

    /* ---------- 4. blocks ---------- */

    @Test
    @TestSecurity(user = "reporter")
    void blockUnblockAndList() {
        given().when().put("/user/me/blocks/" + ownerUid).then().statusCode(204);
        // Idempotent — the (blocker, blocked) pair is the primary key.
        given().when().put("/user/me/blocks/" + ownerUid).then().statusCode(204);
        assertEquals(1L, scalar("select count(*) from user_blocks where blocker_uid = '" + reporterUid + "'"));

        given().when().get("/user/me/blocks")
                .then().statusCode(200)
                .body("[0].uid", equalTo(ownerUid))
                .body("[0].displayName", equalTo("Owner"))
                .body("[0].slug", equalTo(ownerSlug));

        given().when().delete("/user/me/blocks/" + ownerUid).then().statusCode(204);
        given().when().delete("/user/me/blocks/" + ownerUid).then().statusCode(204);
        assertEquals(0L, scalar("select count(*) from user_blocks where blocker_uid = '" + reporterUid + "'"));
    }

    @Test
    @TestSecurity(user = "reporter")
    void blockingYourselfOrANobodyIsRefused() {
        given().when().put("/user/me/blocks/" + reporterUid)
                .then().statusCode(400).body(containsString("CANNOT_BLOCK_SELF"));
        given().when().put("/user/me/blocks/not-a-real-uid-" + UUID.randomUUID())
                .then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "reporter")
    void aBlockHidesTheProfileInBothDirections() {
        given().when().get("/public/users/" + ownerSlug).then().statusCode(200);

        blockDirectly(reporterUid, ownerUid);
        asUser(reporterUid);
        given().when().get("/public/users/" + ownerSlug).then().statusCode(404);

        // …and the other way round: the blocked party must not keep reading
        // the blocker's profile either.
        asUser(ownerUid);
        given().when().get("/public/users/" + reporterSlug).then().statusCode(404);
    }

    /* ---------- 5. listing effects ---------- */

    @Test
    @TestSecurity(user = "reporter")
    void aBlockFiltersTheTournamentListingForTheBlockerOnly() {
        // Baseline: the blocker can see it.
        given().when().get("/tournaments?status=upcoming")
                .then().statusCode(200).body(containsString(theirTournamentName));

        blockDirectly(reporterUid, ownerUid);
        asUser(reporterUid);

        given().when().get("/tournaments?status=upcoming")
                .then().statusCode(200).body(not(containsString(theirTournamentName)));

        // An ANONYMOUS caller is unaffected — which is what keeps the
        // public cache honest.
        asUser(null);
        given().when().get("/tournaments?status=upcoming")
                .then().statusCode(200).body(containsString(theirTournamentName));
    }

    @Test
    @TestSecurity(user = "reporter")
    void aBlockedUsersPairsAreStillListed() {
        blockDirectly(reporterUid, ownerUid);
        asUser(reporterUid);
        // Deliberate: hiding a pair from one viewer would leave them looking at
        // a round whose opponents do not exist.
        given().when().get("/tournaments/" + theirTournamentUuid + "/pairs")
                .then().statusCode(200).body(containsString("Blokirani par"));
    }

    /* ---------- helpers ---------- */

    private void asUser(String uid) {
        me.uid = uid;
    }

    private static UserProfile profile(String uid, String name, String slug) {
        UserProfile p = new UserProfile();
        p.setUserUid(uid);
        p.setDisplayName(name);
        p.setSlug(slug);
        return p;
    }

    private static String reportBody(String type, String id, String reason, String message) {
        return "{\"targetType\":\"" + type + "\",\"targetId\":\"" + id + "\",\"reason\":\"" + reason + "\""
                + (message == null ? "" : ",\"message\":\"" + message + "\"") + "}";
    }

    /** Insert a report straight into the table — the admin tests are not about filing. */
    private Long fileOneReportDirectly() {
        QuarkusTransaction.requiringNew().run(() -> em.createNativeQuery("""
                        insert into content_reports (reporter_uid, target_type, target_id, reason, message)
                        values (:uid, 'TOURNAMENT', :target, 'SPAM', 'test')
                        """)
                .setParameter("uid", reporterUid)
                .setParameter("target", theirTournamentUuid)
                .executeUpdate());
        return ((Number) em.createNativeQuery(
                        "select max(id) from content_reports where reporter_uid = '" + reporterUid + "'")
                .getSingleResult()).longValue();
    }

    private void blockDirectly(String blocker, String blocked) {
        QuarkusTransaction.requiringNew().run(() -> em.createNativeQuery("""
                        insert into user_blocks (blocker_uid, blocked_uid) values (:a, :b)
                        on conflict do nothing
                        """)
                .setParameter("a", blocker).setParameter("b", blocked).executeUpdate());
    }

    private long countFrom(String path) {
        return given().when().get(path).then().statusCode(200).extract().jsonPath().getLong("total");
    }

    private long scalar(String sql) {
        return ((Number) em.createNativeQuery(sql).getSingleResult()).longValue();
    }
}
