package hr.mrodek.apps.bela_turniri.dtos;

/**
 * Body of {@code PUT /api/internal/profiles/{uid}/game-name}: the player's
 * chosen <em>ime za igru</em>.
 *
 * <p>No bean-validation annotations on purpose. The endpoint checks its
 * shared secret <b>before</b> it looks at the body — for the same reason
 * {@code GameResultsInternalController} does — and a {@code @Valid} parameter
 * is cascaded by JAX-RS before the method runs, so an unauthenticated caller
 * would learn this record's field names from a 400. The rules live in
 * {@code GameNameService}, which is also where the 7-day one has to live
 * anyway.
 */
public record SetGameNameRequest(String name) {}
