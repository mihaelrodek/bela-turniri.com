package hr.mrodek.apps.bela_turniri.dtos;

import java.time.OffsetDateTime;
import java.util.List;

public record AdminGameAnalyticsDto(
        Summary summary,
        List<Breakdown> byTarget,
        List<SuitStat> trumps,
        List<CallPositionStat> callPositions,
        Details details,
        OffsetDateTime lastEventAt
) {
    public record Summary(long roomsCreated, long gamesStarted, long completed, long abandoned,
                          long inProgress, double completionRate, double abandonmentRate) {}
    public record Breakdown(String label, long started, long completed, long abandoned) {}
    public record SuitStat(String suit, long calls, long successes, long falls,
                           double share, double successRate) {}
    public record CallPositionStat(int position, long calls, long successes, long falls,
                                   double successRate) {}
    public record Details(long deals, double averageDealsPerCompletedGame, double averageDurationMinutes,
                          long declarationPoints, long stiglja, long belot, long autoPlayedActions,
                          long publicGames, long privateGames, long humanOnlyGames,
                          long mixedGames, long botOnlyGames) {}
}
