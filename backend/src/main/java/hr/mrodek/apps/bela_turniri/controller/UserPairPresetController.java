package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.UserPairPresetDto;
import hr.mrodek.apps.bela_turniri.model.UserPairPreset;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import hr.mrodek.apps.bela_turniri.repository.UserPairPresetRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

/**
 * Per-user pair-name presets — the home for the share-with-partner flow.
 * Each preset is a saved name ("Marko & Pero") that the user can edit,
 * hide from public view, or share via a /claim-name/{token} URL. When
 * the partner claims, every tournament where the primary played as
 * that name shows up on the partner's profile too (via the widened
 * findMyParticipations query in PairsRepository).
 */
@Path("/user/pair-presets")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserPairPresetController {

    @Inject UserPairPresetRepository repo;
    @Inject UserProfileRepository profileRepo;
    @Inject JsonWebToken jwt;

    private String currentUid() {
        return jwt.getSubject();
    }

    /** Owner sees their own claim token; everyone else gets null. */
    private UserPairPresetDto toDto(UserPairPreset p, boolean includeToken) {
        UserProfile co = null;
        if (p.getCoOwnerUid() != null && !p.getCoOwnerUid().isBlank()) {
            co = profileRepo.findByUid(p.getCoOwnerUid()).orElse(null);
        }
        return new UserPairPresetDto(
                p.getUuid(),
                p.getName(),
                p.isHidden(),
                co == null ? null : co.getSlug(),
                co == null ? null : co.getDisplayName(),
                includeToken ? p.getClaimToken() : null
        );
    }

    /**
     * 24 bytes of SecureRandom → base64-url-no-padding (32 chars). Same
     * recipe as the pair-level claim token so the URL shape is consistent.
     */
    private static String generateClaimToken() {
        byte[] buf = new byte[24];
        new SecureRandom().nextBytes(buf);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }

    @GET
    public List<UserPairPresetDto> list() {
        // Always emit the token to the owner — that's the whole point.
        return repo.findByUserUid(currentUid()).stream()
                .map(p -> toDto(p, true))
                .toList();
    }

    @POST
    @Transactional
    public Response create(@Valid UserPairPresetDto body) {
        UserPairPreset p = new UserPairPreset();
        p.setUserUid(currentUid());
        p.setName(body.name().trim());
        p.setHidden(Boolean.TRUE.equals(body.hidden()));
        // Generate the share token up front so the Podijeli button works
        // immediately without a separate "generate link" step.
        p.setClaimToken(generateClaimToken());
        repo.save(p);
        return Response.status(Response.Status.CREATED).entity(toDto(p, true)).build();
    }

    @PUT
    @Path("/{uuid}")
    @Transactional
    public Response update(@PathParam("uuid") UUID uuid, @Valid UserPairPresetDto body) {
        var p = repo.findByUuidAndUserUid(uuid, currentUid()).orElse(null);
        if (p == null) return Response.status(Response.Status.NOT_FOUND).build();
        p.setName(body.name().trim());
        if (body.hidden() != null) p.setHidden(body.hidden());
        return Response.ok(toDto(p, true)).build();
    }

    @POST
    @Path("/{uuid}/visibility")
    @Transactional
    public Response setVisibility(
            @PathParam("uuid") UUID uuid,
            VisibilityRequest body
    ) {
        if (body == null) throw new BadRequestException("Body required");
        var p = repo.findByUuidAndUserUid(uuid, currentUid()).orElse(null);
        if (p == null) return Response.status(Response.Status.NOT_FOUND).build();
        p.setHidden(body.hidden());
        return Response.ok(toDto(p, true)).build();
    }

    @DELETE
    @Path("/{uuid}")
    @Transactional
    public Response delete(@PathParam("uuid") UUID uuid) {
        var p = repo.findByUuidAndUserUid(uuid, currentUid()).orElse(null);
        if (p == null) return Response.status(Response.Status.NOT_FOUND).build();

        // Lock: once a partner has claimed the preset, we can't simply
        // delete it — that would orphan the partner's read-side view.
        // Owner has to revoke the co-owner first (future feature) or
        // keep the preset and mark it hidden.
        if (p.getCoOwnerUid() != null && !p.getCoOwnerUid().isBlank()) {
            return Response.status(Response.Status.CONFLICT)
                    .entity("CO_OWNED_PRESET")
                    .build();
        }

        repo.delete(p);
        return Response.noContent().build();
    }

    public record VisibilityRequest(boolean hidden) {}
}
