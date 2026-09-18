package hr.mrodek.apps.bela_turniri.enums;

/**
 * Why something was reported — a fixed, translatable list rather than free
 * text, so the admin inbox can be triaged by category and the reporter does
 * not have to compose a sentence to flag obvious spam.
 *
 * <p>{@code OTHER} is the escape hatch and is the one value where the
 * free-text {@code message} really matters; the SPA nudges for it there.
 */
public enum ReportReason {
    SPAM,
    OFFENSIVE,
    /** Someone else's phone number, address or similar posted in a public field. */
    PERSONAL_DATA,
    OTHER
}
