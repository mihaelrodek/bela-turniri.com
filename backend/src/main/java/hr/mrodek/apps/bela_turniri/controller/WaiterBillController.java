package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.AddMatchDrinkRequest;
import hr.mrodek.apps.bela_turniri.dtos.MatchBillDto;
import hr.mrodek.apps.bela_turniri.dtos.SetPaidRequest;
import hr.mrodek.apps.bela_turniri.dtos.WaiterBillSummaryDto;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.services.CurrentUser;
import hr.mrodek.apps.bela_turniri.services.IdempotencyService;
import hr.mrodek.apps.bela_turniri.services.MatchBillService;
import hr.mrodek.apps.bela_turniri.services.MessageService;
import hr.mrodek.apps.bela_turniri.services.WaiterAccessService;
import hr.mrodek.apps.bela_turniri.services.WaiterBillService;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

/**
 * The waiter's "Računi" view: read and settle the drink bills of one
 * tournament, and nothing else.
 *
 * <pre>
 *   GET    /tournaments/{idOrSlug}/waiter/bills                       — every match's bill, one line each
 *   GET    /tournaments/{idOrSlug}/waiter/bills/{matchId}             — full bill incl. drink history
 *   POST   /tournaments/{idOrSlug}/waiter/bills/{matchId}/drinks      — add a drink
 *   DELETE /tournaments/{idOrSlug}/waiter/bills/{matchId}/drinks/{id} — undo one
 *   PATCH  /tournaments/{idOrSlug}/waiter/bills/{matchId}/paid        — settle / unsettle
 * </pre>
 *
 * <h2>Why this is not just {@code MatchBillController} with another guard</h2>
 * The caller here usually has no account — the whole feature exists so
 * venue staff never need one. Every method therefore carries its own
 * {@code @PermitAll} (method-level, NOT class-level — see the note below),
 * and {@link WaiterAccessService#authorizeBillAccess} accepts EITHER caller:
 * a signed-in organiser (the same {@code TournamentAccess.canManage} check
 * every other owner-only endpoint uses — they act as a bartender too, on
 * their own session, no code of their own needed) or a live
 * {@code X-Waiter-Token}. Bolting the waiter half onto
 * {@code MatchBillController} would have meant one endpoint with two
 * mutually exclusive auth models, which is how the wrong one eventually
 * gets skipped.
 *
 * <h2>Why {@code @PermitAll} is on every method, not the class</h2>
 * Confirmed live: Quarkus's build-time security processor treats an
 * explicit class-level {@code @PermitAll} differently from no annotation at
 * all — it still eagerly runs the bearer-token auth mechanism against
 * whatever {@code Authorization} header shows up, and a token that fails to
 * validate (expired, malformed, a stale cached Firebase ID token) 401s the
 * whole request with an empty body, BEFORE {@code authorizeBillAccess} ever
 * runs — even carrying a perfectly valid {@code X-Waiter-Token}. That
 * defeats the entire "either caller" design for the one caller (the
 * organiser) most likely to have a half-expired token lying around. Method-
 * level {@code @PermitAll} does not trigger that eager check — the same
 * pattern already used by {@code WaiterAccessController.redeem} — so it is
 * required here, not a style choice.
 *
 * <h2>Scoping</h2>
 * A token names exactly one tournament, and only an ACTIVE (not revoked)
 * waiter's token is accepted. Every path-parameterised endpoint runs the
 * authorisation check AND {@link WaiterBillService#requireMatchOfTournament}
 * before it touches anything, so a waiter at one tournament cannot walk
 * another one's bills by incrementing {@code matchId}. Both checks answer
 * the same way a missing row does — a 401 for the token, a 404 for the
 * match — because confirming "that match exists, just not yours" is itself
 * the information the guess was after.
 *
 * <h2>Transactions</h2>
 * Every mutating method is {@code @Transactional} for the same reason
 * {@code MatchBillController}'s are: the scoping check and the write that
 * follows must share one transaction and one persistence context, or the
 * check commits and closes and leaves a window before the write.
 *
 * <h2>Offline</h2>
 * A bar's Wi-Fi is exactly as bad as the hall's, so the three mutating
 * endpoints honour {@code X-Client-Op-Id} through
 * {@link IdempotencyService}, keyed on {@link #callerIdentity} — the
 * organiser's own uid when they are the caller, or a digest of the token
 * standing in for the uid a genuine waiter does not have — only ever used
 * to detect a replay arriving from a different caller than the one that
 * first ran the operation.
 */
