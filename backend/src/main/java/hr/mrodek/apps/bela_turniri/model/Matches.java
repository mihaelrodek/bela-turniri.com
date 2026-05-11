package hr.mrodek.apps.bela_turniri.model;

import hr.mrodek.apps.bela_turniri.enums.MatchStatus;
import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity @Table(name = "matches")
@Getter @Setter @NoArgsConstructor
public class Matches {

    @Id
    @SequenceGenerator(name = "matches_seq", sequenceName = "seq_matches_id", allocationSize = 1)
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "matches_seq")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tournament_id")
    private Tournaments tournament;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "round_id", nullable = false)
    private Rounds round;

    @Column(name = "table_no")
    private Integer tableNo;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "pair1_id")
    private Pairs pair1;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "pair2_id")
    private Pairs pair2;

    private Integer score1;
    private Integer score2;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "winner_pair_id")
    private Pairs winnerPair;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20)
    private MatchStatus status = MatchStatus.SCHEDULED;

    /**
     * Set when the bartender marks the table's drinks bill as collected.
     * Independent of {@link #status} (the match's competitive result) —
     * a finished match can be unpaid; an in-progress match can be paid
     * (rare but possible if drinks were prepaid).
     */
    @Column(name = "paid_at")
    private java.time.OffsetDateTime paidAt;

    /** Firebase UID of whoever marked the bill paid (today: the owner only). */
    @Column(name = "paid_by_uid", length = 64)
    private String paidByUid;
}
