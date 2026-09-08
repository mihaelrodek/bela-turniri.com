package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.BlokSessionDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokSessionSummaryDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokShareDto;
import hr.mrodek.apps.bela_turniri.dtos.SaveBlokSessionRequest;
import hr.mrodek.apps.bela_turniri.services.BlokHistoryService;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;
import java.util.UUID;

/**
 * The player's own blok history — {@code BLOK-HISTORY.md} §3.2.
 *
 * <pre>
 *   POST   /user/me/blok-history                  store or refresh one series, keyed by sessionId
 *   GET    /user/me/blok-history?limit=&amp;offset=   summaries, newest first, no payload
 *   GET    /user/me/blok-history/{uuid}           the full series, games and deals
 *   DELETE /user/me/blok-history/{uuid}           delete one of my own
 *   POST   /user/me/blok-history/{uuid}/share     issue (or return) the share token — §5.2
 *   DELETE /user/me/blok-history/{uuid}/share     revoke it
 * </pre>
 *
 * <p>The public half of the share flow is deliberately <b>not</b> here: it is
 * {@link BlokShareController}, on its own path, keyed on the token and not on
 * the uuid.
 *
 * <p>{@code @Authenticated} sits on the class, like {@link UserMeController}:
 * this is private data with no public shape at all, and the section that
 * renders it is hidden even on another user's profile. Ownership is taken
 * from the verified token inside the service ({@code currentUser.requireUid()})
 * and never from the request — a foreign uuid is answered <b>404, not 403</b>,
 * so the caller cannot learn that someone else's record exists.
 *
 * <p>{@code @Transactional} sits here rather than in the service, per this
 * codebase's convention.
 */
@Path("/user/me/blok-history")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class BlokHistoryController {

    @Inject BlokHistoryService history;

    /**
     * Store one series, or bring the stored one up to date.
     *
     * <p><b>Always 200, never 201</b> — including the first time. Two
     * different clients' behaviours land here: a retry of an unconfirmed
     * upload (§3.1) and, since §5.1, the same series re-sent one game longer
     * every time the player starts a new game. Neither can distinguish "the
     * request never arrived" from "the response never came back", so the first
     * attempt and the fifth have to be indistinguishable: same status, same
     * body shape, same uuid. Handing back a 201 once and a 200 afterwards
     * would invite a client to treat the repeat as an anomaly, when it is the
     * designed behaviour.
     *
     * <p>The response is the full stored record — the updated one on a repeat
     * — so the blok can confirm what landed before dropping its local copy.
     */
    @POST
    @Transactional
    public BlokSessionDto save(@Valid SaveBlokSessionRequest body) {
        return history.save(body);
    }

    /**
     * The history list: summaries only, newest upload first.
     *
     * <p>This deliberately never reads the {@code payload} column — the
     * repository projects the summary columns explicitly (§3.1). Paging
     * parameters are clamped, not rejected: {@code limit} to 1..100
     * (default 20), {@code offset} to ≥ 0. A short page means the end.
     */
    @GET
    @Transactional
    public List<BlokSessionSummaryDto> list(@QueryParam("limit") Integer limit,
                                            @QueryParam("offset") Integer offset) {
        return history.list(limit, offset);
    }

    /** One full series: the games and every deal inside them. 404 if it is not yours. */
    @GET
    @Path("/{uuid}")
    @Transactional
    public BlokSessionDto one(@PathParam("uuid") UUID uuid) {
        return history.get(uuid);
    }

    /**
     * Delete one of the caller's own series. 404 if it is not yours.
     *
     * <p>{@code @Consumes(WILDCARD)} overrides the class-level JSON: this
     * method takes no body, and the class annotation otherwise answers 415 —
     * before the auth check — to any client that sends a DELETE without a
     * {@code Content-Type}. The same trap was removed from
     * {@link BlokLinkController#revoke}.
     */
    @DELETE
    @Path("/{uuid}")
    @Consumes(MediaType.WILDCARD)
    @Transactional
    public Response delete(@PathParam("uuid") UUID uuid) {
        history.delete(uuid);
        return Response.noContent().build();
    }

    /* ---------------------- sharing (§5.2) ---------------------- */

    /**
     * Publish this series and answer {@code {"token": "…"}}.
     *
     * <p><b>Idempotent, and that is load-bearing.</b> A record that is already
     * shared returns the token it already has: the player shares the running
     * series with the table and keeps playing, so this is called again and
     * again against a record whose link is already in somebody's chat. Minting
     * a fresh token here would silently kill every link already sent.
     *
     * <p>404 for a uuid that is unknown or belongs to someone else, like every
     * other method on this resource — never 403.
     *
     * <p>{@code @Consumes(WILDCARD)} for the reason spelled out on
     * {@link #delete}: this POST has no body, and the class-level
     * {@code @Consumes(JSON)} would answer 415 — before the auth check — to a
     * client that sends none and sets no {@code Content-Type}.
     */
    @POST
    @Path("/{uuid}/share")
    @Consumes(MediaType.WILDCARD)
    @Transactional
    public BlokShareDto share(@PathParam("uuid") UUID uuid) {
        return history.share(uuid);
    }

    /**
     * Revoke the share link: the token is cleared and
     * {@code GET /blok-share/{token}} answers 404 from then on.
     *
     * <p>204, and idempotent — revoking a series that was never shared
     * succeeds, because the caller asked for a state they already have. 404
     * still means the record itself is unknown or not theirs.
     */
    @DELETE
    @Path("/{uuid}/share")
    @Consumes(MediaType.WILDCARD)
    @Transactional
    public Response unshare(@PathParam("uuid") UUID uuid) {
        history.unshare(uuid);
        return Response.noContent().build();
    }
}
