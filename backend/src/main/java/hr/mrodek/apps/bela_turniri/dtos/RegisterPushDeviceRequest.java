package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code PUT /push/device} (and its {@code /user/me/push/device}
 * alias): what a native shell reports after Firebase Messaging hands it a
 * registration token.
 *
 * <p>The constraints back real column widths — {@code platform} is
 * {@code varchar(16)}, {@code locale} {@code varchar(8)},
 * {@code app_version} {@code varchar(32)} — so an oversized value comes back
 * as the standard per-field 400 envelope instead of reaching the INSERT and
 * failing as a 500. {@code token} is unbounded in the column but capped here
 * anyway: it is attacker-supplied text that ends up in a text column.
 *
 * <p>{@code message =} attributes are i18n bundle keys, resolved by
 * {@code errors/ConstraintViolationExceptionMapper}.
 */
public record RegisterPushDeviceRequest(

        @NotBlank(message = "validation.push.device.token.required")
        @Size(max = 4096, message = "validation.push.device.token.max")
        String token,

        /** {@code ios} or {@code android}; validated for real in PushDeviceService. */
        @NotBlank(message = "validation.push.device.platform.required")
        @Size(max = 16, message = "validation.push.device.platform.max")
        String platform,

        /** The device's own language, a fallback hint only. Optional. */
        @Size(max = 8, message = "validation.push.device.locale.max")
        String locale,

        /** Shell build that registered. Optional, diagnostics only. */
        @Size(max = 32, message = "validation.push.device.appVersion.max")
        String appVersion
) {}
