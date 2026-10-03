package hr.mrodek.apps.bela_turniri.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

/**
 * 2026-10-03: an "Ostalo" bill — a drink bill that belongs to a tournament
 * but not to a match (spectators, organisers, anyone not playing). Drinks
 * live in {@link MatchDrink} with {@code extraBill} set instead of
 * {@code match}; the paid columns mirror {@link Matches#getPaidAt()} etc.
 * exactly, so the waiter UI treats both kinds the same way.
 */
@Entity
@Table(name = "extra_bills")
@Getter @Setter @NoArgsConstructor
public class ExtraBill {

    public static final int LABEL_MAX = 60;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tournament_id")
    private Tournaments tournament;

    /** Free text ("Gledatelji"); null/blank means the UI shows the default "Ostalo". */
    @Column(length = LABEL_MAX)
    private String label;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "paid_at")
    private OffsetDateTime paidAt;

    @Column(name = "paid_by_uid", length = 64)
    private String paidByUid;

    @Column(name = "paid_by_name", length = 120)
    private String paidByName;
}
