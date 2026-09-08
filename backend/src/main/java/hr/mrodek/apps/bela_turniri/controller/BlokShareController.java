package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.BlokSessionDto;
import hr.mrodek.apps.bela_turniri.services.BlokHistoryService;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

/**
 * The public side of a shared blok scorepad — {@code BLOK-HISTORY.md} §5.2.
 *
 * <pre>
 *   GET /blok-share/{token}    the shared series, no sign-in
 * </pre>
 *
 * <p>Deliberately <b>not</b> {@code @Authenticated} and deliberately on its
 * own resource rather than as a branch of {@link BlokHistoryController}: that
 * class carries a class-level {@code @Authenticated}, and a public method
 * hidden inside it would be one careless refactor away from either leaking the
 * private endpoints or breaking this one. With {@code quarkus.http.auth.
 * proactive=false} an unannotated resource is anonymous, so this file's whole
 * security posture is "there is nothing here to authenticate <em>with</em>".
 *
 * <h2>Why the path takes a token and not a uuid</h2>
 * Since §5.1 a series is uploaded the moment the player starts a new game, so
 * <b>every record in the table exists without its owner ever having agreed to
 * publish it</b>. The record's {@code uuid} meanwhile travels through the
 * owner's own URLs and every API response they receive. If this route took a
 * uuid, a leaked or guessed one would expose a scorepad nobody consented to
 * share. The {@code share_token} is that consent: a separate {@code
 * SecureRandom} string that does not exist until the owner presses "Podijeli"
 * and is set back to NULL when they stop sharing. A uuid handed to this
 * endpoint matches no token and answers <b>404</b> — the same answer as an
 * invented or revoked token, so nothing here ever confirms that a record
 * exists.
 *
 * <h2>No Cache-Control, on purpose</h2>
 * This endpoint is not in {@code PublicReadCacheFilter}'s whitelist and sets
 * no cache headers of its own. Revocation has to be immediate — §5.2's
 * "poveznica prestaje raditi" — and an {@code s-maxage} would let Caddy keep
 * serving a revoked scorepad from the edge for the length of the window. The
 * body is also live: the series grows with every game the owner saves, so a
 * cached copy would show the table a stale score. Rate limiting is left to
 * Caddy's existing {@code /api/*} zone; there is nothing to enumerate here
 * that a per-endpoint limit would protect, since the key is 24 bytes of
 * {@code SecureRandom} and the lookup is a single indexed read.
 */
@Path("/blok-share/{token}")
@Produces(MediaType.APPLICATION_JSON)
public class BlokShareController {

    @Inject BlokHistoryService history;

    /**
     * The shared series: the same shape as {@code GET
     * /user/me/blok-history/{uuid}} — same field names, same order — with
     * {@code uuid} and {@code sessionId} blanked, because they are the
     * owner's private handles to the record and a viewer needs neither to read
     * a scorepad. Nothing identifying the owner was ever in this DTO: no uid,
     * no e-mail, no display name, no profile slug. What a viewer gets is the
     * series result, every game and every deal, and the two side names the
     * player typed themselves.
     *
     * <p>404 for an unknown, revoked or malformed token, and for a uuid.
     */
    @GET
    @Transactional
    public BlokSessionDto shared(@PathParam("token") String token) {
        return history.getShared(token);
    }
}
