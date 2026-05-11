package hr.mrodek.apps.bela_turniri.dtos;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** One drink line on a match's bill. */
public record MatchDrinkDto(
        Long id,
        Long priceId,
        String name,
        BigDecimal unitPrice,
        int quantity,
        BigDecimal lineTotal,
        OffsetDateTime createdAt
) {}
