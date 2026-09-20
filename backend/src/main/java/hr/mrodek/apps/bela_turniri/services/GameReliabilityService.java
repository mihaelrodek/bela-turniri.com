package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.GameReliabilityDto;
import hr.mrodek.apps.bela_turniri.dtos.GameReliabilityEventRequest;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import hr.mrodek.apps.bela_turniri.repository.GameReliabilityEventRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.OffsetDateTime;

/**
 * Persistent reliability rules for online Bela ("karma").
 *
 * <p>Deliberately a tiny, human-sized scale: everyone starts at
 * {@code 10/10}, abandoning a running game costs exactly one point (floor 0)
 * and every {@link #GAMES_PER_RECOVERY} finished games give one point back
 * (cap 10). A player can therefore say what their number means without
 * reading anything.
 *
 * <p>The game process only reports a leave after its reconnect grace expires.
 * A unique event id makes a retry harmless. A completed game calls
 * {@link #recordCompleted(String)} from {@code GameStatsService}; keeping
 * both updates here gives the score one owner and prevents UI/server rules
 * from drifting.
 */
@ApplicationScoped
public class GameReliabilityService {
    /** Full karma, and the value a brand-new player starts with. */
    public static final int MAX_KARMA = 10;
    /** Kept as the "starting value" name used by callers and tests. */
    public static final int DEFAULT_KARMA = MAX_KARMA;
    /** One abandoned game = one point. */
    public static final int ABANDON_PENALTY = 1;
    /** Finished games needed to earn a single point back. */
    public static final int GAMES_PER_RECOVERY = 3;

    @Inject UserProfileRepository profiles;
    @Inject GameReliabilityEventRepository events;

    public GameReliabilityDto forUser(String uid) {
        return profiles.findByUid(uid)
                .map(p -> new GameReliabilityDto(p.getGameKarma(), p.getGameAbandons(), MAX_KARMA))
                .orElse(GameReliabilityDto.DEFAULT);
    }

    /** @return true for a newly recorded abandonment, false for an idempotent replay. */
    public boolean recordAbandonment(GameReliabilityEventRequest request) {
        OffsetDateTime occurredAt = request.occurredAt() == null ? OffsetDateTime.now() : request.occurredAt();
        if (!events.insertIfAbsent(request.eventId(), request.userUid(), request.eventType(), occurredAt)) return false;

        UserProfile profile = profiles.findByUid(request.userUid()).orElseGet(() -> {
            UserProfile created = new UserProfile();
            created.setUserUid(request.userUid());
            created.setGameKarma(DEFAULT_KARMA);
            created.setGameAbandons(0);
            profiles.persist(created);
            return created;
        });

        profile.setGameAbandons(profile.getGameAbandons() + 1);
        profile.setGameKarma(Math.max(0, profile.getGameKarma() - ABANDON_PENALTY));
        return true;
    }

    /**
     * Count one finished, eligible game towards recovery.
     *
     * <p>Every {@link #GAMES_PER_RECOVERY}rd finished game returns one point.
     * The progress counter lives on the profile, so it survives restarts, and
     * it is held at zero while karma is full: a player at 10/10 is not
     * banking credit against a future abandonment.
     */
    public void recordCompleted(String uid) {
        if (uid == null || uid.isBlank()) return;
        profiles.findByUid(uid).ifPresent(profile -> {
            if (profile.getGameKarma() >= MAX_KARMA) {
                profile.setGameKarma(MAX_KARMA);
                profile.setGameCompletedSinceRecovery(0);
                return;
            }
            int progress = profile.getGameCompletedSinceRecovery() + 1;
            if (progress >= GAMES_PER_RECOVERY) {
                progress = 0;
                profile.setGameKarma(Math.min(MAX_KARMA, profile.getGameKarma() + 1));
            }
            profile.setGameCompletedSinceRecovery(progress);
        });
    }
}
