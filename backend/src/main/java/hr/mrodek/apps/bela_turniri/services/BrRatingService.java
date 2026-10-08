package hr.mrodek.apps.bela_turniri.services;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import hr.mrodek.apps.bela_turniri.dtos.BrDtos;
import hr.mrodek.apps.bela_turniri.dtos.BrResultReportRequest;
import hr.mrodek.apps.bela_turniri.repository.BrRatingRepository;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.ServiceUnavailableException;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.*;
import java.util.*;

@ApplicationScoped
public class BrRatingService {
    @ConfigProperty(name = "game.br.enabled", defaultValue = "false") boolean enabled;
    @Inject BrRatingRepository repo;
    @Inject BrRatingEngine engine;
    @Inject ObjectMapper mapper;
    private static final ZoneId SEASON_ZONE = ZoneId.of("Europe/Zagreb");

    public BrDtos.Status status() {
        return new BrDtos.Status(enabled, BrRatingEngine.VERSION, 20, 30, "1001/prolaz/declarations/4-accounts/public");
    }

    /** One transaction: audit + all four ratings + seasonal standings, or nothing. */
    @Transactional
    public boolean record(BrResultReportRequest body) {
        validate(body);
        UUID id = UUID.fromString(body.matchId());
        String json = json(body);
        repo.lock();
        var duplicate = repo.duplicate(id, json);
        if (duplicate.isPresent()) {
            if (!duplicate.get()) throw new ClientErrorException("Conflicting BR report for the same matchId", 409);
            return false;
        }
        // 503 deliberately leaves the durable game-server report pending during a backend pause/rolling deployment.
        if (!enabled) throw new ServiceUnavailableException("BR is disabled");

        ZonedDateTime end = body.finishedAt().atZoneSameInstant(SEASON_ZONE);
        int quarter = (end.getMonthValue() - 1) / 3 + 1;
        String season = end.getYear() + "-Q" + quarter;
        var start = LocalDate.of(end.getYear(), (quarter - 1) * 3 + 1, 1).atStartOfDay(SEASON_ZONE);
        repo.season(season, start.toOffsetDateTime(), start.plusMonths(3).toOffsetDateTime());
        String roster = json(body.players().stream().map(p -> Map.of("uid", p.uid())).toList());
        String review = "CANCELLED".equals(body.outcome()) ? null : repo.reviewFlag(body, roster);
        repo.match(id, season, body, json, review);
        if ("CANCELLED".equals(body.outcome())) return true;

        var before = new LinkedHashMap<String, BrRatingRepository.StoredRating>();
        for (var p : body.players()) before.put(p.uid(), repo.ensureRating(p));
        var players = body.players().stream().map(p -> {
            var r = before.get(p.uid());
            return new BrRatingEngine.Player(p.uid(), p.team(), r.mu(), r.sigma());
        }).toList();
        var after = engine.rate(players, body.winnerTeam());
        for (var p : body.players()) {
            var change = after.get(p.uid());
            repo.adjustment(id, season, p, before.get(p.uid()), change.mu(), change.sigma(),
                    BrRatingEngine.display(change.mu(), change.sigma()), p.team().equals(body.winnerTeam()), body.finishedAt());
        }
        // Most reports belong to the current season. Only late reports require refreshing old podiums here.
        if (!start.plusMonths(3).toInstant().isAfter(Instant.now())) repo.refreshAwards(OffsetDateTime.now());
        return true;
    }

    @Scheduled(cron = "0 40 4 * * ?", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    @Transactional
    void seasonRollover() {
        if (!enabled) return;
        repo.lock();
        repo.refreshAwards(OffsetDateTime.now());
    }

    private void validate(BrResultReportRequest b) {
        try {
            UUID id = UUID.fromString(b.matchId());
            if (!id.toString().equals(b.matchId())) throw new IllegalArgumentException();
        } catch (RuntimeException e) { throw new BadRequestException("matchId must be a canonical UUID"); }
        if (b.targetScore() != 1001 || !"prolaz".equals(b.gameEndRule()) || b.noDeclarations()
                || !b.allowBela() || b.privateRoom()) {
            throw new BadRequestException("BR v1 requires public 1001/prolaz with declarations and bela");
        }
        if (b.finishedAt().isBefore(b.startedAt()) || b.finishedAt().isAfter(OffsetDateTime.now().plusMinutes(5))) {
            throw new BadRequestException("Invalid BR match timestamps");
        }
        Set<Integer> seats = new HashSet<>();
        Set<String> uids = new HashSet<>();
        for (var p : b.players()) {
            String team = p.seat() % 2 == 0 ? "A" : "B";
            if (!seats.add(p.seat()) || !uids.add(p.uid()) || !team.equals(p.team()) || !realUid(p.uid())) {
                throw new BadRequestException("BR requires four distinct account players in seats 0/2=A, 1/3=B");
            }
        }
        if ("CANCELLED".equals(b.outcome())) {
            if (b.winnerTeam() != null || b.abandonedUid() != null) throw new BadRequestException("Cancelled BR has no winner/leaver");
        } else if (b.winnerTeam() == null) {
            throw new BadRequestException("BR outcome requires a winner");
        } else if ("FORFEIT".equals(b.outcome())) {
            var leaver = b.players().stream().filter(p -> p.uid().equals(b.abandonedUid())).findFirst()
                    .orElseThrow(() -> new BadRequestException("Forfeit requires an original participant"));
            if (leaver.team().equals(b.winnerTeam())) throw new BadRequestException("Leaver's team cannot win a forfeit");
        } else {
            if (b.abandonedUid() != null) throw new BadRequestException("Completed BR cannot have a leaver");
            int score = "A".equals(b.winnerTeam()) ? b.scoreA() : b.scoreB();
            if (score < 1001) throw new BadRequestException("Completed BR winner has not reached 1001");
        }
    }

    private static boolean realUid(String uid) {
        return uid.equals(uid.trim()) && !uid.startsWith("guest:") && !uid.startsWith("dev:") && !uid.startsWith("demo:");
    }

    private String json(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Cannot encode BR audit", e); }
    }
}
