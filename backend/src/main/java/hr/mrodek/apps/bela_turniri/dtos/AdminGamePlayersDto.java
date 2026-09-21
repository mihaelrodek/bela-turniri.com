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
 * finished, eligible games §8.1 lets through). Merging them would make one
 * endpoint that half-fails when either source is empty, and would mean a
 * per-player scan on every dashboard poll even when nobody opens this section.
 *
 * @param totalPlayers distinct real accounts that ever appear in a recorded
 *                     game — the heading's number, independent of the cap
 * @param shown        how many rows {@link #players()} actually carries
 * @param limit        the cap that was applied, so the UI can say "top N"
 * @param guestSeats   seats played by GUESTS (human, no uid). Guests carry no
 *                     stored identifier at all — {@code GameStatsService}
 *                     rejects a guest seat that has a uid — so they can be
 *                     counted but never listed or de-duplicated: this is a
 *                     number of SEATS, not of people.
 * @param guestWins    of those seats, the ones on the winning team
 * @param botSeats     seats played by bots, for scale next to the guest number
 */
public record AdminGamePlayersDto(
        long totalPlayers,
        int shown,
        int limit,
        long guestSeats,
        long guestWins,
        long botSeats,
        List<Player> players
) {
    /**
     * @param uid          Firebase UID — shown only as a fallback name, never
     *                     as a column of its own
     * @param name         in-game name, else profile display name, else a
     *                     shortened uid (the same precedence the game server
     *                     uses per seat: {@code gameName ?? displayName ?? …})
     * @param games        finished eligible games this account played
     * @param wins         of those, games won
     * @param losses       {@code games - wins}, precomputed so the client does
     *                     no arithmetic on numbers it did not derive
     * @param lastPlayedAt when the most recent of those games was played
     * @param abandons     LIFETIME confirmed abandonments
     *                     ({@code user_profiles.game_abandons}), never reset
     * @param karma        current derived karma (10 − abandons in the rolling
     *                     window), batched through
     *                     {@code GameReliabilityService.forUsers}
     * @param maxKarma     the scale's top, so the UI renders "7/10" without
     *                     hard-coding the rule
     */
    public record Player(String uid, String name, long games, long wins, long losses,
                         OffsetDateTime lastPlayedAt, long abandons, int karma, int maxKarma) {}
}
