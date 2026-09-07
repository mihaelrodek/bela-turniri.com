package hr.mrodek.apps.bela_turniri.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import hr.mrodek.apps.bela_turniri.dtos.*;
import hr.mrodek.apps.bela_turniri.dtos.SelfRegisterPairRequest;
import hr.mrodek.apps.bela_turniri.mappers.TournamentMapper;
import hr.mrodek.apps.bela_turniri.model.Resources;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.repository.PairsRepository;
import hr.mrodek.apps.bela_turniri.repository.TournamentsRepository;
import hr.mrodek.apps.bela_turniri.services.CurrentUser;
import hr.mrodek.apps.bela_turniri.services.GeocodeService;
import hr.mrodek.apps.bela_turniri.services.IdempotencyService;
import hr.mrodek.apps.bela_turniri.services.QrCodeRenderer;
import hr.mrodek.apps.bela_turniri.services.RepassageService;
import hr.mrodek.apps.bela_turniri.services.SelfRegistrationService;
import hr.mrodek.apps.bela_turniri.services.StorageService;
import hr.mrodek.apps.bela_turniri.services.TournamentAccess;
import hr.mrodek.apps.bela_turniri.services.TournamentLifecycleService;
import hr.mrodek.apps.bela_turniri.services.TournamentPairService;
import hr.mrodek.apps.bela_turniri.services.TournamentSlugService;
import io.quarkus.security.Authenticated;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Tournament CRUD, lifecycle and pair roster.
 *
 * <p>Every mutating endpoint follows the same three beats: resolve the
 * tournament and assert access through {@link TournamentAccess}, delegate
 * the domain rules to a service, map the result to a DTO. The ownership
 * checks, the pair-diff algorithm, the self-registration rules and the
 * DRAFT→STARTED→FINISHED guards all used to live inline here.
 *
 * <p>{@code @Transactional} stays on the resource methods rather than
 * moving down into the services. The access check loads the managed
 * {@link Tournaments} and the service then mutates that same instance; if
 * the service opened its own transaction the entity would already be
 * detached and its writes would vanish at commit.
 */
