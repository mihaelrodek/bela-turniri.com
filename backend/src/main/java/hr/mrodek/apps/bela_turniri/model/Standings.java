package hr.mrodek.apps.bela_turniri.model;

import hr.mrodek.apps.bela_turniri.model.Tournaments;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal; import java.util.UUID;

@Entity @Table(name = "standings")
@Getter @Setter @NoArgsConstructor
public class Standings {

    @Id
    @SequenceGenerator(name = "standings_seq", sequenceName = "seq_standings_id", allocationSize = 1)
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "standings_seq")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tournament_id")
    private Tournaments tournament;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pair_id")
    private Pairs pair;

    @Column(nullable = false)
    private Integer rank;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "prize_amount", precision = 10, scale = 2)
    private BigDecimal prizeAmount;
}