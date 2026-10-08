package hr.mrodek.apps.bela_turniri.dtos;

import java.time.OffsetDateTime;
import java.util.List;

/** Admin-only inspection contracts. Deliberately absent from public profiles and game protocol. */
public final class BrDtos {
    private BrDtos() {}
    public record Status(boolean enabled, String algorithmVersion, int calibrationGames,
                         int activeDays, String mode) {}
    public record Rating(String uid, String name, int br, int bestBr, int games, int wins,
                         int losses, double mu, double sigma, boolean calibrated, boolean active,
                         Long place, String title, OffsetDateTime lastPlayedAt) {}
    public record Ranking(long total, List<Rating> players) {}
    public record Change(String matchId, String season, String outcome, boolean won,
                         int before, int after, int delta, double muBefore, double sigmaBefore,
                         double muAfter, double sigmaAfter, OffsetDateTime finishedAt,
                         String reviewFlag, String algorithmVersion) {}
    public record Season(String id, OffsetDateTime startsAt, OffsetDateTime endsAt, boolean ended) {}
    public record Standing(String uid, String name, long place, int br, int bestBr,
                           int games, int wins, OffsetDateTime lastPlayedAt) {}
    public record SeasonRanking(String season, long total, List<Standing> players) {}
    public record Award(String season, int place, String uid, String name, int br,
                        int games, int wins, OffsetDateTime awardedAt) {}
}
