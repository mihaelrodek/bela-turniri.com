package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.repository.GameReplayRepository;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.time.OffsetDateTime;

/**
 * Retention for "zapisi partija" (game/README.md §8.8).
 *
 * <p>A replay is RESEARCH MATERIAL with a shelf life. Its whole purpose is
 * "how did the bot play, and what should it have done?", and a game played
 * against a bot version that no longer exists answers that about nobody. Half
 * a year is comfortably more than a tuning cycle and keeps the table's size a
 * known quantity instead of an open-ended one.
 *
 * <p>Only the replays go. {@code game_results} and {@code game_result_players}
 * — the statistics, the profile cards, the karma window — are permanent and
 * are never touched here. Deleting a replay loses the cards of an old game
 * and nothing else.
 *
 * <p>Age is measured by the GAME's {@code played_at}, not by the row's
 * {@code created_at}: "keep the last 180 days of games" is what the number
 * means, and the two differ by however long the report took to arrive.
 *
 * <h2>Scheduling</h2>
 * 04:20 daily, twenty minutes after {@link ContactMessageRetentionJob} so the
 * two never contend, and gated by the same standard
 * {@code quarkus.scheduler.enabled} property (the {@code %test} profile sets
 * it false, so it does not fire during a {@code @QuarkusTest}).
 * {@link #sweep()} is public and plain, so a test calls the real thing.
 *
 * <p>Single-node assumption like everything else in this deployment: two
 * instances would both run it, which is harmless — the statement is an
 * idempotent {@code where played_at < …} sweep.
 */
@ApplicationScoped
public class GameReplayRetentionJob {

    private static final Logger LOG = Logger.getLogger(GameReplayRetentionJob.class);

    /**
     * How many days of replays to keep. Configurable because the right number
     * depends on how actively the bot is being worked on; see
     * {@code application.properties}.
     */
    @ConfigProperty(name = "game.replays.retention-days", defaultValue = "180")
    int retentionDays;

    @Inject GameReplayRepository replayRepo;

    /** 04:20 every day. */
    @Scheduled(cron = "0 20 4 * * ?")
    void scheduledSweep() {
        sweep();
    }

    /**
     * Delete replays of games older than the retention window.
     *
     * <p>A non-positive setting means "keep forever" and does nothing — the
     * safe reading of a misconfigured number, since the alternative
     * interpretation would delete the entire archive.
     *
     * @return number of replay rows deleted
     */
    @Transactional
    public int sweep() {
        if (retentionDays <= 0) return 0;
        OffsetDateTime cutoff = OffsetDateTime.now().minusDays(retentionDays);
        int deleted = replayRepo.deleteOlderThan(cutoff);
        if (deleted > 0) {
            LOG.infof("Game replay retention: %d replay(s) deleted (games older than %dd).",
                    deleted, retentionDays);
        }
        return deleted;
    }
}
