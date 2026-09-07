package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.WaiterDto;
import hr.mrodek.apps.bela_turniri.dtos.WaiterInviteRequest;
import hr.mrodek.apps.bela_turniri.dtos.WaiterRedeemRequest;
import hr.mrodek.apps.bela_turniri.dtos.WaiterRedeemResponse;
import hr.mrodek.apps.bela_turniri.model.TournamentWaiter;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.services.TournamentAccess;
import hr.mrodek.apps.bela_turniri.services.WaiterAccessService;
import io.quarkus.security.Authenticated;
import jakarta.annotation.security.PermitAll;
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
import jakarta.ws.rs.core.MediaType;

import java.util.List;

/**
 * Inviting, listing, revoking and redeeming waiter ("konobar") credentials.
 *
 * <pre>
 *   GET    /tournaments/{idOrSlug}/waiter-access                   — organiser: active waiters
 *   POST   /tournaments/{idOrSlug}/waiter-access                   — organiser: invite one, named
 *   DELETE /tournaments/{idOrSlug}/waiter-access/{waiterId}        — organiser: revoke one
 *   POST   /tournaments/{idOrSlug}/waiter-access/revoke-all        — organiser: revoke everyone
 *   POST   /tournaments/{idOrSlug}/waiter-access/redeem            — anonymous: code → session token
 * </pre>
 *
 * <p>The management endpoints are owner/admin only, via {@code loadForEdit}
 * — issuing or withdrawing a credential to venue staff is an act of
 * tournament management. Redemption is {@code @PermitAll} because the whole
 * point is that the person typing the code has no account and never will;
 * the code itself is the credential.
 *
 * <p>Every mutating method is {@code @Transactional}, the list included
 * (it is a plain read, but staying consistent with the rest of this
 * controller costs nothing and rules out a class of "forgot to add it
 * later" bugs).
 */
@Path("/tournaments/{idOrSlug}/waiter-access")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class WaiterAccessController {

    @Inject TournamentAccess access;
    @Inject WaiterAccessService waiter;

    /** Every active waiter of this tournament, oldest invite first. */
    @GET
    @Authenticated
    @Transactional
    public List<WaiterDto> list(@PathParam("idOrSlug") String idOrSlug) {
        Tournaments t = access.loadForEdit(idOrSlug);
        return waiter.listWaiters(t).stream().map(WaiterAccessController::toDto).toList();
    }

    /** Invite one named waiter — mints a fresh four-letter code just for them. */
    @POST
    @Authenticated
    @Transactional
    public WaiterDto invite(
            @PathParam("idOrSlug") String idOrSlug,
            @Valid WaiterInviteRequest body
    ) {
        Tournaments t = access.loadForEdit(idOrSlug);
        TournamentWaiter row = waiter.inviteWaiter(t, body.name(), Boolean.TRUE.equals(body.canEditCjenik()));
        return toDto(row);
    }

    /** Withdraw one waiter's access. Their sessions only — everyone else keeps working. */
    @DELETE
    @Path("/{waiterId}")
    @Authenticated
    @Transactional
    public void revoke(
            @PathParam("idOrSlug") String idOrSlug,
            @PathParam("waiterId") Long waiterId
    ) {
        Tournaments t = access.loadForEdit(idOrSlug);
        waiter.revokeWaiter(t, waiterId);
    }

    /** Withdraw every active waiter's access at once. */
    @POST
    @Path("/revoke-all")
    @Authenticated
    @Transactional
    public void revokeAll(@PathParam("idOrSlug") String idOrSlug) {
        Tournaments t = access.loadForEdit(idOrSlug);
        waiter.revokeAll(t);
    }

    /**
     * Trade four letters for a session token.
     *
     * <p>No auth at all. A wrong code raises {@code IllegalArgumentException}
     * from the service, which the existing mapper renders as the standard
     * 400 {@code ApiError} envelope — the controller has nothing to add.
     *
     * <p>The tournament identity comes back with the token because this is
     * the only moment the client learns which tournament it is now bound
     * to: it typed a code, not a URL.
     */
    @POST
    @Path("/redeem")
    @PermitAll
    @Transactional
    public WaiterRedeemResponse redeem(
            @PathParam("idOrSlug") String idOrSlug,
            @Valid WaiterRedeemRequest body
    ) {
        var result = waiter.redeem(idOrSlug, body == null ? null : body.code());
        Tournaments t = result.tournament();
        return new WaiterRedeemResponse(
                result.token(),
                t.getUuid() != null ? t.getUuid().toString() : null,
                // Nullable by design — legacy rows are slug-backfilled lazily.
                t.getSlug(),
                t.getName(),
                result.canEditCjenik());
    }

    private static WaiterDto toDto(TournamentWaiter w) {
        return new WaiterDto(w.getId(), w.getName(), w.getCode(), w.getCreatedAt(), w.isCanEditCjenik());
    }
}
