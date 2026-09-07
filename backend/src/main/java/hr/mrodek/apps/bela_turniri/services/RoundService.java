// src/main/java/hr/mrodek/apps/bela_turniri/services/RoundService.java
package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.ManualRoundRequest;
import hr.mrodek.apps.bela_turniri.dtos.MatchDto;
import hr.mrodek.apps.bela_turniri.dtos.RoundDto;
import hr.mrodek.apps.bela_turniri.dtos.UpdateMatchRequest;
import hr.mrodek.apps.bela_turniri.enums.MatchStatus;
import hr.mrodek.apps.bela_turniri.enums.RoundStatus;
import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.mappers.RoundMatchMapper;
import hr.mrodek.apps.bela_turniri.model.Matches;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Rounds;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.realtime.LiveBroadcaster;
import hr.mrodek.apps.bela_turniri.repository.MatchesRepository;
import hr.mrodek.apps.bela_turniri.repository.PairsRepository;
import hr.mrodek.apps.bela_turniri.repository.RoundsRepository;
import hr.mrodek.apps.bela_turniri.repository.TournamentsRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Persistence and orchestration for rounds and matches.
 *
 * <p>Two concerns used to live in here and now don't:
 * <ul>
 *   <li>{@link RoundPairing} — the pure draw algorithm (shuffle, BYE choice,
 *       backtracking over pair ids). Entities are mapped to ids here, at the
 *       boundary, and the {@link Random} is created here too, so the draw is
 *       exactly as random as it always was.</li>
 *   <li>{@link RoundNotifier} — every push notification, built per recipient
 *       in the recipient's own language.</li>
 * </ul>
 *
 * <p>Transaction policy is unchanged: {@code @Transactional} sits on these
 * service entry points (mirroring what the controllers expect), the loaded
 * entities are managed, and the collaborators mutate/read those same
 * instances without opening transactions of their own.
 */
@ApplicationScoped
public class RoundService {

    @Inject
    TournamentsRepository tournamentsRepo;
    @Inject
    RoundsRepository roundsRepo;
    @Inject
    MatchesRepository matchesRepo;
    @Inject
    PairsRepository pairsRepo;
    @Inject
    RoundMatchMapper mapper;
    @Inject
    LiveBroadcaster live;
    @Inject
    RoundNotifier notifier;
    @Inject
    MessageService messages;

    /**
     * Ping every open tournament page that something changed. The uuid comes
     * off the tournament we already loaded (the caller may have passed a
     * slug); the send itself is deferred until this transaction commits.
     */
    private void broadcast(Tournaments t, String scope) {
        if (t == null || t.getUuid() == null) return;
        live.notifyTournament(t.getUuid().toString(), scope);
    }

    private Tournaments requireTournament(String uuid) {
        return tournamentsRepo.findByUuidOrSlug(uuid)
                .orElseThrow(() -> new NoSuchElementException(messages.t("tournament.notFound")));
    }

    public List<RoundDto> listByTournamentUuid(String uuid) {
        Tournaments t = tournamentsRepo.findByUuidOrSlug(uuid).orElse(null);
        if (t == null) return List.of();
        var rounds = roundsRepo.findByTournamentOrderByNumberAsc(t);

        // One query for every match of the tournament, with round and both
        // pairs fetched, then grouped in Java — instead of a query per round
        // plus two lazy pair loads per match inside the mapper.
        Map<Long, List<Matches>> byRound = matchesRepo
                .findByTournament_IdWithRoundAndPairs(t.getId())
                .stream()
                .collect(Collectors.groupingBy(
                        m -> m.getRound().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()));

        List<RoundDto> out = new ArrayList<>();
        for (var r : rounds) {
            var dto = mapper.toRoundDto(r);
            var matches = byRound.getOrDefault(r.getId(), List.of());
            out.add(new RoundDto(dto.id(), dto.number(), dto.status(), mapper.toMatchDtoList(matches)));
        }
        return out;
    }

