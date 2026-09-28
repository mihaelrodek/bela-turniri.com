package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.services.RequestLocale;
import hr.mrodek.apps.bela_turniri.services.ReverseGeocodeService;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.Map;

/**
 * {@code GET /api/geocode/reverse?lat=&lng=} — the map picker's click → address.
 *
 * <p>Signed-in only (only organisers creating or editing a tournament use the
 * picker) so an anonymous caller cannot spend the Google quota. Answers
 * 204 when Google is not configured or finds nothing; the SPA then falls
 * back to Nominatim itself.
 */
@Path("/geocode")
@Produces(MediaType.APPLICATION_JSON)
public class GeocodeController {

    @Inject ReverseGeocodeService reverseGeocode;
    @Inject RequestLocale requestLocale;

    @GET
    @Path("/reverse")
    @Authenticated
    public Response reverse(@QueryParam("lat") Double lat, @QueryParam("lng") Double lng) {
        if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw new BadRequestException("lat/lng out of range");
        }
        return reverseGeocode.reverse(lat, lng, requestLocale.get())
                .map(address -> Response.ok(Map.of("displayName", address)).build())
                .orElseGet(() -> Response.noContent().build());
    }
}
