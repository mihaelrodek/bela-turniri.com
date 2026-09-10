package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.Size;

public record UserProfileDto(
        // `message` is an i18n bundle key (i18n/messages_*.properties), resolved
        // into the caller's language by errors/ConstraintViolationExceptionMapper.
        @Size(max = 8, message = "validation.profile.phoneCountry.max")
        String phoneCountry,

        @Size(max = 50, message = "validation.profile.phone.max")
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
        String avatarUrl,

        /**
         * Per-user theme preference. Accepts "light" or "dark" on PUT;
         * other values get ignored server-side. Null means the user
         * hasn't picked one yet — frontend falls back to its own default.
         */
        @Size(max = 10, message = "validation.profile.colorMode.max")
        String colorMode,

        /**
         * Per-user language preference — a supported BCP-47 base tag ("hr",
         * "sl"). Written through {@code PATCH /user/me/profile/locale} (and
         * accepted on PUT for symmetry with colorMode); unsupported values are
         * rejected server-side. Null means the user hasn't picked one.
         */
        @Size(max = 5, message = "validation.profile.locale.max")
        String locale,

        /**
         * "Ime za igru" — the name this player wears at the online card table,
         * or {@code null} when they have never set one and the account's own
         * display name is used instead.
         *
         * <p>READ-ONLY here, like {@code avatarUrl}, and for a sharper reason:
         * the only write path is the game server's internal endpoint
         * ({@code PUT /internal/profiles/{uid}/game-name}), because the same
         * name and the same once-a-week limit have to cover GUESTS, who have
         * no account and therefore never reach this controller at all. A
         * second writer here would be a second clock on the same rule.
         *
         * <p>It is returned so the profile page can show what the player is
         * called at a table, which is not always what their account is called.
         */
        String gameName
) {
    /** Two-arg convenience for callers that only manage phone fields. */
    public UserProfileDto(String phoneCountry, String phone) {
        this(phoneCountry, phone, null, null, null, null, null, null);
    }

    public UserProfileDto(String phoneCountry, String phone, String displayName, String slug) {
        this(phoneCountry, phone, displayName, slug, null, null, null, null);
    }

    public UserProfileDto(String phoneCountry, String phone, String displayName, String slug, String avatarUrl) {
        this(phoneCountry, phone, displayName, slug, avatarUrl, null, null, null);
    }

    public UserProfileDto(String phoneCountry, String phone, String displayName, String slug,
                          String avatarUrl, String colorMode) {
        this(phoneCountry, phone, displayName, slug, avatarUrl, colorMode, null, null);
    }
}
