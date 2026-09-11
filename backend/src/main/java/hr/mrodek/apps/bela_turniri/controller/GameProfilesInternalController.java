package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.SetGameNameRequest;
import hr.mrodek.apps.bela_turniri.model.GameName;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import hr.mrodek.apps.bela_turniri.services.AvatarPresetService;
import hr.mrodek.apps.bela_turniri.services.GameNameService;
import hr.mrodek.apps.bela_turniri.services.InternalTokenGuard;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

/**
 * How the online game learns a player's REAL name and avatar, and where their
 * in-game name is set.
 *
 * <p><b>Not a user endpoint.</b> Full public paths:
 * {@code GET /api/internal/profiles/{uid}} and
 * {@code PUT /api/internal/profiles/{uid}/game-name} — Caddy 404s
 * {@code /api/internal/*} from the outside, and {@link InternalTokenGuard} is
 * the second layer.
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
 *
 * <h2>Two kinds of player, one uid</h2>
 * The {@code uid} in the path is whatever the game server knows the player by:
 * a Firebase UID for someone signed in, {@code guest:<64 hex>} for a guest who
 * never did. Only the first of those can have a {@code UserProfile}; the
 * in-game name below is keyed on the uid string itself, so it answers for both
 * (see {@link GameNameService}). That is why the game-name lookup here is
 * independent of the profile lookup rather than nested inside it — a guest
 * would otherwise never get their own name back.
 */
@Path("/internal/profiles")
@Produces(MediaType.APPLICATION_JSON)
public class GameProfilesInternalController {

    @Inject UserProfileRepository profiles;
    @Inject GameNameService gameNames;
    @Inject InternalTokenGuard guard;
    @Inject AvatarPresetService avatarPresets;

    /**
     * What the game server needs to render a seat: nothing more.
     *
     * @param displayName the name set in this app, or null to keep the token's
     * @param avatarUrl   proxied avatar path ({@code /api/resources/{id}/image}),
     *                    or null when the user never uploaded one. Relative on
     *                    purpose — the game client is served from the same
     *                    origin, so the browser resolves it without the
     *                    backend having to know its own public URL.
     * @param gameName    the player's chosen <em>ime za igru</em>, or null when
     *                    they have not set one. Present for guests too, who
     *                    have neither of the other two fields.
     * @param avatarPreset id of the drawn character the player picked instead
     *                    of a photo, or null. Appended rather than folded into
     *                    {@code avatarUrl} because the drawings live in the
     *                    frontend and the game client renders them itself —
     *                    there is no URL to point a seat at. Already resolved
     *                    against the photo (see
     *                    {@link AvatarPresetService#presetFor}), so the caller
     *                    draws the photo if it is there and the character
     *                    otherwise, with no rule of its own.
     */
    public record GameProfileResponse(String displayName, String avatarUrl, String gameName,
                                      String avatarPreset) {}

    /**
     * The accepted name plus the two instants the caller needs to render
     * "changeable again in N days" without knowing the rule.
     *
     * @param changedAt    when this name was last actually changed (ISO-8601)
     * @param nextChangeAt when the next change becomes possible (ISO-8601)
     */
    public record GameNameResponse(String gameName, String changedAt, String nextChangeAt) {}

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
        // Resolved before the profile branch below, so a guest — who by
        // definition has no profile row — still gets their name back.
        String gameName = gameNames.nameFor(uid);
        return profiles.findByUid(uid)
                .map(p -> {
                    String avatarUrl = p.getAvatar() != null && p.getAvatar().getId() != null
                            ? "/api/resources/" + p.getAvatar().getId() + "/image"
                            : null;
                    return new GameProfileResponse(
                            p.getDisplayName(),
                            avatarUrl,
                            gameName,
                            avatarPresets.presetFor(p, avatarUrl));
                })
                .orElseGet(() -> new GameProfileResponse(null, null, gameName, null));
    }

    /**
     * Set the player's in-game name, on their behalf.
     *
     * <p>The game server is the only possible caller: for a guest, the identity
     * being written to exists nowhere else, so there is no request the backend
     * could have authenticated instead. The shared secret is the whole gate,
     * and it is checked before the body is read — same reasoning as
     * {@code GameResultsInternalController}, and why {@link SetGameNameRequest}
     * carries no {@code @Valid} constraints for JAX-RS to cascade first.
     *
     * <p>Refusals come out of {@link GameNameService}: a bare 400 code for a
     * name or uid that could never be stored, and a 409 carrying
     * {@code nextChangeAt} when the once-per-7-days rule is what stopped it.
     */
    @PUT
    @Path("/{uid}/game-name")
    @Consumes(MediaType.APPLICATION_JSON)
    @Transactional
    public GameNameResponse setGameName(@HeaderParam(InternalTokenGuard.TOKEN_HEADER) String token,
                                        @PathParam("uid") String uid,
                                        SetGameNameRequest body) {
        guard.require(token);
        if (body == null) throw new BadRequestException("body is required");
        GameName saved = gameNames.set(uid, body.name());
        return new GameNameResponse(
                saved.getName(),
                saved.getChangedAt().toInstant().toString(),
                GameNameService.nextChangeAt(saved).toInstant().toString());
    }
}
