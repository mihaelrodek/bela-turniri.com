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
        String slug,

        /**
         * Read-only proxied URL for the user's avatar (e.g. "/api/resources/42/image"),
         * or {@code null} when the user hasn't uploaded one. Set on read paths;
         * incoming PUT bodies leave it null and it's ignored by the server.
         */
        String avatarUrl
) {
    /** Two-arg convenience for callers that only manage phone fields. */
    public UserProfileDto(String phoneCountry, String phone) {
        this(phoneCountry, phone, null, null, null);
    }

    /**
     * Four-arg convenience preserves existing call sites that don't yet
     * touch the avatar field. Adds {@code avatarUrl=null}.
     */
    public UserProfileDto(String phoneCountry, String phone, String displayName, String slug) {
        this(phoneCountry, phone, displayName, slug, null);
    }
}
