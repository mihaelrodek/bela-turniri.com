package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.MatchBillDto;
import hr.mrodek.apps.bela_turniri.dtos.MatchDrinkDto;
import hr.mrodek.apps.bela_turniri.enums.MatchStatus;
import hr.mrodek.apps.bela_turniri.model.MatchDrink;
import hr.mrodek.apps.bela_turniri.model.Matches;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.TournamentDrinkPrice;
import hr.mrodek.apps.bela_turniri.repository.MatchDrinkRepository;
import hr.mrodek.apps.bela_turniri.repository.MatchesRepository;
import hr.mrodek.apps.bela_turniri.repository.TournamentDrinkPriceRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;

/**
 * Match-bill bookkeeping: attach drinks to a match, mark the bill paid
 * (or unpaid), assemble a full bill view for the UI.
 *
 * The "loser pays" rule is surfaced by populating {@code loserPairId}
 * on the bill DTO once the match is FINISHED — the UI uses that to
 * label the bill. The actual collection still happens at the bar,
 * not in software.
 */
@ApplicationScoped
public class MatchBillService {

    @Inject MatchesRepository matchesRepo;
    @Inject MatchDrinkRepository drinkRepo;
    @Inject TournamentDrinkPriceRepository priceRepo;

    /** Build the full bill view for one match. */
    public MatchBillDto getBill(Long matchId) {
        Matches m = matchesRepo.findByIdOptional(matchId)
                .orElseThrow(() -> new NotFoundException("Match not found"));
        return buildBill(m);
    }

    @Transactional
    public MatchBillDto addDrink(Long matchId, Long priceId, int quantity) {
        if (quantity < 1) quantity = 1;
        Matches m = matchesRepo.findByIdOptional(matchId)
                .orElseThrow(() -> new NotFoundException("Match not found"));
        assertBillEditable(m);
        TournamentDrinkPrice p = priceRepo.findByIdOptional(priceId)
                .orElseThrow(() -> new NotFoundException("Drink not found in cjenik"));
        if (!Objects.equals(p.getTournament().getId(), m.getTournament().getId())) {
            throw new BadRequestException("Drink belongs to a different tournament");
        }

        MatchDrink d = new MatchDrink();
        d.setMatch(m);
        d.setPrice(p);
        d.setNameSnapshot(p.getName());
        d.setPriceSnapshot(p.getPrice() != null ? p.getPrice() : BigDecimal.ZERO);
        d.setQuantity(quantity);
        drinkRepo.persist(d);
        return buildBill(m);
    }

    @Transactional
    public MatchBillDto removeDrink(Long matchId, Long drinkId) {
        Matches m = matchesRepo.findByIdOptional(matchId)
                .orElseThrow(() -> new NotFoundException("Match not found"));
        assertBillEditable(m);
        MatchDrink d = drinkRepo.findByIdOptional(drinkId)
                .orElseThrow(() -> new NotFoundException("Drink not found"));
        if (!Objects.equals(d.getMatch().getId(), m.getId())) {
            throw new BadRequestException("Drink doesn't belong to this match");
        }
        drinkRepo.delete(d);
        return buildBill(m);
    }

    /**
     * Freeze rule: once the bill is marked paid the bartender can't add or
     * remove items without first hitting "Poništi plaćeno". This protects
     * the audit trail — a bill the players already settled at the bar
     * shouldn't silently change later.
     */
    private void assertBillEditable(Matches m) {
        if (m.getPaidAt() != null) {
            throw new WebApplicationException(
                    "Bill is already marked paid — unpay first to edit.",
                    Response.Status.CONFLICT);
        }
    }

    /**
     * True if {@code uid} was the submitter of either pair in this match,
     * or null if the user has no pair in the match. Used by the controller
     * for access checks — non-participants get a 404 (we intentionally don't
     * differentiate from a missing match: it's a privacy signal).
     */
    public boolean isParticipant(Matches m, String uid) {
        if (uid == null || uid.isBlank()) return false;
        return participantOnPair(m.getPair1(), uid) || participantOnPair(m.getPair2(), uid);
    }

    /** True if {@code uid} is either the primary submitter or the claimed co-owner of {@code p}. */
    private static boolean participantOnPair(Pairs p, String uid) {
        if (p == null) return false;
        if (uid.equals(p.getSubmittedByUid())) return true;
        if (uid.equals(p.getCoSubmittedByUid())) return true;
        return false;
    }

