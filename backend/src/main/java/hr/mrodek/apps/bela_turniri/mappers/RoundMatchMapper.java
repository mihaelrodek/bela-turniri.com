package hr.mrodek.apps.bela_turniri.mappers;

import hr.mrodek.apps.bela_turniri.dtos.MatchDto;
import hr.mrodek.apps.bela_turniri.dtos.RoundDto;
import hr.mrodek.apps.bela_turniri.model.Matches;
import hr.mrodek.apps.bela_turniri.model.Rounds;
import org.mapstruct.*;

import java.util.List;

@Mapper(componentModel = "cdi", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface RoundMatchMapper {

    @Mappings({
            @Mapping(target = "pair1Id", source = "pair1.id"),
            @Mapping(target = "pair1Name", source = "pair1.name"),
            @Mapping(target = "pair2Id", source = "pair2.id"),
            @Mapping(target = "pair2Name", source = "pair2.name"),
            @Mapping(target = "winnerPairId", source = "winnerPair.id"),
            @Mapping(target = "status", expression = "java(m.getStatus() == null ? null : m.getStatus().name())")
    })
    MatchDto toMatchDto(Matches m);

    List<MatchDto> toMatchDtoList(List<Matches> list);

    @Mappings({
            @Mapping(target = "status", expression = "java(r.getStatus() == null ? null : r.getStatus().name())"),
            @Mapping(target = "matches", ignore = true) // set manually when assembling the RoundDto
    })
    RoundDto toRoundDto(Rounds r);
}