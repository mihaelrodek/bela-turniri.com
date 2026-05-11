package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.UserInvoiceDto;
import hr.mrodek.apps.bela_turniri.services.MatchBillService;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.List;

/**
 * Personal invoice history — every match the current user played that
 * has a bill (drinks attached or already paid). Returned newest-first.
 *
 * Private endpoint: scoped to {@code jwt.getSubject()}; there's no
 * endpoint to look up someone else's invoices.
 */
@Path("/user/me/invoices")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class UserInvoicesController {

    @Inject MatchBillService billService;
    @Inject JsonWebToken jwt;

    @GET
    public List<UserInvoiceDto> myInvoices() {
        return billService.listInvoicesForUser(jwt.getSubject());
    }
}
