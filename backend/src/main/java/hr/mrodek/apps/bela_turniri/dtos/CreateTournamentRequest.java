package hr.mrodek.apps.bela_turniri.dtos;

import hr.mrodek.apps.bela_turniri.enums.RepassageUntil;
import hr.mrodek.apps.bela_turniri.enums.RewardType;
import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record CreateTournamentRequest(
        @NotBlank(message = "name is required")
        @Size(max = 200, message = "name must be at most 200 characters")
        String name,

        @Size(max = 200, message = "location must be at most 200 characters")
        String location,

        @Size(max = 4000, message = "details must be at most 4000 characters")
        String details,

        OffsetDateTime startAt,

        @Size(max = 1000, message = "bannerUrl must be at most 1000 characters")
        String bannerUrl,

        @Min(value = 2, message = "maxPairs must be at least 2")
        Integer maxPairs,                      // default 16 if null

        @DecimalMin(value = "0.0", inclusive = true, message = "entryPrice cannot be negative")
        BigDecimal entryPrice,                 // default 0 if null

        @DecimalMin(value = "0.0", inclusive = true, message = "repassagePrice cannot be negative")
        BigDecimal repassagePrice,             // default 0 if null

        @DecimalMin(value = "0.0", inclusive = true, message = "repassageSecondPrice cannot be negative")
        BigDecimal repassageSecondPrice,       // nullable

        RepassageUntil repassageUntil,         // FINALS | SEMIFINALS | FIRST_ROUND

        @Size(max = 200, message = "contactName must be at most 200 characters")
        String contactName,

        @Size(max = 50, message = "contactPhone must be at most 50 characters")
        String contactPhone,

        RewardType rewardType,                 // FIXED | PERCENTAGE

        @DecimalMin(value = "0.0", inclusive = true, message = "rewardFirst cannot be negative")
        BigDecimal rewardFirst,

        @DecimalMin(value = "0.0", inclusive = true, message = "rewardSecond cannot be negative")
        BigDecimal rewardSecond,

        @DecimalMin(value = "0.0", inclusive = true, message = "rewardThird cannot be negative")
        BigDecimal rewardThird,

        TournamentStatus status                // DRAFT | STARTED | FINISHED (default DRAFT if null)
) {}
