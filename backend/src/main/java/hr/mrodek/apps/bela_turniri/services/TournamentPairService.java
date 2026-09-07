package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.PairDto;
import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.errors.ApiCodes;
import hr.mrodek.apps.bela_turniri.mappers.PairMapper;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import hr.mrodek.apps.bela_turniri.repository.PairsRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.NotFoundException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Pair roster of a tournament: listing, bulk replace, approval, payment
 * flag and deletion — everything the organiser does on the "Parovi" tab.
 *
 * <p>Lifted verbatim out of {@code TournamentController}, which had grown
 * to ~980 lines around this logic. The controller now resolves the
 * tournament, asserts access via {@link TournamentAccess}, and delegates.
 *
 * <p>No {@code @Transactional} here on purpose: the JAX-RS resource methods
 * that call in are already transactional, and they pass in a
 * <em>managed</em> {@link Tournaments} loaded inside that same transaction.
 * Opening a second transaction down here would give this service a detached
 * copy whose mutations are silently discarded on commit — the exact bug
 * {@code MatchBillController}'s class javadoc documents.
 */
@ApplicationScoped
public class TournamentPairService {

    @Inject PairsRepository pairRepo;
    @Inject UserProfileRepository userProfileRepo;
    @Inject PairMapper pairMapper;
    @Inject PushService pushService;
    @Inject TournamentAccess access;
    @Inject CurrentUser currentUser;
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

    /* ===================== Read ===================== */

    /**
     * The tournament's pairs as the current viewer is allowed to see them.
     * Claim tokens are emitted only to the primary submitter of each row
     * (so they can copy their own share link) and to the organiser/admin —
     * the share link is the primary's to hand out, not something the whole
     * tournament should be able to read off the API.
     */
    public List<PairDto> listForViewer(Tournaments t) {
        return toDtoListForViewer(t, pairRepo.findByTournament_Id(t.getId()));
    }

    private List<PairDto> toDtoListForViewer(Tournaments t, List<Pairs> pairs) {
        return pairMapper.toDtoListEnrichedForViewer(
                pairs,
                fetchSubmitterProfiles(pairs),
                currentUser.uidOrNull(),
                access.canManage(t));
    }

    /** Enriched single-pair DTO, for the endpoints that return one row. */
    public PairDto toDto(Pairs p) {
        return pairMapper.toDtoEnriched(p, fetchSubmitterProfiles(List.of(p)));
    }

    /**
     * Bulk-load {@link UserProfile} rows for every distinct submitter UID
     * across the given pairs — primary submitters AND share-link co-owners.
     * One map serves both enrichment lookups in {@code PairMapper}, which
     * is what keeps a 40-pair listing at a single profile query.
     */
    public Map<String, UserProfile> fetchSubmitterProfiles(List<Pairs> pairs) {
        Set<String> uids = new HashSet<>();
        for (var p : pairs) {
            if (p.getSubmittedByUid() != null) uids.add(p.getSubmittedByUid());
            if (p.getCoSubmittedByUid() != null) uids.add(p.getCoSubmittedByUid());
        }
        return userProfileRepo.findByUids(uids);
    }

    /* ===================== Bulk replace ===================== */

    /**
     * Diff the submitted roster against what is stored: rows absent from
     * the payload are deleted, rows carrying a known id are updated in
     * place (so match history keeps pointing at the same pair), and the
     * rest are inserted.
     */
    public List<PairDto> replacePairs(Tournaments tournament, List<PairDto> payload) {
        if (payload == null) {
            throw new jakarta.ws.rs.BadRequestException(messages.t("error.bodyRequired"));
        }
        if (payload.stream().anyMatch(p -> p.name() == null || p.name().trim().isEmpty())) {
            throw new jakarta.ws.rs.BadRequestException(messages.t("pair.nameRequired"));
        }

        // Managed rows for this tx
        var existing = pairRepo.findByTournament_Id(tournament.getId());
        Map<Long, Pairs> byId = existing.stream()
                .filter(p -> p.getId() != null)
                .collect(Collectors.toMap(Pairs::getId, p -> p));

        Set<Long> payloadIds = payload.stream()
                .map(PairDto::id)
                .filter(Objects::nonNull)
                .map(Integer::longValue)
                .collect(Collectors.toSet());

        // 1) delete removed rows first
        for (var e : existing) {
            if (e.getId() != null && !payloadIds.contains(e.getId())) {
                pairRepo.delete(e);
            }
        }

        // 2) update managed rows, collect new rows to insert
        List<Pairs> toInsert = new ArrayList<>();
        for (var in : payload) {
            Long pid = (in.id() == null) ? null : in.id().longValue();

            if (pid != null && byId.containsKey(pid)) {
                var entity = byId.get(pid);
                pairMapper.updateEntity(entity, in);
                clampCounters(entity);
            } else {
                var entity = new Pairs();
                entity.setTournament(tournament);
                pairMapper.updateEntity(entity, in);
                clampCounters(entity);
                toInsert.add(entity);
            }
        }

        if (!toInsert.isEmpty()) {
            pairRepo.saveAll(toInsert);
        }

        broadcast(tournament, hr.mrodek.apps.bela_turniri.realtime.LiveBroadcaster.SCOPE_PAIRS);

        return toDtoListForViewer(tournament, pairRepo.findByTournament_Id(tournament.getId()));
    }

