package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * PUT body to replace the whole cjenik for a tournament or user template.
 *
 * <p>An explicitly empty list is accepted — that is how the SPA clears a
 * price list. A <b>missing</b> list is not: the handler used to coerce both
 * {@code null} body and {@code null} items to {@code List.of()}, so a
 * truncated request, a client bug or a stray {@code PUT {}} silently wiped
 * the whole cjenik of a live tournament with a 200. {@code @NotNull} makes
 * the difference between "clear it" and "you sent nothing" explicit.
 *
 * <p>The {@code @Valid} cascade is what makes the per-row
 * {@link DrinkPriceDto} constraints actually fire; without it they were
 * inert decoration.
 */
public record SaveDrinkPricesRequest(
        @NotNull(message = "validation.cjenik.items.required")
        @Valid List<@Valid DrinkPriceDto> items
) {}
