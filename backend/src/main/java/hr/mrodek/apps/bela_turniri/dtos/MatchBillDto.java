package hr.mrodek.apps.bela_turniri.dtos;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Full bill view for one match.
 *
 * {@code loserPairId}/{@code loserPairName} are populated only when the
 * match is finished and not a BYE — that's the pair Belot tradition
 * has paying the table. Before the match finishes both are null and the
 * UI just shows the running total without attribution.
 */
public record MatchBillDto(
        Long matchId,
        List<MatchDrinkDto> drinks,
        BigDecimal total,
        OffsetDateTime paidAt,
        String paidByUid,
        Long loserPairId,
        String loserPairName
) {}
