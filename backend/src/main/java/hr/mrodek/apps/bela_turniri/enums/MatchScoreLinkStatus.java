package hr.mrodek.apps.bela_turniri.enums;

/**
 * Lifecycle of a "blok ↔ stol" link (see {@code BLOK-LINK.md}).
 *
 * <p>{@link #PENDING} and {@link #APPROVED} are the two <em>active</em>
 * states: the partial unique index {@code uq_msl_active_per_match} allows at
 * most one row in either of them per match. {@link #REJECTED} and
 * {@link #REVOKED} are terminal and are kept as history — a link is never
 * deleted, so the organiser can see that a request was turned down and the
 * player can see why their blok stopped syncing.
 */
public enum MatchScoreLinkStatus {
    /** Requested by a player, waiting for the organiser. */
    PENDING,
    /** Organiser said yes — the requester may now write the match score. */
    APPROVED,
    /** Organiser said no. */
    REJECTED,
    /**
     * Withdrawn: by the requester ("I picked the wrong table"), by the
     * organiser, or automatically when the round completed / the tournament
     * finished under an approved link (see BLOK-LINK.md §2.3(2)).
     */
    REVOKED
}
