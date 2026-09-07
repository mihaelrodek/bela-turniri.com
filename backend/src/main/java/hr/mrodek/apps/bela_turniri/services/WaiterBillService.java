package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.WaiterBillSummaryDto;
import hr.mrodek.apps.bela_turniri.model.MatchDrink;
import hr.mrodek.apps.bela_turniri.model.Matches;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.repository.MatchDrinkRepository;
import hr.mrodek.apps.bela_turniri.repository.MatchesRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.NotFoundException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * The waiter's view of a tournament's bills.
 *
 * <p>Separate from {@link MatchBillService} because the question is a
 * different one. That service answers "what is on this table's bill?"; this
 * one answers "which of the twenty tables in this hall still owe money?",
 * which is a whole-tournament read that has to survive being refreshed
 * every few seconds on a phone with one bar of signal.
 *
 * <p>Living in a service rather than inline in the controller keeps the
 * query and the mapping testable on their own, and keeps the controller
 * doing what every other controller here does: authorise, delegate, map.
 */
@ApplicationScoped
public class WaiterBillService {

    @Inject MatchesRepository matchesRepo;
    @Inject MatchDrinkRepository drinkRepo;
    @Inject MessageService messages;

    /**
     * Every match of the tournament, ordered by round then table — the
     * order the waiter physically walks the room in.
     *
     * <p>Two queries, always, regardless of how many matches there are:
     * {@code findByTournament_IdWithRoundAndPairs} fetch-joins the round
     * and both pairs, and the drinks for every match come back in a single
     * {@code findByMatchIds} exactly as
     * {@link MatchBillService#listInvoicesForUser} does. The naive shape —
     * a bill lookup per match — was 1 + 3n queries for the one screen this
     * feature exists to render, and it is the screen that gets polled.
     *
     * <p>{@code @Transactional} because the mapping walks the fetched
     * associations; the load and every walk have to share one persistence
     * context.
     */
    @Transactional
    public List<WaiterBillSummaryDto> listBills(Tournaments tournament) {
        if (tournament == null || tournament.getId() == null) return List.of();

        List<Matches> matches = matchesRepo.findByTournament_IdWithRoundAndPairs(tournament.getId());
        if (matches.isEmpty()) return List.of();

        List<Long> matchIds = matches.stream().map(Matches::getId).toList();
        Map<Long, List<MatchDrink>> drinksByMatch = drinkRepo.findByMatchIds(matchIds).stream()
                .collect(Collectors.groupingBy(d -> d.getMatch().getId()));

        List<WaiterBillSummaryDto> out = new ArrayList<>(matches.size());
        for (Matches m : matches) {
            // A BYE (pair2 == null, same definition RoundService uses) is a
            // free table with nobody to serve — no opponent, no game, no
            // bill. Skip it rather than list a table the waiter cannot
            // actually charge anyone at.
            if (m.getPair2() == null) continue;

            BigDecimal total = BigDecimal.ZERO;
            int drinkCount = 0;
            for (MatchDrink d : drinksByMatch.getOrDefault(m.getId(), List.of())) {
                total = total.add(d.getPriceSnapshot().multiply(BigDecimal.valueOf(d.getQuantity())));
                // Drinks carried, not rows recorded: "3 × pivo" is three beers.
                drinkCount += d.getQuantity();
            }
            out.add(new WaiterBillSummaryDto(
                    m.getId(),
                    m.getRound() != null ? m.getRound().getNumber() : null,
                    m.getTableNo(),
                    pairName(m.getPair1()),
                    pairName(m.getPair2()),
                    total,
                    m.getPaidAt() != null,
                    m.getPaidAt(),
                    drinkCount,
                    m.getStatus() != null ? m.getStatus().name() : null
            ));
        }
        return out;
    }

    /**
     * Resolve a match id against the tournament the waiter's token unlocked,
     * or 404.
     *
     * <p>This is the check that stops a waiter token for tournament A from
     * reading or mutating a bill in tournament B by guessing sequential
     * match ids — the path segment is attacker-controlled and proves
     * nothing on its own. Same shape as {@code MatchBillController.loadMatch}
     * and, like it, answers 404 rather than 403: a 403 would confirm the
     * match exists somewhere, which is precisely what the guess was for.
     *
     * <p>Not transactional itself. Callers are, and the match they get back
     * has to be usable in the same persistence context as the write that
     * follows.
     */
    public Matches requireMatchOfTournament(Tournaments tournament, Long matchId) {
        if (tournament == null || matchId == null) {
            throw new NotFoundException(messages.t("match.notFound"));
        }
        Matches m = matchesRepo.findByIdOptional(matchId).orElse(null);
        if (m == null || m.getTournament() == null
                || !Objects.equals(m.getTournament().getId(), tournament.getId())) {
            throw new NotFoundException(messages.t("match.notFound"));
        }
        return m;
    }

    private static String pairName(Pairs p) {
        return p == null ? null : p.getName();
    }
}