    @Transactional
    public RoundDto drawNextRound(String uuid) {
        Tournaments t = requireTournament(uuid);

        int nextNumber = nextRoundNumber(t);

        // Active pairs (not eliminated)
        List<Pairs> active = pairsRepo.findByTournament_Id(t.getId())
                .stream().filter(p -> !p.isEliminated()).toList();

        if (active.size() < 2) throw new IllegalStateException(messages.t("round.draw.notEnoughPairs"));

        // History for (1) pairing repeats and (2) prior BYEs
        List<Matches> history = matchesRepo.findByTournament_Id(t.getId());

        // Unordered pairings that already happened (exclude BYEs)
        Set<String> played = new HashSet<>();
        // Collect who already received a BYE (either side, defensive)
        Set<Long> byeRecipients = new HashSet<>();
        for (Matches m : history) {
            if (m.getPair1() != null && m.getPair2() != null) {
                played.add(RoundPairing.pairKey(m.getPair1().getId(), m.getPair2().getId()));
            }
            if (m.getPair1() != null && m.getPair2() == null) byeRecipients.add(m.getPair1().getId());
            if (m.getPair2() != null && m.getPair1() == null) byeRecipients.add(m.getPair2().getId());
        }

        // The algorithm works on ids only; the randomness lives here so the
        // pure part stays testable (see RoundPairing's determinism note).
        List<Long> activeIds = active.stream().map(Pairs::getId).toList();
        RoundPairing.Plan plan = RoundPairing.plan(
                activeIds, played, byeRecipients, t.isPreserveMatchmaking(), new Random());

        // ===== Persist round + matches =====
        Map<Long, Pairs> byId = new HashMap<>();
        for (Pairs p : active) byId.put(p.getId(), p); // includes the BYE pick too

        Rounds round = newRound(t, nextNumber);

        int tableNo = 1;
        List<Matches> toSave = new ArrayList<>();
        for (RoundPairing.Matchup ab : plan.pairs()) {
            toSave.add(newMatch(t, round, tableNo++, byId.get(ab.pair1Id()), byId.get(ab.pair2Id())));
        }
        if (plan.byeId() != null) {
            // pair2 == null marks the BYE row
            toSave.add(newMatch(t, round, tableNo++, byId.get(plan.byeId()), null));
        }

        var saved = matchesRepo.saveAll(toSave);

        notifier.notifyMatches(t, round, saved);

        broadcast(t, LiveBroadcaster.SCOPE_ROUND);

        var dto = mapper.toRoundDto(round);
        return new RoundDto(dto.id(), dto.number(), dto.status(), mapper.toMatchDtoList(saved));
    }

