// src/main/java/hr/mrodek/apps/bela_turniri/service/RoundService.java
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
    @Inject
    PushService pushService;
    @Inject
    hr.mrodek.apps.bela_turniri.repository.MatchDrinkRepository matchDrinkRepo;

    public List<RoundDto> listByTournamentUuid(String uuid) {
        Tournaments t = tournamentsRepo.findByUuidOrSlug(uuid).orElse(null);
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
        Tournaments t = tournamentsRepo.findByUuidOrSlug(uuid)
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

        // Notify every player whose pair has a known user UID — one push per
        // device telling them which round / table / opponent to head to.
        // Skip BYE matches (pair2 == null): there's no real game to attend.
        // Errors inside sendToUser are swallowed by PushService, so a flaky
        // push provider can never roll back the round.
        String tournamentRef = (t.getSlug() != null && !t.getSlug().isBlank())
                ? t.getSlug()
                : (t.getUuid() != null ? t.getUuid().toString() : "");
        for (Matches m : saved) {
            if (m.getPair2() == null) continue; // BYE — no opponent
            Pairs p1 = m.getPair1();
            Pairs p2 = m.getPair2();
            if (p1 == null) continue;
            Integer tbl = m.getTableNo();
            String title = "Runda " + round.getNumber();
            String body = p1.getName() + " vs " + p2.getName()
                    + (tbl != null ? " na stolu " + tbl : "");
            // Deep-link to the specific match: TournamentDetailsPage reads
            // ?match={id} on mount, switches to the Ždrijeb tab, expands
            // the round, and scrolls the row into view (no modal opened
            // — there's no bill yet at this point in the tournament).
            // SPA route is /turniri/{slug} since the Croatian-routes refactor.
            // /tournaments/... still works as a 301 alias, but emitting the
            // canonical URL means the SW notification-click handler navigates
            // without a redirect hop.
            String matchUrl = "/turniri/" + tournamentRef + "?match=" + m.getId();
            // Tag groups notifications per round so a re-draw or a follow-up
            // notification for the same player+round replaces the previous
            // instead of stacking on the lock screen.
            String tag = "round-" + round.getId() + "-pair-";
            // Notify every UID linked to either pair (primary submitter
            // and co-owner from the share-link claim). Same payload for
            // both — they both need to know which table to head to.
            for (String uid : pairUids(p1)) {
                pushService.sendToUser(
                        uid,
                        new PushService.PushPayload(
                                title, body, matchUrl,
                                "/bela-turniri-symbol.png",
                                tag + p1.getId() + "-" + uid
                        )
                );
            }
            for (String uid : pairUids(p2)) {
                pushService.sendToUser(
                        uid,
                        new PushService.PushPayload(
                                title, body, matchUrl,
                                "/bela-turniri-symbol.png",
                                tag + p2.getId() + "-" + uid
                        )
                );
            }
        }

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
        Tournaments t = tournamentsRepo.findByUuidOrSlug(uuid)
                .orElseThrow(() -> new NoSuchElementException("Tournament not found"));

        if (t.getStatus() == TournamentStatus.FINISHED) {
            throw new IllegalStateException("Tournament is already finished");
        }

        if (req == null || req.matches() == null || req.matches().isEmpty()) {
            throw new IllegalStateException("At least one match is required");
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
                throw new IllegalStateException("Each match needs pair1Id and tableNo");
            }
            Pairs p1 = pairsById.get(m.pair1Id());
            if (p1 == null) {
                throw new IllegalStateException("pair1Id " + m.pair1Id() + " is not in this tournament");
            }
            if (p1.isEliminated()) {
                throw new IllegalStateException("Pair " + p1.getName() + " is already eliminated");
            }
            if (!usedIds.add(m.pair1Id())) {
                throw new IllegalStateException("Pair " + p1.getName() + " appears in more than one match");
            }
            if (m.pair2Id() != null) {
                if (m.pair2Id().equals(m.pair1Id())) {
                    throw new IllegalStateException("A pair cannot play itself");
                }
                Pairs p2 = pairsById.get(m.pair2Id());
                if (p2 == null) {
                    throw new IllegalStateException("pair2Id " + m.pair2Id() + " is not in this tournament");
                }
                if (p2.isEliminated()) {
                    throw new IllegalStateException("Pair " + p2.getName() + " is already eliminated");
                }
                if (!usedIds.add(m.pair2Id())) {
                    throw new IllegalStateException("Pair " + p2.getName() + " appears in more than one match");
                }
            }
        }

        int nextNumber = roundsRepo.findTopByTournamentOrderByNumberDesc(t)
                .map(Rounds::getNumber).map(n -> n + 1).orElse(1);

        Rounds round = new Rounds();
        round.setTournament(t);
        round.setNumber(nextNumber);
        round.setStatus(RoundStatus.IN_PROGRESS);
        roundsRepo.save(round);

        List<Matches> toSave = new ArrayList<>();
        for (ManualRoundRequest.Match m : req.matches()) {
            Matches row = new Matches();
            row.setTournament(t);
            row.setRound(round);
            row.setTableNo(m.tableNo());
            row.setPair1(pairsById.get(m.pair1Id()));
            row.setPair2(m.pair2Id() == null ? null : pairsById.get(m.pair2Id()));
            row.setStatus(MatchStatus.SCHEDULED);
            toSave.add(row);
        }

        var saved = matchesRepo.saveAll(toSave);

        // Same push-notification logic as the automatic draw — players
        // get a deep link into their match. Lifted out into a helper so
        // both code paths agree on the payload shape; if you tweak one,
        // tweak the other.
        notifyMatches(t, round, saved);

        var dto = mapper.toRoundDto(round);
        return new RoundDto(dto.id(), dto.number(), dto.status(), mapper.toMatchDtoList(saved));
    }

    /**
     * Send a "Runda X" push notification to every UID linked to each
     * pair playing in the round. Extracted from {@link #drawNextRound}
     * so {@link #drawManualRound} can reuse the same payload shape.
     * BYE rows (pair2 == null) are skipped — there's no opponent to
     * announce.
     */
    private void notifyMatches(Tournaments t, Rounds round, List<Matches> matches) {
        String tournamentRef = (t.getSlug() != null && !t.getSlug().isBlank())
                ? t.getSlug()
                : (t.getUuid() != null ? t.getUuid().toString() : "");
        for (Matches m : matches) {
            if (m.getPair2() == null) continue;
            Pairs p1 = m.getPair1();
            Pairs p2 = m.getPair2();
            if (p1 == null) continue;
            Integer tbl = m.getTableNo();
            String title = "Runda " + round.getNumber();
            String body = p1.getName() + " vs " + p2.getName()
                    + (tbl != null ? " na stolu " + tbl : "");
            String matchUrl = "/turniri/" + tournamentRef + "?match=" + m.getId();
            String tag = "round-" + round.getId() + "-pair-";
            for (String uid : pairUids(p1)) {
                pushService.sendToUser(uid, new PushService.PushPayload(
                        title, body, matchUrl, "/bela-turniri-symbol.png",
                        tag + p1.getId() + "-" + uid));
            }
            for (String uid : pairUids(p2)) {
                pushService.sendToUser(uid, new PushService.PushPayload(
                        title, body, matchUrl, "/bela-turniri-symbol.png",
                        tag + p2.getId() + "-" + uid));
            }
        }
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

    /**
     * All UIDs linked to a pair — the primary submitter and (if claimed)
     * the share-link co-owner. Order is primary first then co-owner.
     */
    private static java.util.List<String> pairUids(Pairs p) {
        if (p == null) return java.util.List.of();
        java.util.List<String> out = new java.util.ArrayList<>(2);
        if (p.getSubmittedByUid() != null && !p.getSubmittedByUid().isBlank()) {
            out.add(p.getSubmittedByUid());
        }
        if (p.getCoSubmittedByUid() != null && !p.getCoSubmittedByUid().isBlank()) {
            out.add(p.getCoSubmittedByUid());
        }
        return out;
    }

    /**
     * Push the loser of a freshly-finished match a notification with the
     * table's current bill total — they're the one who pays per Belot
     * tradition. Both the primary submitter AND the share-link co-owner
     * get the notification (each on their own devices).
     *
     * Silent no-op when:
     *   - BYE match (no opponent, nothing to settle)
     *   - neither side of the losing pair has a known user UID
     *
     * Push failures are swallowed by PushService so a flaky provider
     * can't roll back the score update.
     */
    private void notifyLoser(Tournaments t, Matches m) {
        if (m.getPair2() == null) return; // BYE
        if (m.getWinnerPair() == null) return;
        if (m.getPair1() == null) return;

        Pairs loser = Objects.equals(m.getWinnerPair().getId(), m.getPair1().getId())
                ? m.getPair2() : m.getPair1();
        if (loser == null) return;
        var uids = pairUids(loser);
        if (uids.isEmpty()) return;

        // Compute current bill total. We don't bail on empty bill — we
        // still tell the loser they lost, with 0,00 € as the body. That
        // way they know the match was scored even before any drinks
        // were attached.
        java.math.BigDecimal total = java.math.BigDecimal.ZERO;
        for (var d : matchDrinkRepo.findByMatchId(m.getId())) {
            java.math.BigDecimal line = d.getPriceSnapshot()
                    .multiply(java.math.BigDecimal.valueOf(d.getQuantity()));
            total = total.add(line);
        }
        String totalStr = new java.text.DecimalFormat("0.00")
                .format(total).replace('.', ',');

        String tournamentRef = (t.getSlug() != null && !t.getSlug().isBlank())
                ? t.getSlug()
                : (t.getUuid() != null ? t.getUuid().toString() : "");
        Integer tbl = m.getTableNo();
        String body = "Račun za stol" + (tbl != null ? " " + tbl : "")
                + ": " + totalStr + " €";
        // Tag scopes the notification to this match so a re-score doesn't
        // stack multiple notifications on the lock screen.
        String tag = "loss-match-" + m.getId();

        // Deep-link straight to the bill modal. TournamentDetailsPage
        // reads ?bill={matchId} on mount and (a) switches to the Ždrijeb
        // tab, (b) expands the round, (c) scrolls to the match, (d)
        // auto-opens the bill dialog.
        for (String uid : uids) {
            pushService.sendToUser(
                    uid,
                    new PushService.PushPayload(
                            "Izgubili ste meč",
                            body,
                            "/turniri/" + tournamentRef + "?bill=" + m.getId(),
                            "/bela-turniri-symbol.png",
                            tag + "-" + uid
                    )
            );
        }
    }

    @Transactional
    public MatchDto updateMatchScore(String uuid, Long roundId, Long matchId, UpdateMatchRequest req) {
        Tournaments t = tournamentsRepo.findByUuidOrSlug(uuid)
                .orElseThrow(() -> new NoSuchElementException("Tournament not found"));

        Rounds r = roundsRepo.findByIdOptional(roundId)
                .filter(x -> Objects.equals(x.getTournament().getId(), t.getId()))
                .orElseThrow(() -> new NoSuchElementException("Round not found"));

        Matches m = matchesRepo.findByIdOptional(matchId)
                .filter(x -> Objects.equals(x.getRound().getId(), r.getId()))
                .orElseThrow(() -> new NoSuchElementException("Match not found"));

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

        // Loss push: only if the match is now FINISHED AND either
        //   (a) it wasn't finished before (fresh decision), or
        //   (b) the winner flipped (re-score by the organizer).
        // In case (b) the previous loser was just reinstated as winner;
        // the *new* loser gets the push instead.
        if (m.getStatus() == MatchStatus.FINISHED) {
            Long newWinnerId = (m.getWinnerPair() != null) ? m.getWinnerPair().getId() : null;
            boolean newFinish = !wasFinished;
            boolean flipped = wasFinished && !Objects.equals(prevWinnerId, newWinnerId);
            if (newFinish || flipped) {
                notifyLoser(t, m);
            }
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

        return mapper.toMatchDto(m);
    }

    @Transactional
    public void hardResetRound(String uuid, Long roundId) {
        // 0) Load + verify
        Tournaments t = tournamentsRepo.findByUuidOrSlug(uuid)
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
        Tournaments t = tournamentsRepo.findByUuidOrSlug(uuid)
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

            // Fresh finish via "Završi rundu" — notify the new loser with
            // the table's bill total.
            notifyLoser(t, m);
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
        var tournament = tournamentsRepo.findByUuidOrSlug(uuid)
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
        // winner flip). Skip for BYE (handled by notifyLoser).
        if (match.getStatus() == MatchStatus.FINISHED) {
            Long newWinnerId = (match.getWinnerPair() != null) ? match.getWinnerPair().getId() : null;
            boolean newFinish = !wasFinished;
            boolean flipped = wasFinished && !Objects.equals(prevWinnerId, newWinnerId);
            if (newFinish || flipped) {
                notifyLoser(tournament, match);
            }
        }

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