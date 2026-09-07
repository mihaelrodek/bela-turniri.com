package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /contact} — the public "javi nam se" form.
 *
 * <p>Every {@code message =} attribute is an i18n bundle key
 * ({@code i18n/messages_*.properties}), resolved into the caller's language by
 * {@code errors/ConstraintViolationExceptionMapper}; never literal Croatian.
 *
 * @param website honeypot. A real browser never sees this field (the form
 *                hides it), so anything in it means a bot filled the form in
 *                blind. The controller answers 202 as if all were well and
 *                does nothing — telling a spammer their submission was
 *                rejected only teaches them to stop filling it in. It carries
 *                no validation constraints for the same reason: a 400 would
 *                be a signal too.
 */
public record ContactRequest(
        @NotBlank(message = "validation.contact.name.required")
        @Size(max = 120, message = "validation.contact.name.max")
        String name,

        @NotBlank(message = "validation.contact.email.required")
        @Email(message = "validation.contact.email.invalid")
        @Size(max = 200, message = "validation.contact.email.max")
        String email,

        @Size(max = 200, message = "validation.contact.subject.max")
        String subject,

        @NotBlank(message = "validation.contact.message.required")
        @Size(max = 4000, message = "validation.contact.message.max")
        String message,

        String website
) {}
