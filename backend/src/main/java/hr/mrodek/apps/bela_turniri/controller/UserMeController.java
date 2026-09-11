package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.GameStatsDto;
import hr.mrodek.apps.bela_turniri.services.GameNameService;
import hr.mrodek.apps.bela_turniri.dtos.MyTournamentParticipationDto;
import hr.mrodek.apps.bela_turniri.dtos.RegisterPushDeviceRequest;
import hr.mrodek.apps.bela_turniri.dtos.SyncProfileRequest;
import hr.mrodek.apps.bela_turniri.dtos.UserProfileDto;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Resources;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.model.UserPairPreset;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import hr.mrodek.apps.bela_turniri.repository.PairsRepository;
import hr.mrodek.apps.bela_turniri.repository.UserPairPresetRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import hr.mrodek.apps.bela_turniri.services.AvatarPresetService;
import hr.mrodek.apps.bela_turniri.services.CurrentUser;
import hr.mrodek.apps.bela_turniri.services.GameStatsService;
import hr.mrodek.apps.bela_turniri.services.MessageService;
import hr.mrodek.apps.bela_turniri.services.PushDeviceService;
import hr.mrodek.apps.bela_turniri.services.SlugService;
import hr.mrodek.apps.bela_turniri.services.StorageService;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.util.List;

/**
 * Read-only endpoints scoped to the currently signed-in user.
 * Enforces auth at the class level — every operation pulls the UID from
 * the verified JWT so a user can never look at someone else's data.
 */
