package hr.mrodek.apps.bela_turniri.model;

import hr.mrodek.apps.bela_turniri.enums.PairRequestStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "pair_requests")
@Getter @Setter @NoArgsConstructor
public class PairRequest {

    @Id
    @SequenceGenerator(name = "pair_requests_seq", sequenceName = "seq_pair_requests_id", allocationSize = 1)
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "pair_requests_seq")
    private Long id;

    @Column(nullable = false, unique = true)
    private UUID uuid;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tournament_id", nullable = false)
    private Tournaments tournament;

    @Column(name = "player_name", length = 200, nullable = false)
    private String playerName;

    @Column(name = "phone", length = 50)
    private String phone;

    @Column(name = "note", length = 1000)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    private PairRequestStatus status = PairRequestStatus.OPEN;

    /** Firebase UID of the user who posted the request. Null for legacy rows. */
    @Column(name = "created_by_uid", length = 64)
    private String createdByUid;

    @CreationTimestamp
    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (uuid == null) uuid = UUID.randomUUID();
        if (status == null) status = PairRequestStatus.OPEN;
    }
}
