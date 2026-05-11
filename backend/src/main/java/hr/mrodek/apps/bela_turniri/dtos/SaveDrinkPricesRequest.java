package hr.mrodek.apps.bela_turniri.dtos;

import java.util.List;

/** PUT body to replace the whole cjenik for a tournament or user template. */
public record SaveDrinkPricesRequest(List<DrinkPriceDto> items) {}
