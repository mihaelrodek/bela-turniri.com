package com.belaturniri.app

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * Single renderer shared by BelaLiveActivityPlugin (foreground JS calls) and
 * BelaMessagingService (background/killed FCM data pushes), so both paths
 * draw the identical notification for a given ContentState. See N4.4.
 *
 * Everything goes through NotificationCompat: androidx.core 1.17.0 (see
 * variables.gradle / androidxCoreVersion) ships both
 * `NotificationCompat.ProgressStyle` and
 * `NotificationCompat.Builder.setRequestPromotedOngoing(boolean)`, so the
 * Android 16 "Live Update" promotion no longer needs the reflective
 * `Notification.Builder#setRequestPromotedOngoing` hack that used to live
 * here — the compat layer is a no-op on older platforms by construction.
 *
 * The promotion eligibility rules this build satisfies (see
 * developer.android.com/develop/ui/views/notifications/live-update):
 *   - android.permission.POST_PROMOTED_NOTIFICATIONS declared in the manifest
 *   - setRequestPromotedOngoing(true)
 *   - setOngoing(true)
 *   - a contentTitle
 *   - a small icon (ic_stat_bela — white-on-transparent, see the drawable)
 *   - ProgressStyle (one of the promotable styles)
 *   - channel importance DEFAULT, i.e. not IMPORTANCE_MIN
 *   - no custom RemoteViews, not a group summary, not setColorized(true)
 */
object LiveGameNotification {

    const val CHANNEL_ID = "bela_live"
    private const val END_TIMEOUT_MS = 15L * 60L * 1000L

