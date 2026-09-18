package hr.mrodek.apps.bela_turniri.services;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import hr.mrodek.apps.bela_turniri.dtos.CreateReportRequest;
import hr.mrodek.apps.bela_turniri.dtos.ReportDto;
import hr.mrodek.apps.bela_turniri.dtos.ResolveReportRequest;
import hr.mrodek.apps.bela_turniri.enums.ReportTargetType;
import hr.mrodek.apps.bela_turniri.errors.ApiCodes;
import hr.mrodek.apps.bela_turniri.model.ContentReport;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import hr.mrodek.apps.bela_turniri.repository.ContentReportRepository;
import hr.mrodek.apps.bela_turniri.repository.PairsRepository;
import hr.mrodek.apps.bela_turniri.repository.TournamentsRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.NotFoundException;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * "Prijavi sadržaj" — filing a report and triaging it. App Store guideline
 * 1.2 requires both halves: a way for a user to flag content, and a way for
 * the operator to act on the flag.
 *
 * <h2>The target is validated, then frozen</h2>
 * The pointer ({@code targetType} + {@code targetId}) is resolved to a real
 * row before the insert — an unknown target is a 404, so a client cannot fill
 * the queue with reports about nothing. After that the pointer is NOT a
 * foreign key: the reported tournament or pair may be deleted while the report
 * is still open, and the report has to outlive it. That is why
 * {@link #labelFor} is best-effort and {@link ReportDto#targetLabel()} is
 * allowed to be null.
 *
 * <h2>Rate limit</h2>
 * Ten per uid per hour, refused with 429 and the bare wire code
 * {@code RATE_LIMITED}. Two counters, deliberately:
 * <ul>
 *   <li>an in-memory Caffeine window, the same shape
 *       {@link SelfRegistrationService} uses for anonymous registrations —
 *       cheap, per-node, and enough for the honest-mistake case;</li>
 *   <li>a row count over the last hour, because the first one dies with the
 *       process and a restart must not hand a spammer a fresh budget.</li>
 * </ul>
 */
@ApplicationScoped
public class ContentReportService {

    /** Reports one signed-in user may file per {@link #WINDOW}. */
    public static final int MAX_PER_WINDOW = 10;
    public static final Duration WINDOW = Duration.ofHours(1);

    /**
     * {@code static} so it survives however the bean is scoped, and bounded so
     * a flood of distinct uids cannot turn the guard into a memory leak —
     * exactly the reasoning in {@code SelfRegistrationService.ANON_SUBMITS}.
     */
    private static final Cache<String, Integer> RECENT_REPORTS = Caffeine.newBuilder()
            .expireAfterWrite(WINDOW)
            .maximumSize(10_000)
            .build();

    @Inject ContentReportRepository reportRepo;
    @Inject TournamentsRepository tournamentRepo;
    @Inject PairsRepository pairRepo;
    @Inject UserProfileRepository profileRepo;
    @Inject DisplayNames displayNames;
    @Inject MessageService messages;

    /* ===================== filing ===================== */

    /**
     * File one report.
     *
     * @return the persisted row, whose id the controller returns as
     *         {@code {"id": n}} with 201
     * @throws jakarta.ws.rs.WebApplicationException 404 unknown target,
     *         400 {@code CANNOT_REPORT_SELF}, 429 {@code RATE_LIMITED}
     */
    public ContentReport create(String reporterUid, CreateReportRequest body) {
        String targetId = body.targetId().trim();

        // Resolve first: a 404 for a target that does not exist must not cost
        // the reporter a slot in their hourly budget.
        Object target = resolveTarget(body.targetType(), targetId);
        if (target == null) {
            throw new NotFoundException(messages.t("report.target.notFound"));
        }
        if (isOwnedBy(body.targetType(), target, reporterUid)) {
            // Not a moral position — reporting your own tournament is simply
            // never a moderation signal, and it is the cheapest way to fill
            // the queue with noise.
            throw ApiCodes.badRequest("CANNOT_REPORT_SELF");
        }
        if (throttled(reporterUid)) {
            throw ApiCodes.tooManyRequests("RATE_LIMITED");
        }

        var report = new ContentReport();
        report.setReporterUid(reporterUid);
        report.setTargetType(body.targetType());
        // Store the canonical id, not whatever the client typed: a tournament
        // may be addressed by slug, and a report that points at a slug breaks
        // the day the slug changes.
        report.setTargetId(canonicalId(body.targetType(), target, targetId));
        report.setReason(body.reason());
        report.setMessage(blank(body.message()));
        report.setCreatedAt(OffsetDateTime.now());
        return reportRepo.save(report);
    }

    /** True when this uid has already used its hourly budget. */
    private boolean throttled(String uid) {
        Integer seen = RECENT_REPORTS.getIfPresent(uid);
        if (seen != null && seen >= MAX_PER_WINDOW) return true;
        if (seen == null) {
            // Cold cache (fresh process, or the window just expired): fall
            // back to the durable count so a restart is not a free reset.
            long persisted = reportRepo.countByReporterSince(uid, OffsetDateTime.now().minus(WINDOW));
            if (persisted >= MAX_PER_WINDOW) return true;
            RECENT_REPORTS.put(uid, (int) persisted + 1);
            return false;
        }
        // Re-put rather than mutate: the write is what re-arms Caffeine's
        // expireAfterWrite clock, which is what makes the window slide.
        RECENT_REPORTS.put(uid, seen + 1);
        return false;
    }

    /* ===================== triage ===================== */

    /** @param status {@code "resolved"} for the closed queue, anything else for the open one. */
    public List<ReportDto> list(String status) {
        var rows = "resolved".equalsIgnoreCase(status) ? reportRepo.findResolved() : reportRepo.findOpen();
        return rows.stream().map(this::toDto).toList();
    }

    public long count(String status) {
        return "resolved".equalsIgnoreCase(status) ? reportRepo.countResolved() : reportRepo.countOpen();
    }

    /**
     * Close a report.
     *
     * <p>Re-resolving an already-resolved report overwrites the verdict and
     * the note rather than refusing: an admin correcting a mis-click is the
     * likelier case than a race, and the row is a record for the operator, not
     * an audit log.
     */
    public ReportDto resolve(Long id, ResolveReportRequest body) {
        ContentReport row = reportRepo.findByIdOptional(id)
                .orElseThrow(() -> new NotFoundException(messages.t("report.notFound")));
        row.setResolution(body.resolution());
        row.setAdminNote(blank(body.note()));
        row.setResolvedAt(OffsetDateTime.now());
        reportRepo.save(row);
        return toDto(row);
    }

    /* ===================== helpers ===================== */

    private ReportDto toDto(ContentReport r) {
        return new ReportDto(
                r.getId(),
                r.getTargetType() == null ? null : r.getTargetType().name(),
                r.getTargetId(),
                labelFor(r),
                r.getReporterUid(),
                r.getReason() == null ? null : r.getReason().name(),
                r.getMessage(),
                r.getCreatedAt(),
                r.getResolvedAt(),
                r.getResolution() == null ? null : r.getResolution().name(),
                r.getAdminNote());
    }

    /**
     * Human-readable name of what was reported, or null when the row is gone.
     *
     * <p>Resolved per report rather than bulk-loaded: the inbox is capped at
     * {@link ContentReportRepository#LIST_LIMIT} rows and is opened by one
     * admin now and then, so the N+1 here costs less than three
     * type-partitioned bulk queries would cost to maintain.
     */
    private String labelFor(ContentReport r) {
        Object target = resolveTarget(r.getTargetType(), r.getTargetId());
        if (target == null) return null;
        return switch (r.getTargetType()) {
            case TOURNAMENT -> ((Tournaments) target).getName();
            case PAIR -> ((Pairs) target).getName();
            // Deleted accounts render as "Obrisani korisnik", never as a blank.
            case PROFILE -> displayNames.nameOf((UserProfile) target);
        };
    }

    /** The entity the pointer names, or null when nothing matches. */
    private Object resolveTarget(ReportTargetType type, String targetId) {
        if (type == null || targetId == null || targetId.isBlank()) return null;
        return switch (type) {
            case TOURNAMENT -> tournamentRepo.findByUuidOrSlug(targetId).orElse(null);
            case PAIR -> parseLong(targetId) == null
                    ? null
                    : pairRepo.findByIdOptional(parseLong(targetId)).orElse(null);
            case PROFILE -> profileRepo.findByUid(targetId).orElse(null);
        };
    }

    /** The id the row should store, regardless of how the client addressed it. */
    private static String canonicalId(ReportTargetType type, Object target, String given) {
        return switch (type) {
            case TOURNAMENT -> {
                var uuid = ((Tournaments) target).getUuid();
                yield uuid != null ? uuid.toString() : given;
            }
            case PAIR -> String.valueOf(((Pairs) target).getId());
            case PROFILE -> ((UserProfile) target).getUserUid();
        };
    }

    /** True when the reporter is reporting their own content. */
    private static boolean isOwnedBy(ReportTargetType type, Object target, String uid) {
        return switch (type) {
            case TOURNAMENT -> uid.equals(((Tournaments) target).getCreatedByUid());
            case PAIR -> {
                Pairs p = (Pairs) target;
                yield uid.equals(p.getSubmittedByUid()) || uid.equals(p.getCoSubmittedByUid());
            }
            case PROFILE -> uid.equals(((UserProfile) target).getUserUid());
        };
    }

    private static Long parseLong(String s) {
        try {
            return Long.valueOf(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String blank(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    /** Test seam: the in-memory window is static and otherwise outlives a test. */
    public static void resetRateLimitForTests() {
        RECENT_REPORTS.invalidateAll();
    }
}
