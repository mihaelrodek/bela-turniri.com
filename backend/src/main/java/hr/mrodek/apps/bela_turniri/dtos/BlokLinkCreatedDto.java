package hr.mrodek.apps.bela_turniri.dtos;

/**
 * The <b>only</b> response that ever carries a link's write token:
 * {@code POST /blok-links} ({@code BLOK-LINK.md} §7.1).
 *
 * <pre>
 * {
 *   "link":       { …the ordinary BlokLinkDto… },
 *   "writeToken": "ZmFrZS10b2tlbi0zMi1jaGFycw"
 * }
 * </pre>
 *
 * <h2>Why the token is not a field on {@link BlokLinkDto}</h2>
 * {@code writeToken} is a bearer credential: whoever holds it can write this
 * table's score once the organiser approves. {@link BlokLinkDto} is returned
 * by the score endpoint, by {@code GET /blok-links/mine}, by
 * {@code GET /blok-links/{uuid}} and — the one that matters — by the
 * organiser's {@code GET /tournaments/{id}/blok-links}, which lists every
 * link of the tournament to somebody who is not the player. A nullable field
 * on that record would have put the secret one forgotten {@code null} away
 * from every one of those responses.
 *
 * <p>Making it a separate shape means the leak is not a mistake anyone can
 * make quietly: there is no field to fill in, and the token is written into
 * exactly one response by exactly one line of {@code BlokLinkService.request}.
 *
 * <h2>The client's side of the bargain</h2>
 * It is returned <b>once</b> and never again — nothing else on the server can
 * read it back out. A blok that loses it keeps the link only for as long as it
 * has a signed-in account behind it; a signed-out one has to ask for a new
 * link. That is the same deal as the waiter session token this project already
 * mints, and the reason the field sits at the top level of the creation
 * response rather than inside {@link #link}: it belongs to the device, not to
 * the link's public state.
 *
 * @param link       the link itself, in the same shape every other endpoint
 *                   returns it — safe to store as-is
 * @param writeToken the device secret, 32 URL-safe characters from
 *                   {@code ClaimTokens}; send it back as
 *                   {@code X-Blok-Link-Token} on the score, read and revoke
 *                   endpoints
 */
public record BlokLinkCreatedDto(
        BlokLinkDto link,
        String writeToken
) {}
