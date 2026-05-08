package hr.mrodek.apps.bela_turniri.dtos;

import java.util.UUID;

public record PairShortDto(
        UUID id,
        String names,
        Boolean extraLife,
        Boolean extraLifeUsed,
        Boolean eliminated
) {}
