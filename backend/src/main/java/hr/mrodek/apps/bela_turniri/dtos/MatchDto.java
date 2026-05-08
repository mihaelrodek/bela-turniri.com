package hr.mrodek.apps.bela_turniri.dtos;

public record MatchDto(
        Long id,
        Integer tableNo,
        Long pair1Id,
        String pair1Name,
        Long pair2Id,
        String pair2Name,
        Integer score1,
        Integer score2,
        Long winnerPairId,
        String status
) {}