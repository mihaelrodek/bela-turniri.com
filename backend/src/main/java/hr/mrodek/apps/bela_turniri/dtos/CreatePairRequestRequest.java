package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreatePairRequestRequest(
        // `message` is an i18n bundle key (i18n/messages_*.properties), resolved
        // into the caller's language by errors/ConstraintViolationExceptionMapper.
        @NotBlank(message = "validation.pairRequest.playerName.required")
        @Size(max = 200, message = "validation.pairRequest.playerName.max")
        String playerName,

        @Size(max = 50, message = "validation.pairRequest.phone.max")
        String phone,

        @Size(max = 1000, message = "validation.pairRequest.note.max")
        String note
) {}