@Path("/user/me")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserMeController {

    @Inject PairsRepository pairRepo;
    @Inject UserPairPresetRepository presetRepo;
    @Inject UserProfileRepository profileRepo;
    @Inject SlugService slugService;
    @Inject StorageService storageService;
    @Inject MessageService messages;
    @Inject CurrentUser currentUser;
    @Inject GameStatsService gameStatsService;
    @Inject GameNameService gameNameService;
    @Inject PushDeviceService pushDevices;
    @Inject AvatarPresetService avatarPresets;

    @GET
    @Path("/tournaments")
    public List<MyTournamentParticipationDto> myTournaments() {
        String uid = currentUser.requireUid();
        // Pass the user's saved pair-name presets so we also catch tournaments
        // where the pair was added via the organizer flow with a known name.
        var presetNames = presetRepo.findByUserUid(uid).stream()
                .map(UserPairPreset::getName)
                .toList();
        return pairRepo.findMyParticipations(uid, presetNames).stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * "Moji pari" list on the profile's Predlošci tab. Returns every pair
     * the viewer is linked to — as primary submitter (so they can copy
     * the share link) or as the claimed co-owner. Each row carries enough
     * context to render without N+1: tournament name/date, both submitters'
     * display info, and the claim token IF the viewer is the primary.
     */
    @GET
    @Path("/pairs")
    @Transactional
    public List<hr.mrodek.apps.bela_turniri.dtos.MyPairDto> myPairs() {
        String uid = currentUser.requireUid();
        // Reuse findMyParticipations to capture both primary + co-owned
        // pairs. Preset-name fallback is left empty here: the share-link
        // flow only makes sense for actually-persisted Pairs rows where
        // we know who submitted them; legacy-by-name matches don't carry
        // a UID and so can't be shared.
        var pairs = pairRepo.findMyParticipations(uid, java.util.List.of());

        // Bulk-load both submitters' UserProfiles for the row enrichment.
        var profileUids = new java.util.HashSet<String>();
        for (var p : pairs) {
            if (p.getSubmittedByUid() != null) profileUids.add(p.getSubmittedByUid());
            if (p.getCoSubmittedByUid() != null) profileUids.add(p.getCoSubmittedByUid());
        }
        var profilesByUid = profileRepo.findByUids(profileUids);

        var out = new java.util.ArrayList<hr.mrodek.apps.bela_turniri.dtos.MyPairDto>(pairs.size());
        for (Pairs p : pairs) {
            boolean isPrimary = uid != null && uid.equals(p.getSubmittedByUid());
            var primaryProfile = p.getSubmittedByUid() != null
                    ? profilesByUid.get(p.getSubmittedByUid())
                    : null;
            var coProfile = p.getCoSubmittedByUid() != null
                    ? profilesByUid.get(p.getCoSubmittedByUid())
                    : null;
            var t = p.getTournament();
            String ref = t.getSlug() != null && !t.getSlug().isBlank()
                    ? t.getSlug()
                    : (t.getUuid() != null ? t.getUuid().toString() : null);
            out.add(new hr.mrodek.apps.bela_turniri.dtos.MyPairDto(
                    p.getId(),
                    p.getName(),
                    t.getId(),
                    t.getName(),
                    ref,
                    t.getStartAt(),
                    isPrimary,
                    p.isPendingApproval(),
                    primaryProfile != null ? primaryProfile.getDisplayName() : null,
                    primaryProfile != null ? primaryProfile.getSlug() : null,
                    coProfile != null ? coProfile.getDisplayName() : null,
                    coProfile != null ? coProfile.getSlug() : null,
                    isPrimary ? p.getClaimToken() : null
            ));
        }
        return out;
    }

    /**
     * The viewer's online-Bela record (game/README.md §8.5) — one always-present
     * {@code global} row plus a {@code byTargetScore} map holding only the
     * categories they have actually played.
     *
     * <p>Computed by query on every call, never from a stored counter, so it
     * cannot drift from the recorded games. The rows come from the Node game
     * server via {@code POST /api/internal/game-results}; that server also owns
     * the eligibility rule (a game counts only when both teams contain at least
     * one human), so nothing is filtered here.
     */
    @GET
    @Path("/game-stats")
    public GameStatsDto gameStats() {
        return gameStatsService.statsFor(currentUser.requireUid());
    }

    @GET
    @Path("/profile")
    @Transactional   // touch the lazy avatar relation
    public UserProfileDto getProfile() {
        String uid = currentUser.requireUid();
        var p = profileRepo.findByUid(uid).orElse(null);
        // A player can have an in-game name without ever having a profile row:
        // profiles are created lazily, the game name is written by the game
        // server, and the two have never depended on each other. Returning an
        // empty DTO here would hide a name the player can see at the table.
        if (p == null) {
            return new UserProfileDto(null, null, null, null, null, null, null,
                    gameNameService.nameFor(uid), null);
        }
        return toDto(p);
    }

    @PUT
    @Path("/profile")
    @Transactional
    public UserProfileDto updateProfile(@Valid UserProfileDto body) {
        String uid = currentUser.requireUid();
        var existing = profileRepo.findByUid(uid).orElse(null);
        if (existing == null) {
            existing = new UserProfile();
            existing.setUserUid(uid);
            // Row created here rather than by /sync — give it the same
            // starting face ensureProfile would have. Anything the body
            // carries below still wins over it.
            avatarPresets.assignDefaultIfMissing(existing);
        }
        existing.setPhoneCountry(blank(body.phoneCountry()));
        existing.setPhone(blank(body.phone()));
        // body.avatarUrl is intentionally ignored — avatars are managed via
        // the dedicated /avatar endpoints, not via PUT /profile.
        // The CHARACTER, unlike the photo, is writable here: it is a choice
        // from a fixed list, not an upload, so it has no multipart endpoint of
        // its own. Omitted → unchanged, "" → cleared, unknown id → 400
        // INVALID_AVATAR_PRESET. Picking one never touches the photo; which of
        // the two shows is decided in AvatarPresetService.presetFor.
        avatarPresets.applyFromRequest(existing, body.avatarPreset());
        // Theme: accept "light" or "dark", silently ignore anything else
        // (defensive against stale clients).
        if (body.colorMode() != null) {
            String cm = body.colorMode().trim().toLowerCase();
            if ("light".equals(cm) || "dark".equals(cm)) {
                existing.setColorMode(cm);
            }
        }
        // Language: same shape as the theme above — accept a supported tag,
        // silently ignore anything else. The dedicated PATCH below is what the
        // SPA's language switcher actually calls; this branch exists so a full
        // profile PUT does not silently drop the field.
        if (body.locale() != null) {
            String loc = body.locale().trim().toLowerCase();
            if (MessageService.isSupported(loc)) {
                existing.setLocale(loc);
            }
        }
        profileRepo.persist(existing);
        return toDto(existing);
    }

    /**
     * Persist the user's language choice, so it follows the account across
     * devices instead of living only in that browser's localStorage. Called
     * (fire-and-forget, silently) by {@code LocaleSync} whenever the navbar
     * language picker changes while signed in.
     *
     * <p>PATCH rather than PUT because it touches exactly one field: a PUT of
     * the whole profile from a client that only knows about the language would
     * null out the contact details.
     *
     * <p>Only {@link MessageService#SUPPORTED_LANGUAGES} are accepted — the
     * value is echoed back to every device on the next login and used to pick
     * the bundle for this user's push notifications, so an arbitrary string
     * must never reach the column.
     */
    @PATCH
    @Path("/profile/locale")
    @Transactional
    public UserProfileDto updateLocale(@Valid UserProfileDto body) {
        String raw = body == null ? null : body.locale();
        String loc = raw == null ? null : raw.trim().toLowerCase();
        if (!MessageService.isSupported(loc)) {
            throw new BadRequestException(messages.t("user.locale.unsupported", raw));
        }
        String uid = currentUser.requireUid();
        var existing = profileRepo.findByUid(uid).orElse(null);
        if (existing == null) {
            existing = new UserProfile();
            existing.setUserUid(uid);
        }
        existing.setLocale(loc);
        profileRepo.persist(existing);
        return toDto(existing);
    }

    /**
     * Called by the frontend on every login. Persists the Firebase displayName
     * we just got from the SDK and ensures a unique slug exists for the public
     * /profile/{slug} URL.
     *
     * Idempotent — calling repeatedly with the same name keeps the same slug.
     * We never auto-rotate the slug if displayName changes; users link-share
     * their profile, and silently shifting the URL would be worse than a
     * slightly stale one. Anyone who really wants a fresh slug can ask.
     */
    @POST
    @Path("/sync")
    @Transactional
    public UserProfileDto syncProfile(@Valid SyncProfileRequest body) {
        String uid = currentUser.requireUid();
        String displayName = body == null ? null : blank(body.displayName());
        var profile = slugService.ensureProfile(uid, displayName);
        // ensureProfile returns the persisted entity with the slug guaranteed.
        return toDto(profile);
    }

    /* ===================== native push devices ===================== */

    /**
     * {@code PUT /user/me/push/device} — register (or refresh) this user's
     * FCM registration token, so the iOS/Android shell receives the same
     * notifications a browser gets over Web Push.
     *
     * <p>An alias of {@code PUT /push/device}, sitting here because this is
     * the "my account" surface the shells already talk to; both routes call
     * the same {@link PushDeviceService}, so they cannot drift. 201 the first
     * time a token is seen, 200 on the re-registration the app performs on
     * every cold start.
     *
     * <p>Class-level {@code @Authenticated} applies: a guest has no Firebase
     * UID to key the row on, so guests have no native push at all.
     */
    @PUT
    @Path("/push/device")
    @Transactional
    public Response registerPushDevice(@Valid RegisterPushDeviceRequest body) {
        if (body == null) {
            throw new BadRequestException(messages.t("push.device.missingFields"));
        }
        boolean created = pushDevices.register(
                currentUser.requireUid(), body.token(), body.platform(), body.locale(), body.appVersion());
        return Response.status(created ? Response.Status.CREATED : Response.Status.OK).build();
    }

    /**
     * {@code DELETE /user/me/push/device/{token}} — drop one of this user's
     * own registrations. 404 for an unknown token and for someone else's
     * alike, so the response never confirms a token exists elsewhere.
     */
    @DELETE
    @Path("/push/device/{token}")
    @Transactional
    public Response unregisterPushDevice(@PathParam("token") String token) {
        if (token == null || token.isBlank()) {
            throw new BadRequestException(messages.t("push.device.missingFields"));
        }
        pushDevices.unregister(currentUser.requireUid(), token);
        return Response.noContent().build();
    }

    /**
     * Upload (or replace) the current user's avatar. Multipart form with a
     * single {@code avatar} part. The previous avatar's resource row is
     * unlinked, and — best-effort, after the profile update succeeds — its
     * MinIO object and Resources row are cleaned up if nothing else still
     * references it (see {@link StorageService#releaseIfOrphaned(Resources)}).
     */
    @POST
    @Path("/avatar")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Transactional
    public UserProfileDto uploadAvatar(@RestForm("avatar") FileUpload avatar) {
        if (avatar == null || avatar.size() == 0) {
            throw new BadRequestException(messages.t("user.avatar.missingPart"));
        }
        String uid = currentUser.requireUid();
        var profile = profileRepo.findByUid(uid).orElse(null);
        if (profile == null) {
            // First-time uploaders may not have an entity yet — make one.
            profile = new UserProfile();
            profile.setUserUid(uid);
        }
        Resources oldAvatar = profile.getAvatar();
        Resources newResource = storageService.uploadAvatar(avatar);
        profile.setAvatar(newResource);
        // A real photo replaces the stand-in character outright. Without this
        // the row would carry both, and "either a photo or a character" would
        // stop being true the moment the photo was later removed — the user
        // would get back a face they had already replaced.
        profile.setAvatarPreset(null);
        profileRepo.persist(profile);
        if (oldAvatar != null && oldAvatar.getId() != null
                && !oldAvatar.getId().equals(newResource.getId())) {
            storageService.releaseIfOrphaned(oldAvatar);
        }
        return toDto(profile);
    }

    /** Remove the avatar from the current user's profile (FK set to NULL). */
    @DELETE
    @Path("/avatar")
    @Transactional
    public UserProfileDto deleteAvatar() {
        String uid = currentUser.requireUid();
        var profile = profileRepo.findByUid(uid).orElse(null);
        if (profile == null) return new UserProfileDto(null, null, null, null, null);
        profile.setAvatar(null);
        // Removing the photo must never leave a player faceless. Uploading a
        // photo clears the preset outright (see uploadAvatar), so without this
        // the common path — auto-assigned face, upload a photo, later delete it
        // — would fall all the way back to bare initials. `assignDefaultIfMissing`
        // only fills a blank, so a face the user picked while the photo was up
        // survives untouched.
        avatarPresets.assignDefaultIfMissing(profile);
        profileRepo.persist(profile);
        return toDto(profile);
    }

    private static String blank(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    /**
     * Build a UserProfileDto from an entity. Computes the proxied avatar URL
     * from the joined Resources row id; same pattern TournamentMapper uses
     * for posters. Caller must run inside an active transaction so the lazy
     * {@code avatar} association can be resolved.
     */
    private UserProfileDto toDto(UserProfile p) {
        String avatarUrl = null;
        Resources av = p.getAvatar();
        if (av != null && av.getId() != null) {
            avatarUrl = "/api/resources/" + av.getId() + "/image";
        }
        return new UserProfileDto(
                p.getPhoneCountry(),
                p.getPhone(),
                p.getDisplayName(),
                p.getSlug(),
                avatarUrl,
                p.getColorMode(),
                p.getLocale(),
                // Read-only here — the only writer is the game server's
                // internal endpoint, because the same rule has to cover guests
                // who never reach this controller (UserProfileDto.gameName).
                gameNameService.nameFor(p.getUserUid()),
                // Precedence lives in one place — see AvatarPresetService.
                avatarPresets.presetFor(p, avatarUrl));
    }

    private MyTournamentParticipationDto toDto(Pairs p) {
        Tournaments t = p.getTournament();
        boolean isWinner =
                t.getWinnerName() != null
                        && p.getName() != null
                        && t.getWinnerName().trim().equalsIgnoreCase(p.getName().trim());
        return new MyTournamentParticipationDto(
                t.getUuid(),
                t.getSlug(),
                t.getName(),
                t.getLocation(),
                t.getStartAt(),
                t.getStatus() == null ? null : t.getStatus().name(),
                t.getWinnerName(),
                p.getId(),
                p.getName(),
                p.isPendingApproval(),
                p.isEliminated(),
                p.isExtraLife(),
                p.getWins(),
                p.getLosses(),
                isWinner
        );
    }
}
