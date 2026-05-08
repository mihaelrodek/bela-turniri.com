package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.Size;

public record UserProfileDto(
        @Size(max = 8, message = "phoneCountry must be at most 8 characters")
        String phoneCountry,

        @Size(max = 50, message = "phone must be at most 50 characters")
        String phone,

        // Read-only fields — populated via /user/me/sync. Returned alongside
        // contact info so the frontend can link straight to /profile/{slug}.
        String displayName,
        String slug
) {
    /** Two-arg constructor preserved for callers that only manage phone fields. */
    public UserProfileDto(String phoneCountry, String phone) {
        this(phoneCountry, phone, null, null);
    }
}
