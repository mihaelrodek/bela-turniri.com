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
import hr.mrodek.apps.bela_turniri.services.PushService;
import hr.mrodek.apps.bela_turniri.services.RepassageService;
import hr.mrodek.apps.bela_turniri.services.SlugService;
import hr.mrodek.apps.bela_turniri.services.StorageService;
import hr.mrodek.apps.bela_turniri.services.TournamentSlugService;
import io.quarkus.security.Authenticated;
import jakarta.annotation.security.RolesAllowed;
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
    @Inject TournamentSlugService tournamentSlugService;
    @Inject PushService pushService;

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

    /**
     * Reject a request with a startAt in the past. Mirrors the frontend's
     * {@code min} attribute and submit-time check — both layers exist
     * because either can be bypassed (custom client, slow form-fill).
     * Allows a 5-minute slack so clock skew between client and server
     * doesn't reject borderline-valid creates.
     */
    private static void assertStartInFuture(OffsetDateTime startAt) {
        if (startAt == null) return; // null is handled by other validation
        OffsetDateTime cutoff = OffsetDateTime.now().minusMinutes(5);
        if (startAt.isBefore(cutoff)) {
            throw new BadRequestException("Datum i vrijeme turnira ne mogu biti u prošlosti.");
        }
    }

    @POST
    @Authenticated
    @Transactional
    public Response create(@Valid CreateTournamentRequest req) {
        assertStartInFuture(req.startAt());
        Tournaments t = tournamentMapper.toEntity(req);
        stampCreator(t);
        applyGeocoding(t);
        // Generate slug before save so the unique index sees it on first
        // INSERT — the entity already has name + startAt populated by the
        // mapper at this point.
        t.setSlug(tournamentSlugService.generateUnique(t, null));
        Tournaments saved = tournamentsRepo.save(t);
        return Response.created(URI.create("/tournaments/" + saved.getSlug()))
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
        assertStartInFuture(req.startAt());

        Tournaments t = tournamentMapper.toEntity(req);
        stampCreator(t);

        if (poster != null && poster.size() > 0) {
            Resources r = storageService.uploadPoster(poster);
            t.setResource(r);
        }

        applyGeocoding(t);
        t.setSlug(tournamentSlugService.generateUnique(t, null));
        Tournaments saved = tournamentsRepo.save(t);
        URI location = URI.create("/tournaments/" + saved.getSlug());
        return Response.created(location)
                .entity(tournamentMapper.toDetails(saved))
                .build();
    }

    /* ===================== Poster (edit) ===================== */

    /**
     * Replace the tournament's poster with the uploaded file. Owner-only.
     * Mirrors the multipart path in createMultipart but scoped to an
     * existing tournament. The previous Resources row is left in place;
     * StorageService is responsible for any retention/cleanup policy.
     */
    @POST
    @Path("/{uuid}/poster")
    @Authenticated
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Transactional
    public Response updatePoster(
            @PathParam("uuid") String uuid,
            @RestForm("poster") FileUpload poster
    ) {
        var t = tournamentsRepo.findByUuidOrSlug(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        assertCanEdit(t);
        if (poster == null || poster.size() == 0) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Missing 'poster' file part").build();
        }
        Resources r = storageService.uploadPoster(poster);
        t.setResource(r);
        t.setUpdatedAt(OffsetDateTime.now());
        return Response.ok(tournamentMapper.toDetails(t)).build();
    }

    /** Remove the tournament's poster. Owner-only. */
    @DELETE
    @Path("/{uuid}/poster")
    @Authenticated
    @Transactional
    public Response deletePoster(@PathParam("uuid") String uuid) {
        var t = tournamentsRepo.findByUuidOrSlug(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        assertCanEdit(t);
        t.setResource(null);
        t.setUpdatedAt(OffsetDateTime.now());
        return Response.ok(tournamentMapper.toDetails(t)).build();
    }

    /* ===================== Update ===================== */

    @PUT
    @Path("/{uuid}")
    @Authenticated
    @Transactional
    public Response update(@PathParam("uuid") String uuid, @Valid CreateTournamentRequest req) {
        var t = tournamentsRepo.findByUuidOrSlug(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        assertCanEdit(t);
        // Block moving the date into the past on edit too. Editing a
        // currently-running or finished tournament's date isn't sensible.
        assertStartInFuture(req.startAt());

        // Mapper applies all updatable fields in place. Status, winner, poster, and
        // matchmaking preference are intentionally NOT touched here — they're owned by
        // dedicated endpoints (/start, /finish, /reset, /multipart, /preserve-matchmaking).
        String previousLocation = t.getLocation();
        String previousName = t.getName();
        OffsetDateTime previousStartAt = t.getStartAt();
        tournamentMapper.applyUpdate(t, req);
        t.setUpdatedAt(OffsetDateTime.now());

        // Re-geocode only when the location actually changed — saves Nominatim hits.
        if (!java.util.Objects.equals(previousLocation, t.getLocation())) {
            applyGeocoding(t);
        }

        // Regenerate the slug if the name or start date changed — those are the
        // only inputs that go into the slug. We pass the current id so the row's
        // existing slug doesn't trip the uniqueness check against itself.
        boolean nameChanged = !java.util.Objects.equals(previousName, t.getName());
        boolean dateChanged = !java.util.Objects.equals(previousStartAt, t.getStartAt());
        if (nameChanged || dateChanged || t.getSlug() == null || t.getSlug().isBlank()) {
            t.setSlug(tournamentSlugService.generateUnique(t, t.getId()));
        }

        return Response.ok(tournamentMapper.toDetails(t)).build();
    }

    /**
     * One-shot backfill: geocodes every tournament that has a location but no coords.
     * Sleeps 1s between calls to respect Nominatim's usage policy. Returns a small
     * summary so the operator can see what happened.
     *
     * Admin-only: a regular logged-in user could otherwise pin the request thread
     * for several minutes per call (1s sleep × N tournaments) and burn the shared
     * Nominatim usage budget. The {@code role: "admin"} custom claim is set via
     * {@code scripts/set-admin.mjs}.
     */
    @POST
    @Path("/geocode-missing")
    @RolesAllowed("admin")
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
    public Response startTournament(@PathParam("uuid") String uuid) {
        var t = tournamentsRepo.findByUuidOrSlug(uuid).orElse(null);
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
    public Response finishTournament(@PathParam("uuid") String uuid) {
        var t = tournamentsRepo.findByUuidOrSlug(uuid).orElse(null);
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

    /**
     * Set the 2nd + 3rd place pair names after the tournament finishes.
     * Owner or admin only. Both body fields are nullable — a null/blank
     * value clears that column, letting the organiser remove a wrongly-set
     * podium position.
     *
     * <p>Each non-blank name is matched (case-insensitive, trimmed)
     * against the tournament's own pair names. Unknown names return
     * 400 — better than silently persisting garbage that the SPA can't
     * highlight on the Parovi tab.
     *
     * <p>Doesn't gate on tournament status. Most organisers will fill
     * the podium right after FINISH, but allowing edits while STARTED
     * (or even on a DRAFT) doesn't hurt and lets the organiser pre-fill
     * if they want.
     */
    @PATCH
    @Path("/{uuid}/podium")
    @Authenticated
    @Transactional
    public Response setPodium(@PathParam("uuid") String uuid,
                              PodiumRequest req) {
        var t = tournamentsRepo.findByUuidOrSlug(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        assertCanEdit(t);

        if (req == null) req = new PodiumRequest(null, null);

        // Build the set of valid pair names once (case-insensitive,
        // trimmed) so we can validate both inputs against the same
        // dataset without doing two queries.
        var pairNames = pairRepo.findByTournament_Id(t.getId()).stream()
                .map(p -> p.getName() == null ? null : p.getName().trim().toLowerCase(java.util.Locale.ROOT))
                .filter(s -> s != null && !s.isEmpty())
                .collect(java.util.stream.Collectors.toSet());

        String second = normalisePodiumName(req.secondPlaceName());
        String third  = normalisePodiumName(req.thirdPlaceName());

        if (second != null && !pairNames.contains(second.toLowerCase(java.util.Locale.ROOT))) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("SECOND_PLACE_PAIR_NOT_FOUND").build();
        }
        if (third != null && !pairNames.contains(third.toLowerCase(java.util.Locale.ROOT))) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("THIRD_PLACE_PAIR_NOT_FOUND").build();
        }
        if (second != null && third != null
                && second.equalsIgnoreCase(third)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("SAME_PAIR_FOR_SECOND_AND_THIRD").build();
        }
        // Don't allow podium to overlap with the gold winner — a single
        // pair can't simultaneously be 1st AND (2nd|3rd).
        if (t.getWinnerName() != null) {
            String winner = t.getWinnerName().trim();
            if (second != null && winner.equalsIgnoreCase(second)) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity("SECOND_PLACE_EQUALS_WINNER").build();
            }
            if (third != null && winner.equalsIgnoreCase(third)) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity("THIRD_PLACE_EQUALS_WINNER").build();
            }
        }

        t.setSecondPlaceName(second);
        t.setThirdPlaceName(third);
        t.setUpdatedAt(OffsetDateTime.now());

        return Response.ok(tournamentMapper.toDetails(t)).build();
    }

    /** Trim + null-out empty strings so the DB stores a clean null. */
    private static String normalisePodiumName(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    @POST
    @Path("/{uuid}/reset")
    @Authenticated
    @Transactional
    public Response resetTournament(@PathParam("uuid") String uuid) {
        var t = tournamentsRepo.findByUuidOrSlug(uuid).orElse(null);
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
            @PathParam("uuid") String uuid,
            @Valid PreserveMatchmakingRequest body
    ) {
        var t = tournamentsRepo.findByUuidOrSlug(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        assertCanEdit(t);

        t.setPreserveMatchmaking(body.preserveMatchmaking());
        t.setUpdatedAt(OffsetDateTime.now());

        return Response.ok(tournamentMapper.toDetails(t)).build();
    }

    /* ===================== Read ===================== */

    @GET
    public List<TournamentCardDto> list(
            @QueryParam("status") @DefaultValue("upcoming") String status,
            @QueryParam("offset") @DefaultValue("0") int offset,
            @QueryParam("limit") @DefaultValue("0") int limit) {
        // "finished" means explicit TournamentStatus.FINISHED — date isn't
        // the source of truth (a tournament that started today and is still
        // being scored is in progress, not finished). The other bucket
        // covers DRAFT + STARTED, sorted by startAt ascending so the soonest
        // event is first. Pagination is opt-in via offset/limit: pass
        // limit=0 (default) to get everything, or a positive limit to page.
        final List<Tournaments> items;
        if ("finished".equalsIgnoreCase(status)) {
            if (limit > 0) {
                items = tournamentsRepo.findFinishedPaged(Math.max(0, offset), limit);
            } else {
                items = tournamentsRepo.findFinishedPaged(0, Integer.MAX_VALUE);
            }
        } else {
            items = tournamentsRepo.findNotFinishedOrderByStartAtAsc();
        }

        if (items.isEmpty()) return List.of();

        List<Long> ids = items.stream().map(Tournaments::getId).toList();
        Map<Long, Long> counts = pairRepo.countByTournamentIds(ids).stream()
                .collect(Collectors.toMap(
                        r -> (Long) r[0],
                        r -> (Long) r[1]
                ));

        return tournamentMapper.toCardList(items, counts);
    }

    /**
     * Lightweight count for paginated finished listings — the SPA hits this
     * once to know whether to render the "Učitaj više" button after the
     * initial page of finished tournaments.
     */
    @GET
    @Path("/count")
    public java.util.Map<String, Long> count(
            @QueryParam("status") @DefaultValue("finished") String status) {
        if ("finished".equalsIgnoreCase(status)) {
            return java.util.Map.of("total", tournamentsRepo.countFinished());
        }
        // Other buckets aren't paged today so they don't need a count.
        return java.util.Map.of("total", 0L);
    }

    @GET
    @Path("/{uuid}")
    public Response getById(@PathParam("uuid") String idOrSlug) {
        // Accepts either a UUID (legacy / shared URLs from before slugs landed)
        // or the new pretty slug, so existing bookmarks keep working.
        return tournamentsRepo.findByUuidOrSlug(idOrSlug)
                .map(tournamentMapper::toDetails)
                .map(dto -> Response.ok(dto).build())
                .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).build());
    }

    /* ===================== Pairs ===================== */

    @GET
    @Path("/{uuid}/pairs")
    public Response listPairs(@PathParam("uuid") String uuid) {
        var t = tournamentsRepo.findByUuidOrSlug(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        var pairs = pairRepo.findByTournament_Id(t.getId());
        // Emit claim tokens only to the primary submitter of each pair
        // (so they can copy the share link) or to organizer/admin.
        // Other viewers don't see tokens — the share link is for the
        // primary to hand out, not for the whole tournament to see.
        String viewerUid = (jwt != null) ? jwt.getSubject() : null;
        boolean viewerIsOrganizerOrAdmin =
                (identity != null && identity.hasRole("admin"))
                || (viewerUid != null && viewerUid.equals(t.getCreatedByUid()));
        return Response.ok(
                pairMapper.toDtoListEnrichedForViewer(
                        pairs,
                        fetchSubmitterProfiles(pairs),
                        viewerUid,
                        viewerIsOrganizerOrAdmin
                )
        ).build();
    }

    /**
     * Build a random opaque token for the pair-sharing URL. 24 bytes of
     * SecureRandom encoded base64-url-no-padding = 32 chars — short
     * enough to fit in a clipboard-friendly URL, long enough that
     * brute-forcing is infeasible.
     */
    private static String generateClaimToken() {
        byte[] buf = new byte[24];
        new java.security.SecureRandom().nextBytes(buf);
        return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }

    /**
     * Bulk-load UserProfile rows for every distinct submitter UID across
     * the given pairs — both primary submitters AND co-owners that
     * claimed the pair via the share link. Same map serves both
     * enrichment lookups in PairMapper.toDtoEnriched.
     */
    private java.util.Map<String, hr.mrodek.apps.bela_turniri.model.UserProfile> fetchSubmitterProfiles(List<Pairs> pairs) {
        java.util.Set<String> uids = new java.util.HashSet<>();
        for (var p : pairs) {
            if (p.getSubmittedByUid() != null) uids.add(p.getSubmittedByUid());
            if (p.getCoSubmittedByUid() != null) uids.add(p.getCoSubmittedByUid());
        }
        return userProfileRepo.findByUids(uids);
    }

    @PUT
    @Path("/{uuid}/pairs")
    @Authenticated
    @Transactional
    public Response replacePairs(
            @PathParam("uuid") String uuid,
            @Valid List<@Valid PairDto> payload
    ) {
        var tournament = tournamentsRepo.findByUuidOrSlug(uuid).orElse(null);
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
        // Same viewer-aware emission as listPairs — primary submitter
        // of each row sees their own claim token; everyone else gets
        // null in that field.
        String viewerUid = (jwt != null) ? jwt.getSubject() : null;
        boolean viewerIsOrganizerOrAdmin =
                (identity != null && identity.hasRole("admin"))
                || (viewerUid != null && viewerUid.equals(tournament.getCreatedByUid()));
        return Response.ok(
                pairMapper.toDtoListEnrichedForViewer(
                        all,
                        fetchSubmitterProfiles(all),
                        viewerUid,
                        viewerIsOrganizerOrAdmin
                )
        ).build();
    }

    @POST
    @Path("/{uuid}/pairs/{pairId}/extra-life")
    @Authenticated
    @Transactional
    public Response buyExtraLife(
            @PathParam("uuid") String uuid,
            @PathParam("pairId") Long pairId
    ) {
        var t = tournamentsRepo.findByUuidOrSlug(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        assertCanEdit(t);
        // Pass the resolved canonical UUID into the service so the inner
        // lookup doesn't have to also handle slugs.
        return Response.ok(repassageService.buyExtraLife(t.getUuid().toString(), pairId)).build();
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
            @PathParam("uuid") String uuid,
            @Valid SelfRegisterPairRequest body
    ) {
        var t = tournamentsRepo.findByUuidOrSlug(uuid).orElse(null);
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
        // Generate a pair-level claim token (legacy — sharing now happens
        // at the preset level, but the column is kept for back-compat
        // with already-claimed pairs).
        p.setClaimToken(generateClaimToken());

        // Auto-inherit co-owner from the user's matching preset. If the
        // user has already shared the name "Marko & Pero" and the
        // partner has claimed, every new Pair self-registered under
        // that name should also surface on the partner's profile +
        // notifications. The preset is the source of truth.
        if (myUid != null) {
            userPairPresetRepo.findByUserUidAndNameIgnoreCase(myUid, trimmedName)
                    .ifPresent(preset -> {
                        if (preset.getCoOwnerUid() != null && !preset.getCoOwnerUid().isBlank()) {
                            p.setCoSubmittedByUid(preset.getCoOwnerUid());
                        }
                    });
        }

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
            @PathParam("uuid") String uuid,
            @PathParam("pairId") Long pairId
    ) {
        var t = tournamentsRepo.findByUuidOrSlug(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        assertCanEdit(t);

        var pairOpt = pairRepo.findByIdOptional(pairId);
        if (pairOpt.isEmpty()) return Response.status(Response.Status.NOT_FOUND).build();

        var pair = pairOpt.get();
        if (pair.getTournament() == null || !Objects.equals(pair.getTournament().getId(), t.getId())) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        boolean wasPending = pair.isPendingApproval();
        pair.setPendingApproval(false);

        // Notify the player(s) whose pair just got approved. Only push when
        // the row was actually pending — re-approving an already-approved
        // pair would be a confusing duplicate notification. Both the
        // primary submitter and the share-link co-owner get the push.
        if (wasPending) {
            String tournamentRef = t.getSlug() != null && !t.getSlug().isBlank()
                    ? t.getSlug()
                    : (t.getUuid() != null ? t.getUuid().toString() : "");
            java.util.List<String> uids = new java.util.ArrayList<>(2);
            if (pair.getSubmittedByUid() != null && !pair.getSubmittedByUid().isBlank()) {
                uids.add(pair.getSubmittedByUid());
            }
            if (pair.getCoSubmittedByUid() != null && !pair.getCoSubmittedByUid().isBlank()) {
                uids.add(pair.getCoSubmittedByUid());
            }
            for (String uid : uids) {
                pushService.sendToUser(
                        uid,
                        new PushService.PushPayload(
                                "Prijava odobrena",
                                "Tvoj par \"" + pair.getName() + "\" je prihvaćen na turniru " + t.getName() + ".",
                                "/turniri/" + tournamentRef
                        )
                );
            }
        }

        return Response.ok(pairMapper.toDtoEnriched(pair, fetchSubmitterProfiles(List.of(pair)))).build();
    }

    @PATCH
    @Path("/{uuid}/pairs/{pairId}/paid")
    @Authenticated
    @Transactional
    public Response setPairPaid(
            @PathParam("uuid") String uuid,
            @PathParam("pairId") Long pairId,
            @Valid PaidRequest body
    ) {
        var t = tournamentsRepo.findByUuidOrSlug(uuid).orElse(null);
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
            @PathParam("uuid") String uuid,
            @PathParam("pairId") Long pairId
    ) {
        var t = tournamentsRepo.findByUuidOrSlug(uuid).orElse(null);
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
    public Response softDeleteTournament(@PathParam("uuid") String uuid) {
        boolean admin = identity != null && identity.hasRole("admin");
        if (!admin) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Samo administrator može obrisati turnir.").build();
        }
        var t = tournamentsRepo.findByUuidOrSlug(uuid).orElse(null);
        if (t == null) return Response.status(Response.Status.NOT_FOUND).build();
        t.setDeleted(true);
        return Response.noContent().build();
    }
}
