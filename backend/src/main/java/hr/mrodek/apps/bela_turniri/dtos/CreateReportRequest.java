package hr.mrodek.apps.bela_turniri.dtos;

import hr.mrodek.apps.bela_turniri.enums.ReportReason;
import hr.mrodek.apps.bela_turniri.enums.ReportTargetType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /reports} — "prijavi sadržaj".
 *
 * <p>{@code targetType} and {@code reason} are enums, so an unknown value is
 * rejected by Jackson before any of this reaches the service; that is
 * deliberate, because both end up verbatim in a database column.
 *
 * <p>{@code message} is the only free text, capped at 1000 characters to match
 * the column's practical use — a report is a pointer for a human, not a
 * correspondence.
 *
 * <p>{@code message} keys, like every other validation message in this project,
 * are i18n bundle keys resolved by {@code ConstraintViolationExceptionMapper}.
 */
public record CreateReportRequest(
        @NotNull(message = "validation.report.targetType.required")
        ReportTargetType targetType,

        @NotBlank(message = "validation.report.targetId.required")
        @Size(max = 64, message = "validation.report.targetId.max")
        String targetId,

        @NotNull(message = "validation.report.reason.required")
        ReportReason reason,

        @Size(max = 1000, message = "validation.report.message.max")
        String message
) {
}
