package hr.mrodek.apps.bela_turniri.dtos;

/**
 * Body for {@code PATCH /tournaments/{uuid}/podium}.
 *
 * <p>Both fields are nullable — the organiser may set just 2nd, just
 * 3rd, both, or neither (which clears the columns). Names are matched
 * case-insensitively against {@code pairs.name} on the backend to
 * surface a clear error when the organiser typos a pair name.
 */
public record PodiumRequest(
        String secondPlaceName,
        String thirdPlaceName
) {}
