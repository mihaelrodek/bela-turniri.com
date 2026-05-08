package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.NotNull;

public record PaidRequest(
        @NotNull(message = "paid is required")
        Boolean paid
) {}
