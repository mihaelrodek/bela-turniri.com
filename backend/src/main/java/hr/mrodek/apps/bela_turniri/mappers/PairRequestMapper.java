package hr.mrodek.apps.bela_turniri.mappers;

import hr.mrodek.apps.bela_turniri.dtos.PairRequestDto;
import hr.mrodek.apps.bela_turniri.model.PairRequest;
import org.mapstruct.*;

import java.util.List;

@Mapper(componentModel = "cdi", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface PairRequestMapper {

    @Mappings({
            @Mapping(target = "uuid", source = "uuid"),
            @Mapping(target = "tournamentUuid", source = "tournament.uuid"),
            @Mapping(target = "tournamentSlug", source = "tournament.slug"),
            @Mapping(target = "tournamentName", source = "tournament.name"),
            @Mapping(target = "tournamentLocation", source = "tournament.location"),
            @Mapping(target = "tournamentStartAt", source = "tournament.startAt"),
            @Mapping(target = "playerName", source = "playerName"),
            @Mapping(target = "phone", source = "phone"),
            @Mapping(target = "note", source = "note"),
            @Mapping(target = "status", expression = "java(r.getStatus() == null ? null : r.getStatus().name())"),
            @Mapping(target = "createdAt", source = "createdAt"),
            @Mapping(target = "createdByUid", source = "createdByUid"),
    })
    PairRequestDto toDto(PairRequest r);

    List<PairRequestDto> toDtoList(List<PairRequest> list);
}
