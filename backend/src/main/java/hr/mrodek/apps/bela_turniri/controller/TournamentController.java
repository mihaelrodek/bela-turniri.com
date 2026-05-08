package hr.mrodek.apps.bela_turniri.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import hr.mrodek.apps.bela_turniri.dtos.*;
import hr.mrodek.apps.bela_turniri.dtos.SelfRegisterPairRequest;
import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.mappers.PairMapper;
import hr.mrodek.apps.bela_turniri.mappers.TournamentMapper;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Resources;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.repository.MatchesRepository;
import hr.mrodek.apps.bela_turniri.repository.PairsRepository;
import hr.mrodek.apps.bela_turniri.repository.RoundsRepository;
import hr.mrodek.apps.bela_turniri.repository.TournamentsRepository;
import hr.mrodek.apps.bela_turniri.repository.UserPairPresetRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import hr.mrodek.apps.bela_turniri.services.GeocodeService;
import hr.mrodek.apps.bela_turniri.services.RepassageService;
import hr.mrodek.apps.bela_turniri.services.SlugService;
import hr.mrodek.apps.bela_turniri.services.StorageService;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.jwt.JsonWebToken;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Path("/tournaments")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TournamentController {

    @Inject RepassageService repassageService;
    @Inject TournamentMapper tournamentMapper;
    @Inject PairMapper pairMapper;
    @Inject ObjectMapper objectMapper;
    @Inject StorageService storageService;
    @Inject GeocodeService geocodeService;
    @Inject SlugService slugService;

    @Inject TournamentsRepository tournamentsRepo;
    @Inject PairsRepository pairRepo;
    @Inject RoundsRepository roundsRepo;
    @Inject MatchesRepository matchesRepo;
    @Inject UserProfileRepository userProfileRepo;
    @Inject UserPairPresetRepository userPairPresetRepo;

    @Inject SecurityIdentity identity;
    @Inject JsonWebToken jwt;

    /**
     * Best-effort display name from the verified ID token. Prefers the
     * Firebase {@code name} claim, falls back to {@code email}, otherwise
     * null. Shared between {@link #stampCreator} and the lazy profile
     * upsert in self-register.
     */
    private String displayNameFromJwt() {
        if (jwt == null || jwt.getRawToken() == null) return null;
        Object name = jwt.getClaim("name");
        if (name != null) return name.toString();
        Object email = jwt.getClaim("email");
        return email != null ? email.toString() : null;
    }

    /**
     * Stamp the current Firebase user as the creator of a tournament.
     * Reads the verified ID-token claims for UID and display name.
     * Falls back to email when no `name` is set (e.g. email/password signup
     * without a profile name).
     */
    private void stampCreator(Tournaments t) {
        if (jwt == null || jwt.getRawToken() == null) return;
        t.setCreatedByUid(jwt.getSubject());
        t.setCreatedByName(displayNameFromJwt());
    }

    /**
     * Throw 403 if the current user is neither the tournament's creator nor
     * an admin. Legacy tournaments without a creator can only be edited by
     * admins, since we have no original owner to defer to.
     */
    private void assertCanEdit(Tournaments t) {
        boolean admin = identity != null && identity.hasRole("admin");
        if (admin) return;
        String me = jwt != null ? jwt.getSubject() : null;
        boolean owner = me != null && me.equals(t.getCreatedByUid());
        if (!owner) {
            throw new jakarta.ws.rs.ForbiddenException("Only the creator or an admin can modify this tournament.");
        }
    }

    /** Resolve location → lat/lng on create / update. Failure is non-fatal. */
    private void applyGeocoding(Tournaments t) {
        var loc = t.getLocation();
        if (loc == null || loc.isBlank()) {
            t.setLatitude(null);
            t.setLongitude(null);
            t.setGeocodedAt(null);
            return;
        }
        geocodeService.geocode(loc).ifPresentOrElse(
                ll -> {
                    t.setLatitude(ll.latitude());
                    t.setLongitude(ll.longitude());
                    t.setGeocodedAt(OffsetDateTime.now());
                },
                () -> {
                    // keep any previous coords if lookup failed; but stamp the attempt
                    t.setGeocodedAt(OffsetDateTime.now());
                }
        );
    }

    /* ===================== Create ===================== */

    @POST
    @Authenticated
    @Transactional
    public Response create(@Valid CreateTournamentRequest req) {
        Tournaments t = tournamentMapper.toEntity(req);
        stampCreator(t);
        applyGeocoding(t);
        Tournaments saved = tournamentsRepo.save(t);
        return Response.created(URI.create("/tournaments/" + saved.getUuid()))
                .entity(tournamentMapper.toDetails(saved))
                .build();
    }

    @POST
    @Path("/multipart")
    @Authenticated
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Transactional
    public Response createMultipart(
            @RestForm("data") String data,          // JSON string for CreateTournamentRequest
            @RestForm("poster") FileUpload poster   // optional image file
    ) {
        if (data == null || data.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Missing 'data' part").build();
        }

        final CreateTournamentRequest req;
        try {
            req = objectMapper.readValue(data, CreateTournamentRequest.class);
        } catch (Exception ex) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Invalid JSON in 'data' part").build();
        }

        if (req.name() == null || req.name().trim().isEmpty()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("name is required").build();
        }

        Tournaments t = tournamentMapper.toEntity(req);
        stampCreator(t);

        if (poster != null && poster.size() > 0) {
            Resources r = storageService.uploadPoster(poster);
            t.setResource(r);
        }

        applyGeocoding(t);
        Tournaments saved = tournamentsRepo.save(t);
        URI location = URI.create("/tournaments/" + saved.getUuid());
        return Response.created(location)
                .entity(tournamentMapper.toDetails(saved))
                .build();
    }

    /* ===================== Update ===================== */

    @PUT
    @Path("/{uuid}")
    @Authenticated
    @Transactional
    public Response update(@PathParam("uuid") UUID uuid, @Valid CreateTournamentRequest req) {
        var t = tournamentsRepo.findByUuid(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        assertCanEdit(t);

        // Mapper applies all updatable fields in place. Status, winner, poster, and
        // matchmaking preference are intentionally NOT touched here — they're owned by
        // dedicated endpoints (/start, /finish, /reset, /multipart, /preserve-matchmaking).
        String previousLocation = t.getLocation();
        tournamentMapper.applyUpdate(t, req);
        t.setUpdatedAt(OffsetDateTime.now());

        // Re-geocode only when the location actually changed — saves Nominatim hits.
        if (!java.util.Objects.equals(previousLocation, t.getLocation())) {
            applyGeocoding(t);
        }

        return Response.ok(tournamentMapper.toDetails(t)).build();
    }

    /**
     * One-shot backfill: geocodes every tournament that has a location but no coords.
     * Sleeps 1s between calls to respect Nominatim's usage policy. Returns a small
     * summary so the operator can see what happened.
     */
    @POST
    @Path("/geocode-missing")
    @Authenticated
    @Transactional
    public Response geocodeMissing() {
        var all = tournamentsRepo.listAll();
        int attempted = 0, resolved = 0, skipped = 0;
        for (var t : all) {
            if (t.getLocation() == null || t.getLocation().isBlank()) { skipped++; continue; }
            if (t.getLatitude() != null && t.getLongitude() != null) { skipped++; continue; }
            applyGeocoding(t);
            attempted++;
            if (t.getLatitude() != null) resolved++;
            try { Thread.sleep(1100); } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        return Response.ok(java.util.Map.of(
                "total", all.size(),
                "attempted", attempted,
                "resolved", resolved,
                "skipped", skipped
        )).build();
    }

    /* ===================== Lifecycle ===================== */

    @PUT
    @Path("/{uuid}/start")
    @Authenticated
    @Transactional
    public Response startTournament(@PathParam("uuid") UUID uuid) {
        var t = tournamentsRepo.findByUuid(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        assertCanEdit(t);

        if (t.getStatus() == TournamentStatus.FINISHED) {
            return Response.status(Response.Status.CONFLICT).entity("ALREADY_FINISHED").build();
        }

        // A tournament needs at least two pairs that have actually paid.
        // Pending self-registered pairs are excluded from the count — the
        // organizer must approve them first (otherwise self-registrations
        // could let anyone start a tournament with bogus pairs).
        long paidApprovedCount = pairRepo.findByTournament_Id(t.getId()).stream()
                .filter(p -> p.isPaid() && !p.isPendingApproval())
                .count();
        if (paidApprovedCount < 2) {
            return Response.status(Response.Status.CONFLICT).entity("INSUFFICIENT_PAIRS").build();
        }

        // Block if at least one approved pair hasn't paid
        if (pairRepo.existsByTournament_IdAndPaidFalse(t.getId())) {
            return Response.status(Response.Status.CONFLICT).entity("UNPAID_REQUIRED").build();
        }

        if (t.getStatus() != TournamentStatus.STARTED) {
            t.setStatus(TournamentStatus.STARTED);
            t.setUpdatedAt(OffsetDateTime.now());
        }
        return Response.ok(tournamentMapper.toDetails(t)).build();
    }

    @POST
    @Path("/{uuid}/finish")
    @Authenticated
    @Transactional
    public Response finishTournament(@PathParam("uuid") UUID uuid) {
        var t = tournamentsRepo.findByUuid(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        assertCanEdit(t);

        if (t.getStatus() == TournamentStatus.FINISHED) {
            return Response.ok(tournamentMapper.toDetails(t)).build();
        }

        var active = pairRepo.findByTournament_Id(t.getId())
                .stream()
                .filter(p -> !p.isEliminated())
                .toList();

        if (active.size() != 1) {
            return Response.status(Response.Status.CONFLICT)
                    .entity("EXACTLY_ONE_ACTIVE_PAIR_REQUIRED").build();
        }

        var winner = active.get(0);

        // Ensure elimination flags reflect the final state
        var allPairs = pairRepo.findByTournament_Id(t.getId());
        for (var p : allPairs) {
            boolean shouldBeEliminated = !Objects.equals(p.getId(), winner.getId());
            if (p.isEliminated() != shouldBeEliminated) {
                p.setEliminated(shouldBeEliminated);
            }
        }

        t.setStatus(TournamentStatus.FINISHED);
        t.setWinnerName(winner.getName());
        t.setUpdatedAt(OffsetDateTime.now());

        return Response.ok(tournamentMapper.toDetails(t)).build();
    }

    @POST
    @Path("/{uuid}/reset")
    @Authenticated
    @Transactional
    public Response resetTournament(@PathParam("uuid") UUID uuid) {
        var t = tournamentsRepo.findByUuid(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        assertCanEdit(t);

        // 1) Delete all matches first (avoid FK issues), then rounds
        matchesRepo.deleteByTournament(t);
        roundsRepo.deleteByTournament(t);

        // 2) Zero out pair stats and un-eliminate everyone (keeps extraLife as-is)
        var pairs = pairRepo.findByTournament_Id(t.getId());
        for (var p : pairs) {
            p.setWins(0);
            p.setLosses(0);
            p.setEliminated(false);
        }

        // 3) Reset tournament status and winner
        t.setStatus(TournamentStatus.DRAFT);
        t.setWinnerName(null);
        t.setUpdatedAt(OffsetDateTime.now());

        return Response.ok(tournamentMapper.toDetails(t)).build();
    }

    @PATCH
    @Path("/{uuid}/preserve-matchmaking")
    @Authenticated
    @Transactional
    public Response setPreserveMatchmaking(
            @PathParam("uuid") UUID uuid,
            @Valid PreserveMatchmakingRequest body
    ) {
        var t = tournamentsRepo.findByUuid(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        assertCanEdit(t);

        t.setPreserveMatchmaking(body.preserveMatchmaking());
        t.setUpdatedAt(OffsetDateTime.now());

        return Response.ok(tournamentMapper.toDetails(t)).build();
    }

    /* ===================== Read ===================== */

    @GET
    public List<TournamentCardDto> list(@QueryParam("status") @DefaultValue("upcoming") String status) {
        var now = OffsetDateTime.now();
        List<Tournaments> items = "finished".equalsIgnoreCase(status)
                ? tournamentsRepo.findByStartAtBeforeOrderByStartAtDesc(now)
                : tournamentsRepo.findByStartAtGreaterThanEqualOrderByStartAtAsc(now);

        if (items.isEmpty()) return List.of();

        List<Long> ids = items.stream().map(Tournaments::getId).toList();
        Map<Long, Long> counts = pairRepo.countByTournamentIds(ids).stream()
                .collect(Collectors.toMap(
                        r -> (Long) r[0],
                        r -> (Long) r[1]
                ));

        return tournamentMapper.toCardList(items, counts);
    }

    @GET
    @Path("/{uuid}")
    public Response getById(@PathParam("uuid") UUID uuid) {
        return tournamentsRepo.findByUuid(uuid)
                .map(tournamentMapper::toDetails)
                .map(dto -> Response.ok(dto).build())
                .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).build());
    }

    /* ===================== Pairs ===================== */

    @GET
    @Path("/{uuid}/pairs")
    public Response listPairs(@PathParam("uuid") UUID uuid) {
        var t = tournamentsRepo.findByUuid(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        var pairs = pairRepo.findByTournament_Id(t.getId());
        return Response.ok(pairMapper.toDtoListEnriched(pairs, fetchSubmitterProfiles(pairs))).build();
    }

    /** Bulk-load UserProfile rows for all distinct submittedByUid values in {@code pairs}. */
    private java.util.Map<String, hr.mrodek.apps.bela_turniri.model.UserProfile> fetchSubmitterProfiles(List<Pairs> pairs) {
        java.util.Set<String> uids = pairs.stream()
                .map(Pairs::getSubmittedByUid)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        return userProfileRepo.findByUids(uids);
    }

    @PUT
    @Path("/{uuid}/pairs")
    @Authenticated
    @Transactional
    public Response replacePairs(
            @PathParam("uuid") UUID uuid,
            @Valid List<@Valid PairDto> payload
    ) {
        var tournament = tournamentsRepo.findByUuid(uuid).orElse(null);
        if (tournament == null) return Response.status(Response.Status.NOT_FOUND).build();
        assertCanEdit(tournament);

        if (payload == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Body required").build();
        }
        if (payload.stream().anyMatch(p -> p.name() == null || p.name().trim().isEmpty())) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Each pair needs a name").build();
        }

        // Managed rows for this tx
        var existing = pairRepo.findByTournament_Id(tournament.getId());
        Map<Long, Pairs> byId = existing.stream()
                .filter(p -> p.getId() != null)
                .collect(Collectors.toMap(Pairs::getId, p -> p));

        Set<Long> payloadIds = payload.stream()
                .map(PairDto::id)
                .filter(Objects::nonNull)
                .map(Integer::longValue)
                .collect(Collectors.toSet());

        // 1) delete removed rows first
        for (var e : existing) {
            if (e.getId() != null && !payloadIds.contains(e.getId())) {
                pairRepo.delete(e);
            }
        }

        // 2) update managed rows, collect new rows to insert
        List<Pairs> toInsert = new ArrayList<>();
        for (var in : payload) {
            Long pid = (in.id() == null) ? null : in.id().longValue();

            if (pid != null && byId.containsKey(pid)) {
                var entity = byId.get(pid);
                pairMapper.updateEntity(entity, in);
                if (entity.getWins() < 0) entity.setWins(0);
                if (entity.getLosses() < 0) entity.setLosses(0);
            } else {
                var entity = new Pairs();
                entity.setTournament(tournament);
                pairMapper.updateEntity(entity, in);
                if (entity.getWins() < 0) entity.setWins(0);
                if (entity.getLosses() < 0) entity.setLosses(0);
                toInsert.add(entity);
            }
        }

        if (!toInsert.isEmpty()) {
            pairRepo.saveAll(toInsert);
        }

        var all = pairRepo.findByTournament_Id(tournament.getId());
        return Response.ok(pairMapper.toDtoListEnriched(all, fetchSubmitterProfiles(all))).build();
    }

    @POST
    @Path("/{uuid}/pairs/{pairId}/extra-life")
    @Authenticated
    @Transactional
    public Response buyExtraLife(
            @PathParam("uuid") String uuid,
            @PathParam("pairId") Long pairId
    ) {
        var t = tournamentsRepo.findByUuid(java.util.UUID.fromString(uuid)).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        assertCanEdit(t);
        return Response.ok(repassageService.buyExtraLife(uuid, pairId)).build();
    }

    /**
     * Any logged-in user can self-register a pair against a tournament that
     * hasn't started yet. The pair is created with `pendingApproval=true` and
     * `submittedByUid=current user` so the organizer can confirm or reject it.
     */
    @POST
    @Path("/{uuid}/pairs/self-register")
    @Authenticated
    @Transactional
    public Response selfRegisterPair(
            @PathParam("uuid") UUID uuid,
            @Valid SelfRegisterPairRequest body
    ) {
        var t = tournamentsRepo.findByUuid(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();

        if (t.getStatus() == TournamentStatus.STARTED || t.getStatus() == TournamentStatus.FINISHED) {
            return Response.status(Response.Status.CONFLICT).entity("TOURNAMENT_ALREADY_STARTED").build();
        }

        // Reject duplicate name from the same self-registering user — prevents
        // the same person from accidentally re-registering the same pair.
        String myUid = jwt.getSubject();
        String trimmedName = body.name().trim();
        boolean alreadyRegistered = pairRepo.findByTournament_Id(t.getId()).stream()
                .anyMatch(existing ->
                        myUid != null && myUid.equals(existing.getSubmittedByUid())
                                && existing.getName() != null
                                && existing.getName().equalsIgnoreCase(trimmedName));
        if (alreadyRegistered) {
            return Response.status(Response.Status.CONFLICT).entity("ALREADY_REGISTERED").build();
        }

        // Make sure the user has a UserProfile row + slug *before* we persist
        // the pair. Without this, pair-list enrichment would render the row
        // without "Prijavio: …" any time the front-end /user/me/sync hadn't
        // landed yet (race between sign-in and the first self-register).
        slugService.ensureProfile(myUid, displayNameFromJwt());

        // Capacity is intentionally not enforced here — the organizer can review
        // the pending list and approve/reject to fit their tournament size.

        Pairs p = new Pairs();
        p.setTournament(t);
        p.setName(body.name().trim());
        p.setEliminated(false);
        p.setExtraLife(false);
        p.setWins(0);
        p.setLosses(0);
        p.setPaid(false);
        p.setSubmittedByUid(jwt.getSubject());
        p.setPendingApproval(true);

        pairRepo.save(p);

        // Auto-save the typed name into the user's pair-name address book so
        // they don't have to type it again next time. Skipped when the same
        // name (case-insensitive) is already saved.
        if (myUid != null) {
            var alreadySaved = userPairPresetRepo
                    .findByUserUidAndNameIgnoreCase(myUid, trimmedName)
                    .isPresent();
            if (!alreadySaved) {
                var preset = new hr.mrodek.apps.bela_turniri.model.UserPairPreset();
                preset.setUserUid(myUid);
                preset.setName(trimmedName);
                userPairPresetRepo.save(preset);
            }
        }

        return Response.status(Response.Status.CREATED)
                .entity(pairMapper.toDtoEnriched(p, fetchSubmitterProfiles(List.of(p))))
                .build();
    }

    /**
     * Organizer approves a pending self-registered pair. Owner-or-admin only.
     */
    @POST
    @Path("/{uuid}/pairs/{pairId}/approve")
    @Authenticated
    @Transactional
    public Response approvePair(
            @PathParam("uuid") UUID uuid,
            @PathParam("pairId") Long pairId
    ) {
        var t = tournamentsRepo.findByUuid(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        assertCanEdit(t);

        var pairOpt = pairRepo.findByIdOptional(pairId);
        if (pairOpt.isEmpty()) return Response.status(Response.Status.NOT_FOUND).build();

        var pair = pairOpt.get();
        if (pair.getTournament() == null || !Objects.equals(pair.getTournament().getId(), t.getId())) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        pair.setPendingApproval(false);
        return Response.ok(pairMapper.toDtoEnriched(pair, fetchSubmitterProfiles(List.of(pair)))).build();
    }

    @PATCH
    @Path("/{uuid}/pairs/{pairId}/paid")
    @Authenticated
    @Transactional
    public Response setPairPaid(
            @PathParam("uuid") UUID uuid,
            @PathParam("pairId") Long pairId,
            @Valid PaidRequest body
    ) {
        var t = tournamentsRepo.findByUuid(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        assertCanEdit(t);

        var pairOpt = pairRepo.findByIdOptional(pairId);
        if (pairOpt.isEmpty()) return Response.status(Response.Status.NOT_FOUND).build();

        var pair = pairOpt.get();
        if (pair.getTournament() == null || !Objects.equals(pair.getTournament().getId(), t.getId())) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        pair.setPaid(Boolean.TRUE.equals(body.paid()));
        // @UpdateTimestamp on Pairs.updatedAt handles the touch automatically

        return Response.noContent().build();
    }

    /**
     * Delete a single pair from a tournament. Owner/admin only — same gating
     * as the bulk-replace PUT. Refuses to delete once the tournament has
     * started (matches reference pair_id, so blowing them up would orphan
     * historical results).
     */
    @DELETE
    @Path("/{uuid}/pairs/{pairId}")
    @Authenticated
    @Transactional
    public Response deletePair(
            @PathParam("uuid") UUID uuid,
            @PathParam("pairId") Long pairId
    ) {
        var t = tournamentsRepo.findByUuid(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        assertCanEdit(t);

        if (t.getStatus() == TournamentStatus.STARTED || t.getStatus() == TournamentStatus.FINISHED) {
            return Response.status(Response.Status.CONFLICT).entity("TOURNAMENT_ALREADY_STARTED").build();
        }

        var pairOpt = pairRepo.findByIdOptional(pairId);
        if (pairOpt.isEmpty()) return Response.status(Response.Status.NOT_FOUND).build();

        var pair = pairOpt.get();
        if (pair.getTournament() == null || !Objects.equals(pair.getTournament().getId(), t.getId())) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        pairRepo.delete(pair);
        return Response.noContent().build();
    }

    /**
     * Soft-delete a tournament. Admin-only — non-admins (even the creator)
     * can't trigger this because deleting a tournament wipes it from every
     * other user's history view, which is a heavier action than editing.
     *
     * Sets {@code is_deleted = true} on the row. The class-level
     * {@code @Where(clause = "is_deleted = false")} on Tournaments makes the
     * row disappear from every read path; nothing else needs to change.
     */
    @DELETE
    @Path("/{uuid}")
    @Authenticated
    @Transactional
    public Response softDeleteTournament(@PathParam("uuid") UUID uuid) {
        boolean admin = identity != null && identity.hasRole("admin");
        if (!admin) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Samo administrator može obrisati turnir.").build();
        }
        var t = tournamentsRepo.findByUuid(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        t.setDeleted(true);
        return Response.noContent().build();
    }
}
