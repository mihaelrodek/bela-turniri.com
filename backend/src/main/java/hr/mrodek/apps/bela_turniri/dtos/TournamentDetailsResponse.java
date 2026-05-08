package hr.mrodek.apps.bela_turniri.dtos;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record TournamentDetailsResponse(
        Long id,
        UUID uuid,
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
        String repassageUntil,        // "FINALS" | "SEMIFINALS"

        String contactName,
        String contactPhone,

        String rewardType,           // "FIXED" | "PERCENTAGE"
        BigDecimal rewardFirst,
        BigDecimal rewardSecond,
        BigDecimal rewardThird,

        List<String> additionalOptions, // if/when you join them; null/empty for now
        List<PairShortDto> pairs,       // empty until pairs are implemented
        String winnerName,              // optional

        // Creator (Firebase UID + display name copied at create-time).
        String createdByUid,
        String createdByName
) {}
