package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record UserPairPresetDto(
        UUID uuid,

        @NotBlank(message = "name is required")
        @Size(max = 200, message = "name must be at most 200 characters")
        String name
) {}
