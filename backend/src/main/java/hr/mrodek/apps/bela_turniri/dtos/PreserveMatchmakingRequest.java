package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.NotNull;

public record PreserveMatchmakingRequest(
        // `message` is an i18n bundle key (i18n/messages_*.properties), resolved
        // into the caller's language by errors/ConstraintViolationExceptionMapper.
        @NotNull(message = "validation.preserveMatchmaking.required")
        Boolean preserveMatchmaking
) {}
