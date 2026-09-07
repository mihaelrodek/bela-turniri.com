package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * The name the organiser attaches to a freshly invited waiter — "Ivan",
 * "Konoba Marko" — shown back in the waiter list so codes can be told
 * apart. The code itself is never supplied by the caller; see
 * {@code WaiterAccessService#inviteWaiter}.
 */
public record WaiterInviteRequest(
        // `message` is an i18n bundle key (i18n/messages_*.properties), resolved
        // into the caller's language by errors/ConstraintViolationExceptionMapper.
        @NotBlank(message = "validation.waiter.name.required")
        @Size(max = 60, message = "validation.waiter.name.tooLong")
        String name,
        /** "Gazda konobara" — also unlocks the cjenik. Null on the wire means false. */
        Boolean canEditCjenik
) {}
