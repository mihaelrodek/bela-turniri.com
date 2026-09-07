package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.DrinkPriceDto;
import hr.mrodek.apps.bela_turniri.dtos.SaveDrinkPricesRequest;
import hr.mrodek.apps.bela_turniri.services.CjenikService;
import hr.mrodek.apps.bela_turniri.services.CurrentUser;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;

/**
 * Per-user reusable cjenik templates.
 *
 *   GET    /user/me/drink-templates                 — list names
 *   GET    /user/me/drink-templates/{name}/items    — items in one template
 *   PUT    /user/me/drink-templates/{name}/items    — replace items (creates if new)
 *   POST   /user/me/drink-templates/{name}/rename   — rename template
 *   DELETE /user/me/drink-templates/{name}          — delete template
 *
 * A user can save many named templates (e.g. "Pivo bar", "Eventi",
 * "Kafić") and pick which to load when seeding a tournament's cjenik.
 */
@Path("/user/me/drink-templates")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserDrinkTemplateController {

    @Inject CjenikService cjenikService;
    @Inject CurrentUser currentUser;
    @Inject hr.mrodek.apps.bela_turniri.services.MessageService messages;

    @GET
    public List<String> listMyTemplateNames() {
        return cjenikService.listTemplateNames(currentUser.requireUid());
    }

    @GET
    @Path("/{name}/items")
    public List<DrinkPriceDto> getTemplateItems(@PathParam("name") String name) {
        return cjenikService.listTemplate(currentUser.requireUid(), name);
    }

    @PUT
    @Path("/{name}/items")
    @Transactional
    public List<DrinkPriceDto> putTemplateItems(
            @PathParam("name") String name,
            @Valid SaveDrinkPricesRequest body
    ) {
        // Same rule as the tournament cjenik PUT: an empty items array
        // clears the template, an absent one is a malformed request. Do not
        // coerce null into "delete everything you saved".
        if (body == null) {
            throw new BadRequestException(messages.t("validation.cjenik.items.required"));
        }
        return cjenikService.replaceTemplate(currentUser.requireUid(), name, body.items());
    }

    @POST
    @Path("/{name}/rename")
    @Transactional
    public Response renameTemplate(
            @PathParam("name") String name,
            @Valid RenameTemplateRequest body
    ) {
        if (body == null || body.newName() == null || body.newName().isBlank()) {
            throw new BadRequestException(messages.t("cjenik.template.newNameRequired"));
        }
        try {
            cjenikService.renameTemplate(currentUser.requireUid(), name, body.newName());
        } catch (IllegalStateException e) {
            return Response.status(Response.Status.CONFLICT).entity(e.getMessage()).build();
        }
        return Response.noContent().build();
    }

    @DELETE
    @Path("/{name}")
    @Transactional
    public Response deleteTemplate(@PathParam("name") String name) {
        cjenikService.deleteTemplate(currentUser.requireUid(), name);
        return Response.noContent().build();
    }

    public record RenameTemplateRequest(String newName) {}
}
