package hr.mrodek.apps.bela_turniri.services;

import com.fasterxml.jackson.databind.JsonNode;
import hr.mrodek.apps.bela_turniri.dtos.AdminGamePlayersDto;
import hr.mrodek.apps.bela_turniri.dtos.GameReliabilityDto;
import hr.mrodek.apps.bela_turniri.dtos.GameResultReportRequest;
import hr.mrodek.apps.bela_turniri.dtos.GameStatsDto;
import hr.mrodek.apps.bela_turniri.model.GameReplay;
import hr.mrodek.apps.bela_turniri.model.GameResult;
import hr.mrodek.apps.bela_turniri.model.GameResultPlayer;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import hr.mrodek.apps.bela_turniri.repository.GameNameRepository;
import hr.mrodek.apps.bela_turniri.repository.GameReplayRepository;
import hr.mrodek.apps.bela_turniri.repository.GameResultPlayerRepository;
import hr.mrodek.apps.bela_turniri.repository.GameResultRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.BadRequestException;
import org.jboss.logging.Logger;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
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
 * the game server, which knows who is human per seat; this service records
 * its verdict on {@code game_results.eligible} and never second-guesses it.
 *
 * <p>Since 2026-09-22 (§8.7) the reporter sends EVERY finished game that had
 * a real person in it, eligible or not, so the admin analytics can see games
 * played against bots and against the demo lobby. The split is strict:
 * {@link #statsFor} and everything behind {@code GameReliabilityService}
 * count eligible games only, exactly as before; {@link #adminPlayers} counts
 * everything, and reports the eligible subset next to it.
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

    /**
     * Backstop on a stored replay, in bytes. The game server already refuses
     * anything over 512 KB; this is double that, so it only ever catches a
     * caller that is not the game server we ship.
     */
    private static final int MAX_REPLAY_BYTES = 1024 * 1024;

    @Inject GameResultRepository resultRepo;
    @Inject GameResultPlayerRepository playerRepo;
    @Inject GameReplayRepository replayRepo;
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
                body.dealsCount() == null ? null : body.dealsCount().shortValue(),
                eligibilityOf(body));

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
            row.setPlayerName(trimName(p.name()));
            row.setPlayerKind(kindOf(p));
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

        recordReplay(body, parent);
        return true;
    }

    /**
     * Store the game's full replay, if it sent one (game/README.md §8.8).
     *
     * <p>Inside the SAME transaction as the result and its seats, so the
     * archive can never disagree with the statistics: either the whole report
     * lands or none of it does. Reached only on a fresh insert — a replayed
     * {@code resultId} returns before this — so the one-to-one row can never
     * be written twice.
     *
     * <p>OPTIONAL IN EVERY DIRECTION. No replay is a perfectly normal report
     * (an older game server sends none, and the reporter drops an oversized
     * one rather than losing the result), and nothing downstream depends on
     * the row existing. The only thing that must never happen is a replay
     * costing a game its statistics, which is why the size guard below drops
     * the document and logs instead of rejecting the request.
     */
    private void recordReplay(GameResultReportRequest body, GameResult parent) {
        JsonNode node = body.replay();
        if (node == null || node.isNull() || node.isMissingNode()) return;

        String json = node.toString();
        int bytes = json.getBytes(StandardCharsets.UTF_8).length;
        if (bytes > MAX_REPLAY_BYTES) {
            // The reporter has its own 512 KB guard, so this only fires for a
            // caller that ignored it. A WARN and no row: the game itself is
            // already recorded and must stay that way.
            // `body.resultId()`, not `parent.getUuid()`: `parent` is an
            // unloaded reference and asking it for a column would fire a
            // SELECT purely to write a log line.
            LOG.warnf("Replay for game %s is %d bytes (limit %d) — result recorded without it",
                    body.resultId(), bytes, MAX_REPLAY_BYTES);
            return;
        }

        GameReplay replay = new GameReplay();
        replay.setGameResult(parent);
        replay.setReplay(json);
        replay.setBotVersion(botVersionOf(node));
        replay.setSizeBytes(bytes);
        replayRepo.persist(replay);
    }

    /**
     * {@code botVersion} lifted out of the document into its own column — the
     * one field the export groups by. Read defensively: the document belongs
     * to the game server, and a missing or oddly-typed field must cost a
     * column value, never the row.
     */
    private static String botVersionOf(JsonNode replay) {
        JsonNode node = replay.path("botVersion");
        if (!node.isTextual()) return null;
        String value = node.asText().trim();
        if (value.isEmpty()) return null;
        return value.length() <= 32 ? value : value.substring(0, 32);
    }

    /**
     * The user's record across every category they have actually played.
     *
     * <p>One query, folded up here: the global row is the sum of the
     * per-category tallies rather than a second unfiltered query, so the parts
     * always add up to the whole even if a game lands between them.
     *
     * <p>ELIGIBLE GAMES ONLY (§8.1), enforced in the query. This is the
     * competitive record shown on the profile, and it means exactly what it
     * meant before 2026-09-22 — a game against three bots is recorded for the
     * admin analytics and appears nowhere here.
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
     * <p>Fixed query count whatever the list size: two grouped tallies
     * (accounts by uid, guests by name), one distinct count, one
     * anonymous-seat tally, one company tally, one batch of in-game names,
     * one batch of profiles and {@link GameReliabilityService#forUsers} (three
     * more). Nothing here is per player.
     *
     * <p>ANALYTICS VIEW: every recorded game counts, including the ones §8.1
     * rejects. The eligible subset rides along per row as
     * {@code rankedGames}/{@code rankedWins}, so the owner can see both "who
     * has been on the site" and "whose record this actually is" without the
     * two numbers being confused for each other.
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

        // Accounts and named guests are two different groupings (uid vs. the
        // name played under) and therefore two queries; each is capped on its
        // own so a flood of one kind cannot push the other out of the list,
        // and the merged result is capped again below.
        List<GameResultPlayerRepository.PlayerTally> accounts = playerRepo.topPlayers(cap);
        List<GameResultPlayerRepository.PlayerTally> guests = playerRepo.topGuests(cap);

        List<String> uids = accounts.stream().map(GameResultPlayerRepository.PlayerTally::uid).toList();
        Map<String, String> gameNameByUid = gameNames.namesByGameUid(uids);
        Map<String, UserProfile> profileByUid = profiles.findByUids(uids);
        Map<String, GameReliabilityDto> reliabilityByUid = reliability.forUsers(uids);

        List<AdminGamePlayersDto.Player> rows = new ArrayList<>(accounts.size() + guests.size());
        for (var tally : accounts) {
            UserProfile profile = profileByUid.get(tally.uid());
            GameReliabilityDto rel = reliabilityByUid.get(tally.uid());
            rows.add(row(tally,
                    resolveName(tally.uid(), gameNameByUid.get(tally.uid()),
                            profile == null ? null : profile.getDisplayName()),
                    "PLAYER",
                    rel == null ? 0L : rel.abandons(),
                    rel == null ? GameReliabilityService.MAX_KARMA : rel.karma()));
        }
        for (var tally : guests) {
            // A guest has no account, so nothing tracks their reliability:
            // zero abandons and a full karma bar both mean "not tracked", and
            // the UI hides them on a guest row rather than showing a 10/10
            // nobody earned.
            rows.add(row(tally, tally.name(), "GUEST", 0L, GameReliabilityService.MAX_KARMA));
        }

        // One merged order, so an admin reads a single leaderboard rather than
        // two lists whose top rows are not comparable.
        rows.sort(ADMIN_ROW_ORDER);
        if (rows.size() > cap) rows = new ArrayList<>(rows.subList(0, cap));

        long[] anonymous = playerRepo.anonymousSeatTally();
        long[] company = resultRepo.companyGameTally();
        return new AdminGamePlayersDto(
                playerRepo.countDistinctPlayers(), rows.size(), cap,
                anonymous[0], anonymous[1], anonymous[2], anonymous[3],
                company[0], company[1], rows);
    }

    /* ===================== internals ===================== */

    /** Most games first, newest activity breaking the tie. */
    private static final Comparator<AdminGamePlayersDto.Player> ADMIN_ROW_ORDER =
            Comparator.comparingLong(AdminGamePlayersDto.Player::games).reversed()
                    .thenComparing(AdminGamePlayersDto.Player::lastPlayedAt,
                            Comparator.nullsLast(Comparator.reverseOrder()));

    private static AdminGamePlayersDto.Player row(GameResultPlayerRepository.PlayerTally t,
                                                  String name, String kind,
                                                  long abandons, int karma) {
        return new AdminGamePlayersDto.Player(
                t.uid(), name, kind,
                t.games(), t.wins(), t.games() - t.wins(),
                t.rankedGames(), t.rankedWins(), t.rankedGames() - t.rankedWins(),
                t.lastPlayedAt(), abandons, karma, GameReliabilityService.MAX_KARMA);
    }

    /**
     * §8.1's verdict as reported, or the old rule applied to the seats when
     * the field is absent.
     *
     * <p>The fallback exists for one case only: a game server that has not
     * been redeployed yet. Such a server also only ever POSTs games it has
     * already judged eligible, so re-deriving the rule here is a restatement
     * of what it meant, not a guess — and it keeps a mixed-version deployment
     * from writing NULLs that every competitive query would then skip.
     */
    private static boolean eligibilityOf(GameResultReportRequest body) {
        if (body.eligible() != null) return body.eligible();
        boolean teamA = false;
        boolean teamB = false;
        for (GameResultReportRequest.PlayerDto p : body.players()) {
            if (Boolean.TRUE.equals(p.isBot())) continue;
            if ("A".equals(p.team())) teamA = true; else teamB = true;
        }
        return teamA && teamB;
    }

    /**
     * The reported kind, or the best the old wire shape could say. DEMO is
     * not derivable — an older server sent a fake person as a plain bot — so
     * an absent kind never produces one.
     */
    private static String kindOf(GameResultReportRequest.PlayerDto p) {
        if (p.kind() != null && !p.kind().isBlank()) return p.kind();
        if (Boolean.TRUE.equals(p.isBot())) return "BOT";
        return p.uid() == null || p.uid().isBlank() ? "GUEST" : "PLAYER";
    }

    /** Null/blank → null; otherwise trimmed to the column width. */
    private static String trimName(String raw) {
        if (raw == null) return null;
        String name = raw.trim();
        if (name.isEmpty()) return null;
        return name.length() <= 64 ? name : name.substring(0, 64);
    }

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
            // `kind` is the newer, more precise way to say the same thing;
            // when it is present it wins, so a reporter that stops sending
            // the legacy `isGuest` flag stays correct.
            boolean isGuest = "GUEST".equals(p.kind()) || (p.kind() == null && Boolean.TRUE.equals(p.isGuest()));
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
