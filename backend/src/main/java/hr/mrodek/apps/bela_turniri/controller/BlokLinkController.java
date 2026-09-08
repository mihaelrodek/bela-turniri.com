package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.BlokLinkCreatedDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokLinkDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokLinkScoreRequest;
import hr.mrodek.apps.bela_turniri.dtos.BlokLinkSuggestionDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokLinkTargetDto;
import hr.mrodek.apps.bela_turniri.dtos.CreateBlokLinkRequest;
import hr.mrodek.apps.bela_turniri.services.BlokLinkService;
import io.quarkus.security.Authenticated;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;
import java.util.UUID;

/**
 * The player's half of "Poveži blok sa stolom" ({@code BLOK-LINK.md} §2.2,
 * as revised by §7 and §8). The organiser's half lives in
 * {@link TournamentBlokLinkController}.
 *
 * <pre>
 *   GET    /blok-links/targets?tournament={uuidOrSlug}   linkable tables in the active round
 *   GET    /blok-links/suggestions                       the table you are already sitting at (§8)
 *   POST   /blok-links                                   ask for a link  → PENDING + writeToken
 *   GET    /blok-links/mine                              my links (signed in)
 *   GET    /blok-links/{uuid}                            one link's state (uid or writeToken)
 *   DELETE /blok-links/{uuid}                            break it        → REVOKED
 *   PUT    /blok-links/{uuid}/score                      write the score (approved link only)
 * </pre>
 *
 * <h2>Auth, after §7.1: two ways to be the same player</h2>
 * Linking no longer requires an account. Asking for a link, reading it back,
 * breaking it and writing its score are open to a signed-out blok, which
 * proves itself with the <b>write token</b> minted once when the link was
 * created and sent back in
 * <code>{@value #TOKEN_HEADER}</code>.
 *
 * <p>A header, not a body field, and deliberately: it is a bearer credential,
 * it has to ride on a {@code GET} and a {@code DELETE} that have no body at
 * all, and this project already carries exactly this kind of secret in exactly
 * this way ({@code X-Waiter-Token}, {@code WaiterBillController}). Putting it
 * in the JSON would also have meant it travelling inside request bodies that
 * get logged and replayed through the offline queue.
 *
 * <p>The signed-in path is untouched: {@link BlokLinkService} checks
 * {@code requestedByUid} first and by uid, so a token never makes its holder
 * somebody else. What a stolen token buys is one thing only — writing a score
 * into the one already-approved match its link names.
 *
 * <p><b>{@code @PermitAll} is method-level, never class-level.</b> Confirmed
 * in {@code WaiterBillController}: a class-level {@code @PermitAll} makes
 * Quarkus eagerly run the bearer mechanism, so a stale or malformed
 * {@code Authorization} header 401s the request with an empty body before any
 * of this code runs — even when a perfectly good token was presented
 * alongside. That would break the one caller most likely to have a
 * half-expired Firebase token lying around.
 *
 * <p>The score is the <b>series result</b> — games won by each side, the
 * {@code 2 : 1} a tournament match is scored in (§6.1) — not the blok's point
 * totals. Writing one through an approved link also publishes that series'
 * scorepad <em>if the link has an account behind it</em>, so the returned
 * {@link BlokLinkDto} may carry a {@code shareToken} (§6.2). An anonymous link
 * never does: a scorepad lives on a profile (§7.2).
 *
 * <p>{@code @Transactional} sits here rather than in the service, per this
 * codebase's convention: the service is handed managed entities and mutates
 * them inside this transaction.
 */
