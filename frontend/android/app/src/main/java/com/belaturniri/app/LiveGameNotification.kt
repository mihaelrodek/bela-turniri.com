package com.belaturniri.app

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * Single renderer shared by BelaLiveActivityPlugin (foreground JS calls) and
 * BelaMessagingService (background/killed FCM data pushes), so both paths
 * draw the identical notification for a given ContentState. See N4.4.
 */
object LiveGameNotification {

    const val CHANNEL_ID = "bela_live"
    private const val END_TIMEOUT_MS = 15L * 60L * 1000L
    private const val DEEP_LINK_BASE = "https://bela-turniri.com/igra/"

    /** Stable per-room id so a new game replaces rather than stacks. */
    fun notificationIdFor(roomId: String): Int = ("bela_live_$roomId").hashCode()

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return

        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.live_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT
        )
        channel.setSound(null, null)
        channel.enableVibration(false)
        channel.vibrationPattern = null
        manager.createNotificationChannel(channel)
    }

    /**
     * Posts/updates the ongoing "game in progress" notification.
     *
     * @SuppressLint("MissingPermission"): lint's flow analysis for
     * POST_NOTIFICATIONS can't see through [notificationsAllowed], which is
     * the real (and correct, per the N4.4 contract) guard — start/update must
     * resolve silently rather than throw when the permission isn't granted.
     */
    @SuppressLint("MissingPermission")
    fun render(context: Context, state: LiveGameState) {
        // Defensive: an update() delivered after the game actually ended should
        // still resolve to the terminal card rather than leave a stale ongoing
        // notification around forever.
        if (state.phase == LiveGameState.PHASE_GAME_OVER) {
            end(context, state)
            return
        }

        if (!notificationsAllowed(context)) return
        ensureChannel(context)

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val id = notificationIdFor(state.roomId)
        val contentIntent = pendingIntentFor(context, state.roomId, id)

        if (Build.VERSION.SDK_INT >= 36) {
            manager.notify(id, buildProgressStyleNotification(context, state, contentIntent))
        } else {
            NotificationManagerCompat.from(context).notify(id, buildCompatOngoingNotification(context, state, contentIntent))
        }
    }

    /**
     * Posts the terminal ("Pobjeda!"/"Poraz") notification and schedules its
     * own cancellation. See [render] for why MissingPermission is suppressed.
     */
    @SuppressLint("MissingPermission")
    fun end(context: Context, state: LiveGameState?) {
        if (state == null || !notificationsAllowed(context)) return
        ensureChannel(context)

        val id = notificationIdFor(state.roomId)
        val contentIntent = pendingIntentFor(context, state.roomId, id)
        val resultText = when (state.winner) {
            "us" -> context.getString(R.string.live_notif_win)
            "them" -> context.getString(R.string.live_notif_lose)
            else -> null
        }

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(smallIcon(context))
            .setContentTitle(context.getString(R.string.live_notif_title, state.scoreUs, state.scoreThem))
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
        NotificationManagerCompat.from(context).cancel(notificationIdFor(roomId))
    }

    // ---- API 36+: Notification.ProgressStyle / Android 16 Live Updates ----

    @RequiresApi(36)
    private fun buildProgressStyleNotification(
        context: Context,
        state: LiveGameState,
        contentIntent: PendingIntent
    ): Notification {
        val target = state.target.coerceAtLeast(1)
        val progress = state.scoreUs.coerceIn(0, target)

        val progressStyle = Notification.ProgressStyle()
            .addProgressSegment(Notification.ProgressStyle.Segment(target))
            .setProgress(progress)

        val builder = Notification.Builder(context, CHANNEL_ID)
            .setSmallIcon(smallIcon(context))
            .setContentTitle(context.getString(R.string.live_notif_title, state.scoreUs, state.scoreThem))
            .setContentText(turnText(context, state))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(contentIntent)
            .setStyle(progressStyle)

        // setRequestPromotedOngoing() (Android 16 "Live Updates" promotion) ships
        // as a minor/extension bump on top of API 36 and isn't present in every
        // API-36 SDK snapshot (it's absent from the android-36 platform this repo
        // compiles against, only present in android-36.1+). Reflection keeps this
        // compiling against the pinned compileSdk while still activating the
        // promoted chip on devices/OS builds that actually expose the method.
        try {
            val method = Notification.Builder::class.java.getMethod(
                "setRequestPromotedOngoing",
                Boolean::class.javaPrimitiveType
            )
            method.invoke(builder, true)
        } catch (e: NoSuchMethodException) {
            // Not available on this OS/SDK combination — the plain ongoing
            // ProgressStyle notification below still renders correctly.
        } catch (e: Exception) {
            // Never let a reflective best-effort call break notification posting.
        }

        return builder.build()
    }

    // ---- Below API 36: plain ongoing NotificationCompat ----

    private fun buildCompatOngoingNotification(
        context: Context,
        state: LiveGameState,
        contentIntent: PendingIntent
    ): android.app.Notification {
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(smallIcon(context))
            .setContentTitle(context.getString(R.string.live_notif_title, state.scoreUs, state.scoreThem))
            .setContentText(turnText(context, state))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(contentIntent)

        val deadline = state.turnDeadline
        if (deadline != null && deadline > System.currentTimeMillis()) {
            builder
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setWhen(deadline)
        }

        return builder.build()
    }

    private fun turnText(context: Context, state: LiveGameState): String {
        return if (state.yourTurn) {
            context.getString(R.string.live_notif_text_your_turn)
        } else {
            context.getString(R.string.live_notif_text_other_turn, state.turnSeat ?: -1)
        }
    }

    private fun pendingIntentFor(context: Context, roomId: String, requestCode: Int): PendingIntent {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(DEEP_LINK_BASE + roomId), context, MainActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    private fun smallIcon(context: Context): Int {
        val appIcon = context.applicationInfo.icon
        return if (appIcon != 0) appIcon else R.mipmap.ic_launcher
    }

    private fun notificationsAllowed(context: Context): Boolean {
        return NotificationManagerCompat.from(context).areNotificationsEnabled()
    }
}
