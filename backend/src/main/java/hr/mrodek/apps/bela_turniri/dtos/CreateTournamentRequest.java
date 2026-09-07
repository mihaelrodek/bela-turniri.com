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
        // `message` is an i18n bundle key (i18n/messages_*.properties), resolved
        // into the caller's language by errors/ConstraintViolationExceptionMapper.
        @NotBlank(message = "validation.tournament.name.required")
        @Size(max = 200, message = "validation.tournament.name.max")
        String name,

        @Size(max = 200, message = "validation.tournament.location.max")
        String location,

        @Size(max = 4000, message = "validation.tournament.details.max")
        String details,

        OffsetDateTime startAt,

        @Size(max = 1000, message = "validation.tournament.bannerUrl.max")
        String bannerUrl,

        // Optional. null = "no cap" (organiser left it unspecified).
        // @Min treats null as valid, so this only enforces "≥ 2" when
        // a value is actually present.
        @Min(value = 2, message = "validation.tournament.maxPairs.min")
        Integer maxPairs,

        @DecimalMin(value = "0.0", inclusive = true, message = "validation.tournament.entryPrice.negative")
        BigDecimal entryPrice,                 // default 0 if null

        @DecimalMin(value = "0.0", inclusive = true, message = "validation.tournament.repassagePrice.negative")
        BigDecimal repassagePrice,             // default 0 if null

        @DecimalMin(value = "0.0", inclusive = true, message = "validation.tournament.repassageSecondPrice.negative")
        BigDecimal repassageSecondPrice,       // nullable

        RepassageUntil repassageUntil,         // FINALS | SEMIFINALS | FIRST_ROUND

        @Size(max = 200, message = "validation.tournament.contactName.max")
        String contactName,

        @Size(max = 50, message = "validation.tournament.contactPhone.max")
        String contactPhone,

        RewardType rewardType,                 // FIXED | PERCENTAGE

        @DecimalMin(value = "0.0", inclusive = true, message = "validation.tournament.rewardFirst.negative")
        BigDecimal rewardFirst,

        @DecimalMin(value = "0.0", inclusive = true, message = "validation.tournament.rewardSecond.negative")
        BigDecimal rewardSecond,

        @DecimalMin(value = "0.0", inclusive = true, message = "validation.tournament.rewardThird.negative")
        BigDecimal rewardThird,

        TournamentStatus status                // DRAFT | STARTED | FINISHED (default DRAFT if null)
) {}
