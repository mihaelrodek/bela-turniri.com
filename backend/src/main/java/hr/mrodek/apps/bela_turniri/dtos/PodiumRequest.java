package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.Size;

/**
 * Body for {@code PATCH /tournaments/{uuid}/podium}.
 *
 * <p>Both fields are nullable — the organiser may set just 2nd, just
 * 3rd, both, or neither (which clears the columns). Names are matched
 * case-insensitively against {@code pairs.name} on the backend to
 * surface a clear error when the organiser typos a pair name.
 *
 * <p>The size cap mirrors {@code tournaments.second_place_name} /
 * {@code third_place_name} (both {@code varchar(200)}); without it an
 * over-long name only failed at INSERT time, as a 500.
 */
public record PodiumRequest(
        // `message` is an i18n bundle key (i18n/messages_*.properties), resolved
        // into the caller's language by errors/ConstraintViolationExceptionMapper.
        @Size(max = 200, message = "validation.podium.second.max")
        String secondPlaceName,

        @Size(max = 200, message = "validation.podium.third.max")
        String thirdPlaceName
) {}
