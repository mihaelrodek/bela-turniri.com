package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.ReportDto;
import hr.mrodek.apps.bela_turniri.dtos.ResolveReportRequest;
import hr.mrodek.apps.bela_turniri.services.ContentReportService;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;

import java.util.List;
import java.util.Map;

/**
 * The moderation inbox — {@code /admin/reports}.
 *
 * <p>Beside {@link AdminController} rather than inside it, for the reason that
 * controller's own javadoc gives: it centralises one distinct admin surface,
 * and moderation is a different job from the dashboard's retroactive
 * pair-attaching. Same {@code role: "admin"} custom claim gates both.
 *
 * <p>Reads are capped at {@link hr.mrodek.apps.bela_turniri.repository.ContentReportRepository#LIST_LIMIT}
 * rows; the {@code /count} endpoint exists so the SPA can render an unread
 * badge without paying for the list.
 */
@Path("/admin/reports")
@RolesAllowed("admin")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AdminReportController {

    @Inject ContentReportService reports;

    /** @param status {@code open} (default) or {@code resolved}. Newest first. */
    @GET
    @Transactional
    public List<ReportDto> list(@QueryParam("status") @DefaultValue("open") String status) {
        return reports.list(status);
    }

    /** Badge count, same {@code status} vocabulary as the list. */
    @GET
    @Path("/count")
    @Transactional
    public Map<String, Long> count(@QueryParam("status") @DefaultValue("open") String status) {
        return Map.of("total", reports.count(status));
    }

    /** Close a report; returns the updated row so the SPA can patch it in place. */
    @POST
    @Path("/{id}/resolve")
    @Transactional
    public ReportDto resolve(@PathParam("id") Long id, @Valid ResolveReportRequest body) {
        return reports.resolve(id, body);
    }
}
