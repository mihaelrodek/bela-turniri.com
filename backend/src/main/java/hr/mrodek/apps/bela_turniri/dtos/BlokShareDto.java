package hr.mrodek.apps.bela_turniri.dtos;

/**
 * Answer of {@code POST /user/me/blok-history/{uuid}/share} —
 * {@code BLOK-HISTORY.md} §5.2.
 *
 * <pre>
 * { "token": "kK3s9Qv1nP0aZ7xR2mYb8LdT4cWfH6uE" }
 * </pre>
 *
 * <p>One field on purpose. The public page lives at the SPA route
 * {@code /blok/z/{token}} (§5.2) and the backend reads it back at
 * {@code GET /api/blok-share/{token}}; both are built by the client from this
 * string, so no absolute URL is minted here and a route rename does not become
 * a backend change.
 *
 * <p>The token is <b>stable</b>: asking to share a record that is already
 * shared returns the token it already has rather than a fresh one, so a link
 * the player has already sent to the table keeps working. Only the DELETE
 * invalidates it.
 */
public record BlokShareDto(
        /** 32 URL-safe characters from {@code ClaimTokens}; never the record's uuid. */
        String token
) {}
