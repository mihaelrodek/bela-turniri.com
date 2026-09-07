package hr.mrodek.apps.bela_turniri.dtos;

/**
 * Flip a match bill's paid flag from the waiter view.
 *
 * <p>One PATCH carrying the desired state instead of the organiser's
 * {@code /pay} + {@code /unpay} pair: the waiter's UI is a checkbox in a
 * long list of tables, and a replayed offline queue must converge on the
 * state the waiter chose rather than on whichever verb arrived last.
 *
 * <p>Primitive {@code boolean}, so an absent or null {@code paid} field
 * deserialises to {@code false} rather than blowing up — "not paid" is the
 * safe reading of a malformed request here, since it never destroys money
 * data, only leaves a bill open.
 */
public record SetPaidRequest(boolean paid) {}
