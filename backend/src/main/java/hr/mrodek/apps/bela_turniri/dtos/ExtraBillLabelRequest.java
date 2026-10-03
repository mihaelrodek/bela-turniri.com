package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.Size;

/** Body for creating / renaming an "Ostalo" bill; blank or null label = unnamed. */
public record ExtraBillLabelRequest(
        @Size(max = 60, message = "validation.extraBill.label.max") String label
) {}