    /** A hand-edited roster must never carry negative win/loss counters. */
    private static void clampCounters(Pairs entity) {
        if (entity.getWins() < 0) entity.setWins(0);
        if (entity.getLosses() < 0) entity.setLosses(0);
    }

    /* ===================== Single-pair operations ===================== */

    /**
     * Approve a pending self-registration and notify the player(s).
     *
     * <p>The push only fires when the row was actually pending —
     * re-approving an already-approved pair would send a confusing
     * duplicate. Both the primary submitter and the share-link co-owner
     * are notified, because both see the pair as theirs.
     */
    public PairDto approve(Tournaments t, Long pairId) {
        Pairs pair = requirePairOfTournament(t, pairId);

        boolean wasPending = pair.isPendingApproval();
        pair.setPendingApproval(false);

        if (wasPending) {
            String url = "/turniri/" + tournamentRef(t);
            String pairName = pair.getName();
            String tournamentName = t.getName();
            // Composed for the RECIPIENT, not for the organiser who clicked
            // "approve": each owner is notified in their own stored language.
            for (String uid : ownerUids(pair)) {
                pushService.sendToUser(uid, locale -> new PushService.PushPayload(
                        messages.t(locale, "push.pairApproved.title"),
                        messages.t(locale, "push.pairApproved.body", pairName, tournamentName),
                        url));
            }
        }

        broadcast(t, hr.mrodek.apps.bela_turniri.realtime.LiveBroadcaster.SCOPE_PAIRS);

        return toDto(pair);
    }

    /** Flip the "platio" flag. {@code @UpdateTimestamp} on Pairs handles the touch. */
    public void setPaid(Tournaments t, Long pairId, boolean paid) {
        requirePairOfTournament(t, pairId).setPaid(paid);
        broadcast(t, hr.mrodek.apps.bela_turniri.realtime.LiveBroadcaster.SCOPE_PAIRS);
    }

    /**
     * Delete a single pair. Refused once the tournament has started:
     * matches reference {@code pair_id}, so removing a pair mid-run would
     * orphan historical results.
     */
    public void deletePair(Tournaments t, Long pairId) {
        if (t.getStatus() == TournamentStatus.STARTED || t.getStatus() == TournamentStatus.FINISHED) {
            throw ApiCodes.conflict("TOURNAMENT_ALREADY_STARTED");
        }
        pairRepo.delete(requirePairOfTournament(t, pairId));
        broadcast(t, hr.mrodek.apps.bela_turniri.realtime.LiveBroadcaster.SCOPE_PAIRS);
    }

    /* ===================== Shared helpers ===================== */

    /**
     * Load a pair and insist it belongs to {@code t}.
     *
     * <p>A pair id from another tournament answers 404, not 403: the caller
     * is already authorised on {@code t}, so the only thing wrong with the
     * request is that {@code /tournaments/{t}/pairs/{id}} names a resource
     * that does not exist. The old 403 also leaked that the id was real
     * somewhere else.
     */
    private Pairs requirePairOfTournament(Tournaments t, Long pairId) {
        Pairs pair = pairRepo.findByIdOptional(pairId)
                .orElseThrow(() -> new NotFoundException(messages.t("pair.notFound")));
        if (pair.getTournament() == null
                || !Objects.equals(pair.getTournament().getId(), t.getId())) {
            throw new NotFoundException(messages.t("pair.notFound"));
        }
        return pair;
    }

    /** Slug when there is one, UUID otherwise — the SPA route accepts either. */
    static String tournamentRef(Tournaments t) {
        if (t.getSlug() != null && !t.getSlug().isBlank()) return t.getSlug();
        return t.getUuid() != null ? t.getUuid().toString() : "";
    }

    /** Non-blank UIDs of everyone who counts as an owner of the pair. */
    private static List<String> ownerUids(Pairs pair) {
        List<String> uids = new ArrayList<>(2);
        if (pair.getSubmittedByUid() != null && !pair.getSubmittedByUid().isBlank()) {
            uids.add(pair.getSubmittedByUid());
        }
        if (pair.getCoSubmittedByUid() != null && !pair.getCoSubmittedByUid().isBlank()) {
            uids.add(pair.getCoSubmittedByUid());
        }
        return uids;
    }
}
