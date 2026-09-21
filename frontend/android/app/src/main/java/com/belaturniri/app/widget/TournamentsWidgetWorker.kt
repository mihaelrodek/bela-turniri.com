package com.belaturniri.app.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Background refresh for the "Nadolazeći turniri" widget (N5.3). Runs on a
 * WorkManager background thread — never inside AppWidgetProvider.onUpdate,
 * which executes on the main thread. On success the fresh JSON is cached
 * (SharedPreferences, via TournamentsRepository) and every placed widget
 * instance is redrawn; on failure/no-network the widget keeps showing
 * whatever was last cached and the work is retried with backoff.
 */
class TournamentsWidgetWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    override fun doWork(): Result {
        val raw = TournamentsRepository.fetchUpcomingRaw() ?: return retryOrGiveUp()
        try {
            // Validate before caching so a malformed response never clobbers
            // a good previous cache.
            TournamentsRepository.parseTournaments(raw)
        } catch (e: Exception) {
            return retryOrGiveUp()
        }
        TournamentsRepository.saveCache(applicationContext, raw)
        refreshAllWidgets(applicationContext)
        return Result.success()
    }

    /**
     * Result.retry() unconditionally is a stuck-job generator: the one-shot
     * work is enqueued under a unique name with a KEEP policy, so as long as
     * it keeps retrying (a permanently unreachable API, a server returning
     * something unparseable) it stays in the queue and every later
     * enqueueUniqueWork for that name is DROPPED — the widget then never
     * refreshes again, with backoff pushing the retries hours apart.
     *
     * So: retry a few times, then succeed. The widget keeps showing the last
     * good cache either way, and the hourly periodic work is the real safety
     * net — it re-runs regardless of what this attempt concluded.
     */
    private fun retryOrGiveUp(): Result =
        if (runAttemptCount < MAX_RETRIES) Result.retry() else Result.success()

    companion object {
        private const val MAX_RETRIES = 3
        private const val PERIODIC_WORK_NAME = "bela_upcoming_tournaments_refresh"
        private const val IMMEDIATE_WORK_NAME = "bela_upcoming_tournaments_refresh_once"
        private val CONSTRAINTS = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        /** Idempotent — safe to call from every onUpdate/onEnabled. */
        fun ensureScheduled(context: Context) {
            val request = PeriodicWorkRequestBuilder<TournamentsWidgetWorker>(1, TimeUnit.HOURS)
                .setConstraints(CONSTRAINTS)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(PERIODIC_WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
        }

        /**
         * One-shot kick so a freshly placed widget doesn't wait up to an hour
         * for real data.
         *
         * REPLACE, not KEEP: KEEP means "if anything is already enqueued or
         * running under this name, drop the new request". A single attempt
         * stuck in backoff (or, worse, left ENQUEUED by a process death) then
         * swallows every subsequent kick — the user places a second widget,
         * or reboots, and nothing happens. The work is idempotent (fetch,
         * validate, cache, redraw), so replacing the pending attempt with a
         * fresh one is always the behaviour the caller actually wants.
         */
        fun enqueueImmediateRefresh(context: Context) {
            val request = OneTimeWorkRequestBuilder<TournamentsWidgetWorker>()
                .setConstraints(CONSTRAINTS)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork(IMMEDIATE_WORK_NAME, ExistingWorkPolicy.REPLACE, request)
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(PERIODIC_WORK_NAME)
        }

        fun refreshAllWidgets(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, UpcomingTournamentsWidgetProvider::class.java))
            if (ids.isNotEmpty()) {
                UpcomingTournamentsWidgetProvider.updateWidgets(context, manager, ids)
            }
        }
    }
}
