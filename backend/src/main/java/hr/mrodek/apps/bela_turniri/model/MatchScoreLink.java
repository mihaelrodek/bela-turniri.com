package hr.mrodek.apps.bela_turniri.model;

import hr.mrodek.apps.bela_turniri.enums.MatchScoreLinkStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A player's local bela blok, linked to one table (= one {@link Matches} row)
 * of a running tournament. See {@code BLOK-LINK.md} §2.1.
 *
 * <p>The link is what lets a non-organiser write a match score — the only
 * place in this application where that happens. It is therefore explicit,
 * per-match, and gated on the organiser approving it: {@link #status} starts
 * at {@code PENDING} and only an {@code APPROVED} row grants the write. What
 * travels that way is the <b>series result</b> — how many games each side has
 * won, the {@code 2 : 1} a tournament match is scored in (§6.1) — not the
 * blok's internal point totals.
 *
 * <p><b>At most one active link per match.</b> Enforced in the database by the
 * partial unique index {@code uq_msl_active_per_match} on {@code match_id}
 * {@code WHERE status IN ('PENDING','APPROVED')} — a second request for the
 * same table is answered {@code 409 LINK_EXISTS} by the service, and the index
 * is the backstop for two requests racing. Rejected and revoked rows stay
 * behind as history and are deliberately outside the index.
 *
 * <p>{@link #tournament} is denormalised (it is reachable through
 * {@code match.tournament}) so the organiser's "all links of this tournament"
 * listing is one indexed query rather than a join through matches and rounds.
 *
 * <p><b>Signing in is not required to ask</b> ({@code BLOK-LINK.md} §7.1).
 * {@link #requestedByUid} is therefore nullable, and {@link #writeToken} is
 * what a signed-out blok proves itself with. Neither changes the defence: the
 * organiser's approval is still the only thing that lets any of it reach the
 * score sheet.
 *
 * <p>{@link #usPair} records <em>which side of the match the requester is</em>.
 * A blok only knows "us" and "them"; the match knows pair1 and pair2. Without
 * this column the organiser would receive two numbers with no way to tell whose
 * is whose. The mapping is chosen once, at request time, and never edited —
 * a player who picked the wrong side revokes the link and asks again.
 */
@Entity
@Table(name = "match_score_links")
@Getter @Setter @NoArgsConstructor
public class MatchScoreLink {

    @Id
    @SequenceGenerator(name = "match_score_links_seq",
            sequenceName = "seq_match_score_links_id", allocationSize = 1)
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "match_score_links_seq")
    private Long id;

    /** The id that travels through the API; the bigint PK never leaves the server. */
    @Column(nullable = false, unique = true)
    private UUID uuid;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "match_id", nullable = false)
    private Matches match;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tournament_id", nullable = false)
    private Tournaments tournament;

    /** Which of the match's two pairs is the requester's own side. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "us_pair_id", nullable = false)
    private Pairs usPair;

    /**
     * Which blok <em>series</em> is being played at this table — the client's
     * own {@code sessionId}, the same string {@code blok_sessions.session_id}
     * holds ({@code BLOK-LINK.md} §6.2).
     *
     * <p>Linking a blok to a table is the player's consent to publish that
     * scorepad, so writing a score through an {@code APPROVED} link mints the
     * series' {@code share_token} (BLOK-HISTORY.md §5.2) — and the server can
     * only find the series to mint it for if the link names one.
     *
     * <p><b>Nullable, and deliberately not a foreign key.</b> A player links
     * the table long before the series has ever been uploaded (uploading needs
     * them to save; linking does not), and may never upload it at all, so the
     * row this string names routinely does not exist — a FK would refuse the
     * ordinary case. Links created before §6.2 have no series either, which is
     * why the score endpoint accepts the id later and adopts it if this is
     * still null.
     *
     * <p>The series is always resolved as {@code (requestedByUid, sessionId)}:
     * a link can only ever reach a series belonging to the player who asked
     * for it, which is where the consent boundary is drawn.
     */
    @Column(name = "session_id", length = 64)
    private String sessionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 16, nullable = false)
    private MatchScoreLinkStatus status = MatchScoreLinkStatus.PENDING;

    /**
     * Firebase UID of the player who asked, or <b>null when they were not
     * signed in</b> ({@code BLOK-LINK.md} §7.1).
     *
     * <p>When it is set it is the only uid allowed to write this link's score.
     * When it is null the link is an anonymous one and {@link #writeToken} is
     * the only thing that can prove the right to write — see that field.
     *
     * <p>Everything that reads this column has to tolerate null: the "my
     * links" listing (a signed-out player has none to list), the decision
     * push (nobody to notify), and the series lookup behind
     * {@code shareToken} (an anonymous player has no profile to keep a
     * scorepad on, which is exactly the difference §7.2 draws between signing
     * in and not).
     */
    @Column(name = "requested_by_uid", length = 64)
    private String requestedByUid;

    /**
     * Per-link bearer secret, minted once by {@code ClaimTokens} when the link
     * is created and returned to the client exactly once, in the creation
     * response ({@code BLOK-LINK.md} §7.1).
     *
     * <p>It exists because §7 made signing in optional: the server still has
     * to know <em>which device</em> is allowed to write this table's score,
     * and for a signed-out player there is no uid to ask. Holding the token
     * proves "I am the blok that asked for this link" and gives exactly one
     * power — writing a score into this one match, and only once an organiser
     * has approved it. It is not an identity: it never makes the caller the
     * link's {@link #requestedByUid}, so it cannot reach that player's
     * profile, their scorepads or any other link.
     *
     * <p><b>Never leaves the server after creation.</b> {@code BlokLinkDto} —
     * the shape the organiser's listing and every read returns — has no field
     * for it, on purpose: the organiser must not be handed a credential that
     * writes as the player, and a listing is the easiest place for a secret
     * to escape.
     *
     * <p>Nullable: links created before §7 have none and still work through
     * their {@code requestedByUid}. Unique, so a token names at most one link.
     */
    @Column(name = "write_token", length = 48, unique = true)
    private String writeToken;

    /**
     * Display name snapshot taken when the request was made, so the organiser's
     * approval list reads "Marko traži stol 4" without a profile join — and
     * still does if the player later renames themselves.
     */
    @Column(name = "requested_by_name", length = 120)
    private String requestedByName;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    /** When the link left {@code PENDING}; null while it is still waiting. */
    @Column(name = "decided_at")
    private OffsetDateTime decidedAt;

    /**
     * Who approved / rejected / revoked it. The organiser for a decision, the
     * requester for a self-revoke, and the requester again for the automatic
     * revoke that fires when the round completes under an approved link.
     */
    @Column(name = "decided_by_uid", length = 64)
    private String decidedByUid;

    @PrePersist
    protected void onCreate() {
        if (uuid == null) uuid = UUID.randomUUID();
        if (status == null) status = MatchScoreLinkStatus.PENDING;
    }

    /** True while the link occupies its match's single active slot. */
    public boolean isActive() {
        return status == MatchScoreLinkStatus.PENDING || status == MatchScoreLinkStatus.APPROVED;
    }
}
