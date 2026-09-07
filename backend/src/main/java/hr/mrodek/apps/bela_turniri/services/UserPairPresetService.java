package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.UserPairPresetDto;
import hr.mrodek.apps.bela_turniri.errors.ApiCodes;
import hr.mrodek.apps.bela_turniri.model.UserPairPreset;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import hr.mrodek.apps.bela_turniri.repository.UserPairPresetRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Per-user pair-name preset lifecycle — listing, edit, visibility and the
 * co-owned archive-request flow — behind
 * {@link hr.mrodek.apps.bela_turniri.controller.UserPairPresetController},
 * which stays {@code @Transactional} and delegates here.
 *
 * <p>No {@code @Transactional} here on purpose, matching
 * {@link TournamentPairService}: the controller methods that call in are
 * already transactional and pass a request already scoped to the caller's
 * {@link CurrentUser}.
 */
@ApplicationScoped
public class UserPairPresetService {

    @Inject UserPairPresetRepository repo;
    @Inject UserProfileRepository profileRepo;
    @Inject PushService pushService;
    @Inject CurrentUser currentUser;
    @Inject MessageService messages;

    /** Every active preset (primary or co-owner) the caller can see. */
    public List<UserPairPresetDto> list() {
        String me = currentUser.requireUid();
        var presets = repo.findActiveForViewer(me);
        return toDtoList(presets, me);
    }

    public UserPairPresetDto create(UserPairPresetDto body) {
        String me = currentUser.requireUid();
        UserPairPreset p = new UserPairPreset();
        p.setUserUid(me);
        p.setName(body.name().trim());
        p.setHidden(Boolean.TRUE.equals(body.hidden()));
        p.setClaimToken(ClaimTokens.generate());
        repo.save(p);
        return toDto(p, me);
    }

    /** Either owner can rename. */
    public UserPairPresetDto update(UUID uuid, UserPairPresetDto body) {
        String me = currentUser.requireUid();
        var p = repo.findByUuidForOwnerOrCoOwner(uuid, me).orElseThrow(ApiCodes::notFound);
        p.setName(body.name().trim());
        if (body.hidden() != null) p.setHidden(body.hidden());
        return toDto(p, me);
    }

    public UserPairPresetDto setVisibility(UUID uuid, boolean hidden) {
        String me = currentUser.requireUid();
        var p = repo.findByUuidForOwnerOrCoOwner(uuid, me).orElseThrow(ApiCodes::notFound);
        p.setHidden(hidden);
        return toDto(p, me);
    }

    /**
     * Only the primary can hit this — co-owner gets 404. Once co-owned,
     * deletion must go through the archive-request flow.
     */
    public void delete(UUID uuid) {
        String me = currentUser.requireUid();
        var p = repo.findByUuidAndUserUid(uuid, me).orElseThrow(ApiCodes::notFound);
        if (p.getCoOwnerUid() != null && !p.getCoOwnerUid().isBlank()) {
            throw ApiCodes.conflict("CO_OWNED_USE_ARCHIVE_FLOW");
        }
        repo.delete(p);
    }

    /* ===================== Archive-request lifecycle ===================== */

    /**
     * File a request to archive. Either owner can call this. The partner
     * gets a push notification and sees the request in their UI.
     */
    public UserPairPresetDto requestArchive(UUID uuid) {
        String me = currentUser.requireUid();
        var p = repo.findByUuidForOwnerOrCoOwner(uuid, me).orElseThrow(ApiCodes::notFound);
        if (p.getCoOwnerUid() == null || p.getCoOwnerUid().isBlank()) {
            // Not co-owned — nothing to archive. UI should never hit this,
            // but return 409 with a code instead of crashing.
            throw ApiCodes.conflict("NOT_CO_OWNED");
        }
        if (p.getArchiveRequestByUid() != null) {
            // Already pending — idempotent.
            return toDto(p, me);
        }
        p.setArchiveRequestByUid(me);
        repo.persist(p);

        // Push the partner.
        String partnerUid = me.equals(p.getUserUid()) ? p.getCoOwnerUid() : p.getUserUid();
        var myProfile = profileRepo.findByUid(me).orElse(null);
        String displayName = myProfile != null ? myProfile.getDisplayName() : null;
        String pairName = p.getName();
        // The partner reads this, not the caller — resolve the copy (including
        // the "Suvlasnik" name fallback) in the PARTNER's stored language.
        pushService.sendToUser(partnerUid, locale -> new PushService.PushPayload(
                messages.t(locale, "push.pairArchiveRequest.title"),
                messages.t(locale, "push.pairArchiveRequest.body",
                        nameOr(displayName, locale), pairName),
                "/profil"
        ));
        return toDto(p, me);
    }

