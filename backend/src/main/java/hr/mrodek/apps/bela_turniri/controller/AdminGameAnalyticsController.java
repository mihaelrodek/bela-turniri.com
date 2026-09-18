package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.AdminGameAnalyticsDto;
import hr.mrodek.apps.bela_turniri.services.GameAnalyticsService;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/admin/game-analytics")
@RolesAllowed("admin")
@Produces(MediaType.APPLICATION_JSON)
public class AdminGameAnalyticsController {
    @Inject GameAnalyticsService analytics;

    @GET
    @Transactional
    public AdminGameAnalyticsDto get() {
        return analytics.aggregate();
    }
}
