package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.GameResultReportRequest;
import hr.mrodek.apps.bela_turniri.dtos.GameStatsDto;
import hr.mrodek.apps.bela_turniri.model.GameResult;
import hr.mrodek.apps.bela_turniri.model.GameResultPlayer;
import hr.mrodek.apps.bela_turniri.repository.GameResultPlayerRepository;
import hr.mrodek.apps.bela_turniri.repository.GameResultRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.BadRequestException;
import org.jboss.logging.Logger;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Recording and reading of online-game results (game/README.md §8).
 *
 * <p>Two halves that never meet: the game server writes through
 * {@link #record}, the profile reads through {@link #statsFor}. There is no
 * aggregate table between them — the statistics are recomputed from the
 * player rows on every read, so they cannot drift.
 *
 * <p>Nothing here decides whether a game is <i>eligible</i>. That rule (§8.1
 * — a game counts only when both teams contain at least one human) belongs to
 * the game server, which knows who is human per seat; everything that reaches
 * this service is already meant to be counted.
 */
@ApplicationScoped
public class GameStatsService {

    private static final Logger LOG = Logger.getLogger(GameStatsService.class);

    /** The categories §8.2 defines, in the order the profile card shows them. */
    private static final int[] CATEGORIES = {501, 701, 1001};

    @Inject GameResultRepository resultRepo;
    @Inject GameResultPlayerRepository playerRepo;
    @Inject EntityManager em;

    /**
     * Record one finished game.
     *
     * @return {@code true} if the game was stored, {@code false} if this
     *         {@code resultId} had already been recorded (a retry after the
     *         reporter lost the response — see §8.4)
     */
    public boolean record(GameResultReportRequest body) {
        UUID uuid = parseUuid(body.resultId());
        validateSeats(body);

        short targetScore = body.targetScore().shortValue();
        String winnerTeam = body.winnerTeam();

        Optional<Long> inserted = resultRepo.insertIfAbsent(
                uuid,
                body.playedAt(),
                targetScore,
                winnerTeam,
                body.scoreA(),
                body.scoreB(),
                body.dealsCount() == null ? null : body.dealsCount().shortValue());

        if (inserted.isEmpty()) {
            // Already recorded. Not an error and not worth a WARN: a retry
            // after a dropped response is the expected, designed-for path.
            LOG.debugf("Game result %s already recorded — ignoring replay", uuid);
            return false;
        }

        // The parent row went in with native SQL, so it is not in the
        // persistence context; a reference is enough to hang the children off
        // and avoids a pointless SELECT of a row we just wrote.
        GameResult parent = em.getReference(GameResult.class, inserted.get());
        for (GameResultReportRequest.PlayerDto p : body.players()) {
            GameResultPlayer row = new GameResultPlayer();
            row.setGameResult(parent);
            row.setSeat(p.seat().shortValue());
            row.setTeam(p.team());
            row.setUid(p.uid());
            row.setBot(Boolean.TRUE.equals(p.isBot()));
            // Denormalised on write — the only place the two can be derived
            // from each other, so they can never disagree later.
            row.setWon(winnerTeam.equals(p.team()));
            playerRepo.persist(row);
        }
        return true;
    }

    /**
     * The user's record across every category they have actually played.
     *
     * <p>One query, folded up here: the global row is the sum of the
     * per-category tallies rather than a second unfiltered query, so the parts
     * always add up to the whole even if a game lands between them.
     */
    public GameStatsDto statsFor(String uid) {
        var tallies = playerRepo.tallyByTargetScore(uid);

        Map<Integer, GameResultPlayerRepository.TargetScoreTally> byScore = new LinkedHashMap<>();
        long totalGames = 0;
        long totalWins = 0;
        for (var t : tallies) {
            byScore.put(t.targetScore(), t);
            totalGames += t.games();
            totalWins += t.wins();
        }

        // Fixed order (501, 701, 1001) regardless of what the user played
        // first, and categories with no games are left out entirely.
        Map<String, GameStatsDto.Bucket> buckets = new LinkedHashMap<>();
        for (int category : CATEGORIES) {
            var t = byScore.get(category);
            if (t == null || t.games() == 0) continue;
            buckets.put(String.valueOf(category), GameStatsDto.Bucket.of(t.games(), t.wins()));
        }

        return new GameStatsDto(GameStatsDto.Bucket.of(totalGames, totalWins), buckets);
    }

    /* ===================== internals ===================== */

    private static UUID parseUuid(String raw) {
        try {
            return UUID.fromString(raw.trim());
        } catch (RuntimeException e) {
            throw new BadRequestException("resultId is not a valid UUID");
        }
    }

    /**
     * Cross-element shape checks bean validation cannot express.
     *
     * <p>Loose on purpose — the reporter is trusted for the game rules — but
     * strict about the things that would make a row uninterpretable later:
     * <ul>
     *   <li>exactly the four seats 0-3, each once (the DB unique constraint
     *       would catch a duplicate seat, but as a 500 rather than a 400);</li>
     *   <li>a human seat must carry a uid — otherwise the game silently
     *       counts for nobody, which is invisible until a user asks why their
     *       stats are short;</li>
     *   <li>a uid-less seat must be flagged as a bot, the same defect seen
     *       from the other side.</li>
     * </ul>
     * Scores and winner are NOT cross-checked: the game server is the
     * authority on the result, and second-guessing its arithmetic here would
     * only mean rejecting valid games when the two implementations drift.
     */
    private static void validateSeats(GameResultReportRequest body) {
        boolean[] seen = new boolean[4];
        for (GameResultReportRequest.PlayerDto p : body.players()) {
            int seat = p.seat();
            if (seen[seat]) {
                throw new BadRequestException("duplicate seat " + seat + " in players");
            }
            seen[seat] = true;

            boolean isBot = Boolean.TRUE.equals(p.isBot());
            boolean hasUid = p.uid() != null && !p.uid().isBlank();
            boolean isGuest = Boolean.TRUE.equals(p.isGuest());
            if (isGuest && (hasUid || isBot)) {
                throw new BadRequestException("guest seat must be human without a uid");
            }
            if (!isBot && !isGuest && !hasUid) {
                throw new BadRequestException("seat " + seat + " is human but has no uid");
            }
            if (isBot && hasUid) {
                throw new BadRequestException("seat " + seat + " is a bot but carries a uid");
            }
        }
        for (int seat = 0; seat < seen.length; seat++) {
            if (!seen[seat]) throw new BadRequestException("players is missing seat " + seat);
        }
    }
}
