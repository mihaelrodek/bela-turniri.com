package hr.mrodek.apps.bela_turniri.dtos;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * One line in the waiter's "Računi" overview: every match of a tournament,
 * across every round and table, with just enough to decide where to walk
 * next.
 *
 * <p>Deliberately NOT {@link MatchBillDto}. That one carries the whole
 * drink history and is what the waiter opens for a single table; sending it
 * for forty matches at once would ship every line item of the evening to
 * render a list of totals. Here the bill collapses to {@code total} +
 * {@code drinkCount}, and the detail view fetches the real thing.
 *
 * <p>{@code drinkCount} is the number of drinks — quantities summed, not
 * rows — because "3 × pivo" is three drinks to the person carrying them.
 *
 * <p>{@code matchStatus} is {@code MatchStatus.name()} rather than the enum
 * itself for the same reason every other DTO in this package stringifies:
 * the SPA switches on the raw name and must not break when a constant is
 * added.
 */
public record WaiterBillSummaryDto(
        Long matchId,
        Integer roundNumber,
        Integer tableNo,
        String pair1Name,
        String pair2Name,
        BigDecimal total,
        boolean paid,
        OffsetDateTime paidAt,
        int drinkCount,
        String matchStatus
) {}
