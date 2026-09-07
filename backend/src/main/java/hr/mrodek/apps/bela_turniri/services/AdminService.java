package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.errors.ApiCodes;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.model.UserPairPreset;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import hr.mrodek.apps.bela_turniri.realtime.LiveBroadcaster;
import hr.mrodek.apps.bela_turniri.repository.PairsRepository;
import hr.mrodek.apps.bela_turniri.repository.TournamentsRepository;
import hr.mrodek.apps.bela_turniri.repository.UserPairPresetRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.OffsetDateTime;

/**
 * Business logic behind the admin "Dashboard" tab —
 * {@link hr.mrodek.apps.bela_turniri.controller.AdminController} loads path
 * params, delegates here, and maps the result onto its own response records.
 *
 * <p>No {@code @Transactional} here on purpose, matching
 * {@link TournamentPairService} / {@link TournamentLifecycleService}: the
 * controller methods that call in are already transactional and pass in
 * managed entities loaded inside that same transaction.
 */
@ApplicationScoped
public class AdminService {

    @Inject TournamentsRepository tournamentsRepo;
    @Inject PairsRepository pairsRepo;
    @Inject UserProfileRepository profileRepo;
    @Inject UserPairPresetRepository presetRepo;

    @Inject LiveBroadcaster live;

    /**
     * Ping every open tournament page that something changed. The send is
     * deferred until the caller's transaction commits (see LiveBroadcaster).
     */
    private void broadcast(Tournaments t, String scope) {
        if (t == null || t.getUuid() == null) return;
        live.notifyTournament(t.getUuid().toString(), scope);
    }

    public record AttachPairResult(Long pairId, String userUid, String displayName, boolean createdPreset) {}

    public record TransferResult(Long tournamentId, String userUid, String displayName) {}

    public record StatusOverrideResult(Long tournamentId, String status, String previousStatus) {}

