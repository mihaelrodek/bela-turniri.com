package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.GameReliabilityEvent;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.inject.Inject;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class GameReliabilityEventRepository implements PanacheRepository<GameReliabilityEvent> {
    @Inject EntityManager em;

    /**
     * The only event type the table accepts today (CHECK constraint in
     * {@code db/changelog/game_reliability.xml}). Named here anyway, and
     * filtered on explicitly below, so that adding a second, non-punitive
     * event type later cannot silently inflate everybody's abandon count.
     */
    public static final String ABANDONED = "ABANDONED";

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

    /**
     * Abandonments of one user inside the rolling karma window.
     *
     * <p>This is the whole of karma now (2026-09-21): the score is derived on
     * every read instead of being a counter somebody has to remember to
     * decrement, so an event ageing past {@code since} gives the point back by
     * simply falling out of this count.
     */
    public long countAbandonsSince(String uid, OffsetDateTime since) {
        if (uid == null || uid.isBlank()) return 0;
        return em.createQuery("""
                        select count(e)
                        from GameReliabilityEvent e
                        where e.userUid = :uid
                          and e.eventType = :type
                          and e.occurredAt > :since
                        """, Long.class)
                .setParameter("uid", uid)
                .setParameter("type", ABANDONED)
                .setParameter("since", since)
                .getSingleResult();
    }

    /**
     * The same count for many uids in ONE query — a lobby table is up to four
     * seats and the game server asks per player, so the batched shape exists
     * to keep any list-of-uids caller off an N-query path.
     *
     * <p>Uids with no events in the window are simply absent from the map;
     * callers read them as zero.
     */
    public Map<String, Long> countAbandonsSinceByUid(Collection<String> uids, OffsetDateTime since) {
        if (uids == null || uids.isEmpty()) return Map.of();
        List<Object[]> rows = em.createQuery("""
                        select e.userUid, count(e)
                        from GameReliabilityEvent e
                        where e.userUid in :uids
                          and e.eventType = :type
                          and e.occurredAt > :since
                        group by e.userUid
                        """, Object[].class)
                .setParameter("uids", uids)
                .setParameter("type", ABANDONED)
                .setParameter("since", since)
                .getResultList();

        Map<String, Long> out = new HashMap<>(rows.size());
        for (Object[] row : rows) {
            out.put((String) row[0], ((Number) row[1]).longValue());
        }
        return out;
    }
}
