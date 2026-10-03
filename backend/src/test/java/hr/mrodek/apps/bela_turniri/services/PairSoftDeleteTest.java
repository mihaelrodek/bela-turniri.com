package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.PairDto;
import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.repository.PairsRepository;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.WebApplicationException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 2026-10-03: pair soft delete ({@code 2026-10-03-pairs-soft-delete}) —
 * delete hides, the deleted list shows, restore brings back, and neither
 * delete nor restore works once the tournament has started. Runs against the
 * docker-compose Postgres like the other {@code @QuarkusTest}s (so it is also
 * the first thing to apply the changeset). Fixtures are committed in
 * {@code @BeforeEach}; deleting the tournament cascades to its pairs.
 */
@QuarkusTest
class PairSoftDeleteTest {

    @Inject EntityManager em;
    @Inject TournamentPairService pairs;
    @Inject PairsRepository pairRepo;

    private Long tournamentId;
    private Long aId;
    private Long bId;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            Tournaments t = new Tournaments();
            t.setName("PairSoftDelete");
            t.setLocation("x");
            t.setStatus(TournamentStatus.DRAFT);
            t.setCreatedByUid("pair-soft-delete-test-organiser");
            t.setCreatedAt(OffsetDateTime.now());
            t.setStartAt(OffsetDateTime.now());
            t.setMaxPairs(2);
            em.persist(t);
            Pairs a = pair(t, "Ana & Ivo");
            Pairs b = pair(t, "Pero & Mate");
            em.flush();
            tournamentId = t.getId();
            aId = a.getId();
            bId = b.getId();
        });
    }

    @AfterEach
    void cleanUp() {
        QuarkusTransaction.requiringNew().run(() ->
                em.createNativeQuery("delete from tournaments where id = :id")
                        .setParameter("id", tournamentId)
                        .executeUpdate());
    }

    private Pairs pair(Tournaments t, String name) {
        Pairs p = new Pairs();
        p.setTournament(t);
        p.setName(name);
        p.setPaid(true);
        em.persist(p);
        return p;
    }

    private void inTx(java.util.function.Consumer<Tournaments> body) {
        QuarkusTransaction.requiringNew().run(() -> body.accept(em.find(Tournaments.class, tournamentId)));
    }

    @Test
    void deleteHidesPairAndRestoreBringsItBack() {
        inTx(t -> pairs.deletePair(t, aId));

        QuarkusTransaction.requiringNew().run(() -> {
            assertEquals(1, pairRepo.findByTournament_Id(tournamentId).size());
            assertEquals(1, pairRepo.countActiveByTournament_Id(tournamentId));
            List<Pairs> deleted = pairRepo.findDeletedByTournament_Id(tournamentId);
            assertEquals(1, deleted.size());
            assertNotNull(deleted.get(0).getDeletedAt());
        });

        inTx(t -> {
            List<PairDto> deleted = pairs.listDeleted(t);
            assertEquals(1, deleted.size());
            assertNotNull(deleted.get(0).deletedAt());
            PairDto back = pairs.restore(t, aId);
            assertNull(back.deletedAt());
            assertEquals("Ana & Ivo", back.name());
            assertTrue(back.paid());
        });

        QuarkusTransaction.requiringNew().run(() -> {
            assertEquals(2, pairRepo.findByTournament_Id(tournamentId).size());
            assertEquals(0, pairRepo.findDeletedByTournament_Id(tournamentId).size());
        });
    }

    @Test
    void deletedPairCannotBeDeletedTwiceOrRestoredWhenLive() {
        inTx(t -> pairs.deletePair(t, aId));
        inTx(t -> assertThrows(NotFoundException.class, () -> pairs.deletePair(t, aId)));
        inTx(t -> assertThrows(NotFoundException.class, () -> pairs.restore(t, bId)));
    }

    @Test
    void bulkReplaceSoftDeletesAbsentPairsAndDoesNotResurrect() {
        inTx(t -> {
            List<PairDto> current = pairs.listForViewer(t);
            PairDto keep = current.stream().filter(p -> p.id().longValue() == bId).findFirst().orElseThrow();
            List<PairDto> result = pairs.replacePairs(t, List.of(keep));
            assertEquals(1, result.size());
        });
        QuarkusTransaction.requiringNew().run(() ->
                assertEquals(1, pairRepo.findDeletedByTournament_Id(tournamentId).size()));
        // re-sending the deleted id inserts a NEW row; the deleted one stays deleted
        inTx(t -> {
            PairDto ghost = new PairDto(aId.intValue(), "Ana & Ivo", false, false, 0, 0, true, null, false);
            PairDto keep = pairs.listForViewer(t).get(0);
            pairs.replacePairs(t, List.of(keep, ghost));
        });
        QuarkusTransaction.requiringNew().run(() -> {
            assertEquals(1, pairRepo.findDeletedByTournament_Id(tournamentId).size());
            assertEquals(2, pairRepo.findByTournament_Id(tournamentId).size());
        });
    }

    @Test
    void restoreRefusesWhenRosterFull() {
        inTx(t -> pairs.deletePair(t, aId));
        inTx(t -> {
            pairs.replacePairs(t, List.of(
                    pairs.listForViewer(t).get(0),
                    new PairDto(null, "Novi par", false, false, 0, 0, false, null, false)));
        });
        inTx(t -> {
            WebApplicationException ex =
                    assertThrows(WebApplicationException.class, () -> pairs.restore(t, aId));
            assertEquals(409, ex.getResponse().getStatus());
            assertEquals("PAIRS_FULL", ex.getResponse().getEntity());
        });
    }

    @Test
    void restoreAndDeleteRefusedOnceStarted() {
        inTx(t -> pairs.deletePair(t, aId));
        inTx(t -> t.setStatus(TournamentStatus.STARTED));
        inTx(t -> {
            WebApplicationException r =
                    assertThrows(WebApplicationException.class, () -> pairs.restore(t, aId));
            assertEquals("TOURNAMENT_ALREADY_STARTED", r.getResponse().getEntity());
            WebApplicationException d =
                    assertThrows(WebApplicationException.class, () -> pairs.deletePair(t, bId));
            assertEquals("TOURNAMENT_ALREADY_STARTED", d.getResponse().getEntity());
        });
    }
}
