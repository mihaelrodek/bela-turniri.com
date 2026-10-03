package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.MatchBillDto;
import hr.mrodek.apps.bela_turniri.dtos.MatchDrinkDto;
import hr.mrodek.apps.bela_turniri.dtos.WaiterBillSummaryDto;
import hr.mrodek.apps.bela_turniri.model.ExtraBill;
import hr.mrodek.apps.bela_turniri.model.MatchDrink;
import hr.mrodek.apps.bela_turniri.model.TournamentDrinkPrice;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.realtime.LiveBroadcaster;
import hr.mrodek.apps.bela_turniri.repository.ExtraBillRepository;
import hr.mrodek.apps.bela_turniri.repository.MatchDrinkRepository;
import hr.mrodek.apps.bela_turniri.repository.TournamentDrinkPriceRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * 2026-10-03: "Ostalo" bills — a drink bill that belongs to a tournament
 * but to no match (spectators, organisers, anyone not playing cards).
 *
 * <p>Mirrors {@link MatchBillService} operation for operation (add / remove
 * drink, paid / unpaid, same freeze-while-paid rule, same cjenik snapshot,
 * same after-commit {@code match}-scope broadcast) and returns the SAME
 * {@link MatchBillDto} (with {@code matchId} null and {@code extraBillId} /
 * {@code label} set), so one bill dialog serves both kinds.
 *
 * <p>Every method that takes a bill id also takes the tournament the
 * caller's credentials unlocked and 404s on a mismatch — the same
 * cross-tournament guard as {@code WaiterBillService.requireMatchOfTournament}.
 */
@ApplicationScoped
public class ExtraBillService {

    @Inject ExtraBillRepository extraRepo;
    @Inject MatchDrinkRepository drinkRepo;
    @Inject TournamentDrinkPriceRepository priceRepo;
    @Inject MessageService messages;
    @Inject LiveBroadcaster live;

    private void broadcast(ExtraBill e) {
        Tournaments t = e.getTournament();
        if (t == null || t.getUuid() == null) return;
        live.notifyTournament(t.getUuid().toString(), LiveBroadcaster.SCOPE_MATCH);
    }

    /** Resolve {@code id} inside {@code tournament} or 404 (never confirms it exists elsewhere). */
    public ExtraBill requireOfTournament(Tournaments tournament, Long id) {
        ExtraBill e = (tournament == null || id == null) ? null : extraRepo.findByIdOptional(id).orElse(null);
        if (e == null || e.getTournament() == null
                || !Objects.equals(e.getTournament().getId(), tournament.getId())) {
            throw new NotFoundException(messages.t("extraBill.notFound"));
        }
        return e;
    }

    @Transactional
    public WaiterBillSummaryDto create(Tournaments tournament, String label) {
        ExtraBill e = new ExtraBill();
        e.setTournament(tournament);
        e.setLabel(normaliseLabel(label));
        extraRepo.persist(e);
        broadcast(e);
        return summary(e);
    }

    @Transactional
    public MatchBillDto rename(Tournaments tournament, Long id, String label) {
        ExtraBill e = requireOfTournament(tournament, id);
        e.setLabel(normaliseLabel(label));
        extraRepo.persist(e);
        broadcast(e);
        return buildBill(e);
    }

    /**
     * Delete the bill (its drinks go with it via ON DELETE CASCADE). A
     * waiter may only delete an EMPTY bill — a mistaken tap — while the
     * organiser may delete one with drinks (the UI confirms first).
     */
    @Transactional
    public void delete(Tournaments tournament, Long id, boolean organiser) {
        ExtraBill e = requireOfTournament(tournament, id);
        if (!organiser && !drinkRepo.findByExtraBillId(e.getId()).isEmpty()) {
            throw new IllegalStateException(messages.t("extraBill.notEmpty"));
        }
        broadcast(e);
        drinkRepo.delete("extraBill.id", e.getId());
        extraRepo.delete(e);
    }

    @Transactional
    public MatchBillDto getBill(Tournaments tournament, Long id) {
        return buildBill(requireOfTournament(tournament, id));
    }