    /**
     * Manually generate a round from organiser-supplied pairings.
     *
     * <p>Typical use-case: late in a small bracket (≤ 4 active pairs)
     * where the automatic draw's random pairing isn't what the organiser
     * wants. The caller provides the exact list of (pair1, pair2, tableNo)
     * tuples — we validate and persist them as a new round.
     *
     * <p>Mirrors {@link #drawNextRound(String)}'s persistence path so the
     * resulting round/matches look identical to an auto-drawn one
     * downstream (push notifications, score updates, finish-round flow).
     *
     * <p>Validation (each failure throws {@link IllegalStateException},
     * mapped to HTTP 400 by the global exception mapper):
     *   - tournament must be STARTED (not FINISHED — a finished tournament
     *     is read-only)
     *   - {@code matches} non-empty
     *   - every {@code pair1Id} must reference a pair in this tournament
     *     that is not eliminated; {@code pair2Id} (when non-null) the same
     *   - no pair may appear in more than one match
     *   - {@code pair1Id != pair2Id} (a pair can't play itself)
     */
    @Transactional
    public RoundDto drawManualRound(String uuid, ManualRoundRequest req) {
        Tournaments t = requireTournament(uuid);

        if (t.getStatus() == TournamentStatus.FINISHED) {
            throw new IllegalStateException(messages.t("round.manual.tournamentFinished"));
        }

        if (req == null || req.matches() == null || req.matches().isEmpty()) {
            throw new IllegalStateException(messages.t("round.manual.atLeastOneMatch"));
        }

        // Load every pair in the tournament once so we can validate the
        // request payload against actual DB rows in O(1) lookups.
        Map<Long, Pairs> pairsById = new HashMap<>();
        for (Pairs p : pairsRepo.findByTournament_Id(t.getId())) {
            pairsById.put(p.getId(), p);
        }

        // Track which pair IDs the request already uses — catches both
        // duplicate-in-same-match and reused-across-matches in one pass.
        Set<Long> usedIds = new HashSet<>();
        for (ManualRoundRequest.Match m : req.matches()) {
            if (m == null || m.pair1Id() == null || m.tableNo() == null) {
                throw new IllegalStateException(messages.t("round.manual.matchFieldsRequired"));
            }
            Pairs p1 = pairsById.get(m.pair1Id());
            if (p1 == null) {
                throw new IllegalStateException(messages.t("round.manual.pair1NotInTournament",
                        String.valueOf(m.pair1Id())));
            }
            if (p1.isEliminated()) {
                throw new IllegalStateException(messages.t("round.manual.pairEliminated", p1.getName()));
            }
            if (!usedIds.add(m.pair1Id())) {
                throw new IllegalStateException(messages.t("round.manual.pairDuplicated", p1.getName()));
            }
            if (m.pair2Id() != null) {
                if (m.pair2Id().equals(m.pair1Id())) {
                    throw new IllegalStateException(messages.t("round.manual.pairAgainstItself"));
                }
                Pairs p2 = pairsById.get(m.pair2Id());
                if (p2 == null) {
                    throw new IllegalStateException(messages.t("round.manual.pair2NotInTournament",
                            String.valueOf(m.pair2Id())));
                }
                if (p2.isEliminated()) {
                    throw new IllegalStateException(messages.t("round.manual.pairEliminated", p2.getName()));
                }
                if (!usedIds.add(m.pair2Id())) {
                    throw new IllegalStateException(messages.t("round.manual.pairDuplicated", p2.getName()));
                }
            }
        }

        Rounds round = newRound(t, nextRoundNumber(t));

        List<Matches> toSave = new ArrayList<>();
        for (ManualRoundRequest.Match m : req.matches()) {
            toSave.add(newMatch(t, round, m.tableNo(),
                    pairsById.get(m.pair1Id()),
                    m.pair2Id() == null ? null : pairsById.get(m.pair2Id())));
        }

        var saved = matchesRepo.saveAll(toSave);

        // Same push-notification logic as the automatic draw — players get a
        // deep link into their match, one payload per recipient.
        notifier.notifyMatches(t, round, saved);

        broadcast(t, LiveBroadcaster.SCOPE_ROUND);

        var dto = mapper.toRoundDto(round);
        return new RoundDto(dto.id(), dto.number(), dto.status(), mapper.toMatchDtoList(saved));
    }