@Path("/tournaments/{idOrSlug}/waiter/bills")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class WaiterBillController {

    /** Bearer credential minted by {@code POST /waiter-access/redeem}. */
    private static final String TOKEN_HEADER = "X-Waiter-Token";

    @Inject WaiterAccessService waiter;
    @Inject WaiterBillService waiterBills;
    @Inject MatchBillService billService;
    @Inject IdempotencyService idempotency;
    @Inject MessageService messages;
    @Inject CurrentUser currentUser;

    /** Every match of the tournament with its running total, round then table order. */
    @GET
    @PermitAll
    public List<WaiterBillSummaryDto> list(
            @PathParam("idOrSlug") String idOrSlug,
            @HeaderParam(TOKEN_HEADER) String token
    ) {
        return waiterBills.listBills(waiter.authorizeBillAccess(idOrSlug, token).tournament());
    }

    /**
     * One table's full bill — the same {@link MatchBillDto} the organiser
     * sees. Deliberately the existing type: a second bill shape would drift
     * from the first the moment either gains a field.
     */
    @GET
    @Path("/{matchId}")
    @PermitAll
    public MatchBillDto getBill(
            @PathParam("idOrSlug") String idOrSlug,
            @PathParam("matchId") Long matchId,
            @HeaderParam(TOKEN_HEADER) String token
    ) {
        Tournaments t = waiter.authorizeBillAccess(idOrSlug, token).tournament();
        waiterBills.requireMatchOfTournament(t, matchId);
        return billService.getBill(matchId);
    }

    @POST
    @Path("/{matchId}/drinks")
    @PermitAll
    @Transactional
    public Response addDrink(
            @PathParam("idOrSlug") String idOrSlug,
            @PathParam("matchId") Long matchId,
            @HeaderParam(TOKEN_HEADER) String token,
            @HeaderParam("X-Client-Op-Id") String clientOpId,
            @Valid AddMatchDrinkRequest body
    ) {
        Tournaments t = waiter.authorizeBillAccess(idOrSlug, token).tournament();
        waiterBills.requireMatchOfTournament(t, matchId);
        // priceId/quantity shape is enforced by the DTO's constraints; only
        // an entirely absent body still has to be caught by hand.
        if (body == null) {
            throw new BadRequestException(messages.t("matchBill.priceIdRequired"));
        }
        int qty = body.quantity() == null ? 1 : body.quantity();
        return idempotency.execute(clientOpId, callerIdentity(token),
                "POST /tournaments/{idOrSlug}/waiter/bills/{matchId}/drinks",
                () -> Response.ok(billService.addDrink(matchId, body.priceId(), qty)).build());
    }

    @DELETE
    @Path("/{matchId}/drinks/{drinkId}")
    @PermitAll
    @Transactional
    public Response removeDrink(
            @PathParam("idOrSlug") String idOrSlug,
            @PathParam("matchId") Long matchId,
            @PathParam("drinkId") Long drinkId,
            @HeaderParam(TOKEN_HEADER) String token,
            @HeaderParam("X-Client-Op-Id") String clientOpId
    ) {
        Tournaments t = waiter.authorizeBillAccess(idOrSlug, token).tournament();
        waiterBills.requireMatchOfTournament(t, matchId);
        return idempotency.execute(clientOpId, callerIdentity(token),
                "DELETE /tournaments/{idOrSlug}/waiter/bills/{matchId}/drinks/{drinkId}",
                () -> Response.ok(billService.removeDrink(matchId, drinkId)).build());
    }

    /**
     * Settle or unsettle the bill.
     *
     * <p>One PATCH carrying the desired state, rather than the organiser's
     * {@code /pay} + {@code /unpay} pair, because the waiter's UI is a
     * checkbox: a replayed offline queue should converge on the state that
     * was ticked, not on whichever verb happened to arrive last.
     *
     * <p>{@code paidByUid} is the caller's Firebase uid when the caller IS
     * the organiser (the same value {@code MatchBillController} would
     * record) and <b>null</b> for a genuine waiter-token payment. That
     * column is documented as, and consumed as, a Firebase UID, and
     * {@code MatchBillDto} echoes it back to every participant of the
     * match — writing {@code "waiter:" + token} there would publish a live
     * bearer credential to anyone who can open their own bill, which is
     * every player in the tournament. {@code paidAt} still records that and
     * when the bill was settled; {@code paidByName} carries a human-readable
     * "who" either way — the organiser's display name, or the waiter row's
     * invited name — since a raw uid was never going to be shown to anyone.
     */
    @PATCH
    @Path("/{matchId}/paid")
    @PermitAll
    @Transactional
    public Response setPaid(
            @PathParam("idOrSlug") String idOrSlug,
            @PathParam("matchId") Long matchId,
            @HeaderParam(TOKEN_HEADER) String token,
            @HeaderParam("X-Client-Op-Id") String clientOpId,
            @Valid SetPaidRequest body
    ) {
        WaiterAccessService.Caller caller = waiter.authorizeBillAccess(idOrSlug, token);
        waiterBills.requireMatchOfTournament(caller.tournament(), matchId);
        boolean paid = body != null && body.paid();
        // Who to show on the settled bill: the organiser's own display name,
        // or the invited name on the waiter row that authorised this call —
        // never resolved from a uid later, since a waiter has none. See
        // Matches#paidByName.
        String actorName = caller.isOrganiser() ? currentUser.displayName() : caller.waiter().getName();
        return idempotency.execute(clientOpId, callerIdentity(token),
                "PATCH /tournaments/{idOrSlug}/waiter/bills/{matchId}/paid",
                () -> Response.ok(paid
                        ? billService.markPaid(matchId, currentUser.uidOrNull(), actorName)
                        : billService.markUnpaid(matchId)).build());
    }

    /* ===================== helpers ===================== */

    /**
     * Caller identity for the idempotency store. {@code IdempotencyService}
     * only ever compares this value to the one recorded with the marker, to
     * refuse replaying one caller's stored response to another. An
     * organiser (signed in, no waiter token) gets their real uid, exactly
     * as {@code MatchBillController} would record; a genuine waiter has no
     * uid at all, so a <b>digest of</b> the token stands in for one.
     *
     * <p>The digest, not the token. The value lands in
     * {@code processed_operations.user_uid} — a plaintext, long-lived,
     * backed-up column — and the token is a live bearer credential for this
     * tournament's bills. Storing it verbatim meant every DB dump and every
     * ad-hoc query over that table handed out working waiter credentials.
     * SHA-256 is one-way and still perfectly stable, which is the only
     * property the comparison needs.
     */
    private String callerIdentity(String token) {
        if (token != null && !token.isBlank()) return "waiter:" + sha256Hex(token.trim());
        String uid = currentUser.uidOrNull();
        return uid == null ? null : "owner:" + uid;
    }

    /** Lowercase hex SHA-256 of {@code s}. */
    private static String sha256Hex(String s) {
        try {
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(sha256.digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e); // SHA-256 is always present on the JVMs we run
        }
    }
}