    /**
     * Attach a pair to a user. Two side-effects (both wrapped in the caller's
     * single transaction so a half-attached pair never persists):
     *
     *   1. {@code pair.submittedByUid = userUid} — this single field is what
     *      {@code findMyParticipations} matches on, so the pair starts
     *      appearing on the target user's profile immediately.
     *   2. If the user doesn't already have a {@code UserPairPreset} with the
     *      same name, we create one (with a stable claim token, like the
     *      self-register path). Reason: tournaments with the same pair name
     *      in the future will then auto-claim to this user via the
     *      preset-name fallback in
     *      {@link hr.mrodek.apps.bela_turniri.repository.PairsRepository#findMyParticipations}.
     *
     * Refuses to attach when the pair is already claimed (either submitter
     * slot filled) — the UI filters those out, but a parallel request could
     * race in, so we re-check here as well.
     */
    public AttachPairResult attachPair(Long pairId, String userUid) {
        Pairs pair = pairsRepo.findById(pairId);
        if (pair == null) throw ApiCodes.notFound();

        // Defensive — the UI hides claimed pairs but a parallel admin
        // attaching at the same time would otherwise silently overwrite.
        if (pair.getSubmittedByUid() != null || pair.getCoSubmittedByUid() != null) {
            throw ApiCodes.conflict("ALREADY_CLAIMED");
        }

        UserProfile target = profileRepo.findByUid(userUid).orElse(null);
        if (target == null) throw ApiCodes.notFound("USER_NOT_FOUND");

        // 1. Direct ownership flag.
        pair.setSubmittedByUid(target.getUserUid());
        pairsRepo.persist(pair);

        // 2. Auto-create a matching preset so future tournaments with the
        //    same pair name auto-link to this user. Skip if one already
        //    exists (case-insensitive name match).
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
                preset.setClaimToken(ClaimTokens.generate());
                preset.setArchived(false);
                presetRepo.persist(preset);
                createdPreset = true;
            }
        }

        broadcast(pair.getTournament(), LiveBroadcaster.SCOPE_PAIRS);

        return new AttachPairResult(pair.getId(), target.getUserUid(),
                target.getDisplayName(), createdPreset);
    }

    /**
     * Transfer tournament ownership to another registered user. Used when an
     * admin pre-creates a tournament on behalf of an organiser (e.g. before
     * the organiser has signed up, or for legacy imports) and later wants to
     * hand it over so the real organiser can manage pairs, edit details,
     * finish rounds, etc.
     *
     * <p>Idempotent — transferring to the same user again is a no-op
     * (returns the same payload, still broadcast since it's cheap and
     * harmless).
     */
    public TransferResult transferTournament(Long tournamentId, String userUid) {
        Tournaments tournament = tournamentsRepo.findById(tournamentId);
        if (tournament == null) throw ApiCodes.notFound("TOURNAMENT_NOT_FOUND");

        UserProfile target = profileRepo.findByUid(userUid).orElse(null);
        if (target == null) throw ApiCodes.notFound("USER_NOT_FOUND");

        tournament.setCreatedByUid(target.getUserUid());
        tournament.setCreatedByName(target.getDisplayName());
        tournamentsRepo.persist(tournament);

        broadcast(tournament, LiveBroadcaster.SCOPE_TOURNAMENT);

        return new TransferResult(tournament.getId(), target.getUserUid(), target.getDisplayName());
    }

    /**
     * Admin override of tournament status. Bypasses the regular
     * {@code /tournaments/{uuid}/start} and {@code /tournaments/{uuid}/finish}
     * lifecycle guards (paid-pair count, exactly-one-active-pair rule, etc.)
     * so an admin can correct mis-clicks or backfill tournaments that
     * concluded outside the app.
     *
     * <p>Field hygiene:
     *   - Always updates {@code status} and {@code updatedAt}.
     *   - When moving INTO FINISHED with no winner already set, the field
     *     stays null — the admin can fill it via the existing
     *     {@code /tournaments/{uuid}/podium} endpoint afterwards.
     *   - When moving OUT OF FINISHED (FINISHED → STARTED or DRAFT), clears
     *     {@code winnerName} so a stale champion doesn't linger on a
     *     tournament that's now in-progress or back to draft. Podium names
     *     (silver / bronze) are also cleared to keep the read-back
     *     consistent.
     *
     * <p>Idempotent when {@code statusRaw} already matches the current
     * status — no-op, no broadcast, same as before this refactor.
     */
    public StatusOverrideResult overrideStatus(Long tournamentId, String statusRaw) {
        TournamentStatus next;
        try {
            next = TournamentStatus.valueOf(statusRaw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw ApiCodes.badRequest("INVALID_STATUS");
        }

        Tournaments tournament = tournamentsRepo.findById(tournamentId);
        if (tournament == null) throw ApiCodes.notFound("TOURNAMENT_NOT_FOUND");

        TournamentStatus prev = tournament.getStatus();
        if (prev == next) {
            // Idempotent — no-op when the status is already what we'd set.
            return new StatusOverrideResult(tournament.getId(), next.name(),
                    prev != null ? prev.name() : null);
        }

        // Reverting OUT OF FINISHED clears the champion + podium so a stale
        // winner doesn't show on a tournament that's now back in progress or
        // draft. The organiser can re-set them via the normal finish +
        // podium flow afterwards.
        if (prev == TournamentStatus.FINISHED && next != TournamentStatus.FINISHED) {
            tournament.setWinnerName(null);
            tournament.setSecondPlaceName(null);
            tournament.setThirdPlaceName(null);
        }

        tournament.setStatus(next);
        tournament.setUpdatedAt(OffsetDateTime.now());
        tournamentsRepo.persist(tournament);

        broadcast(tournament, LiveBroadcaster.SCOPE_TOURNAMENT);

        return new StatusOverrideResult(tournament.getId(), next.name(),
                prev != null ? prev.name() : null);
    }
}
