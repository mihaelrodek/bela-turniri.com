package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.UserPairPresetDto;
import hr.mrodek.apps.bela_turniri.model.UserPairPreset;
import hr.mrodek.apps.bela_turniri.repository.UserPairPresetRepository;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.List;
import java.util.UUID;

/**
 * Per-user pair-name presets. Every operation is scoped to the caller's
 * Firebase UID — no admin override, no cross-user reads.
 */
@Path("/user/pair-presets")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserPairPresetController {

    @Inject UserPairPresetRepository repo;
    @Inject JsonWebToken jwt;

    private String currentUid() {
        return jwt.getSubject();
    }

    private UserPairPresetDto toDto(UserPairPreset p) {
        return new UserPairPresetDto(p.getUuid(), p.getName());
    }

    @GET
    public List<UserPairPresetDto> list() {
        return repo.findByUserUid(currentUid()).stream().map(this::toDto).toList();
    }

    @POST
    @Transactional
    public Response create(@Valid UserPairPresetDto body) {
        UserPairPreset p = new UserPairPreset();
        p.setUserUid(currentUid());
        p.setName(body.name().trim());
        repo.save(p);
        return Response.status(Response.Status.CREATED).entity(toDto(p)).build();
    }

    @PUT
    @Path("/{uuid}")
    @Transactional
    public Response update(@PathParam("uuid") UUID uuid, @Valid UserPairPresetDto body) {
        var p = repo.findByUuidAndUserUid(uuid, currentUid()).orElse(null);
        if (p == null) return Response.status(Response.Status.NOT_FOUND).build();
        p.setName(body.name().trim());
        return Response.ok(toDto(p)).build();
    }

    @DELETE
    @Path("/{uuid}")
    @Transactional
    public Response delete(@PathParam("uuid") UUID uuid) {
        var p = repo.findByUuidAndUserUid(uuid, currentUid()).orElse(null);
        if (p == null) return Response.status(Response.Status.NOT_FOUND).build();
        repo.delete(p);
        return Response.noContent().build();
    }
}
