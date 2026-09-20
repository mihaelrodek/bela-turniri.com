package hr.mrodek.apps.bela_turniri.dtos;

/**
 * The intentionally small public shape of a player's online reliability.
 *
 * <p>{@code maxKarma} rides along so the UI can render "x/10" without
 * hard-coding the scale: if the rule ever changes, the label follows.
 */
public record GameReliabilityDto(int karma, long abandons, int maxKarma) {
    public static final GameReliabilityDto DEFAULT = new GameReliabilityDto(10, 0, 10);
}
