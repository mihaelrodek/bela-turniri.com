package hr.mrodek.apps.bela_turniri.dtos;

/**
 * Add a drink to a match. {@code priceId} references the cjenik row to
 * snapshot from; the snapshot freezes name + unit price at attach time
 * so later cjenik edits don't rewrite history.
 */
public record AddMatchDrinkRequest(
        Long priceId,
        Integer quantity
) {}
