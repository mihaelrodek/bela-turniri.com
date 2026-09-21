package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.AdminGameAnalyticsDto;
import hr.mrodek.apps.bela_turniri.dtos.AdminGamePlayersDto;
import hr.mrodek.apps.bela_turniri.services.GameAnalyticsService;
import hr.mrodek.apps.bela_turniri.services.GameStatsService;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;

@Path("/admin/game-analytics")
@RolesAllowed("admin")
@Produces(MediaType.APPLICATION_JSON)
public class AdminGameAnalyticsController {
    @Inject GameAnalyticsService analytics;
    @Inject GameStatsService gameStats;

    @GET
    @Transactional
    public AdminGameAnalyticsDto get() {
        return analytics.aggregate();
    }

    /**
     * Who played, and how much — a SEPARATE resource from the aggregate above
     * because it reads a different table ({@code game_result_players}, the
     * finished games) rather than the analytics event log, and because the
     * dashboard should not pay for a per-player scan on every poll of the
     * summary tiles.
     *
     * <p>Capped and sorted by games desc; the response still carries the true
     * distinct player count, so the heading never lies about the cap.
     */
    @GET
    @Path("/players")
    @Transactional
    public AdminGamePlayersDto players(@QueryParam("limit") @DefaultValue("200") int limit) {
        return gameStats.adminPlayers(limit);
    }
}