    @Transactional
    public MatchBillDto addDrink(Tournaments tournament, Long id, Long priceId, int quantity) {
        if (quantity < 1) quantity = 1;
        ExtraBill e = requireOfTournament(tournament, id);
        assertEditable(e);
        TournamentDrinkPrice p = priceRepo.findByIdOptional(priceId)
                .orElseThrow(() -> new NotFoundException(messages.t("cjenik.drink.notFound")));
        if (!Objects.equals(p.getTournament().getId(), tournament.getId())) {
            throw new BadRequestException(messages.t("matchBill.drink.otherTournament"));
        }
        MatchDrink d = new MatchDrink();
        d.setExtraBill(e);
        d.setPrice(p);
        d.setNameSnapshot(p.getName());
        d.setPriceSnapshot(p.getPrice() != null ? p.getPrice() : BigDecimal.ZERO);
        d.setQuantity(quantity);
        drinkRepo.persist(d);
        broadcast(e);
        return buildBill(e);
    }

    @Transactional
    public MatchBillDto removeDrink(Tournaments tournament, Long id, Long drinkId) {
        ExtraBill e = requireOfTournament(tournament, id);
        assertEditable(e);
        MatchDrink d = drinkRepo.findByIdOptional(drinkId)
                .orElseThrow(() -> new NotFoundException(messages.t("matchBill.drink.notFound")));
        if (d.getExtraBill() == null || !Objects.equals(d.getExtraBill().getId(), e.getId())) {
            throw new BadRequestException(messages.t("extraBill.drink.otherBill"));
        }
        drinkRepo.delete(d);
        broadcast(e);
        return buildBill(e);
    }

    @Transactional
    public MatchBillDto markPaid(Tournaments tournament, Long id, String byUid, String byName) {
        ExtraBill e = requireOfTournament(tournament, id);
        e.setPaidAt(OffsetDateTime.now());
        e.setPaidByUid(byUid);
        e.setPaidByName(byName);
        extraRepo.persist(e);
        broadcast(e);
        return buildBill(e);
    }

    @Transactional
    public MatchBillDto markUnpaid(Tournaments tournament, Long id) {
        ExtraBill e = requireOfTournament(tournament, id);
        e.setPaidAt(null);
        e.setPaidByUid(null);
        e.setPaidByName(null);
        extraRepo.persist(e);
        broadcast(e);
        return buildBill(e);
    }

    /* ===================== helpers ===================== */

    /** Same freeze rule as match bills: a paid bill is read-only until "Poništi plaćeno". */
    private void assertEditable(ExtraBill e) {
        if (e.getPaidAt() != null) {
            throw new IllegalStateException(messages.t("matchBill.alreadyPaid"));
        }
    }

    private String normaliseLabel(String label) {
        if (label == null) return null;
        String t = label.trim();
        if (t.isEmpty()) return null;
        if (t.length() > ExtraBill.LABEL_MAX) {
            throw new BadRequestException(messages.t("extraBill.labelTooLong"));
        }
        return t;
    }

    private WaiterBillSummaryDto summary(ExtraBill e) {
        return new WaiterBillSummaryDto(null, null, null, null, null,
                BigDecimal.ZERO, e.getPaidAt() != null, e.getPaidAt(), e.getPaidByName(),
                0, null, "EXTRA", e.getId(), e.getLabel());
    }

    private MatchBillDto buildBill(ExtraBill e) {
        List<MatchDrink> drinks = drinkRepo.findByExtraBillId(e.getId());
        BigDecimal total = BigDecimal.ZERO;
        List<MatchDrinkDto> dtos = new ArrayList<>(drinks.size());
        for (MatchDrink d : drinks) {
            BigDecimal line = d.getPriceSnapshot().multiply(BigDecimal.valueOf(d.getQuantity()));
            total = total.add(line);
            dtos.add(MatchBillService.toDrinkDto(d, line));
        }
        return new MatchBillDto(null, dtos, total, e.getPaidAt(), e.getPaidByUid(), e.getPaidByName(),
                null, null, e.getId(), e.getLabel());
    }
}
