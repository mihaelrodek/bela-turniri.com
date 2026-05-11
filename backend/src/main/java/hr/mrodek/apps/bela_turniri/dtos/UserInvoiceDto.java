package hr.mrodek.apps.bela_turniri.dtos;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * One match-bill row in the user's personal invoice history.
 *
 * Surfaces enough context to identify the match without the user having
 * to remember it: tournament name + when, round number, table, opponent,
 * the total they owe (or owed), and whether it's been settled. The
 * {@code lost} flag tells the UI whether THIS user's pair was the loser
 * — Belot tradition says the loser pays, so it determines whether to
 * label the row as "Tvoj račun" vs. "Račun za stol".
 */
public record UserInvoiceDto(
        Long matchId,
        Long tournamentId,
        String tournamentName,
        String tournamentRef,   // slug or uuid for deep-linking
        OffsetDateTime tournamentStartAt,
        Integer roundNumber,
        Integer tableNo,
        String myPairName,
        String opponentPairName,
        BigDecimal total,
        OffsetDateTime paidAt,
        /** True if MY pair was the loser of this match. */
        boolean lost,
        /** True if the match has finished and a result was recorded. */
        boolean finished
) {}
