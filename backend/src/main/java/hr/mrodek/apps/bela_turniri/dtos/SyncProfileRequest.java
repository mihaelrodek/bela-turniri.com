package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.Size;

/**
 * Sent by the frontend on every login so the backend learns the user's
 * Firebase displayName and can ensure a slug exists for /profile/{slug}.
 *
 * displayName may be blank — the slug service has a fallback for that case.
 */
public record SyncProfileRequest(
        // `message` is an i18n bundle key (i18n/messages_*.properties), resolved
        // into the caller's language by errors/ConstraintViolationExceptionMapper.
        @Size(max = 200, message = "validation.profile.displayName.max")
        String displayName
) {}
