package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record UserPairPresetDto(
        UUID uuid,

        @NotBlank(message = "name is required")
        @Size(max = 200, message = "name must be at most 200 characters")
        String name,

        /**
         * Display-time visibility flag. True = the public profile
         * (anyone but the owner) hides participations under this name.
         */
        Boolean hidden,

        /**
         * Co-owner info — populated by the controller when reading
         * presets so the UI can show "Suvlasnik: X". Owner sees their
         * own info under {@code primary*}; null when the preset is
         * unclaimed.
         */
        String coOwnerSlug,
        String coOwnerName,

        /**
         * Share token. Only emitted to the owner of the preset (and
         * to admins); other callers get null. Used to build the
         * /claim-name/{token} URL in the share button.
         */
        String claimToken
) {
    /** Backwards-compat — old 2-arg form used by some callers. */
    public UserPairPresetDto(UUID uuid, String name) {
        this(uuid, name, Boolean.FALSE, null, null, null);
    }

    /** Backwards-compat — old 3-arg form (uuid, name, hidden). */
    public UserPairPresetDto(UUID uuid, String name, Boolean hidden) {
        this(uuid, name, hidden, null, null, null);
    }
}
