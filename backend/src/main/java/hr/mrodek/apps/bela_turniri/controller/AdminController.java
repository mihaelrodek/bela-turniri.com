package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.model.UserPairPreset;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import hr.mrodek.apps.bela_turniri.repository.PairsRepository;
import hr.mrodek.apps.bela_turniri.repository.TournamentsRepository;
import hr.mrodek.apps.bela_turniri.repository.UserPairPresetRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import io.quarkus.panache.common.Sort;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.constraints.NotBlank;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;

/**
 * Admin-only endpoints for the "Dashboard" tab on the profile page.
 *
 * <p>The dashboard lets an admin attach a tournament pair to a registered
 * user retroactively — typically for legacy/organiser-added pairs from
 * tournaments that finished before the player signed up. After attaching,
 * the pair shows up on that user's public profile the same way a
 * self-registered pair would.
 *
 * <p>Authorization is gated on the Firebase {@code role: "admin"} custom
 * claim. Set per-user via {@code scripts/set-admin.mjs}.
 *
 * <p>Why this lives in its own controller (vs. extending an existing one):
 * the admin dashboard is a distinct surface with cross-entity reads
 * (tournaments + pairs + profiles + presets) that don't fit cleanly on
 * any single existing controller. Centralising the dashboard's endpoints
 * also makes it easy to audit/disable the whole admin surface at once.
 */
