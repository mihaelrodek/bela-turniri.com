package hr.mrodek.apps.bela_turniri.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import hr.mrodek.apps.bela_turniri.dtos.AdminGameAnalyticsDto;
import hr.mrodek.apps.bela_turniri.dtos.GameAnalyticsEventRequest;
import hr.mrodek.apps.bela_turniri.model.GameAnalyticsEvent;
import hr.mrodek.apps.bela_turniri.repository.GameAnalyticsEventRepository;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
public class GameAnalyticsService {
    @Inject GameAnalyticsEventRepository repository;
    @Inject ObjectMapper json;

    public boolean record(GameAnalyticsEventRequest request) {
        try {
            return repository.insertIfAbsent(request.eventId(), request.runId(), request.type(),
                    request.occurredAt(), json.writeValueAsString(request.data()));
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid analytics payload", e);
        }
    }

    public AdminGameAnalyticsDto aggregate() {
        List<GameAnalyticsEvent> events = repository.listAll(Sort.by("occurredAt"));
        long roomsCreated = count(events, "ROOM_CREATED");
        List<GameAnalyticsEvent> starts = ofType(events, "GAME_STARTED");
        List<GameAnalyticsEvent> completed = ofType(events, "GAME_COMPLETED");
        List<GameAnalyticsEvent> abandoned = ofType(events, "GAME_ABANDONED");
        Set<String> terminalRuns = events.stream()
                .filter(e -> "GAME_COMPLETED".equals(e.getEventType()) || "GAME_ABANDONED".equals(e.getEventType()))
                .map(GameAnalyticsEvent::getRunId).collect(Collectors.toSet());

        long started = starts.size();
        long completedCount = completed.size();
        long abandonedCount = abandoned.size();
        long inProgress = starts.stream().filter(e -> !terminalRuns.contains(e.getRunId())).count();

        Map<String, long[]> targets = new LinkedHashMap<>();
        targets.put("163", new long[3]); targets.put("501", new long[3]); targets.put("701", new long[3]); targets.put("1001", new long[3]);
        Map<String, String> targetByRun = new LinkedHashMap<>();
        long publicGames = 0, privateGames = 0, humanOnly = 0, mixed = 0, botOnly = 0;
        for (GameAnalyticsEvent event : starts) {
            JsonNode data = read(event);
            String target = data.path("targetScore").asText("—");
            targets.computeIfAbsent(target, ignored -> new long[3])[0]++;
            targetByRun.put(event.getRunId(), target);
            if (data.path("private").asBoolean(false)) privateGames++; else publicGames++;
            int bots = countSeatKind(data.path("seats"), "BOT");
            if (bots == 0) humanOnly++; else if (bots == 4) botOnly++; else mixed++;
        }
        for (GameAnalyticsEvent event : completed) {
            targets.computeIfAbsent(targetByRun.getOrDefault(event.getRunId(), target(read(event))), ignored -> new long[3])[1]++;
        }
        for (GameAnalyticsEvent event : abandoned) {
            targets.computeIfAbsent(targetByRun.getOrDefault(event.getRunId(), target(read(event))), ignored -> new long[3])[2]++;
        }

        Map<String, long[]> suits = new LinkedHashMap<>();
        for (String suit : List.of("HERC", "KARA", "PIK", "TREF")) suits.put(suit, new long[3]);
        Map<Integer, long[]> positions = new LinkedHashMap<>();
        for (int position = 1; position <= 4; position++) positions.put(position, new long[3]);
        long deals = 0, durationMs = 0, declarationPoints = 0, stiglja = 0, belot = 0, auto = 0;
        for (GameAnalyticsEvent event : completed) {
            JsonNode data = read(event);
            durationMs += data.path("durationMs").asLong();
            auto += data.path("autoPlayedActions").asLong();
            for (JsonNode deal : data.path("deals")) {
                deals++;
                boolean passed = deal.path("passed").asBoolean(false);
                long[] suit = suits.computeIfAbsent(deal.path("trump").asText("?"), ignored -> new long[3]);
                suit[0]++; suit[passed ? 1 : 2]++;
                int position = deal.path("callPosition").asInt(0);
                if (position >= 1 && position <= 4) {
                    long[] pos = positions.get(position); pos[0]++; pos[passed ? 1 : 2]++;
                }
                declarationPoints += deal.path("declarationPoints").path("A").asLong()
                        + deal.path("declarationPoints").path("B").asLong();
                if (!deal.path("stiglja").isNull() && !deal.path("stiglja").isMissingNode()) stiglja++;
                if (!deal.path("belot").isNull() && !deal.path("belot").isMissingNode()) belot++;
            }
        }

        final long totalDeals = deals;
        List<AdminGameAnalyticsDto.SuitStat> trumpStats = suits.entrySet().stream().map(entry -> {
            long[] v = entry.getValue();
            return new AdminGameAnalyticsDto.SuitStat(entry.getKey(), v[0], v[1], v[2],
                    ratio(v[0], totalDeals), ratio(v[1], v[0]));
        }).toList();
        List<AdminGameAnalyticsDto.CallPositionStat> positionStats = positions.entrySet().stream()
                .map(entry -> new AdminGameAnalyticsDto.CallPositionStat(entry.getKey(), entry.getValue()[0],
                        entry.getValue()[1], entry.getValue()[2], ratio(entry.getValue()[1], entry.getValue()[0])))
                .toList();
        List<AdminGameAnalyticsDto.Breakdown> targetStats = new ArrayList<>();
        targets.forEach((label, value) -> targetStats.add(new AdminGameAnalyticsDto.Breakdown(label, value[0], value[1], value[2])));

        return new AdminGameAnalyticsDto(
                new AdminGameAnalyticsDto.Summary(roomsCreated, started, completedCount, abandonedCount,
                        inProgress, ratio(completedCount, started), ratio(abandonedCount, started)),
                targetStats, trumpStats, positionStats,
                new AdminGameAnalyticsDto.Details(deals, ratio(deals, completedCount),
                        ratio(durationMs, completedCount) / 60_000d, declarationPoints, stiglja, belot, auto,
                        publicGames, privateGames, humanOnly, mixed, botOnly),
                events.isEmpty() ? null : events.get(events.size() - 1).getOccurredAt());
    }

    private JsonNode read(GameAnalyticsEvent event) {
        try { return json.readTree(event.getPayload()); }
        catch (Exception ignored) { return json.createObjectNode(); }
    }
    private static String target(JsonNode data) { return data.path("targetScore").asText("—"); }
    private static long count(List<GameAnalyticsEvent> events, String type) { return events.stream().filter(e -> type.equals(e.getEventType())).count(); }
    private static List<GameAnalyticsEvent> ofType(List<GameAnalyticsEvent> events, String type) { return events.stream().filter(e -> type.equals(e.getEventType())).toList(); }
    private static double ratio(long numerator, long denominator) { return denominator == 0 ? 0d : (double) numerator / denominator; }
    private static int countSeatKind(JsonNode seats, String kind) {
        int count = 0; for (JsonNode seat : seats) if (kind.equals(seat.path("kind").asText())) count++; return count;
    }
}
