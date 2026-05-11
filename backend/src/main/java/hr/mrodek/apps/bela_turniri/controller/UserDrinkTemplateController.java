package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.DrinkPriceDto;
import hr.mrodek.apps.bela_turniri.dtos.SaveDrinkPricesRequest;
import hr.mrodek.apps.bela_turniri.services.CjenikService;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.List;

/**
 * Per-user reusable cjenik template.
 *
 *   GET  /user/me/drink-template
 *   PUT  /user/me/drink-template
 *
 * Saved here by "Spremi kao predložak" on a tournament's cjenik tab;
 * pulled into a new tournament's cjenik by "Učitaj predložak". One
 * template per user — there's no list/CRUD on individual rows; the
 * PUT replaces the whole list.
 */
@Path("/user/me/drink-template")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserDrinkTemplateController {

    @Inject CjenikService cjenikService;
    @Inject JsonWebToken jwt;

    @GET
    public List<DrinkPriceDto> getMyTemplate() {
        return cjenikService.listTemplate(jwt.getSubject());
    }

    @PUT
    @Transactional
    public List<DrinkPriceDto> putMyTemplate(SaveDrinkPricesRequest body) {
        return cjenikService.replaceTemplate(
                jwt.getSubject(),
                body == null || body.items() == null ? List.of() : body.items()
        );
    }
}
