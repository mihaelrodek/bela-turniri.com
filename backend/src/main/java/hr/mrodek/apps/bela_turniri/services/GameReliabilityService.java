package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.GameReliabilityDto;
import hr.mrodek.apps.bela_turniri.dtos.GameReliabilityEventRequest;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import hr.mrodek.apps.bela_turniri.repository.GameReliabilityEventRepository;
import hr.mrodek.apps.bela_turniri.repository.GameResultPlayerRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Reliability rules for online Bela ("karma").
 *
 * <h2>The rule (redesigned 2026-09-21)</h2>
 * Karma is DERIVED, never stored:
 * {@code karma = MAX_KARMA − abandons in the last WINDOW_DAYS days}, floored
 * at 0. The window is ROLLING per event: each abandonment weighs on the
 * player for exactly thirty days from its own {@code occurred_at} and then
 * drops off by itself. There is no calendar reset and nothing to schedule —
 * the count simply stops matching.
 *
 * <p>Finishing games earns NOTHING back. The old "+1 per three finished
 * games" recovery rule (and its {@code game_completed_since_recovery}
 * counter) is retired: it made the number a currency to farm, while the
 * honest question is only "how often does this person walk out of a game
 * lately?". Time answers that on its own.
 *
 * <p>The trail is shown rather than erased, which is why the DTO carries
 * {@code recentAbandons}, {@code recentGames} and the lifetime total: the UI
 * says "napustio X od Y partija u zadnjih 30 dana" beside the number.
 *
 * <h2>Where the numbers come from</h2>
 * {@code game_reliability_events} (append-only, one row per confirmed leave —
 * the game process reports only after its reconnect grace expires, and the
 * unique event id makes a retry harmless) and {@code game_result_players}
 * joined to their game's {@code played_at} for the games actually finished in
 * the same window. Both are queried per read; there is no aggregate to drift.
 *
 * <p>{@code UserProfile.gameKarma} and {@code gameCompletedSinceRecovery} are
 * LEGACY columns from the stored-score era and are no longer read or written
 * here — see the fields' own comments.
 */
@ApplicationScoped
public class GameReliabilityService {
    /** Full karma, and the value a player with a clean window has. */
    public static final int MAX_KARMA = 10;
    /** Kept as the "starting value" name used by callers and tests. */
    public static final int DEFAULT_KARMA = MAX_KARMA;
    /** One abandoned game inside the window = one point. */
    public static final int ABANDON_PENALTY = 1;
    /** Length of the rolling window an abandonment is counted in. */
    public static final int WINDOW_DAYS = 30;

    @Inject UserProfileRepository profiles;
    @Inject GameReliabilityEventRepository events;
    @Inject GameResultPlayerRepository gamePlayers;

    /** Start of the current rolling window. */
    public static OffsetDateTime windowStart() {
        return OffsetDateTime.now().minusDays(WINDOW_DAYS);
    }

    /** Derived karma for a number of recent abandonments. */
    public static int karmaFor(long recentAbandons) {
        long karma = MAX_KARMA - recentAbandons * ABANDON_PENALTY;
        return (int) Math.max(0, karma);
    }

    /**
     * One player's reliability, computed from the ledger.
     *
     * <p>A uid with no profile row and no events is simply at full karma with
     * zeros — the same answer a freshly created row would give, so the caller
     * never has to special-case "not registered yet".
     */
    public GameReliabilityDto forUser(String uid) {
        if (uid == null || uid.isBlank()) return GameReliabilityDto.DEFAULT;
        OffsetDateTime since = windowStart();
        long recentAbandons = events.countAbandonsSince(uid, since);
        long recentGames = gamePlayers.countGamesSince(uid, since);
        long lifetime = profiles.findByUid(uid).map(UserProfile::getGameAbandons).orElse(0L);
        return new GameReliabilityDto(
                karmaFor(recentAbandons),
                lifetime,
                MAX_KARMA,
                (int) recentAbandons,
                (int) recentGames,
                WINDOW_DAYS);
    }

    /**
     * The same answer for a whole list of uids in a fixed number of queries
     * (three, whatever the list size) — the lobby asks about a table full of
     * players, and an N-query version of this would be the slowest endpoint in
     * the app the moment a room fills up.
     *
     * <p>Every requested uid is present in the result; unknown ones get
     * {@link GameReliabilityDto#DEFAULT}-shaped values.
     */
    public Map<String, GameReliabilityDto> forUsers(Collection<String> uids) {
        if (uids == null || uids.isEmpty()) return Map.of();
        Set<String> wanted = new LinkedHashSet<>(uids);
        wanted.removeIf(u -> u == null || u.isBlank());
        if (wanted.isEmpty()) return Map.of();

        OffsetDateTime since = windowStart();
        Map<String, Long> abandons = events.countAbandonsSinceByUid(wanted, since);
        Map<String, Long> games = gamePlayers.countGamesSinceByUid(wanted, since);
        Map<String, UserProfile> rows = profiles.findByUids(wanted);

        Map<String, GameReliabilityDto> out = new HashMap<>(wanted.size());
        for (String uid : wanted) {
            long recentAbandons = abandons.getOrDefault(uid, 0L);
            long recentGames = games.getOrDefault(uid, 0L);
            UserProfile profile = rows.get(uid);
            out.put(uid, new GameReliabilityDto(
                    karmaFor(recentAbandons),
                    profile == null ? 0L : profile.getGameAbandons(),
                    MAX_KARMA,
                    (int) recentAbandons,
                    (int) recentGames,
                    WINDOW_DAYS));
        }
        return out;
    }

    /**
     * Record one confirmed abandonment.
     *
     * <p>The event insert is still the whole idempotency gate: a replayed
     * report conflicts on {@code event_id}, changes nothing and answers
     * {@code false}. The LIFETIME counter on the profile is the only thing
     * written here — karma itself needs no write, because the row just
     * inserted is what the next read counts.
     *
     * @return true for a newly recorded abandonment, false for an idempotent replay.
     */
    public boolean recordAbandonment(GameReliabilityEventRequest request) {
        OffsetDateTime occurredAt = request.occurredAt() == null ? OffsetDateTime.now() : request.occurredAt();
        if (!events.insertIfAbsent(request.eventId(), request.userUid(), request.eventType(), occurredAt)) return false;

        UserProfile profile = profiles.findByUid(request.userUid()).orElseGet(() -> {
            UserProfile created = new UserProfile();
            created.setUserUid(request.userUid());
            created.setGameAbandons(0);
            profiles.persist(created);
            return created;
        });

        profile.setGameAbandons(profile.getGameAbandons() + 1);
        return true;
    }
}
