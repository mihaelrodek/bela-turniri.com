package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * Score is nullable — a match can be temporarily saved without a decisive result.
 * When both values are present, they must be non-negative and within a sane cap.
 * Bela individual-match totals never exceed a few thousand; 100_000 is an absurdly
 * high defensive ceiling to catch obvious typos / malicious input.
 */
public record UpdateMatchRequest(
        // `message` is an i18n bundle key (i18n/messages_*.properties), resolved
        // into the caller's language by errors/ConstraintViolationExceptionMapper.
        @Min(value = 0, message = "validation.match.score1.negative")
        @Max(value = 100_000, message = "validation.match.score1.tooHigh")
        Integer score1,

        @Min(value = 0, message = "validation.match.score2.negative")
        @Max(value = 100_000, message = "validation.match.score2.tooHigh")
        Integer score2
) {}
