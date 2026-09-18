package hr.mrodek.apps.bela_turniri.services;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Contact-form retention — {@link ContactMessageRetentionJob}.
 *
 * <p>The two numbers this pins (IP dropped after 30 days, row deleted after 12
 * months) are written verbatim into the privacy policy, so the test is really
 * asserting that the code still matches the promise. Fixtures sit deliberately
 * on both sides of each boundary — 29 vs 31 days, 11 vs 13 months — so an
 * off-by-one in either direction fails here rather than in production.
 *
 * <p>The job's cron trigger is NOT exercised: {@code quarkus.scheduler.enabled}
 * is false in the {@code %test} profile (a nightly sweep firing mid-suite would
 * delete other tests' fixtures), so this calls {@link ContactMessageRetentionJob#sweep()}
 * directly — which is the behaviour worth pinning; the cron expression itself
 * is configuration.
 *
 * <p>Runs against the docker-compose Postgres and shares it with real local
 * data, so every fixture is tagged with a unique marker and removed again.
 */
@QuarkusTest
class ContactMessageRetentionJobTest {

    @Inject EntityManager em;
    @Inject ContactMessageRetentionJob job;

    /** Unique per run, so the assertions can never see somebody else's row. */
    private final String marker = "retention-" + UUID.randomUUID() + "@example.test";

    private Long fresh;
    private Long twentyNineDays;
    private Long thirtyOneDays;
    private Long elevenMonths;
    private Long thirteenMonths;

    @BeforeEach
    void seed() {
        QuarkusTransaction.requiringNew().run(() -> {
            fresh = insert(OffsetDateTime.now().minusDays(1));
            twentyNineDays = insert(OffsetDateTime.now().minusDays(29));
            thirtyOneDays = insert(OffsetDateTime.now().minusDays(31));
            elevenMonths = insert(OffsetDateTime.now().minusMonths(11));
            thirteenMonths = insert(OffsetDateTime.now().minusMonths(13));
        });
    }

    @AfterEach
    void cleanUp() {
        QuarkusTransaction.requiringNew().run(() -> em
                .createNativeQuery("delete from contact_messages where email = :m")
                .setParameter("m", marker)
                .executeUpdate());
    }

    @Test
    void changesetAddedTheCreatedAtIndex() {
        assertEquals(1L, scalar("""
                select count(*) from pg_indexes where indexname = 'idx_contact_messages_created_at'
                """), "index missing — changeset 2026-09-13-contact-message-retention did not apply");
    }

    @Test
    void theIpIsDroppedAtThirtyDaysAndTheRowAtTwelveMonths() {
        int[] result = job.sweep();

        // --- the 30-day boundary ---
        assertNotNull(ip(fresh), "a day-old submission must keep its IP");
        assertNotNull(ip(twentyNineDays), "29 days is inside the 30-day window");
        assertNull(ip(thirtyOneDays), "31 days is past the 30-day window — the IP must be gone");
        assertEquals(1L, exists(thirtyOneDays),
                "clearing the IP must not delete the message itself");

        // --- the 12-month boundary ---
        assertNull(ip(elevenMonths), "11 months is well past 30 days");
        assertEquals(1L, exists(elevenMonths), "11 months is inside the 12-month window");
        assertEquals(0L, exists(thirteenMonths), "13 months is past the 12-month window");

        // Three rows had an IP older than 30 days (31d, 11m, 13m); one row was
        // older than 12 months. Asserted as a range rather than exactly, since
        // a developer's local database may hold real messages too.
        assertEquals(true, result[0] >= 3, "expected at least the three stale IPs to be cleared");
        assertEquals(true, result[1] >= 1, "expected at least the 13-month row to be deleted");
    }

    @Test
    void aSecondSweepChangesNothing() {
        job.sweep();
        int[] second = job.sweep();
        // Everything this test seeded is already handled; a re-run must be a
        // no-op for it. (Other rows in a shared dev database are not this
        // test's business, hence the per-row assertions rather than a total.)
        assertNull(ip(thirtyOneDays));
        assertEquals(0L, exists(thirteenMonths));
        assertEquals(true, second[0] >= 0 && second[1] >= 0);
    }

    /* ---------- helpers ---------- */

    private Long insert(OffsetDateTime createdAt) {
        em.createNativeQuery("""
                        insert into contact_messages (created_at, name, email, message, ip, handled)
                        values (:created, 'Retention test', :email, 'test', '198.51.100.7', false)
                        """)
                .setParameter("created", createdAt)
                .setParameter("email", marker)
                .executeUpdate();
        return ((Number) em.createNativeQuery(
                        "select max(id) from contact_messages where email = :m")
                .setParameter("m", marker)
                .getSingleResult()).longValue();
    }

    private Object ip(Long id) {
        var rows = em.createNativeQuery("select ip from contact_messages where id = " + id).getResultList();
        return rows.isEmpty() ? null : rows.get(0);
    }

    private long exists(Long id) {
        return scalar("select count(*) from contact_messages where id = " + id);
    }

    private long scalar(String sql) {
        return ((Number) em.createNativeQuery(sql).getSingleResult()).longValue();
    }
}
