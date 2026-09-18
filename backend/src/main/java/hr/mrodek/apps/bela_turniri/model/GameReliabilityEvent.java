package hr.mrodek.apps.bela_turniri.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/** Append-only, idempotent audit trail behind a player's online-game karma. */
@Entity
@Table(name = "game_reliability_events")
public class GameReliabilityEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", nullable = false, unique = true, length = 120)
    private String eventId;

    @Column(name = "user_uid", nullable = false, length = 128)
    private String userUid;

    @Column(name = "event_type", nullable = false, length = 16)
    private String eventType;

    @Column(name = "occurred_at", nullable = false)
    private OffsetDateTime occurredAt;

    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }
    public void setUserUid(String userUid) { this.userUid = userUid; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public void setOccurredAt(OffsetDateTime occurredAt) { this.occurredAt = occurredAt; }
}
