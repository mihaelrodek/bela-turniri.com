package hr.mrodek.apps.bela_turniri.dtos;

import java.time.OffsetDateTime;

/**
 * One row of the admin moderation inbox.
 *
 * <p>{@code targetLabel} is resolved BEST-EFFORT at read time — the tournament
 * name, the pair name, or the reported user's display name (or the
 * {@code profile.deletedUser} label). It is null when the reported row has
 * since been deleted, which is a real and expected state: the report outlives
 * its target on purpose, so the admin can still see what was reported and
 * when. The raw {@code targetType} / {@code targetId} are always there.
 */
public record ReportDto(
        Long id,
        String targetType,
        String targetId,
        String targetLabel,
        String reporterUid,
        String reason,
        String message,
        OffsetDateTime createdAt,
        OffsetDateTime resolvedAt,
        String resolution,
        String adminNote
) {
}
