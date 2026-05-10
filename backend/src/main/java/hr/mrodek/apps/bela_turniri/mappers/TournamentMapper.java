package hr.mrodek.apps.bela_turniri.mappers;

import hr.mrodek.apps.bela_turniri.dtos.CreateTournamentRequest;
import hr.mrodek.apps.bela_turniri.dtos.TournamentCardDto;
import hr.mrodek.apps.bela_turniri.dtos.TournamentDetailsResponse;
import hr.mrodek.apps.bela_turniri.enums.RepassageUntil;
import hr.mrodek.apps.bela_turniri.enums.RewardType;
import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import org.mapstruct.*;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Mapper(componentModel = "cdi", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface TournamentMapper {

    @Mappings({
            @Mapping(target = "id", source = "id"),
            @Mapping(target = "uuid", source = "uuid"),
            @Mapping(target = "slug", source = "slug"),
            @Mapping(target = "location", source = "location"),
            @Mapping(target = "latitude", source = "latitude"),
            @Mapping(target = "longitude", source = "longitude"),
            @Mapping(target = "startAt", source = "startAt"),
            @Mapping(target = "maxPairs", source = "maxPairs"),
            @Mapping(target = "entryPrice", source = "entryPrice"),
            @Mapping(target = "repassagePrice", source = "repassagePrice"),
            @Mapping(target = "winnerName", source = "winnerName"),
            @Mapping(target = "bannerUrl", expression = "java(publicUrl(t))"),
            @Mapping(target = "registeredPairs",
                    expression = "java(pairCountsByTournamentId.getOrDefault(t.getId(), 0L).intValue())"),
    })
    TournamentCardDto toCard(Tournaments t,  @Context Map<Long, Long> pairCountsByTournamentId);

    List<TournamentCardDto> toCardList(List<Tournaments> list, @Context Map<Long, Long> pairCountsByTournamentId);

    /* ========== Entity -> Full Details DTO ========== */
    @Mappings({
            @Mapping(target = "id", source = "id"),
            @Mapping(target = "uuid", source = "uuid"),
            @Mapping(target = "slug", source = "slug"),
            @Mapping(target = "entryPrice", source = "entryPrice"),
            @Mapping(target = "maxPairs", source = "maxPairs"),
            @Mapping(target = "status", source = "status", qualifiedByName = "enumToName"), // <-- NEW
            @Mapping(target = "repassagePrice", source = "repassagePrice"),
            @Mapping(target = "repassageSecondPrice", source = "repassageSecondPrice"),
            @Mapping(target = "repassageUntil", source = "repassageUntil", qualifiedByName = "enumToName"),
            @Mapping(target = "contactName", source = "contactName"),
            @Mapping(target = "contactPhone", source = "contactPhone"),
            @Mapping(target = "rewardType", source = "rewardType", qualifiedByName = "enumToName"),
            @Mapping(target = "rewardFirst", source = "rewardFirst"),
            @Mapping(target = "rewardSecond", source = "rewardSecond"),
            @Mapping(target = "rewardThird", source = "rewardThird"),
            @Mapping(target = "additionalOptions", expression = "java(java.util.Collections.emptyList())"),
            @Mapping(target = "pairs", expression = "java(java.util.Collections.emptyList())"),
            @Mapping(target = "winnerName", source = "winnerName"),
            @Mapping(target = "bannerUrl", expression = "java(publicUrl(t))"),
            @Mapping(target = "createdByUid", source = "createdByUid"),
            @Mapping(target = "createdByName", source = "createdByName"),
    })
    TournamentDetailsResponse toDetails(Tournaments t);

    /* ========== Create DTO -> Entity ========== */
    @Mappings({
            @Mapping(target = "id", ignore = true),
            @Mapping(target = "uuid", ignore = true),
            @Mapping(target = "slug", ignore = true),
            @Mapping(target = "createdAt", ignore = true),
            @Mapping(target = "updatedAt", ignore = true),

            @Mapping(target = "name", source = "name"),
            @Mapping(target = "location", source = "location"),
            @Mapping(target = "details", source = "details"),
            @Mapping(target = "startAt", source = "startAt"),

            @Mapping(target = "maxPairs", source = "maxPairs"),

            @Mapping(target = "entryPrice", source = "entryPrice"),
            @Mapping(target = "repassagePrice", source = "repassagePrice"),
            @Mapping(target = "repassageSecondPrice", source = "repassageSecondPrice"),
            @Mapping(target = "repassageUntil", source = "repassageUntil", qualifiedByName = "nameToRepassageUntil"),

            @Mapping(target = "contactName", source = "contactName"),
            @Mapping(target = "contactPhone", source = "contactPhone"),

            @Mapping(target = "rewardType", source = "rewardType", qualifiedByName = "nameToRewardType"),
            @Mapping(target = "rewardFirst", source = "rewardFirst"),
            @Mapping(target = "rewardSecond", source = "rewardSecond"),
            @Mapping(target = "rewardThird", source = "rewardThird"),

            // status may come from request later; default in @AfterMapping
            @Mapping(target = "status", ignore = true)
    })
    Tournaments toEntity(CreateTournamentRequest req);

    /* ========== Apply DTO updates onto an existing entity (in place) ==========
       Reuses CreateTournamentRequest as the wire shape — all fields are settable
       except the ones we deliberately ignore: id/uuid/audit timestamps/status
       (status is driven by /start, /finish, /reset endpoints) and the resource
       (poster) which has its own multipart upload flow. */
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.SET_TO_NULL)
    @Mappings({
            @Mapping(target = "id", ignore = true),
            @Mapping(target = "uuid", ignore = true),
            @Mapping(target = "slug", ignore = true),
            @Mapping(target = "createdAt", ignore = true),
            @Mapping(target = "updatedAt", ignore = true),
            @Mapping(target = "status", ignore = true),
            @Mapping(target = "winnerName", ignore = true),
            @Mapping(target = "preserveMatchmaking", ignore = true),
            @Mapping(target = "resource", ignore = true),

            @Mapping(target = "name", source = "name"),
            @Mapping(target = "location", source = "location"),
            @Mapping(target = "details", source = "details"),
            @Mapping(target = "startAt", source = "startAt"),

            @Mapping(target = "maxPairs", source = "maxPairs"),

            @Mapping(target = "entryPrice", source = "entryPrice"),
            @Mapping(target = "repassagePrice", source = "repassagePrice"),
            @Mapping(target = "repassageSecondPrice", source = "repassageSecondPrice"),
            @Mapping(target = "repassageUntil", source = "repassageUntil", qualifiedByName = "nameToRepassageUntil"),

            @Mapping(target = "contactName", source = "contactName"),
            @Mapping(target = "contactPhone", source = "contactPhone"),

            @Mapping(target = "rewardType", source = "rewardType", qualifiedByName = "nameToRewardType"),
            @Mapping(target = "rewardFirst", source = "rewardFirst"),
            @Mapping(target = "rewardSecond", source = "rewardSecond"),
            @Mapping(target = "rewardThird", source = "rewardThird"),
    })
    void applyUpdate(@MappingTarget Tournaments target, CreateTournamentRequest req);

    /* ===== helpers ===== */
    @Named("enumToName")
    default String enumToName(Enum<?> e) {
        return e == null ? null : e.name();
    }

    @Named("nameToRepassageUntil")
    default RepassageUntil nameToRepassageUntil(String s) {
        return (s == null || s.isBlank()) ? null : RepassageUntil.valueOf(s);
    }

    @Named("nameToRewardType")
    default RewardType nameToRewardType(String s) {
        return (s == null || s.isBlank()) ? null : RewardType.valueOf(s);
    }

    @AfterMapping
    default void applyDefaults(CreateTournamentRequest req, @MappingTarget Tournaments t) {
        if (t.getStatus() == null) t.setStatus(TournamentStatus.DRAFT);
        if (t.getMaxPairs() == null) t.setMaxPairs(16);

        if (t.getEntryPrice() == null) t.setEntryPrice(BigDecimal.ZERO);
        if (t.getRepassagePrice() == null) t.setRepassagePrice(BigDecimal.ZERO);
        // repassageSecondPrice intentionally may be null
    }

    /**
     * Stable poster URL for the SPA. Always returns a backend-proxied path
     * ({@code /api/resources/<id>/image}) — never the MinIO direct URL —
     * because the MinIO bucket is private. The proxy controller streams the
     * bytes through with proper Content-Type and a 1-year immutable cache.
     *
     * <p>The legacy {@code Resources.publicUrl} column may still hold MinIO
     * URLs from earlier uploads; we deliberately ignore it and compute the
     * proxied URL from the resource id instead, so old and new rows behave
     * identically without a backfill migration.
     */
    default String publicUrl(Tournaments t) {
        if (t == null || t.getResource() == null) return null;
        Long rid = t.getResource().getId();
        if (rid == null) return null;
        return "/api/resources/" + rid + "/image";
    }
}