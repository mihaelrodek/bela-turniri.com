package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.PairDto;
import hr.mrodek.apps.bela_turniri.dtos.PairShortDto;
import hr.mrodek.apps.bela_turniri.mappers.PairMapper;
import hr.mrodek.apps.bela_turniri.model.*;
import hr.mrodek.apps.bela_turniri.repository.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.time.OffsetDateTime;
import java.util.NoSuchElementException;
import java.util.Objects;

@ApplicationScoped
public class RepassageService {

    @Inject PairsRepository pairsRepo;
    @Inject RoundsRepository roundsRepo;
    @Inject MatchesRepository matchesRepo;
    @Inject RepassagePurchaseRepository repassageRepo;
    @Inject UserProfileRepository userProfileRepo;
    @Inject PairMapper pairMapper;
    @Inject MessageService messages;

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
     * Buy the eliminated pair a second life (repasaž).
     *
     * <p>Takes the {@link Tournaments} entity, not an id: the only caller is
     * {@code TournamentController.buyExtraLife}, which has already resolved
     * and ownership-checked the tournament through {@code TournamentAccess}
     * inside this very transaction. Re-resolving it here bought a duplicate
     * SELECT and a second, unchecked handle on the row.
     */
    @Transactional
    public PairDto buyExtraLife(Tournaments t, Long pairId) {
        if (t == null) {
            throw new NoSuchElementException(messages.t("tournament.notFound"));
        }

        Pairs p = pairsRepo.findByIdOptional(pairId)
                .filter(x -> Objects.equals(x.getTournament().getId(), t.getId()))
                .orElseThrow(() -> new NoSuchElementException(messages.t("pair.notFound")));

        if (Boolean.TRUE.equals(p.isExtraLife())) {
            throw new IllegalStateException(messages.t("repassage.alreadyPurchased"));
        }
        if (p.getLosses() != 1) {
            throw new IllegalStateException(messages.t("repassage.onlyAfterFirstLoss"));
        }

        // Determine the round in which the pair last lost
        Integer lossRound = matchesRepo.findLastLossRoundNumber(t, p);
        if (lossRound == null) {
            throw new IllegalStateException(messages.t("repassage.lossRoundUnknown"));
        }

        // If any round with number > lossRound exists, next round has started → block purchase
        int maxRound = roundsRepo.findTopByTournamentOrderByNumberDesc(t)
                .map(Rounds::getNumber).orElse(0);
        if (maxRound > lossRound) {
            throw new IllegalStateException(messages.t("repassage.nextRoundStarted"));
        }

        // Persist purchase record with the loss round number
        RepassagePurchase rp = new RepassagePurchase();
        rp.setTournament(t);
        rp.setPair(p);
        rp.setRoundNumber(lossRound);
        rp.setPaidAt(OffsetDateTime.now());
        repassageRepo.save(rp);

        // Flip flags on the pair
        p.setExtraLife(true);
        p.setEliminated(false);
        pairsRepo.save(p);

        broadcast(t, hr.mrodek.apps.bela_turniri.realtime.LiveBroadcaster.SCOPE_PAIRS);

        // Enrich with submitter display info so the frontend can render the
        // "Prijavio: …" link without an extra round-trip.
        var profilesByUid = p.getSubmittedByUid() == null
                ? java.util.Map.<String, hr.mrodek.apps.bela_turniri.model.UserProfile>of()
                : userProfileRepo.findByUids(java.util.Set.of(p.getSubmittedByUid()));
        return pairMapper.toDtoEnriched(p, profilesByUid);
    }
}
