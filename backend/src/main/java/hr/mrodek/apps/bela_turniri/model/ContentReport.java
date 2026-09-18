package hr.mrodek.apps.bela_turniri.model;

import hr.mrodek.apps.bela_turniri.enums.ReportReason;
import hr.mrodek.apps.bela_turniri.enums.ReportResolution;
import hr.mrodek.apps.bela_turniri.enums.ReportTargetType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * One "prijavi sadržaj" submission — App Store guideline 1.2.
 *
 * <p>The target is a polymorphic pointer ({@link #targetType} +
 * {@link #targetId}) rather than three foreign keys; see
 * {@code db/changelog/content_reports.xml} for why. The consequence worth
 * remembering at the read site: the pointed-at row may be GONE by the time an
 * admin opens the inbox, so the label is resolved best-effort and the report
 * still renders without it.
 *
 * <p>Enums are {@code EnumType.STRING}: the column values are the wire values
 * the SPA posts, and an ordinal would silently re-map every stored row the
 * first time somebody inserts a constant in the middle of the enum.
 */
@Entity
@Table(name = "content_reports")
@Getter @Setter @NoArgsConstructor
public class ContentReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Firebase uid of whoever pressed "prijavi". Never null — reporting requires an account. */
    @Column(name = "reporter_uid", length = 128, nullable = false)
    private String reporterUid;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", length = 16, nullable = false)
    private ReportTargetType targetType;

    /** Tournament uuid, pair id as a string, or profile uid — see {@link #targetType}. */
    @Column(name = "target_id", length = 64, nullable = false)
    private String targetId;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason", length = 32, nullable = false)
    private ReportReason reason;

    /** Optional free text from the reporter, capped at 1000 chars by the request DTO. */
    @Column(name = "message", columnDefinition = "text")
    private String message;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    /** Null while the report is open; this is the open/resolved switch. */
    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "resolution", length = 16)
    private ReportResolution resolution;

    /** What the admin actually did. Free text on purpose — see {@link ReportResolution}. */
    @Column(name = "admin_note", columnDefinition = "text")
    private String adminNote;
}