@Path("/tournaments")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TournamentController {

    @Inject RepassageService repassageService;
    @Inject TournamentMapper tournamentMapper;
    @Inject ObjectMapper objectMapper;
    @Inject StorageService storageService;
    @Inject GeocodeService geocodeService;
    @Inject TournamentSlugService tournamentSlugService;

    @Inject TournamentAccess access;
    @Inject CurrentUser currentUser;
    @Inject IdempotencyService idempotency;
    @Inject TournamentPairService pairService;
    @Inject SelfRegistrationService selfRegistrationService;
    @Inject TournamentLifecycleService lifecycleService;

    @Inject TournamentsRepository tournamentsRepo;
    @Inject PairsRepository pairRepo;

    @Inject QrCodeRenderer qrCodeRenderer;
    @Inject hr.mrodek.apps.bela_turniri.services.MessageService messages;

    /**
     * Used only by {@link #createMultipart}, whose request body is a JSON
     * string inside a form part and therefore never passes through JAX-RS
     * bean validation on its own.
     */
    @Inject Validator validator;

    @ConfigProperty(name = "app.public-base-url", defaultValue = "https://bela-turniri.com")
    String publicBaseUrl;

    /**
     * Stamp the current Firebase user as the creator of a tournament.
     * Falls back to the email claim when no {@code name} is set (e.g. an
     * email/password signup that never filled in a profile name).
     */
    private void stampCreator(Tournaments t) {
        currentUser.uid().ifPresent(uid -> {
            t.setCreatedByUid(uid);
            t.setCreatedByName(currentUser.displayName());
        });
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
        geocodeService.geocode(loc).ifPresent(ll -> {
            t.setLatitude(ll.latitude());
            t.setLongitude(ll.longitude());
            t.setGeocodedAt(OffsetDateTime.now());
        });
        // On failure we deliberately leave latitude/longitude AND geocodedAt
        // untouched: stamping the attempt would mark the row as "handled"
        // even though it has no coordinates, and a transient Nominatim
        // hiccup would silently cost the tournament its map pin forever.
        // Leaving it unstamped keeps /geocode-missing able to retry.
    }

    /* ===================== Create ===================== */

    /**
     * Reject a request with a startAt in the past. Mirrors the frontend's
     * {@code min} attribute and submit-time check — both layers exist
     * because either can be bypassed (custom client, slow form-fill).
     * Allows a 5-minute slack so clock skew between client and server
     * doesn't reject borderline-valid creates.
     */
    // Not static: the rejection text is looked up in the caller's language
    // through the injected MessageService.
    private void assertStartInFuture(OffsetDateTime startAt) {
        if (startAt == null) return; // null is handled by other validation
        OffsetDateTime cutoff = OffsetDateTime.now().minusMinutes(5);
        if (startAt.isBefore(cutoff)) {
            throw new BadRequestException(messages.t("tournament.startAt.past"));
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
            throw new BadRequestException(messages.t("tournament.create.missingDataPart"));
        }

        final CreateTournamentRequest req;
        try {
            req = objectMapper.readValue(data, CreateTournamentRequest.class);
        } catch (Exception ex) {
            throw new BadRequestException(messages.t("tournament.create.invalidDataPart"));
        }

        // The JSON body of POST /tournaments is validated by @Valid; this
        // twin arrives as a string inside a multipart part, so JAX-RS has
        // nothing to cascade into and every CreateTournamentRequest
        // constraint — name length, non-negative prices, maxPairs >= 2 — was
        // simply not enforced on the path the SPA actually uses when a
        // poster is attached. Validate by hand and rethrow as the same
        // exception the automatic path raises, so errors/
        // ConstraintViolationExceptionMapper produces one identical
        // per-field 400 envelope either way.
        var violations = validator.validate(req);
        if (!violations.isEmpty()) throw new ConstraintViolationException(violations);
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
        Tournaments t = access.loadForEdit(uuid);
        if (poster == null || poster.size() == 0) {
            throw new BadRequestException(messages.t("tournament.poster.missingFilePart"));
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
        Tournaments t = access.loadForEdit(uuid);
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
        Tournaments t = access.loadForEdit(uuid);
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
        if (!Objects.equals(previousLocation, t.getLocation())) {
            applyGeocoding(t);
        }

        // Regenerate the slug if the name or start date changed — those are the
        // only inputs that go into the slug. We pass the current id so the row's
        // existing slug doesn't trip the uniqueness check against itself.
        boolean nameChanged = !Objects.equals(previousName, t.getName());
        boolean dateChanged = !Objects.equals(previousStartAt, t.getStartAt());
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
     *
     * <p>NOT {@code @Transactional}: the loop sleeps ~1s per row, and holding
     * a pooled DB connection (plus write locks on every row it touched) for
     * the whole run would be far worse than the run itself. Instead we pick
     * the candidate ids up front in one short read, then let
     * {@link GeocodeService#geocodeOne(Long)} open and commit a transaction
     * per row. Each row is durable as soon as it resolves, so an aborted run
     * keeps whatever it already managed.
     */
    @POST
    @Path("/geocode-missing")
    @RolesAllowed("admin")
    public Response geocodeMissing() {
        long total = tournamentsRepo.count();
        List<Long> candidates = tournamentsRepo.findIdsNeedingGeocode();

        int attempted = 0, resolved = 0;
        for (Long id : candidates) {
            if (attempted > 0) {
                // Nominatim policy: max 1 req/s. Sleep OUTSIDE any transaction.
                try {
                    Thread.sleep(1100);
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
            attempted++;
            if (geocodeService.geocodeOne(id)) resolved++;
        }

        return Response.ok(Map.of(
                "total", total,
                "attempted", attempted,
                "resolved", resolved,
                "skipped", total - candidates.size()
        )).build();
    }

    /* ===================== Lifecycle ===================== */

    @PUT
    @Path("/{uuid}/start")
    @Authenticated
    @Transactional
    public Response startTournament(@PathParam("uuid") String uuid) {
        Tournaments t = lifecycleService.start(access.loadForEdit(uuid));
        return Response.ok(tournamentMapper.toDetails(t)).build();
    }

    @POST
    @Path("/{uuid}/finish")
    @Authenticated
    @Transactional
    public Response finishTournament(@PathParam("uuid") String uuid) {
        Tournaments t = lifecycleService.finish(access.loadForEdit(uuid));
        return Response.ok(tournamentMapper.toDetails(t)).build();
    }

    /**
     * Set the 2nd + 3rd place pair names. Owner or admin only; the
     * validation rules live in {@link TournamentLifecycleService#setPodium}.
     */
    @PATCH
    @Path("/{uuid}/podium")
    @Authenticated
    @Transactional
    public Response setPodium(@PathParam("uuid") String uuid,
                              @Valid PodiumRequest req) {
        Tournaments t = lifecycleService.setPodium(access.loadForEdit(uuid), req);
        return Response.ok(tournamentMapper.toDetails(t)).build();
    }

    @POST
    @Path("/{uuid}/reset")
    @Authenticated
    @Transactional
    public Response resetTournament(@PathParam("uuid") String uuid) {
        Tournaments t = lifecycleService.reset(access.loadForEdit(uuid));
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
        Tournaments t = access.loadForEdit(uuid);
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
        // Negative values are a client bug, never a request for "all" —
        // say so instead of quietly clamping them to something else.
        if (offset < 0 || limit < 0) {
            throw new BadRequestException(messages.t("tournament.list.negativePaging"));
        }
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
    public Map<String, Long> count(
            @QueryParam("status") @DefaultValue("finished") String status) {
        if ("finished".equalsIgnoreCase(status)) {
            return Map.of("total", tournamentsRepo.countFinished());
        }
        // Other buckets aren't paged today so they don't need a count.
        return Map.of("total", 0L);
    }

    /**
     * Tournaments the signed-in user created, newest start first — feeds the
     * "Učitaj iz predloška" picker on the create-tournament wizard. Declared
     * before {@code /{uuid}} so "mine" is never swallowed by the path param.
     */
    @GET
    @Path("/mine")
    @Authenticated
    public List<TournamentCardDto> mine() {
        String uid = currentUser.requireUid();
        List<Tournaments> items = tournamentsRepo.findByCreatedByUidOrderByStartAtDesc(uid);
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
    public TournamentDetailsResponse getById(@PathParam("uuid") String idOrSlug) {
        // Accepts either a UUID (legacy / shared URLs from before slugs landed)
        // or the new pretty slug, so existing bookmarks keep working.
        return tournamentMapper.toDetails(access.load(idOrSlug));
    }

    /* ===================== QR code ===================== */

    /**
     * Branded PNG QR code that opens the tournament's public page when
     * scanned — meant for an organiser to display on a screen or print at
     * the venue. Generated on the fly (nothing is persisted) and memoised
     * for a day via {@link QrCodeRenderer#renderCached}, since the image
     * only changes if the tournament's slug changes. Anonymous, like the
     * tournament page itself.
     */
    @GET
    @Path("/{uuid}/qr.png")
    @Produces("image/png")
    public Response qrCode(
            @PathParam("uuid") String idOrSlug,
            @QueryParam("size") Integer size,
            @HeaderParam("If-None-Match") String ifNoneMatch
    ) {
        Tournaments t = access.load(idOrSlug);
        String base = publicBaseUrl.replaceAll("/+$", "");
        String ref = (t.getSlug() != null && !t.getSlug().isBlank())
                ? t.getSlug() : t.getUuid().toString();
        String url = base + "/turniri/" + ref;
        int px = QrCodeRenderer.clampSize(size);

        String etag = "\"" + qrEtag(url, px) + "\"";
        if (ifNoneMatch != null && etagMatches(ifNoneMatch, etag)) {
            return Response.status(Response.Status.NOT_MODIFIED)
                    .header("Cache-Control", "public, max-age=86400, s-maxage=86400")
                    .header("ETag", etag)
                    .build();
        }

        byte[] png = qrCodeRenderer.renderCached(url, px);
        return Response.ok(png)
                .header("Cache-Control", "public, max-age=86400, s-maxage=86400")
                .header("ETag", etag)
                .build();
    }

    /** Strong ETag derived from the encoded URL + size — both fully determine the PNG bytes. */
    private static String qrEtag(String url, int size) {
        try {
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            byte[] digest = sha256.digest((url + "|" + size).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 16); // 32 hex chars is plenty for a cache key
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e); // SHA-256 is always available on the JVMs we run
        }
    }

    /** Same minimal If-None-Match handling as {@code ResourceController} — exact match or "*". */
    private static boolean etagMatches(String ifNoneMatch, String quotedEtag) {
        if ("*".equals(ifNoneMatch.trim())) return true;
        for (String candidate : ifNoneMatch.split(",")) {
            if (candidate.trim().equals(quotedEtag)) return true;
        }
        return false;
    }

    /* ===================== Pairs ===================== */

    @GET
    @Path("/{uuid}/pairs")
    public List<PairDto> listPairs(@PathParam("uuid") String uuid) {
        return pairService.listForViewer(access.load(uuid));
    }

    @PUT
    @Path("/{uuid}/pairs")
    @Authenticated
    @Transactional
    public List<PairDto> replacePairs(
            @PathParam("uuid") String uuid,
            @Valid List<@Valid PairDto> payload
    ) {
        return pairService.replacePairs(access.loadForEdit(uuid), payload);
    }

    @POST
    @Path("/{uuid}/pairs/{pairId}/extra-life")
    @Authenticated
    @Transactional
    public Response buyExtraLife(
            @PathParam("uuid") String uuid,
            @PathParam("pairId") Long pairId
    ) {
        // Hand the service the managed entity the access check already
        // loaded, not its uuid: re-resolving it there cost a second SELECT
        // and — worse — the "load, check, reload" shape is exactly how an
        // ownership check ends up applying to a different row than the write.
        Tournaments t = access.loadForEdit(uuid);
        return Response.ok(repassageService.buyExtraLife(t, pairId)).build();
    }

    /**
     * Any logged-in user can self-register a pair against a tournament that
     * hasn't started yet. The pair is created with {@code pendingApproval=true}
     * and {@code submittedByUid=current user} so the organizer can confirm
     * or reject it.
     */
    @POST
    @Path("/{uuid}/pairs/self-register")
    @Authenticated
    @Transactional
    public Response selfRegisterPair(
            @PathParam("uuid") String uuid,
            @Valid SelfRegisterPairRequest body
    ) {
        PairDto created = selfRegistrationService.selfRegister(access.load(uuid), body);
        return Response.status(Response.Status.CREATED).entity(created).build();
    }

    /** Organizer approves a pending self-registered pair. Owner-or-admin only. */
    @POST
    @Path("/{uuid}/pairs/{pairId}/approve")
    @Authenticated
    @Transactional
    public PairDto approvePair(
            @PathParam("uuid") String uuid,
            @PathParam("pairId") Long pairId
    ) {
        return pairService.approve(access.loadForEdit(uuid), pairId);
    }

    /**
     * Kotizacija toggle. Typed at the table alongside the scores, so it is
     * one of the three writes the SPA queues while offline and replays on
     * reconnect — hence the optional {@code X-Client-Op-Id}. Still answers
     * 204 with an empty body, replay or not.
     */
    @PATCH
    @Path("/{uuid}/pairs/{pairId}/paid")
    @Authenticated
    @Transactional
    public Response setPairPaid(
            @PathParam("uuid") String uuid,
            @PathParam("pairId") Long pairId,
            @HeaderParam("X-Client-Op-Id") String clientOpId,
            @Valid PaidRequest body
    ) {
        // Access check outside the idempotent block: a replayed op id must
        // never bypass ownership.
        Tournaments t = access.loadForEdit(uuid);
        return idempotency.execute(clientOpId, currentUser.uidOrNull(),
                "PATCH /tournaments/{uuid}/pairs/{pairId}/paid",
                () -> {
                    pairService.setPaid(t, pairId, Boolean.TRUE.equals(body.paid()));
                    return Response.noContent().build();
                });
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
        pairService.deletePair(access.loadForEdit(uuid), pairId);
        return Response.noContent().build();
    }

    /**
     * Soft-delete a tournament. Admin-only — non-admins (even the creator)
     * can't trigger this because deleting a tournament wipes it from every
     * other user's history view, which is a heavier action than editing.
     *
     * Sets {@code is_deleted = true} on the row. The class-level
     * {@code @SQLRestriction("is_deleted = false")} on Tournaments makes the
     * row disappear from every read path; nothing else needs to change.
     */
    @DELETE
    @Path("/{uuid}")
    @Authenticated
    @Transactional
    public Response softDeleteTournament(@PathParam("uuid") String uuid) {
        // Throw rather than hand-build the response, so this 403 behaves like
        // every other one in the app (TournamentAccess.assertCanEdit): it goes
        // through GenericExceptionMapper's pass-through branch and lands in
        // the AUTHZ WARN audit log. A hand-built Response never did — which is
        // precisely the probe you want a trace of, since this endpoint is the
        // only place a non-admin can try to delete someone else's tournament.
        if (!currentUser.isAdmin()) {
            throw new ForbiddenException(messages.t("tournament.delete.adminOnly"));
        }
        access.load(uuid).setDeleted(true);
        return Response.noContent().build();
    }
}