    /**
     * Confirm the request — sets archived=true and pushes the requester
     * that their request was accepted. Caller must be the OTHER owner (the
     * one who didn't file the request).
     */
    public void confirmArchive(UUID uuid) {
        String me = currentUser.requireUid();
        var p = repo.findByUuidForOwnerOrCoOwner(uuid, me).orElseThrow(ApiCodes::notFound);
        if (p.getArchiveRequestByUid() == null) {
            throw ApiCodes.conflict("NO_REQUEST_PENDING");
        }
        if (Objects.equals(p.getArchiveRequestByUid(), me)) {
            // The requester is trying to confirm their own request — wrong side.
            throw ApiCodes.conflict("OWN_REQUEST_CANNOT_CONFIRM");
        }

        String requesterUid = p.getArchiveRequestByUid();
        p.setArchived(true);
        p.setArchivedAt(OffsetDateTime.now());
        p.setArchiveRequestByUid(null);
        repo.persist(p);

        var myProfile = profileRepo.findByUid(me).orElse(null);
        String displayName = myProfile != null ? myProfile.getDisplayName() : null;
        String pairName = p.getName();
        pushService.sendToUser(requesterUid, locale -> new PushService.PushPayload(
                messages.t(locale, "push.pairArchived.title"),
                messages.t(locale, "push.pairArchived.body",
                        nameOr(displayName, locale), pairName),
                "/profil"
        ));
    }

    /**
     * Cancel a pending request. Either side can hit this: the requester
     * cancels their own request (changed their mind), or the partner
     * rejects it (doesn't want to archive).
     *
     * @return {@code null} when a pending request was actually cleared (the
     *         controller answers 204 for that); the current DTO when there
     *         was nothing to cancel (the controller answers 200 with it) —
     *         same two-shape contract as before this refactor.
     */
    public UserPairPresetDto cancelArchive(UUID uuid) {
        String me = currentUser.requireUid();
        var p = repo.findByUuidForOwnerOrCoOwner(uuid, me).orElseThrow(ApiCodes::notFound);
        if (p.getArchiveRequestByUid() == null) {
            return toDto(p, me); // nothing to cancel
        }

        String requesterUid = p.getArchiveRequestByUid();
        boolean rejection = !requesterUid.equals(me);
        p.setArchiveRequestByUid(null);
        repo.persist(p);

        // If the partner is rejecting, push the original requester so they
        // know their request was declined.
        if (rejection) {
            var myProfile = profileRepo.findByUid(me).orElse(null);
            String displayName = myProfile != null ? myProfile.getDisplayName() : null;
            String pairName = p.getName();
            pushService.sendToUser(requesterUid, locale -> new PushService.PushPayload(
                    messages.t(locale, "push.pairArchiveRejected.title"),
                    messages.t(locale, "push.pairArchiveRejected.body",
                            nameOr(displayName, locale), pairName),
                    "/profil"
            ));
        }
        return null;
    }

    /* ===================== DTO mapping ===================== */

    /**
     * "Partner" = the OTHER user from this viewer's perspective (whichever
     * side they are).
     */
    private static String partnerUidFor(UserPairPreset p, String me) {
        boolean iAmPrimary = me != null && me.equals(p.getUserUid());
        return iAmPrimary ? p.getCoOwnerUid() : p.getUserUid();
    }

    /** Bulk DTO mapping for {@link #list()} — one profile query, not one per row. */
    private List<UserPairPresetDto> toDtoList(List<UserPairPreset> presets, String me) {
        Set<String> partnerUids = new HashSet<>();
        for (var p : presets) {
            String partnerUid = partnerUidFor(p, me);
            if (partnerUid != null && !partnerUid.isBlank()) partnerUids.add(partnerUid);
        }
        Map<String, UserProfile> profiles = profileRepo.findByUids(partnerUids);
        return presets.stream().map(p -> toDto(p, me, profiles)).toList();
    }

    /** Single-row DTO mapping for create/update/etc. */
    private UserPairPresetDto toDto(UserPairPreset p, String me) {
        String partnerUid = partnerUidFor(p, me);
        Map<String, UserProfile> profiles = (partnerUid == null || partnerUid.isBlank())
                ? Map.of()
                : profileRepo.findByUids(List.of(partnerUid));
        return toDto(p, me, profiles);
    }

    private UserPairPresetDto toDto(UserPairPreset p, String me, Map<String, UserProfile> partnerProfilesByUid) {
        boolean iAmPrimary = me != null && me.equals(p.getUserUid());
        String partnerUid = partnerUidFor(p, me);
        UserProfile partner = (partnerUid == null) ? null : partnerProfilesByUid.get(partnerUid);

        // Token only goes to the primary when no one's claimed yet — that's
        // the only state where sharing is meaningful.
        boolean unclaimed = p.getCoOwnerUid() == null || p.getCoOwnerUid().isBlank();
        String token = (iAmPrimary && unclaimed) ? p.getClaimToken() : null;

        boolean archReqByMe = p.getArchiveRequestByUid() != null
                && p.getArchiveRequestByUid().equals(me);
        boolean archReqByPartner = p.getArchiveRequestByUid() != null
                && !p.getArchiveRequestByUid().equals(me);

        return new UserPairPresetDto(
                p.getUuid(),
                p.getName(),
                p.isHidden(),
                iAmPrimary ? "PRIMARY" : "CO_OWNER",
                partner == null ? null : partner.getSlug(),
                partner == null ? null : partner.getDisplayName(),
                token,
                archReqByMe,
                archReqByPartner
        );
    }

    /**
     * A co-owner's display name, or the localised "Suvlasnik" fallback when
     * they never set one. Localised in the RECIPIENT's language because the
     * fallback is rendered inside their notification.
     */
    private String nameOr(String displayName, java.util.Locale locale) {
        return displayName != null ? displayName : messages.t(locale, "push.coOwner.fallback");
    }
}
