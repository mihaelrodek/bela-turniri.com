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
 * Persistent reliability rules for online Bela.
 *
 * <p>The game process only reports a leave after its reconnect grace expires.
 * A unique event id makes a retry harmless. A completed game may later call
 * {@link #recordCompleted(String)}; keeping that update here gives the score
 * one owner and prevents UI/server rules from drifting.
 */
@ApplicationScoped
public class GameReliabilityService {
    public static final int DEFAULT_KARMA = 100;
    public static final int ABANDON_PENALTY = 15;
    public static final int COMPLETION_RECOVERY = 3;

    @Inject UserProfileRepository profiles;
    @Inject GameReliabilityEventRepository events;

    public GameReliabilityDto forUser(String uid) {
        return profiles.findByUid(uid)
                .map(p -> new GameReliabilityDto(p.getGameKarma(), p.getGameAbandons()))
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

    /** Small recovery after a completed eligible game; never exceeds 100. */
    public void recordCompleted(String uid) {
        if (uid == null || uid.isBlank()) return;
        profiles.findByUid(uid).ifPresent(profile ->
                profile.setGameKarma(Math.min(DEFAULT_KARMA, profile.getGameKarma() + COMPLETION_RECOVERY)));
    }
}
