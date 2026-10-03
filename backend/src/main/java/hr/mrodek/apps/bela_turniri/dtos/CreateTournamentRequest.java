package hr.mrodek.apps.bela_turniri.dtos;

import com.fasterxml.jackson.databind.JsonNode;
import hr.mrodek.apps.bela_turniri.enums.RepassageUntil;
import hr.mrodek.apps.bela_turniri.enums.RewardType;
import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.AssertTrue;

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

        Integer targetScore,                    // 501 | 701 | 1001 (default 1001)
        String gameEndRule,                     // prolaz | dosta (default prolaz)
        String dealDirection,                   // right | left (default right)
        Boolean declarationsEnabled,            // default true
        Boolean allowBela,                      // relevant without declarations; default true

        // "Pravila turnira" document (see TournamentRulesNormaliser), validated
        // and normalised in the controller. Three states on update: key absent
        // (Java null) = leave stored rules alone, explicit JSON null (NullNode)
        // = reset to the global defaults, object = replace. That keeps older
        // clients that never send `rules` from wiping an organiser's edits.
        JsonNode rules,

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

        TournamentStatus status,               // DRAFT | STARTED | FINISHED (default DRAFT if null)

        // Pin the organiser picked (map click or autocomplete suggestion).
        // Optional: when absent the server geocodes `location` instead.
        Double latitude,
        Double longitude
) {
    @AssertTrue(message = "latitude and longitude must both be set and in range")
    public boolean isCoordinatesValid() {
        if (latitude == null && longitude == null) return true;
        return latitude != null && longitude != null
                && latitude >= -90 && latitude <= 90
                && longitude >= -180 && longitude <= 180;
    }

    /** True when the request carries a usable pin. */
    public boolean hasCoordinates() {
        return latitude != null && longitude != null;
    }

    @AssertTrue(message = "targetScore must be 501, 701 or 1001")
    public boolean isTargetScoreAllowed() {
        return targetScore == null || targetScore == 501 || targetScore == 701 || targetScore == 1001;
    }

    @AssertTrue(message = "gameEndRule must be prolaz or dosta")
    public boolean isGameEndRuleAllowed() {
        return gameEndRule == null || gameEndRule.equals("prolaz") || gameEndRule.equals("dosta");
    }

    @AssertTrue(message = "dealDirection must be right or left")
    public boolean isDealDirectionAllowed() {
        return dealDirection == null || dealDirection.equals("right") || dealDirection.equals("left");
    }
}
