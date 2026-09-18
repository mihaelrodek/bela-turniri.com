package hr.mrodek.apps.bela_turniri.dtos;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.Map;

public record GameAnalyticsEventRequest(
        @NotBlank @Size(max = 80) String eventId,
        @Size(max = 36) String runId,
        @NotBlank @Pattern(regexp = "^(ROOM_CREATED|GAME_STARTED|GAME_COMPLETED|GAME_ABANDONED)$") String type,
        @NotNull OffsetDateTime occurredAt,
        @NotNull Map<String, Object> data
) {
    @JsonIgnore
    @AssertTrue(message = "runId is required for game lifecycle events")
    public boolean isRunIdPresentWhenRequired() {
        return "ROOM_CREATED".equals(type) || (runId != null && !runId.isBlank());
    }
}
