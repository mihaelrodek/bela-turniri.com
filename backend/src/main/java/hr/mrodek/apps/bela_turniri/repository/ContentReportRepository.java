package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.ContentReport;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * The moderation inbox. Both list queries sort newest-first and ride the
 * {@code (resolved_at, created_at)} index from
 * {@code db/changelog/content_reports.xml}.
 */
@ApplicationScoped
public class ContentReportRepository implements AppRepository<ContentReport, Long> {

    /**
     * Cap on one inbox page. A moderation queue that has grown past this is a
     * staffing problem, not a pagination problem — but an unbounded
     * {@code listAll()} would still happily serialise every report ever filed.
     */
    public static final int LIST_LIMIT = 200;

    /** Open reports (never resolved), newest first. */
    public List<ContentReport> findOpen() {
        return find("resolvedAt is null", Sort.by("createdAt").descending())
                .page(0, LIST_LIMIT)
                .list();
    }

    /** Reports an admin has already closed, newest first. */
    public List<ContentReport> findResolved() {
        return find("resolvedAt is not null", Sort.by("createdAt").descending())
                .page(0, LIST_LIMIT)
                .list();
    }

    public long countOpen() {
        return count("resolvedAt is null");
    }

    public long countResolved() {
        return count("resolvedAt is not null");
    }

    /**
     * How many reports this uid has filed since {@code since} — the rate
     * limit's second, durable line of defence.
     *
     * <p>The in-memory Caffeine counter in {@code ContentReportService} is the
     * fast path and matches the pattern {@code SelfRegistrationService} uses,
     * but it is per-node and dies with the process. Counting rows as well
     * means a restart does not hand a spammer a fresh budget.
     */
    public long countByReporterSince(String reporterUid, OffsetDateTime since) {
        if (reporterUid == null || reporterUid.isBlank()) return 0;
        return count("reporterUid = ?1 and createdAt >= ?2", reporterUid, since);
    }
}