    @Transactional
    public MatchDto updateMatchScore(String uuid, Long roundId, Long matchId, UpdateMatchRequest req) {
        Tournaments t = requireTournament(uuid);

        Rounds r = roundsRepo.findByIdOptional(roundId)
                .filter(x -> Objects.equals(x.getTournament().getId(), t.getId()))
                .orElseThrow(() -> new NoSuchElementException(messages.t("round.notFound")));

        Matches m = matchesRepo.findByIdOptional(matchId)
                .filter(x -> Objects.equals(x.getRound().getId(), r.getId()))
                .orElseThrow(() -> new NoSuchElementException(messages.t("match.notFound")));

        Integer s1 = req.score1();
        Integer s2 = req.score2();

        // Remember the old finished/winner state so we can push the loser
        // exactly when this call introduces a NEW loss (fresh finish or
        // a re-score that flipped the winner).
        boolean wasFinished = m.getStatus() == MatchStatus.FINISHED;
        Long prevWinnerId = (m.getWinnerPair() != null) ? m.getWinnerPair().getId() : null;

        m.setScore1(s1);
        m.setScore2(s2);

        // if both scores present & not equal -> finish and update stats
        if (s1 != null && s2 != null && !Objects.equals(s1, s2) && m.getPair1() != null && m.getPair2() != null) {
            Pairs winner = (s1 > s2) ? m.getPair1() : m.getPair2();
            Pairs loser = (s1 > s2) ? m.getPair2() : m.getPair1();

            // If previously finished with different winner, revert old stats first
            if (m.getStatus() == MatchStatus.FINISHED && m.getWinnerPair() != null) {
                Pairs prevWinner = m.getWinnerPair();
                Pairs prevLoser = (Objects.equals(prevWinner.getId(), m.getPair1().getId())) ? m.getPair2() : m.getPair1();
                // revert
                if (prevWinner.getWins() > 0) prevWinner.setWins(prevWinner.getWins() - 1);
                if (prevLoser.getLosses() > 0) prevLoser.setLosses(prevLoser.getLosses() - 1);
                // elimination may flip back if losses now 0
                if (prevLoser.getLosses() == 0) prevLoser.setEliminated(false);
                pairsRepo.save(prevWinner);
                pairsRepo.save(prevLoser);
            }

            // apply new
            m.setWinnerPair(winner);
            m.setStatus(MatchStatus.FINISHED);

            winner.setWins(winner.getWins() + 1);
            loser.setLosses(loser.getLosses() + 1);
            loser.setEliminated(true); // eliminated immediately after 1st loss; extra life can revive later

            pairsRepo.save(winner);
            pairsRepo.save(loser);
        } else {
            // no decisive result -> mark scheduled & clear winner
            m.setWinnerPair(null);
            m.setStatus(MatchStatus.SCHEDULED);
        }

        matchesRepo.save(m);

        if (introducesNewLoss(m, wasFinished, prevWinnerId)) {
            notifier.notifyLoser(t, m);
        }

        // If every match finished -> mark round completed
        boolean allFinished = matchesRepo.findByRound(r).stream()
                .allMatch(x -> x.getStatus() == MatchStatus.FINISHED);
        if (allFinished) {
            r.setStatus(RoundStatus.COMPLETED);
            r.setCompletedAt(OffsetDateTime.now());
            roundsRepo.save(r);
        } else if (r.getStatus() == RoundStatus.COMPLETED) {
            // someone changed score back -> reopen round
            r.setStatus(RoundStatus.IN_PROGRESS);
            r.setCompletedAt(null);
            roundsRepo.save(r);
        }

        broadcast(t, LiveBroadcaster.SCOPE_MATCH);

        return mapper.toMatchDto(m);
    }

    @Transactional
    public void hardResetRound(String uuid, Long roundId) {
        // 0) Load + verify
        Tournaments t = requireTournament(uuid);

        Rounds r = roundsRepo.findByIdOptional(roundId)
                .filter(x -> Objects.equals(x.getTournament().getId(), t.getId()))
                .orElseThrow(() -> new NoSuchElementException(messages.t("round.notFound")));

        if (r.getStatus() == RoundStatus.COMPLETED) {
            throw new IllegalStateException(messages.t("round.reset.completed"));
        }

        // 1) Delete this round's matches, then the round itself
        matchesRepo.deleteByRound(r);
        roundsRepo.delete(r);

        // 2) Recompute ALL pairs' wins/losses/elimination from the remaining
        //    FINISHED matches. BYEs contribute nothing here — a walkover is
        //    not a win the standings should show after a reset.
        recomputePairStats(t.getId());

        // 3) Touch tournament
        t.setUpdatedAt(OffsetDateTime.now());
        tournamentsRepo.save(t);

        broadcast(t, LiveBroadcaster.SCOPE_ROUND);
    }