@Path("/blok-links")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class BlokLinkController {

    /**
     * The per-link bearer secret of {@code BLOK-LINK.md} §7.1, handed out once
     * by {@code POST /blok-links} and presented on every later call about that
     * link. Named after {@code X-Waiter-Token}, which does the same job for
     * venue staff without accounts.
     */
    static final String TOKEN_HEADER = "X-Blok-Link-Token";

    @Inject BlokLinkService blokLinks;
    @Inject hr.mrodek.apps.bela_turniri.services.MessageService messages;

    /**
     * Tables in the tournament's active round, each flagged {@code linkable}.
     *
     * <p>Anonymous since §7: the dialog "opens straight into choosing a
     * tournament, with no sign-in wall" (§7.3), and choosing a table is the
     * step right after — an {@code @Authenticated} guard here would have made
     * the whole signed-out flow impossible one call before it started. It
     * exposes nothing new either: the draw it summarises is already public
     * through {@code GET /tournaments/{uuid}/rounds}.
     */
    @GET
    @Path("/targets")
    @PermitAll
    @Transactional
    public List<BlokLinkTargetDto> targets(@QueryParam("tournament") String tournamentIdOrSlug) {
        if (tournamentIdOrSlug == null || tournamentIdOrSlug.isBlank()) {
            throw new BadRequestException(messages.t("blokLink.tournamentRequired"));
        }
        return blokLinks.listTargets(tournamentIdOrSlug);
    }

    /**
     * "You are playing at this table right now" — {@code BLOK-LINK.md} §8.
     * Zero or (usually) one element; an empty array whenever any of §8.1's
     * five conditions fails, so a blok with no tournament behind it stays
     * clean.
     *
     * <p>{@code @Authenticated} by the contract: the whole question is "which
     * pair is <em>yours</em>", and this codebase's only answer to that is the
     * uid on {@code pairs.submitted_by_uid} / {@code co_submitted_by_uid}. It
     * takes no parameters at all, which is also what keeps it from being a way
     * to read anybody else's draw.
     */
    @GET
    @Path("/suggestions")
    @Authenticated
    @Transactional
    public List<BlokLinkSuggestionDto> suggestions() {
        return blokLinks.suggestions();
    }

    /**
     * Ask to be linked to one table. Anyone may ask — with or without an
     * account (§7.1) — because this app has no concept of a user belonging to
     * a pair (§5), so the organiser's approval, not membership, is the
     * defence.
     *
     * <p>The response is the one place a {@code writeToken} is ever returned:
     * {@code {"link": {…}, "writeToken": "…"}}. Store it; there is no way to
     * ask for it again. A signed-out caller must sign the request with
     * {@code requestedByName} (2–60 characters) or gets
     * {@code 400 NAME_REQUIRED} — the organiser cannot approve an unsigned,
     * accountless claim on a table.
     */
    @POST
    @PermitAll
    @Transactional
    public Response request(@Valid CreateBlokLinkRequest body) {
        BlokLinkCreatedDto dto = blokLinks.request(body);
        return Response.status(Response.Status.CREATED).entity(dto).build();
    }

    /** Every link the caller ever asked for, newest first. Signed-in only. */
    @GET
    @Path("/mine")
    @Authenticated
    @Transactional
    public List<BlokLinkDto> mine() {
        return blokLinks.listMine();
    }

    /**
     * One link's current state — the signed-out blok's replacement for
     * {@code /mine} (§7.1), so it can see whether the organiser has approved
     * it yet.
     *
     * <p>Requester only: the link's {@code requestedByUid} while signed in, or
     * its write token. Everything else, an unknown uuid included, is the same
     * 401 — the endpoint must not confirm that a guessed uuid is real.
     *
     * <p>{@code @Consumes(WILDCARD)} for the same reason as {@code DELETE}
     * below: a GET carries no body and no {@code Content-Type}, and the
     * class-level JSON would answer 415.
     */
    @GET
    @Path("/{uuid}")
    @Consumes(MediaType.WILDCARD)
    @PermitAll
    @Transactional
    public BlokLinkDto one(@PathParam("uuid") UUID linkUuid,
                           @HeaderParam(TOKEN_HEADER) String writeToken) {
        return blokLinks.getOne(linkUuid, writeToken);
    }

    /**
     * Break the link. Requester (uid or write token) or organiser/admin;
     * idempotent.
     *
     * <p>The token half matters more than it looks: a link holds its match's
     * single active slot ({@code uq_msl_active_per_match}), so a signed-out
     * player who could not revoke their own link would leave that table
     * unlinkable until the organiser cleared it by hand.
     *
     * <p>{@code @Consumes(WILDCARD)} overrides the class-level JSON: this
     * method takes no body, and the class annotation otherwise answers 415 —
     * before the auth check — to any client that sends a DELETE without a
     * {@code Content-Type} (a bare {@code fetch()}, curl, RestAssured). The
     * shared axios instance always sets one, so the SPA never saw it; that is
     * not a reason to leave the trap in place.
     */
    @DELETE
    @Path("/{uuid}")
    @Consumes(MediaType.WILDCARD)
    @PermitAll
    @Transactional
    public Response revoke(@PathParam("uuid") UUID linkUuid,
                           @HeaderParam(TOKEN_HEADER) String writeToken) {
        blokLinks.revoke(linkUuid, writeToken);
        return Response.noContent().build();
    }

    /**
     * Write the blok's score — {@code {us, them}} = <b>games won</b> in the
     * series at that table (§6.1) — into the match. Only the requester of an
     * {@code APPROVED} link (uid or write token, §7.1), and only while the
     * round is live.
     *
     * <p>An accepted write also ensures the linked series' share token exists
     * (§6.2) when the link has an account behind it, so the response's
     * {@code shareToken} is what the bracket turns into {@code /blok/z/{token}}.
     *
     * <p><b>{@code dontRollbackOn} is load-bearing.</b> BLOK-LINK.md §2.3(2)
     * requires that a score arriving after the round completed both
     * <em>revokes the link</em> and answers 409. The 409 is thrown as a
     * {@link WebApplicationException}, and a {@code @Transactional} method
     * rolls back on any RuntimeException — which would discard the revoke and
     * leave the blok retrying against a dead table forever. Listing it here
     * keeps the write. Nothing else in this path writes before throwing, so
     * committing on a thrown WebApplicationException cannot preserve anything
     * unintended — the 401 from a failed authorisation included, since that is
     * thrown before the method has touched a single row.
     */
    @PUT
    @Path("/{uuid}/score")
    @PermitAll
    @Transactional(dontRollbackOn = WebApplicationException.class)
    public BlokLinkDto score(@PathParam("uuid") UUID linkUuid,
                             @HeaderParam(TOKEN_HEADER) String writeToken,
                             @Valid BlokLinkScoreRequest body) {
        return blokLinks.submitScore(linkUuid, body, writeToken);
    }
}
