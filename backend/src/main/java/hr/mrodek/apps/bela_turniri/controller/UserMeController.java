package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.MyTournamentParticipationDto;
import hr.mrodek.apps.bela_turniri.dtos.SyncProfileRequest;
import hr.mrodek.apps.bela_turniri.dtos.UserProfileDto;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.model.UserPairPreset;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import hr.mrodek.apps.bela_turniri.repository.PairsRepository;
import hr.mrodek.apps.bela_turniri.repository.UserPairPresetRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import hr.mrodek.apps.bela_turniri.services.SlugService;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.jwt.JsonWebToken;

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
    @Inject JsonWebToken jwt;

    @GET
    @Path("/tournaments")
    public List<MyTournamentParticipationDto> myTournaments() {
        String uid = jwt.getSubject();
        // Pass the user's saved pair-name presets so we also catch tournaments
        // where the pair was added via the organizer flow with a known name.
        var presetNames = presetRepo.findByUserUid(uid).stream()
                .map(UserPairPreset::getName)
                .toList();
        return pairRepo.findMyParticipations(uid, presetNames).stream()
                .map(this::toDto)
                .toList();
    }

    @GET
    @Path("/profile")
    public UserProfileDto getProfile() {
        var p = profileRepo.findByUid(jwt.getSubject()).orElse(null);
        if (p == null) return new UserProfileDto(null, null, null, null);
        return new UserProfileDto(p.getPhoneCountry(), p.getPhone(), p.getDisplayName(), p.getSlug());
    }

    @PUT
    @Path("/profile")
    @Transactional
    public UserProfileDto updateProfile(@Valid UserProfileDto body) {
        String uid = jwt.getSubject();
        var existing = profileRepo.findByUid(uid).orElse(null);
        if (existing == null) {
            existing = new UserProfile();
            existing.setUserUid(uid);
        }
        existing.setPhoneCountry(blank(body.phoneCountry()));
        existing.setPhone(blank(body.phone()));
        profileRepo.persist(existing);
        return new UserProfileDto(
                existing.getPhoneCountry(),
                existing.getPhone(),
                existing.getDisplayName(),
                existing.getSlug());
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
        String uid = jwt.getSubject();
        String displayName = body == null ? null : blank(body.displayName());
        var profile = slugService.ensureProfile(uid, displayName);
        // ensureProfile returns the persisted entity with the slug guaranteed.
        return new UserProfileDto(
                profile.getPhoneCountry(),
                profile.getPhone(),
                profile.getDisplayName(),
                profile.getSlug());
    }

    private static String blank(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private MyTournamentParticipationDto toDto(Pairs p) {
        Tournaments t = p.getTournament();
        boolean isWinner =
                t.getWinnerName() != null
                        && p.getName() != null
                        && t.getWinnerName().trim().equalsIgnoreCase(p.getName().trim());
        return new MyTournamentParticipationDto(
                t.getUuid(),
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
