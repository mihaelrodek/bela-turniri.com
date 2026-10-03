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
        /** Display snapshot of who settled it (organiser's name or a waiter's invited name); null while unpaid or for bills settled before this was recorded. */
        String paidByName,
        int drinkCount,
        String matchStatus,
        /**
         * 2026-10-03: {@code "MATCH"} (every pre-existing line) or
         * {@code "EXTRA"} — an "Ostalo" bill with no match: {@code matchId},
         * {@code roundNumber}, {@code tableNo}, pair names and
         * {@code matchStatus} are all null, {@code extraBillId} and
         * {@code label} are set.
         */
        String kind,
        Long extraBillId,
        String label
) {}
