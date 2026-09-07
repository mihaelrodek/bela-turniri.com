package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.PairDto;
import hr.mrodek.apps.bela_turniri.dtos.SelfRegisterPairRequest;
import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.errors.ApiCodes;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.model.UserPairPreset;
import hr.mrodek.apps.bela_turniri.repository.PairsRepository;
import hr.mrodek.apps.bela_turniri.repository.UserPairPresetRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

/**
 * "Prijavi se" — any signed-in player registering their own pair against a
 * tournament that hasn't started yet.
 *
 * <p>The pair lands with {@code pendingApproval = true} and
 * {@code submittedByUid = caller}, so the organiser confirms or rejects it
 * before it counts towards anything. Capacity is deliberately NOT enforced
 * here: the organiser reviews the pending list and approves as many as
 * their tournament actually fits.
 *
 * <p>See {@link TournamentPairService} for why this service is not
 * {@code @Transactional} — it runs inside the caller's transaction.
 */
@ApplicationScoped
public class SelfRegistrationService {

    @Inject PairsRepository pairRepo;
    @Inject UserPairPresetRepository userPairPresetRepo;
    @Inject SlugService slugService;
    @Inject TournamentPairService pairService;
    @Inject CurrentUser currentUser;

    @Inject hr.mrodek.apps.bela_turniri.realtime.LiveBroadcaster live;

    /**
     * Ping every open tournament page that something changed. The send is
     * deferred until the caller's transaction commits (see LiveBroadcaster).
     */
    private void broadcast(Tournaments t, String scope) {
        if (t == null || t.getUuid() == null) return;
        live.notifyTournament(t.getUuid().toString(), scope);
    }

    public PairDto selfRegister(Tournaments t, SelfRegisterPairRequest body) {
        if (t.getStatus() == TournamentStatus.STARTED || t.getStatus() == TournamentStatus.FINISHED) {
            throw ApiCodes.conflict("TOURNAMENT_ALREADY_STARTED");
        }

        String myUid = currentUser.requireUid();
        String trimmedName = body.name().trim();

        // Reject a duplicate name from the same self-registering user —
        // stops one person accidentally re-registering the same pair.
        boolean alreadyRegistered = pairRepo.findByTournament_Id(t.getId()).stream()
                .anyMatch(existing ->
                        myUid.equals(existing.getSubmittedByUid())
                                && existing.getName() != null
                                && existing.getName().equalsIgnoreCase(trimmedName));
        if (alreadyRegistered) {
            throw ApiCodes.conflict("ALREADY_REGISTERED");
        }

        // Make sure the user has a UserProfile row + slug *before* the pair
        // is persisted. Without it, pair-list enrichment renders the row
        // without "Prijavio: …" whenever the frontend's /user/me/sync hasn't
        // landed yet (a race between sign-in and the first self-register).
        slugService.ensureProfile(myUid, currentUser.displayName());

        Pairs p = new Pairs();
        p.setTournament(t);
        p.setName(trimmedName);
        p.setEliminated(false);
        p.setExtraLife(false);
        p.setWins(0);
        p.setLosses(0);
        p.setPaid(false);
        p.setSubmittedByUid(myUid);
        p.setPendingApproval(true);
        // Pair-level claim token — legacy, since sharing now happens at the
        // preset level, but the column stays for already-claimed pairs.
        p.setClaimToken(ClaimTokens.generate());

        // Auto-inherit the co-owner from the user's matching preset. Once
        // "Marko & Pero" has been shared and the partner has claimed it,
        // every new pair self-registered under that name must also surface
        // on the partner's profile and notifications. The preset is the
        // source of truth for who the partner is.
        userPairPresetRepo.findByUserUidAndNameIgnoreCase(myUid, trimmedName)
                .ifPresent(preset -> {
                    if (preset.getCoOwnerUid() != null && !preset.getCoOwnerUid().isBlank()) {
                        p.setCoSubmittedByUid(preset.getCoOwnerUid());
                    }
                });

        pairRepo.save(p);

        rememberPairName(myUid, trimmedName);

        broadcast(t, hr.mrodek.apps.bela_turniri.realtime.LiveBroadcaster.SCOPE_PAIRS);

        return pairService.toDto(p);
    }

    /**
     * Auto-save the typed name into the user's pair-name address book so
     * they don't retype it next time. Skipped when the same name
     * (case-insensitive) is already saved.
     */
    private void rememberPairName(String myUid, String trimmedName) {
        if (userPairPresetRepo.findByUserUidAndNameIgnoreCase(myUid, trimmedName).isPresent()) {
            return;
        }
        var preset = new UserPairPreset();
        preset.setUserUid(myUid);
        preset.setName(trimmedName);
        userPairPresetRepo.save(preset);
    }
}
