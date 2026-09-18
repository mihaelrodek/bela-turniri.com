package com.belaturniri.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import androidx.core.net.toUri
import com.belaturniri.app.MainActivity
import com.belaturniri.app.R
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * "Nadolazeći turniri" home-screen widget (N5.3).
 *
 * Plain AppWidgetProvider + RemoteViews on purpose, not Jetpack Glance: this
 * app is a Capacitor/WebView shell with no Compose anywhere in it, and Glance
 * would drag the Compose compiler plugin and the Compose UI/runtime libraries
 * in for a single 4x2 "up to three rows of text" widget. RemoteViews covers
 * everything the design calls for (static rows, per-row tap targets, light/
 * dark colours) with zero extra build-time cost.
 *
 * This class never touches the network: [onUpdate] renders straight from the
 * SharedPreferences cache (via TournamentsRepository.loadCached) and only
 * schedules TournamentsWidgetWorker, which does the actual HTTP call on a
 * WorkManager background thread and then calls back into [updateWidgets].
 */
class UpcomingTournamentsWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        updateWidgets(context, appWidgetManager, appWidgetIds)
        TournamentsWidgetWorker.ensureScheduled(context)
        TournamentsWidgetWorker.enqueueImmediateRefresh(context)
    }

    override fun onEnabled(context: Context) {
        // First widget instance ever placed — belt-and-braces alongside onUpdate.
        TournamentsWidgetWorker.ensureScheduled(context)
        TournamentsWidgetWorker.enqueueImmediateRefresh(context)
    }

    override fun onDisabled(context: Context) {
        // Last widget instance removed — stop polling in the background.
        TournamentsWidgetWorker.cancel(context)
    }

    companion object {
        private const val TOURNAMENTS_LIST_URL = "https://bela-turniri.com/turniri"
        private const val TOURNAMENT_BASE_URL = "https://bela-turniri.com/turniri/"

        private val ROW_CONTAINER_IDS = intArrayOf(R.id.widget_row_1, R.id.widget_row_2, R.id.widget_row_3)
        private val ROW_NAME_IDS = intArrayOf(R.id.widget_row_1_name, R.id.widget_row_2_name, R.id.widget_row_3_name)
        private val ROW_META_IDS = intArrayOf(R.id.widget_row_1_meta, R.id.widget_row_2_meta, R.id.widget_row_3_meta)

        fun updateWidgets(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
            val tournaments = TournamentsRepository.loadCached(context)
            for (appWidgetId in appWidgetIds) {
                appWidgetManager.updateAppWidget(appWidgetId, buildRemoteViews(context, tournaments, appWidgetId))
            }
        }

        private fun buildRemoteViews(context: Context, tournaments: List<WidgetTournament>, appWidgetId: Int): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_upcoming_tournaments)
            views.setOnClickPendingIntent(R.id.widget_title, titlePendingIntent(context, appWidgetId))

            if (tournaments.isEmpty()) {
                views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
                for (containerId in ROW_CONTAINER_IDS) {
                    views.setViewVisibility(containerId, View.GONE)
                }
                return views
            }

            views.setViewVisibility(R.id.widget_empty, View.GONE)
            for (row in ROW_CONTAINER_IDS.indices) {
                val tournament = tournaments.getOrNull(row)
                if (tournament == null) {
                    views.setViewVisibility(ROW_CONTAINER_IDS[row], View.GONE)
                    continue
                }
                views.setViewVisibility(ROW_CONTAINER_IDS[row], View.VISIBLE)
                views.setTextViewText(ROW_NAME_IDS[row], tournament.name)
                views.setTextViewText(ROW_META_IDS[row], rowMeta(tournament))
                views.setOnClickPendingIntent(
                    ROW_CONTAINER_IDS[row],
                    rowPendingIntent(context, tournament, appWidgetId, row)
                )
            }
            return views
        }

        private fun rowMeta(tournament: WidgetTournament): String {
            val startText = formatStartAt(tournament.startAt)
            val location = tournament.location
            return when {
                startText != null && !location.isNullOrBlank() -> "$startText · $location"
                startText != null -> startText
                !location.isNullOrBlank() -> location
                else -> ""
            }
        }

        /** "dd.MM. HH:mm" in the device's default (i.e. current) time zone. */
        private fun formatStartAt(startAt: String?): String? {
            if (startAt.isNullOrBlank()) return null
            val parsed = parseIso(startAt) ?: return null
            val formatter = SimpleDateFormat("dd.MM. HH:mm", Locale.getDefault())
            formatter.timeZone = TimeZone.getDefault()
            return formatter.format(parsed)
        }

        /**
         * The backend sends an offset-qualified ISO-8601 timestamp (e.g.
         * "2026-10-04T18:00:00+02:00"), occasionally trailing "Z" or with
         * fractional seconds. A couple of SimpleDateFormat patterns cover all
         * of those without pulling in java.time desugaring for one field.
         */
        private fun parseIso(value: String): Date? {
            val patterns = arrayOf(
                "yyyy-MM-dd'T'HH:mm:ssXXX",
                "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
                "yyyy-MM-dd'T'HH:mm:ss'Z'",
                "yyyy-MM-dd'T'HH:mm:ss"
            )
            for (pattern in patterns) {
                try {
                    val sdf = SimpleDateFormat(pattern, Locale.US)
                    if (pattern.endsWith("'Z'")) sdf.timeZone = TimeZone.getTimeZone("UTC")
                    return sdf.parse(value)
                } catch (e: Exception) {
                    // try the next pattern
                }
            }
            return null
        }

        private fun titlePendingIntent(context: Context, appWidgetId: Int): PendingIntent {
            val intent = Intent(Intent.ACTION_VIEW, TOURNAMENTS_LIST_URL.toUri(), context, MainActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            return PendingIntent.getActivity(
                context,
                appWidgetId * 10,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
        }

        private fun rowPendingIntent(context: Context, tournament: WidgetTournament, appWidgetId: Int, row: Int): PendingIntent {
            val slugOrUuid = tournament.slug ?: tournament.uuid
            val intent = Intent(Intent.ACTION_VIEW, (TOURNAMENT_BASE_URL + slugOrUuid).toUri(), context, MainActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            // appWidgetId*10 + (row+1): distinct per widget instance AND per
            // row, and never collides with the title's appWidgetId*10 code.
            return PendingIntent.getActivity(
                context,
                appWidgetId * 10 + row + 1,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
        }
    }
}
