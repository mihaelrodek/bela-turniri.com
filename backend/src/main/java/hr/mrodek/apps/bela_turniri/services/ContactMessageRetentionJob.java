package hr.mrodek.apps.bela_turniri.services;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import org.jboss.logging.Logger;

import java.time.OffsetDateTime;

/**
 * Retention for the public contact form.
 *
 * <p>{@code contact_messages} stores an e-mail address and, behind Caddy, the
 * sender's IP. Both were kept forever, which is exactly the open-ended PII a
 * privacy policy cannot honestly describe. Two steps, nightly:
 *
 * <ul>
 *   <li><b>{@value #IP_RETENTION_DAYS} days</b> — {@code ip} is nulled. It
 *       exists for abuse triage, and triage that has not happened within a
 *       month is not going to happen. The message itself stays, so an
 *       unanswered enquiry is not lost.</li>
 *   <li><b>{@value #ROW_RETENTION_MONTHS} months</b> — the whole row is
 *       deleted. The reply happens by e-mail; the row is the durable copy
 *       until it has been answered, not an archive.</li>
 * </ul>
 *
 * <p><b>These two numbers are written verbatim into the privacy policy.</b>
 * Changing one here means changing it there in the same commit.
 *
 * <h2>Scheduling</h2>
 * {@code @Scheduled(cron = …)} at 04:00 server time, when nothing else is
 * happening. It is gated by the standard {@code quarkus.scheduler.enabled}
 * property rather than by a {@code skipExecutionIf} predicate: the idiomatic
 * Quarkus way to turn scheduling off wholesale is the build-time property, it
 * costs nothing at runtime, and it keeps the job from firing during
 * {@code @QuarkusTest} (the {@code %test} profile sets it false) without the
 * job itself having to know it is being tested. {@link #sweep()} is public and
 * plain, so the test calls the real thing rather than a stand-in.
 *
 * <p>Single-node assumption, like everything else in this deployment: two
 * instances would both run it, which is harmless here — both statements are
 * idempotent {@code where created_at < …} sweeps.
 */
@ApplicationScoped
public class ContactMessageRetentionJob {

    private static final Logger LOG = Logger.getLogger(ContactMessageRetentionJob.class);

    /** After this many days the sender's IP is dropped. Mirrored in the privacy policy. */
    public static final int IP_RETENTION_DAYS = 30;

    /** After this many months the whole row goes. Mirrored in the privacy policy. */
    public static final int ROW_RETENTION_MONTHS = 12;

    @Inject EntityManager em;

    /** 04:00 every day. */
    @Scheduled(cron = "0 0 4 * * ?")
    void scheduledSweep() {
        sweep();
    }

    /**
     * Run both retention steps once.
     *
     * <p>Order matters slightly: anonymise first, then delete. The other way
     * round the delete would touch rows the update is about to rewrite for no
     * reason. Both are plain bulk statements — there is nothing to load, and
     * loading a year of messages into the persistence context to null one
     * column each would be the only slow way to do this.
     *
     * @return {@code [rows anonymised, rows deleted]}, for the log line and
     *         for the test to assert on
     */
    @Transactional
    public int[] sweep() {
        OffsetDateTime now = OffsetDateTime.now();

        int anonymised = em.createQuery("""
                        update ContactMessage m
                        set m.ip = null
                        where m.ip is not null and m.createdAt < :cutoff
                        """)
                .setParameter("cutoff", now.minusDays(IP_RETENTION_DAYS))
                .executeUpdate();

        int deleted = em.createQuery("""
                        delete from ContactMessage m
                        where m.createdAt < :cutoff
                        """)
                .setParameter("cutoff", now.minusMonths(ROW_RETENTION_MONTHS))
                .executeUpdate();

        if (anonymised > 0 || deleted > 0) {
            LOG.infof("Contact retention: %d IP(s) cleared (>%dd), %d message(s) deleted (>%dm).",
                    anonymised, IP_RETENTION_DAYS, deleted, ROW_RETENTION_MONTHS);
        }
        return new int[]{anonymised, deleted};
    }
}
