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
import java.util.UUID;

@ApplicationScoped
public class RepassageService {

    @Inject TournamentsRepository tournamentsRepo;
    @Inject PairsRepository pairsRepo;
    @Inject RoundsRepository roundsRepo;
    @Inject MatchesRepository matchesRepo;
    @Inject RepassagePurchaseRepository repassageRepo;
    @Inject UserProfileRepository userProfileRepo;
    @Inject PairMapper pairMapper;

    @Transactional
    public PairDto buyExtraLife(String uuid, Long pairId) {
        // Caller may pass a UUID or a slug — both resolve via the same helper.
        Tournaments t = tournamentsRepo.findByUuidOrSlug(uuid)
                .orElseThrow(() -> new NoSuchElementException("Tournament not found"));

        Pairs p = pairsRepo.findByIdOptional(pairId)
                .filter(x -> Objects.equals(x.getTournament().getId(), t.getId()))
                .orElseThrow(() -> new NoSuchElementException("Pair not found"));

        if (Boolean.TRUE.equals(p.isExtraLife())) {
            throw new IllegalStateException("Extra life already purchased.");
        }
        if (p.getLosses() != 1) {
            throw new IllegalStateException("Extra life allowed only after first loss.");
        }

        // Determine the round in which the pair last lost
        Integer lossRound = matchesRepo.findLastLossRoundNumber(t, p);
        if (lossRound == null) {
            throw new IllegalStateException("Cannot determine loss round for pair.");
        }

        // If any round with number > lossRound exists, next round has started → block purchase
        int maxRound = roundsRepo.findTopByTournamentOrderByNumberDesc(t)
                .map(Rounds::getNumber).orElse(0);
        if (maxRound > lossRound) {
            throw new IllegalStateException("Next round already started; cannot buy extra life.");
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

        // Enrich with submitter display info so the frontend can render the
        // "Prijavio: …" link without an extra round-trip.
        var profilesByUid = p.getSubmittedByUid() == null
                ? java.util.Map.<String, hr.mrodek.apps.bela_turniri.model.UserProfile>of()
                : userProfileRepo.findByUids(java.util.Set.of(p.getSubmittedByUid()));
        return pairMapper.toDtoEnriched(p, profilesByUid);
    }
}
