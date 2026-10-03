package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.AddMatchDrinkRequest;
import hr.mrodek.apps.bela_turniri.dtos.ExtraBillLabelRequest;
import hr.mrodek.apps.bela_turniri.dtos.MatchBillDto;
import hr.mrodek.apps.bela_turniri.dtos.SetPaidRequest;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.services.CurrentUser;
import hr.mrodek.apps.bela_turniri.services.ExtraBillService;
import hr.mrodek.apps.bela_turniri.services.IdempotencyService;
import hr.mrodek.apps.bela_turniri.services.MessageService;
import hr.mrodek.apps.bela_turniri.services.WaiterAccessService;
import hr.mrodek.apps.bela_turniri.services.WaiterCallerIdentity;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/**
 * 2026-10-03: "Ostalo" bills — bills of a tournament that belong to no
 * match. The list entries come from the existing
 * {@code GET …/waiter/bills} (kind {@code EXTRA}); this controller holds the
 * rest.
 *
 * <pre>
 *   POST   /tournaments/{idOrSlug}/waiter/extra-bills                       — create {label?}
 *   GET    /tournaments/{idOrSlug}/waiter/extra-bills/{id}                  — full bill (MatchBillDto)
 *   PATCH  /tournaments/{idOrSlug}/waiter/extra-bills/{id}                  — rename {label?}
 *   DELETE /tournaments/{idOrSlug}/waiter/extra-bills/{id}                  — waiter: only while empty
 *   POST   /tournaments/{idOrSlug}/waiter/extra-bills/{id}/drinks           — add a drink
 *   DELETE /tournaments/{idOrSlug}/waiter/extra-bills/{id}/drinks/{drinkId} — undo one
 *   PATCH  /tournaments/{idOrSlug}/waiter/extra-bills/{id}/paid             — settle / unsettle
 * </pre>
 *
 * A separate class (and path) from {@code WaiterBillController} so a literal
 * {@code extra-bills} segment can never be confused with its {@code {matchId}}
 * routes. Auth, idempotency and per-method {@code @PermitAll} follow that
 * controller exactly — read its class comment for why each is needed:
 * organiser session OR live {@code X-Waiter-Token}; mutating calls honour
 * {@code X-Client-Op-Id}; the bill id is always resolved inside the
 * authorised tournament (404 otherwise).
 */
