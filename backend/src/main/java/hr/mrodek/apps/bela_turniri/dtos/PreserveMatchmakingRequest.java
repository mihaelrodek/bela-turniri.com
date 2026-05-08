package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.NotNull;

public record PreserveMatchmakingRequest(
        @NotNull(message = "preserveMatchmaking is required")
        Boolean preserveMatchmaking
) {}
