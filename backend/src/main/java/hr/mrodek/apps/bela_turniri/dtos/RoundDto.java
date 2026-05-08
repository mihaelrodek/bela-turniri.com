package hr.mrodek.apps.bela_turniri.dtos;

import java.util.List;

public record RoundDto(
        Long id,
        Integer number,
        String status,
        List<MatchDto> matches
) {}