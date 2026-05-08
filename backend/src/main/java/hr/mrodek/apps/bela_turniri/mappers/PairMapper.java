package hr.mrodek.apps.bela_turniri.mappers;

import hr.mrodek.apps.bela_turniri.dtos.PairDto;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import org.mapstruct.*;

import java.util.List;
import java.util.Map;

@Mapper(componentModel = "cdi", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface PairMapper {

    /* Entity -> DTO */
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
    })
    PairDto toDto(Pairs entity);

    List<PairDto> toDtoList(List<Pairs> entities);

    /* DTO (partial) -> existing Entity (update) */
    @Mappings({
            // id & tournament are managed by the controller/repo; do not touch
            @Mapping(target = "name",          source = "name"),
            @Mapping(target = "eliminated",    source = "isEliminated"),
            @Mapping(target = "extraLife",     source = "extraLife"),
            @Mapping(target = "wins",          source = "wins"),
            @Mapping(target = "losses",        source = "losses")
    })
    void updateEntity(@MappingTarget Pairs entity, PairDto dto);

    /**
     * Enrich an entity into a DTO that also carries submitter display name +
     * slug for clickable "Prijavio: …" links. Pass a pre-fetched profile map
     * (UID → UserProfile) to avoid N+1 queries.
     */
    default PairDto toDtoEnriched(Pairs e, Map<String, UserProfile> profilesByUid) {
        UserProfile prof = e.getSubmittedByUid() != null && profilesByUid != null
                ? profilesByUid.get(e.getSubmittedByUid())
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
                prof == null ? null : prof.getDisplayName()
        );
    }

    default List<PairDto> toDtoListEnriched(List<Pairs> entities, Map<String, UserProfile> profilesByUid) {
        return entities.stream().map(e -> toDtoEnriched(e, profilesByUid)).toList();
    }
}