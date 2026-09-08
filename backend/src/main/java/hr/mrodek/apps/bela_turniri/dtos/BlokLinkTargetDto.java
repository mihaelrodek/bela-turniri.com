package hr.mrodek.apps.bela_turniri.dtos;

/**
 * One candidate table for {@code GET /blok-links/targets}. See
 * {@code BLOK-LINK.md} §2.2.
 *
 * <p>Rows that cannot be linked are still returned, with {@link #linkable}
 * false and {@link #reason} carrying the same bare code the POST would have
 * answered with — the player picking a table should see "stol 3 (već
 * povezan)" rather than a table that silently isn't there.
 */
public record BlokLinkTargetDto(
        Long matchId,
        /** Table number as drawn; null only if the round was created without one. */
        Integer tableNo,
        Long roundId,
        Integer roundNumber,

        PairRef pair1,
        /** Null on a BYE row — then {@link #linkable} is false. */
        PairRef pair2,

        boolean linkable,
        /**
         * Why not, when {@link #linkable} is false: {@code MATCH_HAS_BYE} or
         * {@code LINK_EXISTS}. Null when the table is linkable.
         */
        String reason
) {
    /** Just enough of a pair for the player to recognise their own side. */
    public record PairRef(Long id, String name) {}
}
