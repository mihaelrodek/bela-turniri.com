package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import hr.mrodek.apps.bela_turniri.services.InternalTokenGuard;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

/**
 * How the online game learns a player's REAL name and avatar.
 *
 * <p><b>Not a user endpoint.</b> Full public path:
 * {@code GET /api/internal/profiles/{uid}} — Caddy 404s {@code /api/internal/*}
 * from the outside, and {@link InternalTokenGuard} is the second layer.
 *
 * <h2>Why this exists</h2>
 * The Node game server authenticates players by verifying their Firebase ID
 * token, so the only identity it can see is what Google put in the claims:
 * {@code name} and {@code picture}. That is the GOOGLE ACCOUNT photo, not the
 * avatar the user uploaded here — so a player who set a picture in their
 * profile still showed up at the card table with their Google one (reported
 * 2026-09-08). The game server has no database of its own and no business
 * getting one, so it asks this endpoint instead, exactly like it reports
 * finished games to {@code /internal/game-results}.
 *
 * <p>Returns 200 with nulls rather than 404 for an unknown uid: "this user has
 * no profile row yet" is a normal state (profiles are created lazily by
 * {@code SlugService.ensureProfile}), and the caller's fallback is the same
 * either way — keep the token's own claims.
 */
@Path("/internal/profiles")
@Produces(MediaType.APPLICATION_JSON)
public class GameProfilesInternalController {

    @Inject UserProfileRepository profiles;
    @Inject InternalTokenGuard guard;

    /**
     * What the game server needs to render a seat: nothing more.
     *
     * @param displayName the name set in this app, or null to keep the token's
     * @param avatarUrl   proxied avatar path ({@code /api/resources/{id}/image}),
     *                    or null when the user never uploaded one. Relative on
     *                    purpose — the game client is served from the same
     *                    origin, so the browser resolves it without the
     *                    backend having to know its own public URL.
     */
    public record GameProfileResponse(String displayName, String avatarUrl) {}

    /**
     * {@code @Transactional} because the avatar is a LAZY association: reading
     * {@code profile.getAvatar().getId()} outside a transaction throws.
     */
    @GET
    @Path("/{uid}")
    @Transactional
    public GameProfileResponse get(@HeaderParam(InternalTokenGuard.TOKEN_HEADER) String token,
                                   @PathParam("uid") String uid) {
        guard.require(token);
        return profiles.findByUid(uid)
                .map(p -> new GameProfileResponse(
                        p.getDisplayName(),
                        p.getAvatar() != null && p.getAvatar().getId() != null
                                ? "/api/resources/" + p.getAvatar().getId() + "/image"
                                : null))
                .orElseGet(() -> new GameProfileResponse(null, null));
    }
}
