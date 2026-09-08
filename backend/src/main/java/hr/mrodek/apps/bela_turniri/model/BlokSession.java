package hr.mrodek.apps.bela_turniri.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One <em>series</em> ({@code serija}) of blok games — see
 * {@code BLOK-HISTORY.md} §3.1.
 *
 * <p>The bela blok on the phone plays game after game at the same table;
 * "Resetiraj" closes that run and uploads it as a single row. A series that
 * ended 4 : 3 is <b>one</b> record holding <b>seven</b> games, each with all
 * of its deals.
 *
 * <h2>This is a personal scorepad and nothing else</h2>
 * Nothing in the application reads this table but the four
 * {@code /user/me/blok-history} endpoints. It never touches {@link Matches},
 * tournament results or player statistics, which is why the scores in
 * {@link #payload} are accepted as the client computed them: the bela scoring
 * rules live in the TypeScript engine that drew the screen, and porting them
 * to Java would create a second source of truth for numbers nobody else
 * consumes. The limits enforced by {@code BlokHistoryService} are about size
 * and nonsense, not about trusting the result.
 *
 * <h2>Why the summary is duplicated out of the payload</h2>
 * The history LISTING must not read {@link #payload} — that is the entire
 * reason {@link #gamesUs}, {@link #gamesThem}, {@link #target}, the two names
 * and the two dates are real columns. The listing query is an explicit JPQL
 * constructor projection over exactly those columns, so the jsonb is not
 * fetched and then thrown away. Note that {@code payload} is deliberately NOT
 * annotated {@code @Basic(fetch = LAZY)}: a lazy basic attribute only actually
 * defers in Hibernate with bytecode enhancement enabled, which this build does
 * not use, so the annotation would document a laziness that never happens. The
 * projection is the real mechanism.
 *
 * <h2>The jsonb mapping</h2>
 * {@link #payload} is a {@code String} — the raw JSON text — bound to a
 * {@code jsonb} column via {@code @JdbcTypeCode(SqlTypes.JSON)}, the same
 * mechanism {@link Resources#getMetadata()} already uses. String rather than a
 * mapped object graph on purpose: the service validates and re-serialises the
 * games into its own DTO records <em>before</em> persisting, so the text in
 * this field is known-good normalised JSON and the entity does not need to
 * know its shape. Reads hand that text straight back to Jackson. Hibernate's
 * Jackson format mapper passes {@code String} through untouched in both
 * directions (it special-cases {@code String}/{@code Object}), so the column
 * holds the JSON document itself, not a JSON-encoded string — asserted by
 * {@code BlokHistoryControllerTest.payloadRoundTripsAsRealJsonb}.
 *
 * <h2>Idempotency, and why a repeat now UPDATES (§5.1)</h2>
 * {@code uq_blok_sessions_user_session} on {@code (user_uid, session_id)} is
 * the load-bearing constraint: the same {@link #sessionId} <em>will</em>
 * arrive twice.
 *
 * <p>What arrives twice changed with §5.1. A series used to be uploaded once,
 * at the end, so the repeat was a pure retry and {@code ON CONFLICT DO
 * NOTHING} was right. The player now chooses "Spremi i započni novu" at the
 * start of every game, so the <b>same series comes back grown by one game</b>
 * — and the second upload must refresh this row rather than skip it. The
 * service therefore writes with {@code ON CONFLICT (user_uid, session_id) DO
 * UPDATE}, touching the payload, the two game tallies, {@link #gamesCount},
 * {@link #finishedAt}, the names, {@link #target} and {@link #gameEndRule}.
 *
 * <p><b>{@link #uuid}, {@link #createdAt} and {@link #shareToken} are never in
 * that SET list.</b> A share link already handed out points at this record;
 * regenerating any of the three would break it mid-series, which is exactly
 * what §5.1 forbids.
 */
@Entity
@Table(name = "blok_sessions",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_blok_sessions_user_session",
                columnNames = {"user_uid", "session_id"}))
@Getter @Setter @NoArgsConstructor
public class BlokSession {

    @Id
    @SequenceGenerator(name = "blok_sessions_seq",
            sequenceName = "seq_blok_sessions_id", allocationSize = 1)
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "blok_sessions_seq")
    private Long id;

    /** The id that travels through the API; the bigint PK never leaves the server. */
    @Column(nullable = false, unique = true)
    private UUID uuid;

    /**
     * The client's own id for the series ({@code crypto.randomUUID()}), kept
     * across retries. Half of the idempotency key — never an identifier the
     * API hands out, and never trusted for ownership.
     */
    @Column(name = "session_id", length = 64, nullable = false)
    private String sessionId;

    /** Firebase UID of the owner. Every read and write is scoped by it. */
    @Column(name = "user_uid", length = 64, nullable = false)
    private String userUid;

    /**
     * When the series began / ended, by the phone's clock (epoch ms on the
     * wire, §2.3). Nullable because a locally-stored game from before this
     * feature may not know.
     */
    @Column(name = "started_at")
    private OffsetDateTime startedAt;

    @Column(name = "finished_at")
    private OffsetDateTime finishedAt;

    /** Points a game is played to; 1001 in the default blok. */
    @Column(name = "target", nullable = false)
    private Integer target;

    /**
     * How a game of this series ends — {@code "dosta"} or {@code "prolaz"}
     * ({@code BLOK-HISTORY.md} §5.5). The <b>series-level</b> value: the rule
     * in force for the series as it now stands, which is the newest game's.
     * Each game carries its own inside {@link #payload}, because the player
     * may change the setting between games.
     *
     * <p>It is a column and not only a payload field for the same reason
     * {@link #target} is one: the history listing must keep not reading the
     * jsonb (§3.1) and still has to print "Do 1001 · prolaz" on every row.
     *
     * <p>NOT NULL, defaulted to {@code prolaz} in the changeset. §5.5 makes an
     * absent rule <em>mean</em> {@code prolaz}, so a NULL would be a second
     * spelling of a value that already has one — and the same default
     * backfills every series stored before the rule travelled. The service
     * normalises anything that is not {@code dosta} to {@code prolaz} rather
     * than rejecting it, so nothing else ever reaches this column.
     */
    @Column(name = "game_end_rule", length = 8, nullable = false)
    private String gameEndRule;

    /** Side names as typed. Null/empty means "render the translated MI / VI". */
    @Column(name = "name_us", length = 60)
    private String nameUs;

    @Column(name = "name_them", length = 60)
    private String nameThem;

    /**
     * The series result — the 4 and the 3 in "4 : 3". Counted on the server
     * from the per-game winners; §2.3 sends no such field, and counting
     * winners is tallying rather than scoring, so no bela rule is duplicated.
     */
    @Column(name = "games_us", nullable = false)
    private Integer gamesUs;

    @Column(name = "games_them", nullable = false)
    private Integer gamesThem;

    /**
     * Games in the series. Not necessarily {@code gamesUs + gamesThem}: the
     * last game of a run can be abandoned mid-way and has no winner.
     */
    @Column(name = "games_count", nullable = false)
    private Integer gamesCount;

    /** Normalised JSON array of games; see the class javadoc for the mapping. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", columnDefinition = "jsonb", nullable = false)
    private String payload;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    /**
     * The share link's consent token — {@code BLOK-HISTORY.md} §5.2.
     *
     * <p>NULL means "not shared", which is every record's state until the
     * owner presses "Podijeli". <b>Deliberately not {@link #uuid}</b>: since
     * §5.1 a series is uploaded the moment the player starts a new game, so
     * records exist without their owner ever agreeing to publish them, while
     * the uuid travels through the owner's own URLs and every response they
     * receive. A public route keyed on the uuid would turn a leaked or
     * guessed id into an exposure; the token is the consent, minted by
     * {@code ClaimTokens} (24 SecureRandom bytes, base64-url) and set back to
     * NULL by the revoke.
     *
     * <p>Unique, so {@code BlokSessionRepository.findByShareToken} — the only
     * lookup in this table that is not scoped by {@link #userUid} — is an
     * indexed single-row read. Postgres does not treat NULLs as equal, so any
     * number of un-shared rows coexist under that constraint.
     */
    @Column(name = "share_token", length = 48, unique = true)
    private String shareToken;

    /**
     * Only fires on the JPA path. The upload itself writes through native SQL
     * ({@code BlokSessionRepository.upsertAndRead}) and sets both the uuid and
     * created_at explicitly, precisely because {@code ON CONFLICT … DO UPDATE}
     * cannot go through {@code persist()}.
     */
    @PrePersist
    protected void onCreate() {
        if (uuid == null) uuid = UUID.randomUUID();
    }
}
