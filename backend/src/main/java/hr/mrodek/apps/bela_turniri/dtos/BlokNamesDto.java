package hr.mrodek.apps.bela_turniri.dtos;

/**
 * What the two sides of the table call themselves —
 * {@code { "us": "Mi", "them": "Vi" }}.
 *
 * <p>{@code BLOK-HISTORY.md} §2.3 sends this shape on the way in, so responses
 * use it too rather than a flattened {@code nameUs} / {@code nameThem} pair: a
 * screen that renders a series should not have to know which direction the
 * data was travelling.
 *
 * <p><b>An empty string means "render the translated MI / VI"</b> — the player
 * never typed a name. The column stores that as NULL, so {@link #of} coerces
 * on the way out and the wire always carries strings, never nulls. Both mean
 * the same thing to the client, and having exactly one of them means the
 * client does not have to handle both.
 */
public record BlokNamesDto(String us, String them) {

    /** Null-safe constructor: a missing name becomes {@code ""}, never null. */
    public static BlokNamesDto of(String us, String them) {
        return new BlokNamesDto(us == null ? "" : us, them == null ? "" : them);
    }
}
