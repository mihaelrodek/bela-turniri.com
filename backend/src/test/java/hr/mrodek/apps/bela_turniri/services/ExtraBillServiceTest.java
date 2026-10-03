package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.MatchBillDto;
import hr.mrodek.apps.bela_turniri.dtos.WaiterBillSummaryDto;
import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.model.TournamentDrinkPrice;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 2026-10-03: "Ostalo" bills ({@link ExtraBillService}) — runs against the
 * docker-compose Postgres like the other {@code @QuarkusTest}s, which also
 * means it is the first thing to apply the {@code 2026-10-03-extra-bills}
 * changeset (including the exactly-one-of CHECK on {@code match_drinks}).
 * Fixtures are committed in {@code @BeforeEach} and deleted in
 * {@code @AfterEach}; the tournament delete cascades to bills and drinks.
 */
@QuarkusTest
class ExtraBillServiceTest {

    @Inject EntityManager em;
    @Inject ExtraBillService extras;
    @Inject WaiterBillService waiterBills;

    private Long tournamentId;
    private Long otherTournamentId;
    private Long priceId;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            tournamentId = persistTournament("ExtraBill A");
            otherTournamentId = persistTournament("ExtraBill B");
            Tournaments t = em.find(Tournaments.class, tournamentId);
            TournamentDrinkPrice p = new TournamentDrinkPrice();
            p.setTournament(t);
            p.setName("Pivo");
            p.setPrice(new BigDecimal("2.50"));
            p.setCreatedAt(OffsetDateTime.now());
            p.setUpdatedAt(OffsetDateTime.now());
            em.persist(p);
            em.flush();
            priceId = p.getId();
        });
    }

    @AfterEach
    void cleanUp() {
        QuarkusTransaction.requiringNew().run(() ->
                em.createNativeQuery("delete from tournaments where id in (:ids)")
                        .setParameter("ids", List.of(tournamentId, otherTournamentId))
                        .executeUpdate());
    }

    private Long persistTournament(String name) {
        Tournaments t = new Tournaments();
        t.setName(name);
        t.setLocation("x");
        t.setStatus(TournamentStatus.STARTED);
        t.setCreatedByUid("extra-bill-test-organiser");
        t.setCreatedAt(OffsetDateTime.now());
        t.setStartAt(OffsetDateTime.now());
        em.persist(t);
        em.flush();
        return t.getId();
    }

    private Tournaments tournament(Long id) {
        return QuarkusTransaction.requiringNew().call(() -> em.find(Tournaments.class, id));
    }

    @Test
    void lifecycleAndListing() {
        Tournaments t = tournament(tournamentId);
        WaiterBillSummaryDto created = extras.create(t, "  Gledatelji ");
        assertEquals("EXTRA", created.kind());
        assertEquals("Gledatelji", created.label());
        assertNull(created.matchId());

        MatchBillDto bill = extras.addDrink(t, created.extraBillId(), priceId, 2);
        assertEquals(new BigDecimal("5.00"), bill.total());
        assertNull(bill.matchId());

        List<WaiterBillSummaryDto> list = waiterBills.listBills(t);
        assertEquals(1, list.size());
        assertEquals(2, list.get(0).drinkCount());
        assertEquals(new BigDecimal("5.00"), list.get(0).total());
        assertTrue(!list.get(0).paid());

        MatchBillDto paid = extras.markPaid(t, created.extraBillId(), null, "Konobar");
        assertNotNull(paid.paidAt());
        assertEquals("Konobar", paid.paidByName());
        // frozen while paid
        assertThrows(IllegalStateException.class,
                () -> extras.addDrink(t, created.extraBillId(), priceId, 1));
        extras.markUnpaid(t, created.extraBillId());

        // a waiter cannot delete a bill that has drinks, the organiser can
        assertThrows(IllegalStateException.class, () -> extras.delete(t, created.extraBillId(), false));
        extras.delete(t, created.extraBillId(), true);
        assertEquals(0, waiterBills.listBills(t).size());
    }

    @Test
    void otherTournamentCannotReachTheBill() {
        Tournaments t = tournament(tournamentId);
        Tournaments other = tournament(otherTournamentId);
        WaiterBillSummaryDto created = extras.create(t, null);
        assertThrows(NotFoundException.class, () -> extras.getBill(other, created.extraBillId()));
        assertThrows(NotFoundException.class, () -> extras.markPaid(other, created.extraBillId(), null, "x"));
    }

    @Test
    void labelIsCappedAt60() {
        Tournaments t = tournament(tournamentId);
        assertThrows(BadRequestException.class, () -> extras.create(t, "x".repeat(61)));
        assertNull(extras.create(t, "   ").label());
    }
}
