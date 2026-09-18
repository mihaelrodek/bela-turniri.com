package hr.mrodek.apps.bela_turniri.enums;

/**
 * What a {@link hr.mrodek.apps.bela_turniri.model.ContentReport} points at.
 *
 * <p>The three kinds of user-authored content this app actually carries: a
 * tournament (name, description, poster), a pair (the name two players typed
 * for themselves) and a profile (display name, avatar). Everything else a user
 * can write — scores, drink counts — is a number.
 *
 * <p>The name is also the wire value: the SPA posts {@code "TOURNAMENT"} and
 * the column stores {@code TOURNAMENT}, so this enum is append-only in the
 * same way the changelog is.
 */
public enum ReportTargetType {
    /** {@code target_id} is the tournament's uuid (or its slug — both resolve). */
    TOURNAMENT,
    /** {@code target_id} is the {@code pairs.id} as a decimal string. */
    PAIR,
    /** {@code target_id} is the reported user's Firebase uid. */
    PROFILE
}
