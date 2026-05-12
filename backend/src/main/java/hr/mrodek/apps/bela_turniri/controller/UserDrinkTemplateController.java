package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.DrinkPriceDto;
import hr.mrodek.apps.bela_turniri.dtos.SaveDrinkPricesRequest;
import hr.mrodek.apps.bela_turniri.services.CjenikService;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

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
    @Inject JsonWebToken jwt;

    @GET
    public List<String> listMyTemplateNames() {
        return cjenikService.listTemplateNames(jwt.getSubject());
    }

    @GET
    @Path("/{name}/items")
    public List<DrinkPriceDto> getTemplateItems(@PathParam("name") String name) {
        return cjenikService.listTemplate(jwt.getSubject(), name);
    }

    @PUT
    @Path("/{name}/items")
    @Transactional
    public List<DrinkPriceDto> putTemplateItems(
            @PathParam("name") String name,
            SaveDrinkPricesRequest body
    ) {
        return cjenikService.replaceTemplate(
                jwt.getSubject(),
                name,
                body == null || body.items() == null ? List.of() : body.items()
        );
    }

    @POST
    @Path("/{name}/rename")
    @Transactional
    public Response renameTemplate(
            @PathParam("name") String name,
            RenameTemplateRequest body
    ) {
        if (body == null || body.newName() == null || body.newName().isBlank()) {
            throw new BadRequestException("newName required");
        }
        try {
            cjenikService.renameTemplate(jwt.getSubject(), name, body.newName());
        } catch (IllegalStateException e) {
            return Response.status(Response.Status.CONFLICT).entity(e.getMessage()).build();
        }
        return Response.noContent().build();
    }

    @DELETE
    @Path("/{name}")
    @Transactional
    public Response deleteTemplate(@PathParam("name") String name) {
        cjenikService.deleteTemplate(jwt.getSubject(), name);
        return Response.noContent().build();
    }

    public record RenameTemplateRequest(String newName) {}
}
