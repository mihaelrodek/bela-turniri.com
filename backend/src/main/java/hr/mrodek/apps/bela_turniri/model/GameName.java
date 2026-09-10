package hr.mrodek.apps.bela_turniri.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * A player's <em>ime za igru</em> — the name above their seat at the online
 * card table, chosen separately from the account display name.
 *
 * <h2>Why the key is not a {@link UserProfile}</h2>
 * The online game seats <b>guests</b>: people who never signed in, identified
 * by {@code guest:<64 hex>} — an id the game server derives from a secret the
 * browser stores. A guest has no Firebase account, so the row cannot hang off
 * {@link UserProfile}, whose primary key <em>is</em> the Firebase UID. Keying
 * on the game server's own player id instead covers both kinds of player with
 * one row, and a signed-in user's row here is simply keyed by their UID.
 *
 * <p>That same key is what makes the once-per-7-days limit meaningful: for a
 * guest, the browser secret is the only stable identity in existence, so the
 * name and the limit have to sit on it together or the limit resets with
 * every reload.
 *
 * <p>Written only through {@code PUT /api/internal/profiles/{uid}/game-name},
 * i.e. by the Node game server on the player's behalf — a guest's identity
 * exists nowhere else, so there is no user-facing write path to mirror.
 */
@Entity
@Table(name = "game_names")
@Getter @Setter @NoArgsConstructor
public class GameName {

    /**
     * The game server's id for the player — a Firebase UID, or
     * {@code guest:<64 hex>} for a guest. Untrusted input from another
     * service: {@code GameNameService} checks its shape and length before it
     * reaches a query, and the column width caps it a second time.
     */
    @Id
    @Column(name = "game_uid", length = 128)
    private String gameUid;

    /** At most 16 characters — the protocol's {@code LIMITS.playerNameMax}. */
    @Column(name = "name", length = 16, nullable = false)
    private String name;

    /**
     * When the name was last actually changed, and the instant the 7-day rule
     * counts from.
     *
     * <p>Not {@code @UpdateTimestamp}: this must move when — and only when —
     * a change is accepted. A re-submission of the identical name (the game
     * server retrying after a dropped response) leaves it alone, which is what
     * keeps that retry from silently costing the player a week.
     */
    @Column(name = "changed_at", nullable = false)
    private OffsetDateTime changedAt;
}
