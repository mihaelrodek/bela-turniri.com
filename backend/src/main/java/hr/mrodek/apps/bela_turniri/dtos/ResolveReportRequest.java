package hr.mrodek.apps.bela_turniri.dtos;

import hr.mrodek.apps.bela_turniri.enums.ReportResolution;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Body of {@code POST /admin/reports/{id}/resolve}. */
public record ResolveReportRequest(
        @NotNull(message = "validation.report.resolution.required")
        ReportResolution resolution,

        /** What the admin actually did — free text, see {@link ReportResolution}. */
        @Size(max = 2000, message = "validation.report.note.max")
        String note
) {
}