@Path("/tournaments/{idOrSlug}/waiter/extra-bills")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class WaiterExtraBillController {

    private static final String TOKEN_HEADER = "X-Waiter-Token";
    private static final String BASE = "/tournaments/{idOrSlug}/waiter/extra-bills";

    @Inject WaiterAccessService waiter;
    @Inject ExtraBillService extras;
    @Inject IdempotencyService idempotency;
    @Inject MessageService messages;
    @Inject CurrentUser currentUser;
    @Inject WaiterCallerIdentity callerIdentity;

    @POST
    @PermitAll
    @Transactional
    public Response create(
            @PathParam("idOrSlug") String idOrSlug,
            @HeaderParam(TOKEN_HEADER) String token,
            @HeaderParam("X-Client-Op-Id") String clientOpId,
            @Valid ExtraBillLabelRequest body
    ) {
        Tournaments t = waiter.authorizeBillAccess(idOrSlug, token).tournament();
        String label = body == null ? null : body.label();
        return idempotency.execute(clientOpId, callerIdentity.of(token), "POST " + BASE,
                () -> Response.ok(extras.create(t, label)).build());
    }

    @GET
    @Path("/{id}")
    @PermitAll
    public MatchBillDto get(
            @PathParam("idOrSlug") String idOrSlug,
            @PathParam("id") Long id,
            @HeaderParam(TOKEN_HEADER) String token
    ) {
        Tournaments t = waiter.authorizeBillAccess(idOrSlug, token).tournament();
        return extras.getBill(t, id);
    }

    @PATCH
    @Path("/{id}")
    @PermitAll
    @Transactional
    public Response rename(
            @PathParam("idOrSlug") String idOrSlug,
            @PathParam("id") Long id,
            @HeaderParam(TOKEN_HEADER) String token,
            @HeaderParam("X-Client-Op-Id") String clientOpId,
            @Valid ExtraBillLabelRequest body
    ) {
        Tournaments t = waiter.authorizeBillAccess(idOrSlug, token).tournament();
        extras.requireOfTournament(t, id);
        String label = body == null ? null : body.label();
        return idempotency.execute(clientOpId, callerIdentity.of(token), "PATCH " + BASE + "/{id}",
                () -> Response.ok(extras.rename(t, id, label)).build());
    }

    @DELETE
    @Path("/{id}")
    @PermitAll
    @Transactional
    public Response delete(
            @PathParam("idOrSlug") String idOrSlug,
            @PathParam("id") Long id,
            @HeaderParam(TOKEN_HEADER) String token,
            @HeaderParam("X-Client-Op-Id") String clientOpId
    ) {
        WaiterAccessService.Caller caller = waiter.authorizeBillAccess(idOrSlug, token);
        Tournaments t = caller.tournament();
        extras.requireOfTournament(t, id);
        return idempotency.execute(clientOpId, callerIdentity.of(token), "DELETE " + BASE + "/{id}",
                () -> {
                    extras.delete(t, id, caller.isOrganiser());
                    return Response.noContent().build();
                });
    }

    @POST
    @Path("/{id}/drinks")
    @PermitAll
    @Transactional
    public Response addDrink(
            @PathParam("idOrSlug") String idOrSlug,
            @PathParam("id") Long id,
            @HeaderParam(TOKEN_HEADER) String token,
            @HeaderParam("X-Client-Op-Id") String clientOpId,
            @Valid AddMatchDrinkRequest body
    ) {
        Tournaments t = waiter.authorizeBillAccess(idOrSlug, token).tournament();
        extras.requireOfTournament(t, id);
        if (body == null) {
            throw new BadRequestException(messages.t("matchBill.priceIdRequired"));
        }
        int qty = body.quantity() == null ? 1 : body.quantity();
        return idempotency.execute(clientOpId, callerIdentity.of(token), "POST " + BASE + "/{id}/drinks",
                () -> Response.ok(extras.addDrink(t, id, body.priceId(), qty)).build());
    }

    @DELETE
    @Path("/{id}/drinks/{drinkId}")
    @PermitAll
    @Transactional
    public Response removeDrink(
            @PathParam("idOrSlug") String idOrSlug,
            @PathParam("id") Long id,
            @PathParam("drinkId") Long drinkId,
            @HeaderParam(TOKEN_HEADER) String token,
            @HeaderParam("X-Client-Op-Id") String clientOpId
    ) {
        Tournaments t = waiter.authorizeBillAccess(idOrSlug, token).tournament();
        extras.requireOfTournament(t, id);
        return idempotency.execute(clientOpId, callerIdentity.of(token), "DELETE " + BASE + "/{id}/drinks/{drinkId}",
                () -> Response.ok(extras.removeDrink(t, id, drinkId)).build());
    }

    /** Same "who settled it" rules as {@code WaiterBillController#setPaid}: uid only for the organiser, name always. */
    @PATCH
    @Path("/{id}/paid")
    @PermitAll
    @Transactional
    public Response setPaid(
            @PathParam("idOrSlug") String idOrSlug,
            @PathParam("id") Long id,
            @HeaderParam(TOKEN_HEADER) String token,
            @HeaderParam("X-Client-Op-Id") String clientOpId,
            @Valid SetPaidRequest body
    ) {
        WaiterAccessService.Caller caller = waiter.authorizeBillAccess(idOrSlug, token);
        Tournaments t = caller.tournament();
        extras.requireOfTournament(t, id);
        boolean paid = body != null && body.paid();
        String actorName = caller.isOrganiser() ? currentUser.displayName() : caller.waiter().getName();
        return idempotency.execute(clientOpId, callerIdentity.of(token), "PATCH " + BASE + "/{id}/paid",
                () -> Response.ok(paid
                        ? extras.markPaid(t, id, currentUser.uidOrNull(), actorName)
                        : extras.markUnpaid(t, id)).build());
    }
}
