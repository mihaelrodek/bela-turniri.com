package hr.mrodek.apps.bela_turniri.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * A single drink (or batch of N drinks) attached to a match.
 *
 * Name and unit price are snapshotted at attach time — editing the cjenik
 * later doesn't rewrite history. The soft FK to {@link TournamentDrinkPrice}
 * is preserved with ON DELETE SET NULL so we can still offer
 * "increment last drink" UX while a price row still exists.
 */
@Entity
@Table(name = "match_drinks")
@Getter @Setter @NoArgsConstructor
public class MatchDrink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "match_id")
    private Matches match;

    /** Soft link to the cjenik row this came from. Null if that row was deleted. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "price_id")
    private TournamentDrinkPrice price;

    @Column(name = "name_snapshot", nullable = false, length = 100)
    private String nameSnapshot;

    @Column(name = "price_snapshot", nullable = false, precision = 10, scale = 2)
    private BigDecimal priceSnapshot;

    @Column(nullable = false)
    private int quantity = 1;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;
}