    @Transactional
    public RoundDto finishRound(String uuid, Long roundId) {
        Tournaments t = requireTournament(uuid);

        Rounds r = roundsRepo.findByIdOptional(roundId)
                .filter(x -> Objects.equals(x.getTournament().getId(), t.getId()))
                .orElseThrow(() -> new NoSuchElementException(messages.t("round.notFound")));

        var matches = matchesRepo.findByRound(r);

        // Validate & apply missing finals
        for (var m : matches) {
            // BYE
            if (m.getPair2() == null) {
                // Just mark finished; do NOT change wins/losses for BYE
                m.setStatus(MatchStatus.FINISHED);
                m.setWinnerPair(m.getPair1());
                matchesRepo.save(m);
                continue;
            }

            Integer s1 = m.getScore1();
            Integer s2 = m.getScore2();

            if (s1 == null || s2 == null || Objects.equals(s1, s2)) {
                throw new IllegalStateException(messages.t("round.finish.scoresRequired"));
            }

            // If already finished, assume stats are already accounted for (updateMatchScore handled reversals)
            if (m.getStatus() == MatchStatus.FINISHED) {
                continue;
            }

            // Finish & apply stats once
            var winner = (s1 > s2) ? m.getPair1() : m.getPair2();
            var loser = (s1 > s2) ? m.getPair2() : m.getPair1();

            m.setWinnerPair(winner);
            m.setStatus(MatchStatus.FINISHED);
            matchesRepo.save(m);

            // Update stats
            winner.setWins(winner.getWins() + 1);
            loser.setLosses(loser.getLosses() + 1);
            loser.setEliminated(true); // extra life can later revive
            pairsRepo.save(winner);
            pairsRepo.save(loser);

            // Fresh finish via "Završi rundu" — notify the new loser with
            // the table's bill total.
            notifier.notifyLoser(t, m);
        }

        // Mark round completed
        r.setStatus(RoundStatus.COMPLETED);
        r.setCompletedAt(OffsetDateTime.now());
        roundsRepo.save(r);

        broadcast(t, LiveBroadcaster.SCOPE_ROUND);

        // Return fresh DTO with current matches
        var savedMatches = matchesRepo.findByRound(r);
        var dto = mapper.toRoundDto(r);
        return new RoundDto(dto.id(), dto.number(), dto.status(), mapper.toMatchDtoList(savedMatches));
    }

    @Transactional
    public RoundDto overrideMatchScore(String uuid, Long roundId, Long matchId, UpdateMatchRequest req) {
        var tournament = requireTournament(uuid);

        var round = roundsRepo.findByIdOptional(roundId)
                .orElseThrow(() -> new NoSuchElementException(messages.t("round.notFound")));
        if (!round.getTournament().getId().equals(tournament.getId())) {
            throw new IllegalArgumentException(messages.t("round.notInTournament"));
        }

        var match = matchesRepo.findByIdOptional(matchId)
                .orElseThrow(() -> new NoSuchElementException(messages.t("match.notFound")));
        if (!match.getRound().getId().equals(round.getId())) {
            throw new IllegalArgumentException(messages.t("match.notInRound"));
        }

        Integer s1 = req.score1();
        Integer s2 = req.score2();

        // Capture old state so we know whether this override actually
        // introduces a new loss for someone (vs. a no-op or unscore).
        boolean wasFinished = match.getStatus() == MatchStatus.FINISHED;
        Long prevWinnerId = (match.getWinnerPair() != null) ? match.getWinnerPair().getId() : null;

        match.setScore1(s1);
        match.setScore2(s2);

        // Decide status/winner (BYE counts as decided for pair1)
        if (match.getPair2() == null) {
            match.setStatus(MatchStatus.FINISHED);
            match.setWinnerPair(match.getPair1());
        } else if (s1 != null && s2 != null && !s1.equals(s2)) {
            match.setStatus(MatchStatus.FINISHED);
            match.setWinnerPair(s1 > s2 ? match.getPair1() : match.getPair2());
        } else {
            match.setStatus(MatchStatus.SCHEDULED);
            match.setWinnerPair(null);
        }
        matchesRepo.save(match);

        // Loss push — same gating as updateMatchScore (fresh finish or
        // winner flip). Skip for BYE (handled inside notifyLoser).
        if (introducesNewLoss(match, wasFinished, prevWinnerId)) {
            notifier.notifyLoser(tournament, match);
        }

        // 2) Recompute ALL pairs' wins/losses for this tournament from the
        //    FINISHED matches. BYE rows are skipped, matching the live
        //    updateMatchScore path (a walkover never changes wins/losses);
        //    the override used to credit a phantom win here.
        recomputePairStats(tournament.getId());

        // 3) Update round status after the override
        var matchesInRound = matchesRepo.findByRound_IdOrderByTableNoAsc(round.getId());
        boolean allDecided = matchesInRound.stream().allMatch(mx -> {
            if (mx.getPair2() == null) return true; // BYE
            return mx.getStatus() == MatchStatus.FINISHED && mx.getWinnerPair() != null;
        });
        round.setStatus(allDecided ? RoundStatus.COMPLETED : RoundStatus.IN_PROGRESS);
        roundsRepo.save(round);

        broadcast(tournament, LiveBroadcaster.SCOPE_MATCH);

        // 4) Return updated RoundDto (with ordered matches)
        var base = mapper.toRoundDto(round);
        var matchDtos = mapper.toMatchDtoList(matchesInRound);
        return new RoundDto(base.id(), base.number(), base.status(), matchDtos);
    }

