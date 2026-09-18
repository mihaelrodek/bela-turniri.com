package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.GameReliabilityEvent;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.inject.Inject;

import java.time.OffsetDateTime;

@ApplicationScoped
public class GameReliabilityEventRepository implements PanacheRepository<GameReliabilityEvent> {
    @Inject EntityManager em;

    /** Atomic idempotency gate; concurrent retries cannot both earn a penalty. */
    public boolean insertIfAbsent(String eventId, String userUid, String eventType, OffsetDateTime occurredAt) {
        return em.createNativeQuery("""
                insert into game_reliability_events (event_id, user_uid, event_type, occurred_at)
                values (:eventId, :userUid, :eventType, :occurredAt)
                on conflict (event_id) do nothing
                """)
                .setParameter("eventId", eventId)
                .setParameter("userUid", userUid)
                .setParameter("eventType", eventType)
                .setParameter("occurredAt", occurredAt)
                .executeUpdate() == 1;
    }
}
