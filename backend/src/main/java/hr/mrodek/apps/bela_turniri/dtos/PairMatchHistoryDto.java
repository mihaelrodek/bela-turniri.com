package hr.mrodek.apps.bela_turniri.dtos;

import java.util.List;

/**
 * Match-by-match history for a single pair within a single tournament.
 * Used to drill into "round 3 — vs Pero & Ivo — 4:2 (won)".
 */
public record PairMatchHistoryDto(
        Long pairId,
        String pairName,
        String tournamentName,

        List<Row> matches
) {
    public record Row(
            Integer roundNumber,
            Integer tableNo,
            String opponentName,
            Integer ourScore,
            Integer opponentScore,
            String status,        // SCHEDULED | IN_PROGRESS | COMPLETED | …
            Boolean won,          // null when not yet completed
            Boolean isBye         // true when there was no opponent (auto-advance)
    ) {}
}
