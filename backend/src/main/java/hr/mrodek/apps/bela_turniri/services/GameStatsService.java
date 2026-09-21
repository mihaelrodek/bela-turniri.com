package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.AdminGamePlayersDto;
import hr.mrodek.apps.bela_turniri.dtos.GameReliabilityDto;
import hr.mrodek.apps.bela_turniri.dtos.GameResultReportRequest;
import hr.mrodek.apps.bela_turniri.dtos.GameStatsDto;
import hr.mrodek.apps.bela_turniri.model.GameResult;
import hr.mrodek.apps.bela_turniri.model.GameResultPlayer;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import hr.mrodek.apps.bela_turniri.repository.GameNameRepository;
import hr.mrodek.apps.bela_turniri.repository.GameResultPlayerRepository;
import hr.mrodek.apps.bela_turniri.repository.GameResultRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.BadRequestException;
import org.jboss.logging.Logger;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
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

    /**
     * The categories §8.2 defines, in the order the profile card shows them.
     * "Brza 163" is a separate, quick-play discipline — listed first because
     * it is the odd one out (fewer deals, different pace) and this is the
     * order {@code frontend/src/game/util/gameStats.ts}'s
     * {@code STAT_TARGET_SCORES} and the game engine's own
     * {@code TargetScore} union already use.
     */
    private static final int[] CATEGORIES = {163, 501, 701, 1001};

    @Inject GameResultRepository resultRepo;
    @Inject GameResultPlayerRepository playerRepo;
    @Inject EntityManager em;
    // Only the admin list below uses these three; they are the batch sources
    // that keep it at a fixed number of queries.
    @Inject GameNameRepository gameNames;
    @Inject UserProfileRepository profiles;
    @Inject GameReliabilityService reliability;

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
            // Nothing else to do per seat: since 2026-09-21 a finished game
            // earns no karma back (the "+1 per three games" recovery rule is
            // retired). The row just written is itself what the karma popup
            // counts as a game played in the window — see
            // GameReliabilityService.
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

    /**
     * The admin "who played and how much" list (Analitika igre).
     *
     * <p>Fixed query count whatever the list size: one grouped tally, one
     * distinct count, one anonymous-seat tally, one batch of in-game names,
     * one batch of profiles and {@link GameReliabilityService#forUsers} (three
     * more). Nothing here is per player.
     *
     * <p>The name follows the SAME precedence the game server applies per seat
     * — in-game name, else profile display name — with a shortened uid as the
     * last resort, since the backend has no Firebase token to fall back to the
     * way {@code auth.ts} does.
     *
     * @param limit cap on rows returned; the reported total is the true
     *              distinct count, not the capped one
     */
    public AdminGamePlayersDto adminPlayers(int limit) {
        int cap = limit <= 0 ? 200 : Math.min(limit, 1000);
        List<GameResultPlayerRepository.PlayerTally> tallies = playerRepo.topPlayers(cap);
        List<String> uids = tallies.stream().map(GameResultPlayerRepository.PlayerTally::uid).toList();

        Map<String, String> gameNameByUid = gameNames.namesByGameUid(uids);
        Map<String, UserProfile> profileByUid = profiles.findByUids(uids);
        Map<String, GameReliabilityDto> reliabilityByUid = reliability.forUsers(uids);

        List<AdminGamePlayersDto.Player> rows = new ArrayList<>(tallies.size());
        for (var tally : tallies) {
            UserProfile profile = profileByUid.get(tally.uid());
            GameReliabilityDto rel = reliabilityByUid.get(tally.uid());
            rows.add(new AdminGamePlayersDto.Player(
                    tally.uid(),
                    resolveName(tally.uid(), gameNameByUid.get(tally.uid()),
                            profile == null ? null : profile.getDisplayName()),
                    tally.games(),
                    tally.wins(),
                    tally.games() - tally.wins(),
                    tally.lastPlayedAt(),
                    rel == null ? 0L : rel.abandons(),
                    rel == null ? GameReliabilityService.MAX_KARMA : rel.karma(),
                    GameReliabilityService.MAX_KARMA));
        }

        long[] anonymous = playerRepo.anonymousSeatTally();
        return new AdminGamePlayersDto(
                playerRepo.countDistinctPlayers(), rows.size(), cap,
                anonymous[0], anonymous[1], anonymous[2], rows);
    }

    /* ===================== internals ===================== */

    /** In-game name → profile display name → shortened uid. Never null. */
    private static String resolveName(String uid, String gameName, String displayName) {
        if (gameName != null && !gameName.isBlank()) return gameName.trim();
        if (displayName != null && !displayName.isBlank()) return displayName.trim();
        return uid.length() > 8 ? uid.substring(0, 8) + "…" : uid;
    }

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
