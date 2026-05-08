package hr.mrodek.apps.bela_turniri.model;


import hr.mrodek.apps.bela_turniri.enums.RepassageKind;
import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime; import java.util.UUID;

@Entity @Table(name = "repassage_purchase")
@Getter @Setter @NoArgsConstructor
public class RepassagePurchase {

    @Id
    @SequenceGenerator(name = "repassage_purchase_seq", sequenceName = "seq_repassage_purchase_id", allocationSize = 1)
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "repassage_purchase_seq")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "tournament_id", nullable = false)
    private Tournaments tournament;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "pair_id", nullable = false)
    private Pairs pair;

    @Column(name = "round_number")
    private Integer roundNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", length = 10)
    private RepassageKind kind; // FIRST | SECOND

    @Column(name = "paid_at")
    private OffsetDateTime paidAt;
}
