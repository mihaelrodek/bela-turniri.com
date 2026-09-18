package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.GameAnalyticsEvent;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.OffsetDateTime;

@ApplicationScoped
public class GameAnalyticsEventRepository implements AppRepository<GameAnalyticsEvent, Long> {
    public boolean insertIfAbsent(String eventId, String runId, String type,
                                  OffsetDateTime occurredAt, String payload) {
        return getEntityManager().createNativeQuery("""
                insert into game_analytics_events (event_id, run_id, event_type, occurred_at, payload)
                values (:eventId, :runId, :type, :occurredAt, :payload)
                on conflict do nothing
                """)
                .setParameter("eventId", eventId)
                .setParameter("runId", runId)
                .setParameter("type", type)
                .setParameter("occurredAt", occurredAt)
                .setParameter("payload", payload)
                .executeUpdate() == 1;
    }
}
