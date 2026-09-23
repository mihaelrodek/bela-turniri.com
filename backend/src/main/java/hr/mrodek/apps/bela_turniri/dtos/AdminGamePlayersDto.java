package hr.mrodek.apps.bela_turniri.dtos;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Who actually played online Bela, and how much — the admin-only companion to
 * {@link AdminGameAnalyticsDto}.
 *
 * <p>A SIBLING record rather than another field on the analytics DTO because
 * the two are computed from different tables and cannot be kept consistent
 * with each other: the analytics aggregate is folded out of
 * {@code game_analytics_events} (what the game server reported while a run was
 * happening), while this one comes from {@code game_result_players} (the
 * finished games). Merging them would make one endpoint that half-fails when
 * either source is empty, and would mean a per-player scan on every dashboard
 * poll even when nobody opens this section.
 *
 * <p>ANALYTICS VIEW (2026-09-22): every number here counts every RECORDED
 * game — including games a person played with three bots and games played in
 * the demo lobby, which until this date were dropped by the reporter and so
 * were invisible everywhere. The §8.1-eligible subset travels alongside as
 * {@code rankedGames}/{@code rankedWins}, and it is that subset — not
 * anything in this DTO — that drives the player's own record and karma.
 *
 * @param totalPlayers distinct real accounts that ever appear in a recorded
 *                     game — the heading's number, independent of the cap
 * @param shown        how many rows {@link #players()} actually carries
 * @param limit        the cap that was applied, so the UI can say "top N"
 * @param guestSeats   seats played by GUESTS (human, no uid). This is a number
 *                     of SEATS, not of people, and it includes guest seats
 *                     recorded before names were stored, which is why it does
 *                     not have to agree with the guest rows in
 *                     {@link #players()}.
 * @param guestWins    of those seats, the ones on the winning team
 * @param botSeats     seats played by bots, for scale next to the guest number
 * @param demoSeats    seats played by the demo lobby's fake people
 * @param demoGames    whole games in which a real person sat down with at
 *                     least one fake person
 * @param botOnlyGames whole games a real person played with bots only (games
 *                     §8.1 rejects and that hold no fake person)
 */
public record AdminGamePlayersDto(
        long totalPlayers,
        int shown,
        int limit,
        long guestSeats,
        long guestWins,
        long botSeats,
        long demoSeats,
        long demoGames,
        long botOnlyGames,
        List<Player> players
) {
    /**
     * One person in the "who played" list — an account or a guest.
     *
     * @param uid          Firebase UID, or NULL for a guest row. Shown only as
     *                     a fallback name, never as a column of its own.
     * @param name         for an account: in-game name, else profile display
     *                     name, else a shortened uid (the same precedence the
     *                     game server uses per seat). For a guest: the name
     *                     they played under, which is also their whole
     *                     identity — see {@code kind}.
     * @param kind         {@code "PLAYER"} or {@code "GUEST"}. Guest rows are
     *                     grouped BY NAME, because a guest has no identifier
     *                     anywhere in the schema, so two people who played
     *                     under the same name are one row here.
     * @param games        every recorded game this person played
     * @param wins         of those, games won
     * @param losses       {@code games - wins}, precomputed so the client does
     *                     no arithmetic on numbers it did not derive
     * @param rankedGames  of {@code games}, the §8.1-eligible ones — the
     *                     number that actually feeds the player's own record
     * @param rankedWins   of the eligible ones, games won
     * @param rankedLosses {@code rankedGames - rankedWins}
     * @param lastPlayedAt when the most recent of those games was played
     * @param abandons     LIFETIME confirmed abandonments
     *                     ({@code user_profiles.game_abandons}), never reset.
     *                     Always 0 on a guest row: a guest has no account to
     *                     hold karma, so nothing is tracked for them.
     * @param karma        current derived karma (10 − abandons in the rolling
     *                     window), batched through
     *                     {@code GameReliabilityService.forUsers}; the scale's
     *                     top on a guest row, where it means "not tracked"
     * @param maxKarma     the scale's top, so the UI renders "7/10" without
     *                     hard-coding the rule
     */
    public record Player(String uid, String name, String kind,
                         long games, long wins, long losses,
                         long rankedGames, long rankedWins, long rankedLosses,
                         OffsetDateTime lastPlayedAt, long abandons, int karma, int maxKarma) {}
}