    /** Stable per-room id so a new game replaces rather than stacks. */
    fun notificationIdFor(roomId: String): Int = ("bela_live_$roomId").hashCode()

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return

        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.live_channel_name),
            // Must stay >= IMPORTANCE_DEFAULT: IMPORTANCE_MIN disqualifies the
            // notification from Android 16 Live Update promotion outright.
            NotificationManager.IMPORTANCE_DEFAULT
        )
        channel.setSound(null, null)
        channel.enableVibration(false)
        channel.vibrationPattern = null
        // The running score is not a secret, but it is the sort of thing a
        // user hiding sensitive content on the lock screen expects to be
        // hidden. VISIBILITY_PUBLIC + an explicit public version means the
        // lock screen shows "Partija u tijeku" with no score when the device
        // is locked and sensitive content is hidden, and the full card once
        // unlocked — rather than the system's opaque "Content hidden" row.
        channel.lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        manager.createNotificationChannel(channel)
    }

    /**
     * Posts/updates the ongoing "game in progress" notification.
     *
     * @param fromForeground true only when the call originates from the
     *   Capacitor plugin (i.e. the Activity is alive). It gates starting
     *   [LiveGameTaskWatcherService], which may not be started from a
     *   background FCM delivery on API 26+.
     *
     * @SuppressLint("MissingPermission"): lint's flow analysis for
     * POST_NOTIFICATIONS can't see through [notificationsAllowed], which is
     * the real (and correct, per the N4.4 contract) guard — start/update must
     * resolve silently rather than throw when the permission isn't granted.
     */
    @SuppressLint("MissingPermission")
    fun render(context: Context, state: LiveGameState, fromForeground: Boolean = false) {
        // Defensive: an update() delivered after the game actually ended should
        // still resolve to the terminal card rather than leave a stale ongoing
        // notification around forever.
        if (state.phase == LiveGameState.PHASE_GAME_OVER) {
            end(context, state)
            return
        }

        if (!notificationsAllowed(context)) return
        ensureChannel(context)

        val id = notificationIdFor(state.roomId)
        val contentIntent = pendingIntentFor(context, state.roomId, id)

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_bela)
            .setColor(ContextCompat.getColor(context, R.color.notification_accent))
            .setContentTitle(context.getString(R.string.live_notif_title, state.scoreUs, state.scoreThem))
            .setContentText(turnText(context, state))
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPublicVersion(publicVersion(context, contentIntent))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(contentIntent)

        if (Build.VERSION.SDK_INT >= 36) {
            val target = state.target.coerceAtLeast(1)
            builder
                .setStyle(
                    NotificationCompat.ProgressStyle()
                        .addProgressSegment(NotificationCompat.ProgressStyle.Segment(target))
                        .setProgress(state.scoreUs.coerceIn(0, target))
                )
                // What the collapsed status-bar chip shows when the Live
                // Update is promoted — it has room for a few characters, so:
                // the bare score. Keep it short or the system truncates it.
                .setShortCriticalText("${state.scoreUs}:${state.scoreThem}")
                .setRequestPromotedOngoing(true)
        } else {
            // Pre-16 there is no promoted chip; the countdown to the turn
            // deadline is the useful thing to show in the collapsed row.
            val deadline = state.turnDeadline
            if (deadline != null && deadline > System.currentTimeMillis()) {
                builder
                    .setUsesChronometer(true)
                    .setChronometerCountDown(true)
                    .setWhen(deadline)
            }
        }

        NotificationManagerCompat.from(context).notify(id, builder.build())
        if (fromForeground) LiveGameTaskWatcherService.arm(context)
    }

    /**
     * Posts the terminal ("Pobjeda!"/"Poraz") notification and schedules its
     * own cancellation. See [render] for why MissingPermission is suppressed.
     *
     * A null [state] is NOT a no-op: it is how "the user left the room / the
     * table unmounted" arrives, and it must CANCEL the ongoing notification.
     * That path needs the room id, which the caller supplies via [roomId]
     * (see [cancel] and BelaLiveActivityPlugin.end).
     */
    @SuppressLint("MissingPermission")
    fun end(context: Context, state: LiveGameState?, roomId: String? = null) {
        if (state == null) {
            // No final score to show — just take the ongoing notification down.
            if (roomId != null && roomId.isNotBlank()) cancel(context, roomId) else cancelAll(context)
            return
        }
        LiveGameTaskWatcherService.disarm(context)
        if (!notificationsAllowed(context)) return
        ensureChannel(context)

        val id = notificationIdFor(state.roomId)
        val contentIntent = pendingIntentFor(context, state.roomId, id)
        val resultText = when (state.winner) {
            "us" -> context.getString(R.string.live_notif_win)
            "them" -> context.getString(R.string.live_notif_lose)
            else -> null
        }

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_bela)
            .setColor(ContextCompat.getColor(context, R.color.notification_accent))
            .setContentTitle(context.getString(R.string.live_notif_title, state.scoreUs, state.scoreThem))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPublicVersion(publicVersion(context, contentIntent))
            .setOngoing(false)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(contentIntent)
            .setTimeoutAfter(END_TIMEOUT_MS)
        if (resultText != null) {
            builder.setContentText(resultText)
        }

        NotificationManagerCompat.from(context).notify(id, builder.build())
    }

    fun cancel(context: Context, roomId: String) {
        LiveGameTaskWatcherService.disarm(context)
        NotificationManagerCompat.from(context).cancel(notificationIdFor(roomId))
    }

    /**
     * Cancels every notification this object has ever posted, identified by
     * the channel rather than by id — the id is a hash of a room id we may no
     * longer have (process died mid-game, JS ended without one, the app was
     * swiped away).
     *
     * Called from MainActivity.onCreate so a cold start can never find a
     * setOngoing(true) notification from a previous process still sitting in
     * the shade: that notification is not dismissible by the user, and
     * nothing else would ever take it down. If a game really is still in
     * progress, useLiveActivity re-posts within a second of the table
     * mounting, which the stable per-room id makes a silent replace.
     *
     * getActiveNotifications() only ever returns THIS app's notifications and
     * exists from API 23 (minSdk is 24), so the sweep can never touch another
     * app's shade entry. Notification.getChannelId() is API 26 only, hence the
     * flag-based fallback below: pre-O this app posts no other ONGOING
     * notification, so "ongoing" identifies ours exactly as well.
     */
    fun cancelAll(context: Context) {
        LiveGameTaskWatcherService.disarm(context)
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
        val compat = NotificationManagerCompat.from(context)
        val isOurs: (android.app.Notification) -> Boolean =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                { it.channelId == CHANNEL_ID }
            } else {
                { (it.flags and android.app.Notification.FLAG_ONGOING_EVENT) != 0 }
            }
        try {
            manager.activeNotifications
                .filter { isOurs(it.notification) }
                .forEach { compat.cancel(it.tag, it.id) }
        } catch (e: Exception) {
            // Some OEM builds throw out of getActiveNotifications(); a failed
            // sweep must never take the app down on launch.
        }
    }

    /**
     * Lock-screen stand-in used when the user hides sensitive notification
     * content. Same icon and tap target, no score.
     */
    private fun publicVersion(context: Context, contentIntent: PendingIntent) =
        NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_bela)
            .setColor(ContextCompat.getColor(context, R.color.notification_accent))
            .setContentTitle(context.getString(R.string.live_notif_public_title))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(contentIntent)
            .build()

    private fun turnText(context: Context, state: LiveGameState): String {
        return if (state.yourTurn) {
            context.getString(R.string.live_notif_text_your_turn)
        } else {
            context.getString(R.string.live_notif_text_other_turn, state.turnSeat ?: -1)
        }
    }

    private fun pendingIntentFor(context: Context, roomId: String, requestCode: Int): PendingIntent {
        // The host comes from a string resource, never a Kotlin constant:
        // create-games-native.sh rewrites hosts in *.xml, so the games build
        // deep-links into https://bela.games/igra/… and NativeShell.tsx's
        // isGamesHost() check accepts the tap. See R.string.live_deep_link_base.
        val base = context.getString(R.string.live_deep_link_base)
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(base + roomId), context, MainActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    private fun notificationsAllowed(context: Context): Boolean {
        return NotificationManagerCompat.from(context).areNotificationsEnabled()
    }
}
