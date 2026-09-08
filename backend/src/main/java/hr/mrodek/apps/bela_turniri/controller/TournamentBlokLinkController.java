package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.BlokLinkDto;
import hr.mrodek.apps.bela_turniri.services.BlokLinkService;
import hr.mrodek.apps.bela_turniri.services.TournamentAccess;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

import java.util.List;
import java.util.UUID;

/**
 * The organiser's half of "Poveži blok sa stolom" ({@code BLOK-LINK.md} §2.2).
 * The player's half lives in {@link BlokLinkController}.
 *
 * <pre>
 *   GET  /tournaments/{idOrSlug}/blok-links                    all links, PENDING first
 *   POST /tournaments/{idOrSlug}/blok-links/{uuid}/approve     → APPROVED
 *   POST /tournaments/{idOrSlug}/blok-links/{uuid}/reject      → REJECTED
 * </pre>
 *
 * <p>Every method gates on {@link TournamentAccess#loadForEdit(String)} —
 * admin or creator, resolved from either a UUID or a slug — exactly like
 * {@code TournamentController.approvePair}. There is no hand-rolled
 * {@code jwt.getSubject()} comparison anywhere in this flow.
 *
 * <p>A separate resource class from {@link TournamentController} only because
 * that file is already large; the path prefix is shared, which RESTEasy
 * Reactive handles the same way it does for {@code RoundController} and
 * {@code MatchBillController}.
 */
@Path("/tournaments/{idOrSlug}/blok-links")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TournamentBlokLinkController {

    @Inject BlokLinkService blokLinks;
    @Inject TournamentAccess access;

    /**
     * Every link of this tournament, PENDING first — the list the Ždrijeb tab
     * renders as the yellow "waiting for approval" group.
     *
     * <p>Organiser-only rather than public: it carries requester UIDs and
     * names, which are nobody else's business.
     */
    @GET
    @Authenticated
    @Transactional
    public List<BlokLinkDto> list(@PathParam("idOrSlug") String idOrSlug) {
        return blokLinks.listForTournament(access.loadForEdit(idOrSlug));
    }

    /**
     * Approve: the requester may now write this table's score.
     *
     * <p>{@code @Consumes(WILDCARD)} overrides the class-level JSON — the
     * method takes no body, and the class annotation would otherwise answer
     * 415 (ahead of the auth check) to any caller that POSTs without a
     * {@code Content-Type}.
     */
    @POST
    @Path("/{uuid}/approve")
    @Consumes(MediaType.WILDCARD)
    @Authenticated
    @Transactional
    public BlokLinkDto approve(@PathParam("idOrSlug") String idOrSlug,
                               @PathParam("uuid") UUID linkUuid) {
        return blokLinks.approve(access.loadForEdit(idOrSlug), linkUuid);
    }

    /** Decline. Terminal — the player has to ask again if they want back in. */
    @POST
    @Path("/{uuid}/reject")
    @Consumes(MediaType.WILDCARD)
    @Authenticated
    @Transactional
    public BlokLinkDto reject(@PathParam("idOrSlug") String idOrSlug,
                              @PathParam("uuid") UUID linkUuid) {
        return blokLinks.reject(access.loadForEdit(idOrSlug), linkUuid);
    }
}
