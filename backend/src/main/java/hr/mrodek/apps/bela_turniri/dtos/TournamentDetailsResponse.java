package hr.mrodek.apps.bela_turniri.dtos;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record TournamentDetailsResponse(
        Long id,
        UUID uuid,
        /**
         * Pretty URL slug (e.g. {@code "1-bela-open-22-04-2026"}). May be null
         * for legacy rows that haven't been backfilled yet — frontend should
         * fall back to {@code uuid} when null.
         */
        String slug,
        String name,
        String location,
        String details,
        OffsetDateTime startAt,
        String bannerUrl,
        String status,

        // Not persisted yet in your model — keep nullable in response
        BigDecimal entryPrice,
        Integer maxPairs,

        BigDecimal repassagePrice,     // maps from entity.repasage
        BigDecimal repassageSecondPrice,    // maps from entity.repasage2
        String repassageUntil,        // "FINALS" | "SEMIFINALS" | "FIRST_ROUND"

        String contactName,
        String contactPhone,

        String rewardType,           // "FIXED" | "PERCENTAGE"
        BigDecimal rewardFirst,
        BigDecimal rewardSecond,
        BigDecimal rewardThird,

        List<String> additionalOptions, // if/when you join them; null/empty for now
        List<PairShortDto> pairs,       // empty until pairs are implemented
        String winnerName,              // gold-place pair name (set on FINISH)
        // Silver + bronze podium positions. Set by the organiser through
        // the dedicated /podium endpoint after FINISH. Both nullable —
        // the organiser may leave them blank.
        String secondPlaceName,
        String thirdPlaceName,

        // Creator (Firebase UID + display name copied at create-time).
        String createdByUid,
        String createdByName,

        /**
         * Last write to the tournament row ({@code @UpdateTimestamp}).
         *
         * <p>There is no dedicated "finished at" column — FINISH only flips
         * {@code status} and stamps {@code winnerName} — so this is the
         * closest thing to a finish time the model has. The SPA uses it to
         * decide whether a FINISHED tournament is still worth holding a
         * websocket open for: the podium is usually filled in during the
         * minutes right after the final, and each of those edits bumps this
         * value again, so the grace window follows the organiser instead of
         * expiring mid-edit.
         */
        OffsetDateTime updatedAt
) {}
