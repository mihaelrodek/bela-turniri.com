package hr.mrodek.apps.bela_turniri.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A pair-name preset saved by an end user. Each row is scoped to a single
 * Firebase UID — the controller filters by that on every read/write so users
 * never see each other's presets.
 */
@Entity
@Table(name = "user_pair_presets")
@Getter @Setter @NoArgsConstructor
public class UserPairPreset {

    @Id
    @SequenceGenerator(name = "user_pair_presets_seq", sequenceName = "seq_user_pair_presets_id", allocationSize = 1)
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "user_pair_presets_seq")
    private Long id;

    @Column(nullable = false, unique = true)
    private UUID uuid;

    @Column(name = "user_uid", length = 64, nullable = false)
    private String userUid;

    @Column(name = "name", length = 200, nullable = false)
    private String name;

    @CreationTimestamp
    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (uuid == null) uuid = UUID.randomUUID();
    }
}
