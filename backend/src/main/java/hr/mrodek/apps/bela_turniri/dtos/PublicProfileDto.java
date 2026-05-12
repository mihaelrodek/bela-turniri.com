package hr.mrodek.apps.bela_turniri.dtos;

import java.util.List;

/**
 * Everything a public profile page needs in one shot. Phone is nullable —
 * the user may not have set it, but when present it's deliberately exposed
 * (per product decision: profiles are publicly visible). Anonymous reads
 * receive null phone fields per {@code PublicProfileController#redactForAnonymous}.
 */
public record PublicProfileDto(
        String slug,
        String displayName,
        String phoneCountry,
        String phone,

        /**
         * True when the user actually has a phone on file. Anonymous callers
         * see {@code phone = null} (redaction), so the SPA needs a separate
         * signal to know whether to show the "log in to see phone" prompt vs
         * just rendering nothing because the user never set one.
         */
        boolean hasPhone,

        /** Proxied avatar URL ({@code /api/resources/<id>/image}) or null. */
        String avatarUrl,

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
            int wins,
            /**
             * When the pair is co-owned via the preset share flow,
             * these point at the OTHER owner (from the profile owner's
             * perspective) so the UI can render a clickable link.
             * Null when the pair isn't shared.
             */
            String partnerSlug,
            String partnerName
    ) {
        /** Legacy 3-arg shim for callers that didn't carry partner info. */
        public PairSummary(String name, int tournamentCount, int wins) {
            this(name, tournamentCount, wins, null, null);
        }
    }
}
