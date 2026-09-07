package hr.mrodek.apps.bela_turniri.dtos;

/**
 * Answer to a successful code redemption.
 *
 * <p>{@code token} is the bearer credential the device stores and sends
 * back in {@code X-Waiter-Token}. The tournament identity travels with it
 * because redemption is the only moment the SPA learns which tournament the
 * waiter is now bound to — it typed a code, not a URL.
 *
 * <p>{@code tournamentSlug} may be null, exactly as elsewhere in the app:
 * slugs landed after the first tournaments did and legacy rows are
 * backfilled lazily. Clients must fall back to the UUID.
 */
public record WaiterRedeemResponse(
        String token,
        String tournamentUuid,
        String tournamentSlug,
        String tournamentName,
        /** "Gazda konobara" — lets this session also replace the cjenik. */
        boolean canEditCjenik
) {}
