package hr.mrodek.apps.bela_turniri.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(name = "game_analytics_events")
@Getter @Setter @NoArgsConstructor
public class GameAnalyticsEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", nullable = false, unique = true, length = 80)
    private String eventId;

    @Column(name = "run_id", length = 36)
    private String runId;

    @Column(name = "event_type", nullable = false, length = 24)
    private String eventType;

    @Column(name = "occurred_at", nullable = false)
    private OffsetDateTime occurredAt;

    @Column(name = "payload", nullable = false, columnDefinition = "text")
    private String payload;
}
