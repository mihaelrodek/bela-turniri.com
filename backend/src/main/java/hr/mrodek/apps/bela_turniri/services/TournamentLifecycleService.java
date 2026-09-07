package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.PodiumRequest;
import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.errors.ApiCodes;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.repository.MatchesRepository;
import hr.mrodek.apps.bela_turniri.repository.PairsRepository;
import hr.mrodek.apps.bela_turniri.repository.RoundsRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * DRAFT → STARTED → FINISHED, plus the podium and the reset-to-draft
 * escape hatch.
 *
 * <p>The guard clauses answer with bare code strings
 * ({@code UNPAID_REQUIRED}, {@code INSUFFICIENT_PAIRS}, …) because the SPA
 * compares the raw response body against those literals to pick which
 * Croatian explanation to show; see {@link ApiCodes}.
 *
 * <p>See {@link TournamentPairService} for why this service is not
 * {@code @Transactional} — it runs inside the caller's transaction and
 * mutates the managed entity it is handed.
 */
@ApplicationScoped
public class TournamentLifecycleService {

    @Inject PairsRepository pairRepo;
    @Inject RoundsRepository roundsRepo;
    @Inject MatchesRepository matchesRepo;

    @Inject hr.mrodek.apps.bela_turniri.realtime.LiveBroadcaster live;

    /**
     * Ping every open tournament page that something changed. The send is
     * deferred until the caller's transaction commits (see LiveBroadcaster).
     */
    private void broadcast(Tournaments t, String scope) {
        if (t == null || t.getUuid() == null) return;
        live.notifyTournament(t.getUuid().toString(), scope);
    }

    /**
     * Move the tournament to STARTED.
     *
     * <p>Needs at least two pairs that have actually paid. Pending
     * self-registrations are excluded from that count — the organiser must
     * approve them first, otherwise anyone could start a tournament by
     * self-registering two bogus pairs. Idempotent once STARTED.
     */
    public Tournaments start(Tournaments t) {
        if (t.getStatus() == TournamentStatus.FINISHED) {
            throw ApiCodes.conflict("ALREADY_FINISHED");
        }

        long paidApprovedCount = pairRepo.findByTournament_Id(t.getId()).stream()
                .filter(p -> p.isPaid() && !p.isPendingApproval())
                .count();
        if (paidApprovedCount < 2) {
            throw ApiCodes.conflict("INSUFFICIENT_PAIRS");
        }

        // Block if at least one approved pair hasn't paid
        if (pairRepo.existsByTournament_IdAndPaidFalse(t.getId())) {
            throw ApiCodes.conflict("UNPAID_REQUIRED");
        }

        if (t.getStatus() != TournamentStatus.STARTED) {
            t.setStatus(TournamentStatus.STARTED);
            t.setUpdatedAt(OffsetDateTime.now());
            broadcast(t, hr.mrodek.apps.bela_turniri.realtime.LiveBroadcaster.SCOPE_TOURNAMENT);
        }
        return t;
    }

    /**
     * Move the tournament to FINISHED and crown the single surviving pair.
     * Idempotent: finishing an already-finished tournament is a no-op 200,
     * not a conflict.
     */
    public Tournaments finish(Tournaments t) {
        if (t.getStatus() == TournamentStatus.FINISHED) {
            return t;
        }

        var allPairs = pairRepo.findByTournament_Id(t.getId());
        var active = allPairs.stream().filter(p -> !p.isEliminated()).toList();
        if (active.size() != 1) {
            throw ApiCodes.conflict("EXACTLY_ONE_ACTIVE_PAIR_REQUIRED");
        }
        var winner = active.get(0);

        // Ensure elimination flags reflect the final state
        for (var p : allPairs) {
            boolean shouldBeEliminated = !Objects.equals(p.getId(), winner.getId());
            if (p.isEliminated() != shouldBeEliminated) {
                p.setEliminated(shouldBeEliminated);
            }
        }

        t.setStatus(TournamentStatus.FINISHED);
        t.setWinnerName(winner.getName());
        t.setUpdatedAt(OffsetDateTime.now());
        broadcast(t, hr.mrodek.apps.bela_turniri.realtime.LiveBroadcaster.SCOPE_TOURNAMENT);
        return t;
    }

