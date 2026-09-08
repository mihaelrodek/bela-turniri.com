package hr.mrodek.apps.bela_turniri.dtos;

/**
 * A pair of numbers, one per side of the table — {@code { "us": 1012,
 * "them": 786 }}.
 *
 * <p>Used twice in {@code BLOK-HISTORY.md} §2.3: as a game's running
 * {@code totals}, and as one deal's {@code cards} (the trick points before
 * declarations). Same wire shape, so one record.
 */
public record BlokScoresDto(Integer us, Integer them) {}
