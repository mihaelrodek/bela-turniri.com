package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * Body for {@code POST /tournaments/{uuid}/rounds/manual}.
 *
 * <p>Used when the organiser wants explicit control over who plays whom
 * — typically in the final 1-2 rounds when ≤ 4 pairs are alive and the
 * automatic random draw would produce an undesirable bracket. Each
 * {@link Match} entry becomes one {@code matches} row with the supplied
 * table number; if {@code pair2Id} is null, the row is persisted as a
 * BYE (matching how {@code drawNextRound} models odd counts).
 *
 * @param matches at least one match. Backend validates that every
 *                referenced pair belongs to the tournament, is not
 *                eliminated, and appears in at most one match.
 */
public record ManualRoundRequest(
        @NotEmpty @Valid List<Match> matches
) {
    public record Match(
            @NotNull Long pair1Id,
            /** Nullable — null means BYE (only pair1 plays the round). */
            Long pair2Id,
            /** 1-based table number for display. */
            @NotNull Integer tableNo
    ) {}
}
