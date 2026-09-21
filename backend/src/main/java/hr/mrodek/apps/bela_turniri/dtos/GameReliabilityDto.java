package hr.mrodek.apps.bela_turniri.dtos;

/**
 * The intentionally small public shape of a player's online reliability.
 *
 * <p>{@code maxKarma} and {@code windowDays} ride along so the UI can render
 * "x/10" and "u zadnjih 30 dana" without hard-coding the rule: if the scale or
 * the window ever changes, every label follows by itself.
 *
 * @param karma          derived score, {@code maxKarma − recentAbandons}, floor 0
 * @param abandons       LIFETIME confirmed abandonments, never reset — the
 *                       field name is kept from the stored-score era because
 *                       the game protocol already speaks it
 * @param maxKarma       top of the scale (10)
 * @param recentAbandons abandonments inside the rolling window — the only
 *                       thing karma is made of
 * @param recentGames    finished eligible games inside the same window, so the
 *                       popup can say "napustio X od Y partija"
 * @param windowDays     length of that window in days (30)
 */
public record GameReliabilityDto(int karma, long abandons, int maxKarma,
                                 int recentAbandons, int recentGames, int windowDays) {
    /** What an unknown uid looks like: clean window, nothing on record. */
    public static final GameReliabilityDto DEFAULT = new GameReliabilityDto(10, 0, 10, 0, 0, 30);
}
