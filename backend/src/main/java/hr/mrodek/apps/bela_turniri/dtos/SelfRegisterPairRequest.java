package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SelfRegisterPairRequest(
        @NotBlank(message = "name is required")
        @Size(max = 200, message = "name must be at most 200 characters")
        String name
) {}