@Path("/admin")
@RolesAllowed("admin")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AdminController {

    @Inject TournamentsRepository tournamentsRepo;
    @Inject PairsRepository pairsRepo;
    @Inject UserProfileRepository profileRepo;
    @Inject UserPairPresetRepository presetRepo;

    /** Cap on user-search results — see UserProfileRepository.searchByDisplayName. */
    private static final int USER_SEARCH_LIMIT = 25;

    /** ──────────────────────────────────────────────────────────────────
     * Tournament list for the picker. Returns every non-deleted
     * tournament (the {@code @Where} clause on the entity filters
     * deleted rows automatically), newest first, with just the fields
     * the dashboard's dropdown needs.
     * ──────────────────────────────────────────────────────────────── */
    @GET
    @Path("/tournaments")
    public Response listTournaments() {
        List<AdminTournamentDto> dtos = tournamentsRepo
                .listAll(Sort.by("startAt").descending().and("id").descending())
                .stream()
                .map(t -> new AdminTournamentDto(
                        t.getId(),
                        t.getUuid() != null ? t.getUuid().toString() : null,
                        t.getSlug(),
                        t.getName(),
                        t.getLocation(),
                        t.getStartAt(),
                        t.getStatus() != null ? t.getStatus().name() : null,
                        t.getCreatedByUid(),
                        t.getCreatedByName()))
                .toList();
        return Response.ok(dtos).build();
    }

    /** ──────────────────────────────────────────────────────────────────
     * Unclaimed pairs for the selected tournament. "Unclaimed" =
     * neither submittedByUid nor coSubmittedByUid is set. Pending
     * self-registrations are excluded — they need to be approved or
     * rejected by the organiser through the normal flow.
     * ──────────────────────────────────────────────────────────────── */
    @GET
    @Path("/tournaments/{tournamentId}/pairs")
    public Response listUnclaimedPairs(@PathParam("tournamentId") Long tournamentId) {
        if (tournamentsRepo.findByIdOptional(tournamentId).isEmpty()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        List<AdminPairDto> dtos = pairsRepo.findUnclaimedByTournamentId(tournamentId)
                .stream()
                .sorted((a, b) -> {
                    // Stable order: name ascending. Helps a long list stay
                    // visually consistent across reloads after attachments.
                    String an = a.getName() != null ? a.getName() : "";
                    String bn = b.getName() != null ? b.getName() : "";
                    return an.compareToIgnoreCase(bn);
                })
                .map(p -> new AdminPairDto(p.getId(), p.getName(), p.isEliminated(),
                        p.getWins(), p.getLosses()))
                .toList();
        return Response.ok(dtos).build();
    }

    /** ──────────────────────────────────────────────────────────────────
     * User search by displayName for the attach-target picker.
     * Empty/blank query returns the first {@code USER_SEARCH_LIMIT}
     * users alphabetically so the dropdown isn't empty before the
     * admin types.
     * ──────────────────────────────────────────────────────────────── */
    @GET
    @Path("/users")
    public Response searchUsers(@QueryParam("q") String query) {
        List<AdminUserDto> dtos = profileRepo
                .searchByDisplayName(query, USER_SEARCH_LIMIT)
                .stream()
                .map(p -> new AdminUserDto(p.getUserUid(), p.getDisplayName(), p.getSlug()))
                .toList();
        return Response.ok(dtos).build();
    }

    /** ──────────────────────────────────────────────────────────────────
     * Full list of all registered users, alphabetically. Backs the
     * admin "Popis igrača" tab — distinct from {@link #searchUsers}
     * (which caps at {@link #USER_SEARCH_LIMIT} for the dropdown
     * picker) because here we want every profile, not the top-N
     * search hits.
     * ──────────────────────────────────────────────────────────────── */
    @GET
    @Path("/users/all")
    public Response listAllUsers() {
        List<AdminUserDto> dtos = profileRepo.listAllByDisplayName()
                .stream()
                .map(p -> new AdminUserDto(p.getUserUid(), p.getDisplayName(), p.getSlug()))
                .toList();
        return Response.ok(dtos).build();
    }

    /** ──────────────────────────────────────────────────────────────────
     * Attach a pair to a user. Two side-effects (both wrapped in a
     * single transaction so a half-attached pair never persists):
     *
     *   1. {@code pair.submittedByUid = userUid} — this single field is
     *      what {@code findMyParticipations} matches on, so the pair
     *      starts appearing on the target user's profile immediately.
     *   2. If the user doesn't already have a {@code UserPairPreset}
     *      with the same name, we create one (with a stable claim
     *      token, like the self-register path). Reason: tournaments
     *      with the same pair name in the future will then auto-claim
     *      to this user via the preset-name fallback in
     *      {@link hr.mrodek.apps.bela_turniri.repository.PairsRepository#findMyParticipations}.
     *
     * Refuses to attach when the pair is already claimed (either
     * submitter slot filled) — the UI filters those out, but a parallel
     * request could race in, so we re-check here as well.
     * ──────────────────────────────────────────────────────────────── */
    @POST
    @Path("/pairs/{pairId}/attach")
    @Transactional
    public Response attachPair(@PathParam("pairId") Long pairId,
                               AttachPairRequest body) {
        if (body == null || body.userUid() == null || body.userUid().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("USER_UID_REQUIRED").build();
        }
        Pairs pair = pairsRepo.findById(pairId);
        if (pair == null) return Response.status(Response.Status.NOT_FOUND).build();

        // Defensive — the UI hides claimed pairs but a parallel admin
        // attaching at the same time would otherwise silently overwrite.
        if (pair.getSubmittedByUid() != null || pair.getCoSubmittedByUid() != null) {
            return Response.status(Response.Status.CONFLICT)
                    .entity("ALREADY_CLAIMED").build();
        }

        UserProfile target = profileRepo.findByUid(body.userUid()).orElse(null);
        if (target == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("USER_NOT_FOUND").build();
        }

        // 1. Direct ownership flag.
        pair.setSubmittedByUid(target.getUserUid());
        pairsRepo.persist(pair);

        // 2. Auto-create a matching preset so future tournaments with
        //    the same pair name auto-link to this user. Skip if one
        //    already exists (case-insensitive name match).
        String pairName = pair.getName() != null ? pair.getName().trim() : null;
        boolean createdPreset = false;
        if (pairName != null && !pairName.isEmpty()) {
            var existing = presetRepo.findByUserUidAndNameIgnoreCase(
                    target.getUserUid(), pairName);
            if (existing.isEmpty()) {
                UserPairPreset preset = new UserPairPreset();
                preset.setUserUid(target.getUserUid());
                preset.setName(pairName);
                preset.setHidden(false);
                preset.setClaimToken(generateClaimToken());
                preset.setArchived(false);
                presetRepo.persist(preset);
                createdPreset = true;
            }
        }

        return Response.ok(new AttachPairResponse(
                pair.getId(), target.getUserUid(),
                target.getDisplayName(), createdPreset)).build();
    }

    /** ──────────────────────────────────────────────────────────────────
     * Transfer tournament ownership to another registered user. Used
     * when an admin pre-creates a tournament on behalf of an organiser
     * (e.g. before the organiser has signed up, or for legacy imports)
     * and later wants to hand it over so the real organiser can manage
     * pairs, edit details, finish rounds, etc.
     *
     * <p>Two fields are updated on the tournament:
     *   - {@code createdByUid} — drives all owner-only authorisation
     *     checks ({@code canEditTournament}, pair-management endpoints,
     *     the "Uredi" / "Završi turnir" / "Manualno generiraj kolo" UI
     *     gates). After this call the target user is treated exactly as
     *     if they had created the tournament themselves.
     *   - {@code createdByName} — copied from the target's UserProfile
     *     displayName so all "created by" labels in the UI match the
     *     new owner without us having to look up the profile every time
     *     the tournament is rendered.
     *
     * <p>Idempotent — transferring to the same user again is a no-op
     * (returns 200 with the same payload). We don't reject transfers
     * across status (DRAFT / PUBLISHED / FINISHED) because legacy
     * imports often arrive as FINISHED and the whole point of transfer
     * is to backfill ownership for them too.
     * ──────────────────────────────────────────────────────────────── */
    @POST
    @Path("/tournaments/{tournamentId}/transfer")
    @Transactional
    public Response transferTournament(@PathParam("tournamentId") Long tournamentId,
                                       TransferTournamentRequest body) {
        if (body == null || body.userUid() == null || body.userUid().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("USER_UID_REQUIRED").build();
        }
        Tournaments tournament = tournamentsRepo.findById(tournamentId);
        if (tournament == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("TOURNAMENT_NOT_FOUND").build();
        }

        UserProfile target = profileRepo.findByUid(body.userUid()).orElse(null);
        if (target == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("USER_NOT_FOUND").build();
        }

        tournament.setCreatedByUid(target.getUserUid());
        tournament.setCreatedByName(target.getDisplayName());
        tournamentsRepo.persist(tournament);

        return Response.ok(new TransferTournamentResponse(
                tournament.getId(),
                target.getUserUid(),
                target.getDisplayName())).build();
    }

    /* ─────────────────── helpers + DTOs ─────────────────── */

    /**
     * 32-byte URL-safe random token. Matches the format used elsewhere
     * (UserPairPresetController, pair self-register) so claim links
     * generated through the admin path are indistinguishable from
     * organic ones.
     */
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static String generateClaimToken() {
        byte[] buf = new byte[24];
        SECURE_RANDOM.nextBytes(buf);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }

    public record AdminTournamentDto(Long id, String uuid, String slug,
                                     String name, String location,
                                     OffsetDateTime startAt, String status,
                                     String createdByUid, String createdByName) {}

    public record AdminPairDto(Long id, String name, boolean eliminated,
                               int wins, int losses) {}

    public record AdminUserDto(String userUid, String displayName, String slug) {}

    public record AttachPairRequest(@NotBlank String userUid) {}

    public record AttachPairResponse(Long pairId, String userUid,
                                     String displayName, boolean createdPreset) {}

    public record TransferTournamentRequest(@NotBlank String userUid) {}

    public record TransferTournamentResponse(Long tournamentId, String userUid,
                                             String displayName) {}
}
