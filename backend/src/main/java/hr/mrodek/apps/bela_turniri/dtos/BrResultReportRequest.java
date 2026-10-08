package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.util.List;

/** Separate from ordinary statistics: only the game server can submit BR outcomes. */
public record BrResultReportRequest(
        @NotBlank String matchId,
        @NotBlank @Size(max = 128) String roomId,
        @NotNull @Min(1) @Max(1) Integer policyVersion,
        @NotNull OffsetDateTime startedAt,
        @NotNull OffsetDateTime finishedAt,
        @NotNull Integer targetScore,
        @NotBlank String gameEndRule,
        @NotNull Boolean noDeclarations,
        @NotNull Boolean allowBela,
        @NotNull Boolean privateRoom,
        @NotBlank @Pattern(regexp = "COMPLETED|FORFEIT|CANCELLED") String outcome,
        @Pattern(regexp = "A|B") String winnerTeam,
        @Size(max = 128) String abandonedUid,
        @Size(max = 128) String reason,
        @NotNull @Min(0) Integer scoreA,
        @NotNull @Min(0) Integer scoreB,
        @NotNull @Size(min = 4, max = 4) List<@Valid Player> players
) {
    /** Immutable STARTING roster, never the bot/replacement roster at GAME_OVER. */
    public record Player(
            @NotNull @Min(0) @Max(3) Integer seat,
            @NotBlank @Pattern(regexp = "A|B") String team,
            @NotBlank @Size(max = 128) String uid,
            @NotBlank @Size(max = 64) String name
    ) {}
}