    /* ===================== helpers ===================== */

    private int nextRoundNumber(Tournaments t) {
        return roundsRepo.findTopByTournamentOrderByNumberDesc(t)
                .map(Rounds::getNumber).map(n -> n + 1).orElse(1);
    }

    private Rounds newRound(Tournaments t, int number) {
        Rounds round = new Rounds();
        round.setTournament(t);
        round.setNumber(number);
        round.setStatus(RoundStatus.IN_PROGRESS);
        roundsRepo.save(round);
        return round;
    }

    /** A SCHEDULED match row; {@code p2 == null} marks a BYE. */
    private static Matches newMatch(Tournaments t, Rounds round, Integer tableNo, Pairs p1, Pairs p2) {
        Matches m = new Matches();
        m.setTournament(t);
        m.setRound(round);
        m.setTableNo(tableNo);
        m.setPair1(p1);
        m.setPair2(p2);
        m.setStatus(MatchStatus.SCHEDULED);
        return m;
    }

    /**
     * Whether this write introduced a NEW loss for someone: the match is now
     * FINISHED and either it wasn't finished before (fresh decision) or the
     * winner flipped (re-score / override by the organiser). In the flip case
     * the previous loser was just reinstated as winner, so the <i>new</i>
     * loser is the one that gets the bill push.
     */
    private static boolean introducesNewLoss(Matches m, boolean wasFinished, Long prevWinnerId) {
        if (m.getStatus() != MatchStatus.FINISHED) return false;
        Long newWinnerId = (m.getWinnerPair() != null) ? m.getWinnerPair().getId() : null;
        return !wasFinished || !Objects.equals(prevWinnerId, newWinnerId);
    }

    /**
     * Rebuild wins / losses / elimination for every pair of a tournament from
     * its FINISHED matches, then persist them.
     *
     * <p>Collapses the two near-identical recomputations that used to sit
     * inline in {@link #hardResetRound} and {@link #overrideMatchScore}. BYE
     * rows are skipped: the live {@link #updateMatchScore} path never changes
     * wins/losses for a walkover, so neither does the rebuild. The
     * elimination rule (2 losses, or 1 loss without an extra life) is shared.
     */
    private void recomputePairStats(Long tournamentId) {
        var pairs = pairsRepo.findByTournament_Id(tournamentId);
        Map<Long, Pairs> byId = pairs.stream().collect(Collectors.toMap(Pairs::getId, p -> p));

        // reset
        for (var p : pairs) {
            p.setWins(0);
            p.setLosses(0);
            p.setEliminated(false);
        }

        // count from remaining finished matches only
        var finished = matchesRepo.findByTournament_IdAndStatus(tournamentId, MatchStatus.FINISHED);
        for (var m : finished) {
            if (m.getPair2() == null) continue; // BYE: no stats, see updateMatchScore

            if (m.getWinnerPair() != null) {
                Pairs winner = byId.get(m.getWinnerPair().getId());
                Pairs loser = (m.getPair1() != null
                        && Objects.equals(m.getWinnerPair().getId(), m.getPair1().getId()))
                        ? (m.getPair2() != null ? byId.get(m.getPair2().getId()) : null)
                        : (m.getPair1() != null ? byId.get(m.getPair1().getId()) : null);

                if (winner != null) winner.setWins(winner.getWins() + 1);
                if (loser != null) loser.setLosses(loser.getLosses() + 1);
            }
        }

        // Elimination rule: 2 losses OR 1 loss without extraLife
        for (var p : pairs) {
            int losses = p.getLosses();
            p.setEliminated((losses >= 2) || (losses >= 1 && !p.isExtraLife()));
        }
        pairsRepo.saveAll(pairs);
    }
}
