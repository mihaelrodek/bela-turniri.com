package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

/** Internal report emitted after the reconnect grace period has expired. */
public record GameReliabilityEventRequest(
        @NotBlank @Size(max = 120) String eventId,
        @NotBlank @Size(max = 128) String userUid,
        @NotBlank @Pattern(regexp = "^ABANDONED$") String eventType,
        OffsetDateTime occurredAt
) {}
