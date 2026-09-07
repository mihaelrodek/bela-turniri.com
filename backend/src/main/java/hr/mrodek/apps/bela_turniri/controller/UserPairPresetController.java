package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.UserPairPresetDto;
import hr.mrodek.apps.bela_turniri.services.UserPairPresetService;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;
import java.util.UUID;

/**
 * Per-user pair-name presets.
 *
 * Each preset can be viewed by two users — the primary (creator) and a
 * claimed co-owner. Both see the same row in their Moji parovi list.
 * Edit + visibility-toggle are open to either owner. Delete on a
 * co-owned preset goes through the archive-request flow:
 *
 *   1. Either owner POSTs /{uuid}/archive-request → request created,
 *      partner gets a push notification.
 *   2. Partner POSTs /{uuid}/archive-confirm → archived = true, both
 *      lose the row from their list.
 *   3. Either side can DELETE /{uuid}/archive-request to cancel/reject.
 *
 * <p>Business logic lives in {@link UserPairPresetService}; this controller
 * loads/validates the request shape and delegates.
 */
@Path("/user/pair-presets")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserPairPresetController {

    @Inject UserPairPresetService presetService;
    @Inject hr.mrodek.apps.bela_turniri.services.MessageService messages;

    @GET
    public List<UserPairPresetDto> list() {
        return presetService.list();
    }

    @POST
    @Transactional
    public Response create(@Valid UserPairPresetDto body) {
        return Response.status(Response.Status.CREATED)
                .entity(presetService.create(body)).build();
    }

    @PUT
    @Path("/{uuid}")
    @Transactional
    public Response update(@PathParam("uuid") UUID uuid, @Valid UserPairPresetDto body) {
        return Response.ok(presetService.update(uuid, body)).build();
    }

    @POST
    @Path("/{uuid}/visibility")
    @Transactional
    public Response setVisibility(
            @PathParam("uuid") UUID uuid,
            @Valid VisibilityRequest body
    ) {
        if (body == null) throw new BadRequestException(messages.t("error.bodyRequired"));
        return Response.ok(presetService.setVisibility(uuid, body.hidden())).build();
    }

    @DELETE
    @Path("/{uuid}")
    @Transactional
    public Response delete(@PathParam("uuid") UUID uuid) {
        presetService.delete(uuid);
        return Response.noContent().build();
    }

    /* ===================== Archive-request lifecycle ===================== */

    /**
     * File a request to archive. Either owner can call this. The partner
     * gets a push notification and sees the request in their UI.
     */
    @POST
    @Path("/{uuid}/archive-request")
    @Transactional
    public Response requestArchive(@PathParam("uuid") UUID uuid) {
        return Response.ok(presetService.requestArchive(uuid)).build();
    }

    /**
     * Confirm the request — sets archived=true and pushes the requester
     * that their request was accepted. Caller must be the OTHER owner
     * (the one who didn't file the request).
     */
    @POST
    @Path("/{uuid}/archive-confirm")
    @Transactional
    public Response confirmArchive(@PathParam("uuid") UUID uuid) {
        presetService.confirmArchive(uuid);
        return Response.noContent().build();
    }

    /**
     * Cancel a pending request. Either side can hit this:
     *   - Requester cancels their own request (changed their mind)
     *   - Partner rejects the request (doesn't want to archive)
     */
    @DELETE
    @Path("/{uuid}/archive-request")
    @Transactional
    public Response cancelArchive(@PathParam("uuid") UUID uuid) {
        var dto = presetService.cancelArchive(uuid);
        return dto == null ? Response.noContent().build() : Response.ok(dto).build();
    }

    public record VisibilityRequest(boolean hidden) {}
}
