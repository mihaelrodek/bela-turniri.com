package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SelfRegisterPairRequest(
        // `message` is an i18n bundle key (i18n/messages_*.properties), resolved
        // into the caller's language by errors/ConstraintViolationExceptionMapper.
        @NotBlank(message = "validation.pair.name.required")
        @Size(max = 200, message = "validation.pair.name.max")
        String name,

        /*
         * Optional here on purpose, REQUIRED in the service for an anonymous
         * caller: a signed-in registration already carries a reachable
         * identity (profile, email, push), an anonymous one carries nothing
         * but this number. Making it @NotBlank would break the signed-in path,
         * so the rule lives where it can see who is calling
         * (SelfRegistrationService → CONTACT_PHONE_REQUIRED).
         */
        @Size(max = 32, message = "validation.pair.contactPhone.max")
        String contactPhone
) {
    /** Backwards-compat constructor for callers that predate the phone field. */
    public SelfRegisterPairRequest(String name) {
        this(name, null);
    }
}
