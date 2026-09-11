package hr.mrodek.apps.bela_turniri.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One seat of a finished online game (game/README.md §8.3).
 *
 * <p>Four rows per {@link GameResult}, seats 0-3, unique on
 * {@code (game_result_id, seat)}.
 *
 * <p>{@link #won} is denormalised — it always equals
 * {@code team.equals(gameResult.winnerTeam)}. Keeping it here means the whole
 * statistics read is an index scan on {@code uid} plus a join for the parent's
 * {@code target_score}, with no winner comparison inside the GROUP BY.
 *
 * <p>{@link #uid} is NULL for a bot; {@link #bot} says which case a NULL uid
 * is, so a human seat that somehow lost its uid is distinguishable from a bot.
 */
@Entity
@Table(name = "game_result_players")
@Getter @Setter @NoArgsConstructor
public class GameResultPlayer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "game_result_id", nullable = false)
    private GameResult gameResult;

    /** 0-3. */
    @Column(name = "seat", nullable = false)
    private short seat;

    /** {@code "A"} or {@code "B"} — CHAR(1) in the schema. */
    // columnDefinition, not length: the schema column is CHAR(1) and a plain
    // length=1 makes Hibernate expect VARCHAR(1), which dev-mode validation flags.
    @Column(name = "team", nullable = false, columnDefinition = "char(1)")
    private String team;

    /** Firebase UID, or null for a bot. */
    @Column(name = "uid", length = 128)
    private String uid;

    @Column(name = "is_bot", nullable = false)
    private boolean bot;

    /** Denormalised {@code team = gameResult.winnerTeam}. */
    @Column(name = "won", nullable = false)
    private boolean won;
}