    /**
     * Set (or clear) the silver + bronze names.
     *
     * <p>Both fields are nullable: a null/blank value clears that column so
     * the organiser can remove a wrongly-set position. Each non-blank name
     * is matched case-insensitively against the tournament's own pair names
     * — an unknown name is a 400 rather than silently persisted garbage the
     * SPA cannot highlight on the Parovi tab.
     *
     * <p>Deliberately not gated on status: most organisers fill the podium
     * right after finishing, but pre-filling while STARTED does no harm.
     */
    public Tournaments setPodium(Tournaments t, PodiumRequest req) {
        PodiumRequest body = (req == null) ? new PodiumRequest(null, null) : req;

        // One pass over the pair names serves both inputs.
        Set<String> pairNames = pairRepo.findByTournament_Id(t.getId()).stream()
                .map(p -> p.getName() == null ? null : p.getName().trim().toLowerCase(Locale.ROOT))
                .filter(s -> s != null && !s.isEmpty())
                .collect(Collectors.toSet());

        String second = normalisePodiumName(body.secondPlaceName());
        String third = normalisePodiumName(body.thirdPlaceName());

        if (second != null && !pairNames.contains(second.toLowerCase(Locale.ROOT))) {
            throw ApiCodes.badRequest("SECOND_PLACE_PAIR_NOT_FOUND");
        }
        if (third != null && !pairNames.contains(third.toLowerCase(Locale.ROOT))) {
            throw ApiCodes.badRequest("THIRD_PLACE_PAIR_NOT_FOUND");
        }
        if (second != null && third != null && second.equalsIgnoreCase(third)) {
            throw ApiCodes.badRequest("SAME_PAIR_FOR_SECOND_AND_THIRD");
        }
        // A single pair can't be 1st AND (2nd|3rd) at the same time.
        if (t.getWinnerName() != null) {
            String winner = t.getWinnerName().trim();
            if (second != null && winner.equalsIgnoreCase(second)) {
                throw ApiCodes.badRequest("SECOND_PLACE_EQUALS_WINNER");
            }
            if (third != null && winner.equalsIgnoreCase(third)) {
                throw ApiCodes.badRequest("THIRD_PLACE_EQUALS_WINNER");
            }
        }

        t.setSecondPlaceName(second);
        t.setThirdPlaceName(third);
        t.setUpdatedAt(OffsetDateTime.now());
        broadcast(t, hr.mrodek.apps.bela_turniri.realtime.LiveBroadcaster.SCOPE_TOURNAMENT);
        return t;
    }

    /**
     * Wipe the bracket and return the tournament to DRAFT. Pair rows
     * survive with their stats zeroed and their elimination cleared;
     * {@code extraLife} is deliberately left alone, since a repassage was
     * paid for and shouldn't evaporate because the organiser redrew.
     */
    public Tournaments reset(Tournaments t) {
        // Matches first, then rounds — the FK points that way.
        matchesRepo.deleteByTournament(t);
        roundsRepo.deleteByTournament(t);

        for (var p : pairRepo.findByTournament_Id(t.getId())) {
            p.setWins(0);
            p.setLosses(0);
            p.setEliminated(false);
        }

        t.setStatus(TournamentStatus.DRAFT);
        t.setWinnerName(null);
        t.setUpdatedAt(OffsetDateTime.now());
        broadcast(t, hr.mrodek.apps.bela_turniri.realtime.LiveBroadcaster.SCOPE_TOURNAMENT);
        return t;
    }

    /** Trim + null-out empty strings so the DB stores a clean null. */
    private static String normalisePodiumName(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
