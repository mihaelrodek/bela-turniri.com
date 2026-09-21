package com.belaturniri.app

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder

/**
 * Takes the ongoing "partija uživo" notification down when the user swipes the
 * app off the recents screen.
 *
 * Why a Service at all: an Activity receives no callback for a task swipe
 * (onDestroy is not guaranteed and does not distinguish a swipe from a
 * rotation), so a `setOngoing(true)` notification posted by a process that is
 * then killed would sit in the shade undismissable — the user cannot swipe an
 * ongoing notification away, and no code would ever run to cancel it. A plain
 * started Service DOES get [onTaskRemoved], which is exactly the signal.
 *
 * This is deliberately NOT a foreground service: it holds no wake lock, does
 * no work, and exists only for that one callback. It is therefore best
 * effort — the system may reclaim an idle started service, in which case
 * [onTaskRemoved] never fires and the backstop takes over:
 * MainActivity.onCreate calls [LiveGameNotification.cancelAll] on every cold
 * start, so a stale notification cannot outlive the next launch either.
 *
 * Started only from the foreground (the Capacitor plugin path,
 * LiveGameNotification.render(fromForeground = true)). Starting a background
 * service from a killed-app FCM delivery would throw on API 26+, which is why
 * BelaMessagingService never arms it.
 */
class LiveGameTaskWatcherService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Nothing to do while running; do not resurrect after a kill.
        return START_NOT_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        LiveGameNotification.cancelAll(applicationContext)
        stopSelf()
        super.onTaskRemoved(rootIntent)
    }

    companion object {
        /** Idempotent: startService on an already-running service just calls onStartCommand again. */
        fun arm(context: Context) {
            try {
                context.applicationContext.startService(
                    Intent(context.applicationContext, LiveGameTaskWatcherService::class.java)
                )
            } catch (e: Exception) {
                // Background-start restrictions, a dying process, an OEM
                // policy — all best effort. The MainActivity sweep still
                // guarantees no notification outlives the next launch.
            }
        }

        fun disarm(context: Context) {
            try {
                context.applicationContext.stopService(
                    Intent(context.applicationContext, LiveGameTaskWatcherService::class.java)
                )
            } catch (e: Exception) {
                // Never let teardown of a best-effort helper break a cancel.
            }
        }
    }
}
