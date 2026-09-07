package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.NotBlank;

/**
 * The four letters the waiter types in. Case and surrounding whitespace are
 * normalised server-side — the code is read off a phone screen or a napkin,
 * and rejecting "abcd " would be a bug, not a security measure.
 */
public record WaiterRedeemRequest(
        // `message` is an i18n bundle key (i18n/messages_*.properties), resolved
        // into the caller's language by errors/ConstraintViolationExceptionMapper.
        @NotBlank(message = "validation.waiter.code.required")
        String code
) {}
