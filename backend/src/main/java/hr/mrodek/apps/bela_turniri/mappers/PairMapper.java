package hr.mrodek.apps.bela_turniri.mappers;

import hr.mrodek.apps.bela_turniri.dtos.PairDto;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import org.mapstruct.*;

import java.util.List;
import java.util.Map;

@Mapper(componentModel = "cdi", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface PairMapper {

    /* Entity -> DTO (basic, no enrichment) */
    @Mappings({
            @Mapping(target = "id",               source = "id"),
            @Mapping(target = "name",             source = "name"),
            @Mapping(target = "isEliminated",     source = "eliminated"),
            @Mapping(target = "extraLife",        source = "extraLife"),
            @Mapping(target = "wins",             source = "wins"),
            @Mapping(target = "losses",           source = "losses"),
            @Mapping(target = "paid",             source = "paid"),
            @Mapping(target = "submittedByUid",   source = "submittedByUid"),
            @Mapping(target = "pendingApproval",  source = "pendingApproval"),
            @Mapping(target = "coSubmittedByUid", source = "coSubmittedByUid"),
            @Mapping(target = "claimToken",       source = "claimToken"),
    })
    PairDto toDto(Pairs entity);

    List<PairDto> toDtoList(List<Pairs> entities);

    /* DTO (partial) -> existing Entity (update)
     *
     * IMPORTANT: MapStruct auto-maps every matching-name field by default,
     * even those not listed in @Mappings. That means submittedByUid /
     * pendingApproval / submittedBySlug / submittedByName / coSubmittedByUid
     * / claimToken would silently get overwritten with whatever the client
     * sent (typically null, since the editor UI doesn't surface those
     * fields). The result is that saving the pairs list strips the
     * "Prijavio: …" display info and shareable claim token from
     * self-registered pairs.
     *
     * Lock those down explicitly. The controller is responsible for
     * setting submittedByUid / pendingApproval / claimToken / coSubmittedByUid
     * at the right moments (self-register, approve, claim).
     */
    @Mappings({
            // id & tournament are managed by the controller/repo; do not touch
            @Mapping(target = "name",                source = "name"),
            @Mapping(target = "eliminated",          source = "isEliminated"),
            @Mapping(target = "extraLife",           source = "extraLife"),
            @Mapping(target = "wins",                source = "wins"),
            @Mapping(target = "losses",              source = "losses"),
            @Mapping(target = "paid",                source = "paid"),
            @Mapping(target = "submittedByUid",      ignore = true),
            @Mapping(target = "pendingApproval",     ignore = true),
            @Mapping(target = "claimToken",          ignore = true),
            @Mapping(target = "coSubmittedByUid",    ignore = true),
            @Mapping(target = "createdAt",           ignore = true),
            @Mapping(target = "updatedAt",           ignore = true)
    })
    void updateEntity(@MappingTarget Pairs entity, PairDto dto);

    /**
     * Enrich an entity into a DTO that also carries submitter + co-owner
     * display name + slug for clickable "Prijavio: …" / co-owner links.
     * Pass a pre-fetched profile map (UID → UserProfile) to avoid N+1
     * queries — see TournamentController#fetchSubmitterProfiles which
     * already collects both submittedByUid and coSubmittedByUid.
     *
     * Pass {@code includeClaimToken=true} only when the caller has
     * verified the viewer is allowed to see / share the token
     * (primary submitter or organizer/admin). Otherwise null is returned
     * so the share link doesn't leak in pair lists rendered to other
     * tournament participants.
     */
    default PairDto toDtoEnriched(Pairs e, Map<String, UserProfile> profilesByUid,
                                   boolean includeClaimToken) {
        UserProfile prof = e.getSubmittedByUid() != null && profilesByUid != null
                ? profilesByUid.get(e.getSubmittedByUid())
                : null;
        UserProfile co = e.getCoSubmittedByUid() != null && profilesByUid != null
                ? profilesByUid.get(e.getCoSubmittedByUid())
                : null;
        return new PairDto(
                e.getId() == null ? null : e.getId().intValue(),
                e.getName(),
                e.isEliminated(),
                e.isExtraLife(),
                e.getWins(),
                e.getLosses(),
                e.isPaid(),
                e.getSubmittedByUid(),
                e.isPendingApproval(),
                prof == null ? null : prof.getSlug(),
                prof == null ? null : prof.getDisplayName(),
                e.getCoSubmittedByUid(),
                co == null ? null : co.getSlug(),
                co == null ? null : co.getDisplayName(),
                includeClaimToken ? e.getClaimToken() : null
        );
    }

    /** Backwards-compat overload — never includes the claim token. */
    default PairDto toDtoEnriched(Pairs e, Map<String, UserProfile> profilesByUid) {
        return toDtoEnriched(e, profilesByUid, false);
    }

    default List<PairDto> toDtoListEnriched(List<Pairs> entities, Map<String, UserProfile> profilesByUid) {
        return entities.stream().map(e -> toDtoEnriched(e, profilesByUid, false)).toList();
    }

    /**
     * List variant that emits the claim token for pairs where the viewer
     * is the primary submitter (so they can copy the share link). Pass
     * the viewer's UID; tokens for pairs they don't own are null.
     */
    default List<PairDto> toDtoListEnrichedForViewer(
            List<Pairs> entities,
            Map<String, UserProfile> profilesByUid,
            String viewerUid,
            boolean viewerIsOrganizerOrAdmin
    ) {
        return entities.stream().map(e -> {
            boolean canSeeToken = viewerIsOrganizerOrAdmin
                    || (viewerUid != null && viewerUid.equals(e.getSubmittedByUid()));
            return toDtoEnriched(e, profilesByUid, canSeeToken);
        }).toList();
    }
}
