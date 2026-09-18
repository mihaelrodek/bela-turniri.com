package hr.mrodek.apps.bela_turniri.dtos;

/** The intentionally small public shape of a player's online reliability. */
public record GameReliabilityDto(int karma, long abandons) {
    public static final GameReliabilityDto DEFAULT = new GameReliabilityDto(100, 0);
}
