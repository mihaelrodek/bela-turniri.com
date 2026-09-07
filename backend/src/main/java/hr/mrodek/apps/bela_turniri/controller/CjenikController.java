package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.DrinkPriceDto;
import hr.mrodek.apps.bela_turniri.dtos.SaveDrinkPricesRequest;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.services.CjenikService;
import hr.mrodek.apps.bela_turniri.services.CurrentUser;
import hr.mrodek.apps.bela_turniri.services.TournamentAccess;
import hr.mrodek.apps.bela_turniri.services.WaiterAccessService;
import io.quarkus.security.Authenticated;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

import java.util.List;

/**
 * Per-tournament cjenik (drink price list).
 *
 *   GET    /tournaments/{uuid}/cjenik                       — public read
 *   PUT    /tournaments/{uuid}/cjenik                       — owner or head-waiter replace
 *   POST   /tournaments/{uuid}/cjenik/save-as-template      — owner-only
 *   POST   /tournaments/{uuid}/cjenik/import-template       — owner-only
 *
 * Reads are public so anyone viewing the tournament can see the prices
 * (matches the menu being printed on a board at the venue). Replacing the
 * list is owner/admin — or a waiter invited with
 * {@code TournamentWaiter.canEditCjenik} set, via
 * {@link WaiterAccessService#authorizeCjenikAccess}, the same organiser-or-
 * waiter shape {@code WaiterBillController} uses. {@code @PermitAll} is
 * method-level, not class-level, for the reason documented on that
 * controller: a class-level {@code @PermitAll} eagerly rejects any request
 * carrying an invalid {@code Authorization} header, defeating the "either
 * caller" design for exactly the caller (the organiser) most likely to have
 * a stale one. The template endpoints stay owner-only — they key a
 * per-USER reusable template, and a waiter has no account to key one to.
 *
 * The per-user reusable template lives in {@link UserDrinkTemplateController}.
 */
@Path("/tournaments/{uuid}/cjenik")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class CjenikController {

    /** Bearer credential minted by {@code POST /waiter-access/redeem}. */
    private static final String TOKEN_HEADER = "X-Waiter-Token";

    @Inject CjenikService cjenikService;
    @Inject TournamentAccess access;
    @Inject CurrentUser currentUser;
    @Inject WaiterAccessService waiter;
    @Inject hr.mrodek.apps.bela_turniri.services.MessageService messages;

    @GET
    public List<DrinkPriceDto> getTournamentCjenik(@PathParam("uuid") String uuid) {
        return cjenikService.listForTournament(access.load(uuid).getId());
    }

    /**
     * Replace the tournament's whole price list.
     *
     * <p>An empty {@code items} array is a legitimate "clear the cjenik".
     * An absent body or absent {@code items} is not, and is rejected rather
     * than coerced to an empty list: this endpoint is destructive by design,
     * and a truncated or malformed request must not read as "the organiser
     * asked me to delete every price".
     */
    @PUT
    @PermitAll
    @Transactional
    public List<DrinkPriceDto> putTournamentCjenik(
            @PathParam("uuid") String uuid,
            @HeaderParam(TOKEN_HEADER) String waiterToken,
            @Valid SaveDrinkPricesRequest body
    ) {
        Tournaments t = waiter.authorizeCjenikAccess(uuid, waiterToken);
        // A null items list is caught by @NotNull on the DTO; a null body
        // never reaches bean validation at all, so it is caught here.
        if (body == null) {
            throw new BadRequestException(messages.t("validation.cjenik.items.required"));
        }
        return cjenikService.replaceTournamentCjenik(t, body.items());
    }

    @POST
    @Path("/save-as-template")
    @Authenticated
    @Transactional
    public List<DrinkPriceDto> saveAsTemplate(
            @PathParam("uuid") String uuid,
            @QueryParam("name") String templateName
    ) {
        Tournaments t = access.loadForEdit(uuid);
        if (templateName == null || templateName.isBlank()) {
            throw new BadRequestException(messages.t("cjenik.template.nameRequired"));
        }
        return cjenikService.saveTournamentAsTemplate(t, currentUser.requireUid(), templateName.trim());
    }

    @POST
    @Path("/import-template")
    @Authenticated
    @Transactional
    public List<DrinkPriceDto> importTemplate(
            @PathParam("uuid") String uuid,
            @QueryParam("name") String templateName
    ) {
        Tournaments t = access.loadForEdit(uuid);
        if (templateName == null || templateName.isBlank()) {
            throw new BadRequestException(messages.t("cjenik.template.nameRequired"));
        }
        return cjenikService.importTemplateIntoTournament(t, currentUser.requireUid(), templateName.trim());
    }
}
