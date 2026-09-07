package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * Add a drink to a match. {@code priceId} references the cjenik row to
 * snapshot from; the snapshot freezes name + unit price at attach time
 * so later cjenik edits don't rewrite history.
 *
 * <p>{@code quantity} is optional and defaults to 1 in the controller, but
 * when supplied it has to be a real count — a zero or negative quantity
 * used to be silently clamped to 1, which quietly recorded a drink nobody
 * ordered.
 */
public record AddMatchDrinkRequest(
        // `message` is an i18n bundle key (i18n/messages_*.properties), resolved
        // into the caller's language by errors/ConstraintViolationExceptionMapper.
        @NotNull(message = "validation.matchDrink.priceId.required")
        Long priceId,

        @Positive(message = "validation.matchDrink.quantity.positive")
        Integer quantity
) {}
