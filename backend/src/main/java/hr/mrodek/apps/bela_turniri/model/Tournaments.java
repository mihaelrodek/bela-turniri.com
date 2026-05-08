package hr.mrodek.apps.bela_turniri.model;

import hr.mrodek.apps.bela_turniri.enums.RepassageUntil;
import hr.mrodek.apps.bela_turniri.enums.RewardType;
import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.Where;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "tournaments")
// Auto-filter soft-deleted rows from every query Hibernate runs against
// this entity — list, find-by-id, joins, count(), the works. Marking a
// tournament deleted is a single-field update; once the flag flips, the
// row vanishes from every read path without us having to audit every
// repository method.
@Where(clause = "is_deleted = false")
@Getter @Setter @NoArgsConstructor
public class Tournaments {

    @Id
    @SequenceGenerator(name = "tournaments_seq", sequenceName = "seq_tournaments_id", allocationSize = 1)
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "tournaments_seq")
    private Long id;

    @Column(nullable = false, unique = true)
    private UUID uuid; // DB default via gen_random_uuid(); or set in @PrePersist if you prefer

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 200)
    private String location;

    @Column(columnDefinition = "text")
    private String details;

    @Column(name = "start_at")
    private OffsetDateTime startAt;

    @Enumerated(EnumType.STRING)
    @Column(length = 20, nullable = false)
    private TournamentStatus status = TournamentStatus.DRAFT;

    @Column(name = "max_pairs", nullable = false)
    private Integer maxPairs = 16;

    @Column(name = "entry_price", precision = 10, scale = 2, nullable = false)
    private BigDecimal entryPrice = BigDecimal.ZERO;

    @Column(name = "repassage_price", precision = 10, scale = 2, nullable = false)
    private BigDecimal repassagePrice = BigDecimal.ZERO;

    @Column(name = "repassage_second_price", precision = 10, scale = 2)
    private BigDecimal repassageSecondPrice;

    @Enumerated(EnumType.STRING)
    @Column(name = "repassage_until", length = 20)
    private RepassageUntil repassageUntil;

    // contact
    @Column(name = "contact_name", length = 120)
    private String contactName;

    @Column(name = "contact_phone", length = 60)
    private String contactPhone;

    // rewards
    @Enumerated(EnumType.STRING)
    @Column(name = "reward_type", length = 20)
    private RewardType rewardType;

    @Column(name = "reward_first", precision = 10, scale = 2)
    private BigDecimal rewardFirst;

    @Column(name = "reward_second", precision = 10, scale = 2)
    private BigDecimal rewardSecond;

    @Column(name = "reward_third", precision = 10, scale = 2)
    private BigDecimal rewardThird;

    // media
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resource_id")
    private Resources resource;

    @CreationTimestamp
    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @Column(name = "winner_name")
    private String winnerName;   // <- NEW

    @Column(name = "preserve_matchmaking", nullable = false)
    private boolean preserveMatchmaking = false;

    /** Firebase UID of the user who created the tournament (null for legacy rows). */
    @Column(name = "created_by_uid", length = 64)
    private String createdByUid;

    /** Display name copied from the creator's Firebase profile at create-time. */
    @Column(name = "created_by_name", length = 200)
    private String createdByName;

    // --- Geocoding (populated by GeocodeService when location is set) ---
    @Column(name = "latitude")
    private Double latitude;

    @Column(name = "longitude")
    private Double longitude;

    @Column(name = "geocoded_at")
    private OffsetDateTime geocodedAt;

    /**
     * Soft-delete marker. Set by an admin via DELETE /tournaments/{uuid}.
     * Combined with the class-level {@code @Where(clause = "is_deleted = false")},
     * once this flips to {@code true} the row disappears from every read.
     */
    @Column(name = "is_deleted", nullable = false)
    private boolean deleted = false;

    @PrePersist
    protected void onCreate() {
        if (uuid == null) uuid = UUID.randomUUID();     // 👈 generate server-side
        if (status == null) status = TournamentStatus.DRAFT;
        if (maxPairs == null) maxPairs = 16;
        if (entryPrice == null) entryPrice = BigDecimal.ZERO;
        if (repassagePrice == null) repassagePrice = BigDecimal.ZERO;
    }
}