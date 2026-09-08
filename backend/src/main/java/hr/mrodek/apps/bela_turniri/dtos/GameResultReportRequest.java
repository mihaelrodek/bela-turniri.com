package hr.mrodek.apps.bela_turniri.dtos;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * A finished online game, reported by the Node game server
 * (game/README.md §8.4). Server-to-server only — never posted by a browser.
 *
 * <p>Bean-validation here is SHAPE validation, not a re-run of the game
 * rules: the caller is trusted (shared-secret header, internal docker
 * network) and it is the authority on who played what and who won. What is
 * checked is only what would silently corrupt the statistics — an
 * out-of-range category, a team letter the database CHECK constraint would
 * reject at the very bottom of the stack, or a player list that is not the
 * four seats 0-3 exactly once (that last one lives in the controller, since
 * it is a cross-element rule).
 *
 * <p>Messages are plain English rather than i18n bundle keys: nothing here is
 * ever rendered to a user, it goes into the game server's error log.
 * {@code ConstraintViolationExceptionMapper} passes an unresolvable key
 * through verbatim, so they arrive as written.
 */
public record GameResultReportRequest(

        /** Idempotency key — a v4 UUID minted once per game and resent on retry. */
        @NotNull(message = "resultId is required")
        String resultId,

        @NotNull(message = "playedAt is required")
        OffsetDateTime playedAt,

        /** Category: 501, 701 or 1001 (§8.2). */
        @NotNull(message = "targetScore is required")
        Integer targetScore,

        @NotNull(message = "winnerTeam is required")
        @Pattern(regexp = "^[AB]$", message = "winnerTeam must be 'A' or 'B'")
        String winnerTeam,

        @NotNull(message = "scoreA is required")
        @Min(value = 0, message = "scoreA must not be negative")
        Integer scoreA,

        @NotNull(message = "scoreB is required")
        @Min(value = 0, message = "scoreB must not be negative")
        Integer scoreB,

        /** Informational; the reporter may omit it. */
        @Min(value = 0, message = "dealsCount must not be negative")
        @Max(value = 1000, message = "dealsCount is implausibly large")
        Integer dealsCount,

        @NotNull(message = "players is required")
        @Size(min = 4, max = 4, message = "players must contain exactly 4 seats")
        List<@Valid PlayerDto> players
) {

    /**
     * Category membership. An "in this set" rule has no standard annotation,
     * and widening it to {@code @Min(501) @Max(1001)} would let 502 through —
     * which the database CHECK would then reject as a 500 instead of a 400.
     */
    @JsonIgnore
    @AssertTrue(message = "targetScore must be 501, 701 or 1001")
    public boolean isTargetScoreAllowed() {
        return targetScore != null
                && (targetScore == 501 || targetScore == 701 || targetScore == 1001);
    }

    public record PlayerDto(
            @NotNull(message = "seat is required")
            @Min(value = 0, message = "seat must be 0-3")
            @Max(value = 3, message = "seat must be 0-3")
            Integer seat,

            @NotNull(message = "team is required")
            @Pattern(regexp = "^[AB]$", message = "team must be 'A' or 'B'")
            String team,

            /** Firebase UID; null for a bot. */
            @Size(max = 128, message = "uid is too long")
            String uid,

            @NotNull(message = "isBot is required")
            Boolean isBot,
            Boolean isGuest
    ) {}
}
