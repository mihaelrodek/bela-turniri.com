package hr.mrodek.apps.bela_turniri.dtos;

import java.math.BigDecimal;

/**
 * One row of a cjenik (tournament or template). On a PUT the client can
 * leave {@code id} null for new rows; existing rows keep their id so
 * we can preserve {@link hr.mrodek.apps.bela_turniri.model.MatchDrink#getPrice()}
 * links across edits.
 */
public record DrinkPriceDto(
        Long id,
        String name,
        BigDecimal price,
        Integer sortOrder
) {}
