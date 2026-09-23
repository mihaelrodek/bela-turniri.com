package hr.mrodek.apps.bela_turniri.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

/**
 * "Zapis partije" — the full replay of one finished online game
 * (game/README.md §8.8, game/BOT.md → "Zapisi partija").
 *
 * <p>One row per {@link GameResult}: every deal's 32 cards as dealt, the
 * talon split, the bidding, the declarations and all eight tricks with seat
 * attribution. The point of keeping it is the BOT — scenarios written by hand
 * only ever cover positions somebody already thought of, and this is the
 * archive of positions nobody designed.
 *
 * <h2>Why jsonb and not three tables</h2>
 * Same reasoning as {@code BlokSession.payload}: the document is written
 * once, read whole and never queried by a field inside a deal. Everything a
 * listing or a sweep needs — {@link #botVersion}, {@link #sizeBytes},
 * {@link #createdAt} — is a real column, so the export and the retention job
 * never touch the JSON.
 *
 * <p>The field is a {@code String} rather than a {@code JsonNode}: it is
 * stored verbatim as it arrived and handed back verbatim to the NDJSON
 * export, so parsing it into a tree on the way in and re-serialising it on
 * the way out would be pure cost. {@code @JdbcTypeCode(SqlTypes.JSON)} binds
 * it to the {@code jsonb} column, which also means Postgres validates the
 * JSON for us — a malformed body is a 400, not a row.
 *
 * <h2>Optional by design</h2>
 * The replay rides along inside the result POST, but it can be absent: an
 * older game server does not send one, and the reporter drops an implausibly
 * large one rather than losing the result. A game without a replay is a
 * perfectly normal game — {@link GameResult} never depends on this row.
 *
 * <h2>Privacy</h2>
 * Seat names, cards and arithmetic; nothing else. A DEMO seat's internal uid
 * never leaves the game server. On account deletion the leaving user's uid
 * and name are NULLed inside the document
 * ({@code AccountDeletionService}) — the play stays, the person does not.
 */
@Entity
@Table(name = "game_replays")
@Getter @Setter @NoArgsConstructor
public class GameReplay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * The game this is a replay of. Unique, and the FK cascades on delete:
     * a replay of a deleted result would be an orphan with no meaning.
     */
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "game_result_id", nullable = false, unique = true)
    private GameResult gameResult;

    /** The whole document, exactly as the game server sent it. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "replay", columnDefinition = "jsonb", nullable = false)
    private String replay;

    /**
     * {@code BOT_VERSION} from {@code @bela/bots}, lifted out of the document
     * because it is the one field the export groups by ("games played by the
     * 2026-09-23 bot"). Nullable: a reporter that predates the constant, or a
     * hand-inserted row, simply has none.
     */
    @Column(name = "bot_version", length = 32)
    private String botVersion;

    /** Serialised size of {@link #replay} in bytes, for growth monitoring. */
    @Column(name = "size_bytes")
    private Integer sizeBytes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;
}
