package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * One row of a cjenik (tournament or template). On a PUT the client can
 * leave {@code id} null for new rows; existing rows keep their id so
 * we can preserve {@link hr.mrodek.apps.bela_turniri.model.MatchDrink#getPrice()}
 * links across edits.
 *
 * <p>Constraints mirror {@code tournament_drink_prices}: name is
 * {@code varchar(100)} and price is {@code numeric(10,2)}. Neither is
 * {@code @NotNull} on purpose — {@code CjenikService} skips rows with a
 * blank name (that is how the SPA drops an empty row the user added and
 * then abandoned) and defaults a null price to zero.
 */
public record DrinkPriceDto(
        Long id,

        // `message` is an i18n bundle key (i18n/messages_*.properties), resolved
        // into the caller's language by errors/ConstraintViolationExceptionMapper.
        @Size(max = 100, message = "validation.drinkPrice.name.max")
        String name,

        @PositiveOrZero(message = "validation.drinkPrice.price.negative")
        @Digits(integer = 8, fraction = 2, message = "validation.drinkPrice.price.digits")
        BigDecimal price,

        Integer sortOrder
) {}
