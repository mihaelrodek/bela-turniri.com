package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.CreateReportRequest;
import hr.mrodek.apps.bela_turniri.services.ContentReportService;
import hr.mrodek.apps.bela_turniri.services.CurrentUser;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.Map;

/**
 * {@code POST /reports} — "prijavi sadržaj" (App Store guideline 1.2).
 *
 * <p>Authenticated on purpose, unlike most write endpoints' anonymous-friendly
 * neighbours: a report with no author cannot be rate-limited per person, cannot
 * be followed up, and is the easiest possible way to bury a moderation queue.
 *
 * <p>The whole surface is one endpoint — there is no "my reports" read. Once
 * filed, a report belongs to the operator; showing the reporter its status
 * would turn every moderation decision into a conversation.
 */
@Path("/reports")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ReportController {

    @Inject ContentReportService reports;
    @Inject CurrentUser currentUser;

    /**
     * @return 201 with {@code {"id": n}} — the id is the only thing the SPA
     *         needs, and it is what a follow-up e-mail would quote.
     */
    @POST
    @Transactional
    public Response create(@Valid CreateReportRequest body) {
        var saved = reports.create(currentUser.requireUid(), body);
        return Response.status(Response.Status.CREATED)
                .entity(Map.of("id", saved.getId()))
                .build();
    }
}