    /**
     * Build the invoice list for a user: every non-BYE match they played
     * across any tournament, with totals and paid status. Skips matches
     * with no attached drinks AND no paid status — empty unsettled bills
     * are just noise.
     *
     * Sorted newest-first by createdAt of the latest drink (or paid time,
     * or the match itself) so the user's most recent visits surface at
     * the top of the list.
     */
    public java.util.List<hr.mrodek.apps.bela_turniri.dtos.UserInvoiceDto> listInvoicesForUser(String uid) {
        if (uid == null || uid.isBlank()) return java.util.List.of();
        // Find every match where this user was a participant via either
        // pair — as the primary submitter OR as the claimed co-owner.
        // Excludes BYE matches (pair2 is null) — no shared bill to settle.
        var all = matchesRepo.list(
                "(pair1.submittedByUid = ?1 or pair1.coSubmittedByUid = ?1 " +
                " or pair2.submittedByUid = ?1 or pair2.coSubmittedByUid = ?1) " +
                "and pair2 is not null",
                uid
        );

        var out = new java.util.ArrayList<hr.mrodek.apps.bela_turniri.dtos.UserInvoiceDto>(all.size());
        for (Matches m : all) {
            // Compute total
            BigDecimal total = BigDecimal.ZERO;
            int lineCount = 0;
            for (var d : drinkRepo.findByMatchId(m.getId())) {
                total = total.add(d.getPriceSnapshot()
                        .multiply(BigDecimal.valueOf(d.getQuantity())));
                lineCount++;
            }
            // Skip empty + never-paid rows — they'd just clutter the list.
            if (lineCount == 0 && m.getPaidAt() == null) continue;

            // Identify which side is the user and which is the opponent.
            // The user can be either the primary submitter or the claimed
            // co-owner — both qualify.
            Pairs mine =
                    (m.getPair1() != null
                            && (uid.equals(m.getPair1().getSubmittedByUid())
                                || uid.equals(m.getPair1().getCoSubmittedByUid())))
                            ? m.getPair1()
                            : m.getPair2();
            Pairs opp = (mine == m.getPair1()) ? m.getPair2() : m.getPair1();

            boolean finished = m.getStatus() == MatchStatus.FINISHED && m.getWinnerPair() != null;
            boolean lost = finished
                    && mine != null
                    && !Objects.equals(mine.getId(), m.getWinnerPair().getId());

            var t = m.getTournament();
            String ref = (t.getSlug() != null && !t.getSlug().isBlank())
                    ? t.getSlug()
                    : (t.getUuid() != null ? t.getUuid().toString() : "");

            out.add(new hr.mrodek.apps.bela_turniri.dtos.UserInvoiceDto(
                    m.getId(),
                    t.getId(),
                    t.getName(),
                    ref,
                    t.getStartAt(),
                    m.getRound() != null ? m.getRound().getNumber() : null,
                    m.getTableNo(),
                    mine != null ? mine.getName() : null,
                    opp != null ? opp.getName() : null,
                    total,
                    m.getPaidAt(),
                    lost,
                    finished
            ));
        }

        // Newest first — order by tournament start (so recent events float
        // up). Ties broken by match id so order is stable.
        out.sort((a, b) -> {
            OffsetDateTime ta = a.tournamentStartAt();
            OffsetDateTime tb = b.tournamentStartAt();
            int cmp;
            if (ta == null && tb == null) cmp = 0;
            else if (ta == null) cmp = 1;
            else if (tb == null) cmp = -1;
            else cmp = tb.compareTo(ta);
            if (cmp != 0) return cmp;
            return Long.compare(b.matchId(), a.matchId());
        });
        return out;
    }

    @Transactional
    public MatchBillDto markPaid(Long matchId, String byUid) {
        Matches m = matchesRepo.findByIdOptional(matchId)
                .orElseThrow(() -> new NotFoundException("Match not found"));
        m.setPaidAt(OffsetDateTime.now());
        m.setPaidByUid(byUid);
        matchesRepo.persist(m);
        return buildBill(m);
    }

    @Transactional
    public MatchBillDto markUnpaid(Long matchId) {
        Matches m = matchesRepo.findByIdOptional(matchId)
                .orElseThrow(() -> new NotFoundException("Match not found"));
        m.setPaidAt(null);
        m.setPaidByUid(null);
        matchesRepo.persist(m);
        return buildBill(m);
    }

    /* ===================== assembly ===================== */

    private MatchBillDto buildBill(Matches m) {
        List<MatchDrink> drinks = drinkRepo.findByMatchId(m.getId());
        BigDecimal total = BigDecimal.ZERO;
        List<MatchDrinkDto> dtos = new java.util.ArrayList<>(drinks.size());
        for (var d : drinks) {
            BigDecimal line = d.getPriceSnapshot().multiply(BigDecimal.valueOf(d.getQuantity()));
            total = total.add(line);
            dtos.add(new MatchDrinkDto(
                    d.getId(),
                    d.getPrice() != null ? d.getPrice().getId() : null,
                    d.getNameSnapshot(),
                    d.getPriceSnapshot(),
                    d.getQuantity(),
                    line,
                    d.getCreatedAt()
            ));
        }

        // "Loser pays" only makes sense once the match has finished and
        // wasn't a BYE. Before then we leave loser fields null and the
        // UI just shows the running total.
        Long loserPairId = null;
        String loserPairName = null;
        if (m.getStatus() == MatchStatus.FINISHED
                && m.getPair2() != null
                && m.getWinnerPair() != null
                && m.getPair1() != null) {
            Pairs loser = Objects.equals(m.getWinnerPair().getId(), m.getPair1().getId())
                    ? m.getPair2() : m.getPair1();
            if (loser != null) {
                loserPairId = loser.getId();
                loserPairName = loser.getName();
            }
        }

        return new MatchBillDto(
                m.getId(),
                dtos,
                total,
                m.getPaidAt(),
                m.getPaidByUid(),
                loserPairId,
                loserPairName
        );
    }
}
