// src/main/java/hr/mrodek/apps/bela_turniri/service/RoundService.java
package hr.mrodek.apps.bela_turniri.services;

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

    public List<RoundDto> listByTournamentUuid(String uuid) {
        Tournaments t = tournamentsRepo.findByUuid(UUID.fromString(uuid)).orElse(null);
        if (t == null) return List.of();
        var rounds = roundsRepo.findByTournamentOrderByNumberAsc(t);
        List<RoundDto> out = new ArrayList<>();
        for (var r : rounds) {
            var dto = mapper.toRoundDto(r);
            var matches = matchesRepo.findByRound(r);
            out.add(new RoundDto(dto.id(), dto.number(), dto.status(), mapper.toMatchDtoList(matches)));
        }
        return out;
    }

    @Transactional
    public RoundDto drawNextRound(String uuid) {
        Tournaments t = tournamentsRepo.findByUuid(UUID.fromString(uuid))
                .orElseThrow(() -> new NoSuchElementException("Tournament not found"));

        int nextNumber = roundsRepo.findTopByTournamentOrderByNumberDesc(t)
                .map(Rounds::getNumber).map(n -> n + 1).orElse(1);

        // Active pairs (not eliminated)
        List<Pairs> active = pairsRepo.findByTournament_Id(t.getId())
                .stream().filter(p -> !p.isEliminated()).toList();

        if (active.size() < 2) throw new IllegalStateException("Not enough pairs to draw");

        // History for (1) pairing repeats and (2) prior BYEs
        List<Matches> history = matchesRepo.findByTournament_Id(t.getId());

        // Unordered pairings that already happened (exclude BYEs)
        Set<String> played = new HashSet<>();
        for (Matches m : history) {
            if (m.getPair1() != null && m.getPair2() != null) {
                played.add(pairKey(m.getPair1().getId(), m.getPair2().getId()));
            }
        }

        // Collect who already received a BYE (either side, defensive)
        Set<Long> byeRecipients = new HashSet<>();
        for (Matches m : history) {
            if (m.getPair1() != null && m.getPair2() == null) byeRecipients.add(m.getPair1().getId());
            if (m.getPair2() != null && m.getPair1() == null) byeRecipients.add(m.getPair2().getId());
        }

        Random rnd = new Random();

        // Work on a shuffled copy for randomness
        List<Pairs> pool = new ArrayList<>(active);
        Collections.shuffle(pool, rnd);

        // ===== BYE FIRST (if odd count) =====
        Pairs bye = null;
        if (pool.size() % 2 == 1) {
            // Prefer players who have NOT had a BYE yet
            List<Pairs> eligible = pool.stream()
                    .filter(p -> !byeRecipients.contains(p.getId()))
                    .collect(java.util.stream.Collectors.toList());

            List<Pairs> candidates = eligible.isEmpty() ? pool : eligible; // if everyone had a BYE, pick truly random
            Collections.shuffle(candidates, rnd);
            bye = candidates.get(0);

            final Long byeId = (bye != null) ? bye.getId() : null;

            if (byeId != null) {
                pool.removeIf(p -> Objects.equals(p.getId(), byeId));
            }
        }

        // ===== PAIRING =====
        // If preserveMatchmaking = true, avoid repeats unless unavoidable.
        List<long[]> chosenPairs = new ArrayList<>();
        if (!t.isPreserveMatchmaking()) {
            // Simple random adjacent pairing
            for (int i = 0; i < pool.size(); i += 2) {
                chosenPairs.add(new long[]{pool.get(i).getId(), pool.get(i + 1).getId()});
            }
        } else {
            // Backtracking with gradually allowed repeats
            boolean success = false;
            int maxPairs = pool.size() / 2;
            for (int allowedRepeats = 0; allowedRepeats <= maxPairs; allowedRepeats++) {
                chosenPairs.clear();
                boolean[] used = new boolean[pool.size()];
                success = pairBacktrack(pool, used, played, allowedRepeats, chosenPairs, rnd);
                if (success) break;
            }
            if (!success) {
                // Extremely rare fallback: just pair randomly
                chosenPairs.clear();
                for (int i = 0; i < pool.size(); i += 2) {
                    chosenPairs.add(new long[]{pool.get(i).getId(), pool.get(i + 1).getId()});
                }
            }
        }

        // ===== Persist round + matches =====
        Rounds round = new Rounds();
        round.setTournament(t);
        round.setNumber(nextNumber);
        round.setStatus(RoundStatus.IN_PROGRESS);
        roundsRepo.save(round);

        Map<Long, Pairs> byId = new HashMap<>();
        for (Pairs p : active) byId.put(p.getId(), p); // includes the BYE pick too

        int tableNo = 1;
        List<Matches> toSave = new ArrayList<>();

        for (long[] ab : chosenPairs) {
            Pairs p1 = byId.get(ab[0]);
            Pairs p2 = byId.get(ab[1]);

            Matches m = new Matches();
            m.setTournament(t);
            m.setRound(round);
            m.setTableNo(tableNo++);
            m.setPair1(p1);
            m.setPair2(p2);
            m.setStatus(MatchStatus.SCHEDULED);
            toSave.add(m);
        }

        if (bye != null) {
            Matches m = new Matches();
            m.setTournament(t);
            m.setRound(round);
            m.setTableNo(tableNo++);
            m.setPair1(bye);
            m.setPair2(null); // BYE
            m.setStatus(MatchStatus.SCHEDULED);
            toSave.add(m);
        }

        var saved = matchesRepo.saveAll(toSave);

        var dto = mapper.toRoundDto(round);
        return new RoundDto(dto.id(), dto.number(), dto.status(), mapper.toMatchDtoList(saved));
    }

    /* ===================== helpers ===================== */

    // Unordered key for a pairing
    private static String pairKey(long a, long b) {
        long x = Math.min(a, b), y = Math.max(a, b);
        return x + "#" + y;
    }

    /**
     * Backtracking pairing that tries to avoid previously played pairings.
     * Increase `repeatsLeft` externally until a solution is found.
     */
    private static boolean pairBacktrack(
            List<Pairs> pool,
            boolean[] used,
            Set<String> played,
            int repeatsLeft,
            List<long[]> out,
            Random rnd
    ) {
        final int n = pool.size();

        // Find first unused index
        int i = -1;
        for (int k = 0; k < n; k++) {
            if (!used[k]) {
                i = k;
                break;
            }
        }
        if (i == -1) return true; // all paired

        used[i] = true;
        long idA = pool.get(i).getId();

        List<Integer> notPlayed = new ArrayList<>();
        List<Integer> playedBefore = new ArrayList<>();

        for (int j = i + 1; j < n; j++) {
            if (used[j]) continue;
            long idB = pool.get(j).getId();
            if (played.contains(pairKey(idA, idB))) playedBefore.add(j);
            else notPlayed.add(j);
        }

        Collections.shuffle(notPlayed, rnd);
        Collections.shuffle(playedBefore, rnd);

        // Prefer brand-new matchups
        for (int j : notPlayed) {
            used[j] = true;
            out.add(new long[]{idA, pool.get(j).getId()});
            if (pairBacktrack(pool, used, played, repeatsLeft, out, rnd)) return true;
            out.remove(out.size() - 1);
            used[j] = false;
        }

        // Allow repeats if needed
        if (repeatsLeft > 0) {
            for (int j : playedBefore) {
                used[j] = true;
                out.add(new long[]{idA, pool.get(j).getId()});
                if (pairBacktrack(pool, used, played, repeatsLeft - 1, out, rnd)) return true;
                out.remove(out.size() - 1);
                used[j] = false;
            }
        }

        used[i] = false;
        return false;
    }

    @Transactional
    public MatchDto updateMatchScore(String uuid, Long roundId, Long matchId, UpdateMatchRequest req) {
        Tournaments t = tournamentsRepo.findByUuid(UUID.fromString(uuid))
                .orElseThrow(() -> new NoSuchElementException("Tournament not found"));

        Rounds r = roundsRepo.findByIdOptional(roundId)
                .filter(x -> Objects.equals(x.getTournament().getId(), t.getId()))
                .orElseThrow(() -> new NoSuchElementException("Round not found"));

        Matches m = matchesRepo.findByIdOptional(matchId)
                .filter(x -> Objects.equals(x.getRound().getId(), r.getId()))
                .orElseThrow(() -> new NoSuchElementException("Match not found"));

        Integer s1 = req.score1();
        Integer s2 = req.score2();
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

        return mapper.toMatchDto(m);
    }

    @Transactional
    public void hardResetRound(String uuid, Long roundId) {
        // 0) Load + verify
        Tournaments t = tournamentsRepo.findByUuid(UUID.fromString(uuid))
                .orElseThrow(() -> new NoSuchElementException("Tournament not found"));

        Rounds r = roundsRepo.findByIdOptional(roundId)
                .filter(x -> Objects.equals(x.getTournament().getId(), t.getId()))
                .orElseThrow(() -> new NoSuchElementException("Round not found"));

        if (r.getStatus() == RoundStatus.COMPLETED) {
            throw new IllegalStateException("Cannot hard-reset a completed round.");
        }

        // 1) Delete this round's matches, then the round itself
        matchesRepo.deleteByRound(r);
        roundsRepo.delete(r);

        // 2) Recompute ALL pairs' wins/losses/elimination from remaining FINISHED matches
        var pairs = pairsRepo.findByTournament_Id(t.getId());
        Map<Long, Pairs> byId = pairs.stream().collect(Collectors.toMap(Pairs::getId, p -> p));

        // reset
        for (var p : pairs) {
            p.setWins(0);
            p.setLosses(0);
            p.setEliminated(false);
        }

        // count from remaining finished matches only
        var finished = matchesRepo.findByTournament_IdAndStatus(t.getId(), MatchStatus.FINISHED);
        for (var m : finished) {
            // ignore BYE for stats (pair2 == null)
            if (m.getPair2() == null) continue;
            if (m.getWinnerPair() == null) continue;

            Pairs winner = byId.get(m.getWinnerPair().getId());
            Pairs loser;
            if (m.getPair1() != null && Objects.equals(m.getWinnerPair().getId(), m.getPair1().getId())) {
                loser = (m.getPair2() != null) ? byId.get(m.getPair2().getId()) : null;
            } else {
                loser = (m.getPair1() != null) ? byId.get(m.getPair1().getId()) : null;
            }

            if (winner != null) winner.setWins(winner.getWins() + 1);
            if (loser  != null) loser.setLosses(loser.getLosses() + 1);
        }

        // elimination rule (same as your override path): 2 losses, or 1 loss without extraLife
        for (var p : pairs) {
            int losses = Optional.ofNullable(p.getLosses()).orElse(0);
            boolean eliminated = (losses >= 2) || (losses >= 1 && !Boolean.TRUE.equals(p.isExtraLife()));
            p.setEliminated(eliminated);
        }
        pairsRepo.saveAll(pairs);

        // 3) Touch tournament
        t.setUpdatedAt(OffsetDateTime.now());
        tournamentsRepo.save(t);
    }

    @Transactional
    public RoundDto finishRound(String uuid, Long roundId) {
        Tournaments t = tournamentsRepo.findByUuid(UUID.fromString(uuid))
                .orElseThrow(() -> new NoSuchElementException("Tournament not found"));

        Rounds r = roundsRepo.findByIdOptional(roundId)
                .filter(x -> Objects.equals(x.getTournament().getId(), t.getId()))
                .orElseThrow(() -> new NoSuchElementException("Round not found"));

        var matches = matchesRepo.findByRound(r);

        // Validate & apply missing finals
        for (var m : matches) {
            // BYE
            if (m.getPair2() == null) {
                // Just mark finished; do NOT change wins/losses for BYE
                m.setStatus(hr.mrodek.apps.bela_turniri.enums.MatchStatus.FINISHED);
                m.setWinnerPair(m.getPair1());
                matchesRepo.save(m);
                continue;
            }

            Integer s1 = m.getScore1();
            Integer s2 = m.getScore2();

            if (s1 == null || s2 == null || Objects.equals(s1, s2)) {
                throw new IllegalStateException("All matches must have decisive scores (no ties, no blanks).");
            }

            // If already finished, assume stats are already accounted for (updateMatchScore handled reversals)
            if (m.getStatus() == hr.mrodek.apps.bela_turniri.enums.MatchStatus.FINISHED) {
                continue;
            }

            // Finish & apply stats once
            var winner = (s1 > s2) ? m.getPair1() : m.getPair2();
            var loser = (s1 > s2) ? m.getPair2() : m.getPair1();

            m.setWinnerPair(winner);
            m.setStatus(hr.mrodek.apps.bela_turniri.enums.MatchStatus.FINISHED);
            matchesRepo.save(m);

            // Update stats
            winner.setWins(winner.getWins() + 1);
            loser.setLosses(loser.getLosses() + 1);
            loser.setEliminated(true); // extra life can later revive
            pairsRepo.save(winner);
            pairsRepo.save(loser);
        }

        // Mark round completed
        r.setStatus(hr.mrodek.apps.bela_turniri.enums.RoundStatus.COMPLETED);
        r.setCompletedAt(OffsetDateTime.now());
        roundsRepo.save(r);

        // Return fresh DTO with current matches
        var savedMatches = matchesRepo.findByRound(r);
        var dto = mapper.toRoundDto(r);
        return new RoundDto(dto.id(), dto.number(), dto.status(), mapper.toMatchDtoList(savedMatches));
    }

    @Transactional
    public RoundDto overrideMatchScore(String uuid, Long roundId, Long matchId, UpdateMatchRequest req) {
        var tournament = tournamentsRepo.findByUuid(UUID.fromString(uuid))
                .orElseThrow(() -> new NoSuchElementException("Tournament not found"));

        var round = roundsRepo.findByIdOptional(roundId)
                .orElseThrow(() -> new NoSuchElementException("Round not found"));
        if (!round.getTournament().getId().equals(tournament.getId())) {
            throw new IllegalArgumentException("Round does not belong to tournament");
        }

        var match = matchesRepo.findByIdOptional(matchId)
                .orElseThrow(() -> new NoSuchElementException("Match not found"));
        if (!match.getRound().getId().equals(round.getId())) {
            throw new IllegalArgumentException("Match does not belong to round");
        }

        Integer s1 = req.score1();
        Integer s2 = req.score2();
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

        // 2) Recompute ALL pairs' wins/losses for this tournament from FINISHED matches
        var pairs = pairsRepo.findByTournament_Id(tournament.getId());
        Map<Long, Pairs> byId = pairs.stream().collect(Collectors.toMap(Pairs::getId, p -> p));
        pairs.forEach(p -> {
            p.setWins(0);
            p.setLosses(0);
            p.setEliminated(false);
        });

        var finished = matchesRepo.findByTournament_IdAndStatus(tournament.getId(), MatchStatus.FINISHED);
        for (var m : finished) {
            // winner already set above / assumed for existing finished matches
            if (m.getWinnerPair() != null) {
                var winner = byId.get(m.getWinnerPair().getId());
                var loser = (m.getPair1() != null && m.getWinnerPair().getId().equals(m.getPair1().getId()))
                        ? (m.getPair2() != null ? byId.get(m.getPair2().getId()) : null)
                        : (m.getPair1() != null ? byId.get(m.getPair1().getId()) : null);

                if (winner != null) winner.setWins(winner.getWins() + 1);
                if (loser != null) loser.setLosses(loser.getLosses() + 1);
            } else if (m.getPair2() == null && m.getPair1() != null) {
                // safety for BYE: treat as finished for pair1
                var p1 = byId.get(m.getPair1().getId());
                if (p1 != null) p1.setWins(p1.getWins() + 1);
            }
        }

        // Elimination rule: 2 losses OR 1 loss without extraLife
        for (var p : pairs) {
            int losses = p.getLosses();
            boolean eliminated = (losses >= 2) || (losses >= 1 && !Boolean.TRUE.equals(p.isExtraLife()));
            p.setEliminated(eliminated);
        }
        pairsRepo.saveAll(pairs);

        // 3) Update round status after the override
        var matchesInRound = matchesRepo.findByRound_IdOrderByTableNoAsc(round.getId());
        boolean allDecided = matchesInRound.stream().allMatch(mx -> {
            if (mx.getPair2() == null) return true; // BYE
            return mx.getStatus() == MatchStatus.FINISHED && mx.getWinnerPair() != null;
        });
        round.setStatus(allDecided ? RoundStatus.COMPLETED : RoundStatus.IN_PROGRESS);
        roundsRepo.save(round);

        // 4) Return updated RoundDto (with ordered matches)
        var base = mapper.toRoundDto(round);
        var matchDtos = mapper.toMatchDtoList(matchesInRound);
        return new RoundDto(base.id(), base.number(), base.status(), matchDtos);
    }
}