package hr.mrodek.apps.bela_turniri.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "pairs")
@Getter @Setter @NoArgsConstructor
public class Pairs {

    @Id
    @SequenceGenerator(name = "pairs_seq", sequenceName = "seq_pairs_id", allocationSize = 1)
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "pairs_seq")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tournament_id", nullable = false)
    private Tournaments tournament;

    @Column(name = "name", length = 200, nullable = false)
    private String name;

    @Column(name = "is_eliminated", nullable = false)
    private boolean eliminated = false;

    @Column(name = "extra_life", nullable = false)
    private boolean extraLife = false;

    @Column(name = "wins", nullable = false)
    private int wins = 0;

    @Column(name = "losses", nullable = false)
    private int losses = 0;

    @Column(name = "paid", nullable = false)
    private boolean paid = false;

    /** Firebase UID of the user who self-registered this pair (null if added by organizer). */
    @Column(name = "submitted_by_uid", length = 64)
    private String submittedByUid;

    /** True while waiting for the organizer to confirm a self-registered pair. */
    @Column(name = "pending_approval", nullable = false)
    private boolean pendingApproval = false;

    @CreationTimestamp
    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}