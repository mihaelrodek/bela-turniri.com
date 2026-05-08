package hr.mrodek.apps.bela_turniri.dtos;

import java.util.List;

/**
 * Everything a public profile page needs in one shot. Phone is nullable —
 * the user may not have set it, but when present it's deliberately exposed
 * (per product decision: profiles are publicly visible).
 */
public record PublicProfileDto(
        String slug,
        String displayName,
        String phoneCountry,
        String phone,

        /** Distinct pair names this user has played as, with how many tournaments each. */
        List<PairSummary> pairs,

        /** All participations across all tournaments, freshest first. */
        List<MyTournamentParticipationDto> tournaments
) {
    public record PairSummary(
            /** Pair name as shown to humans. */
            String name,
            /** Number of tournaments this pair has participated in. */
            int tournamentCount,
            /** How many of those tournaments this pair won. */
            int wins
    ) {}
}
