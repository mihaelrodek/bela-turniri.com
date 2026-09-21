package com.belaturniri.app

import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * N4.4 — Android side of the cross-platform Live Activity contract.
 *
 * The iOS-only events ("activityToken" / "pushToStartToken") are never
 * emitted here; Android has no equivalent handshake, it just renders/updates
 * a stable ongoing notification per room via LiveGameNotification, which is
 * also the renderer BelaMessagingService uses for background FCM pushes so
 * both paths draw an identical notification.
 */
@CapacitorPlugin(name = "BelaLiveActivity")
class BelaLiveActivityPlugin : Plugin() {

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val result = JSObject()
        result.put("available", notificationsAllowed())
        call.resolve(result)
    }

    @PluginMethod
    fun start(call: PluginCall) {
        applyState(call)
    }

    @PluginMethod
    fun update(call: PluginCall) {
        applyState(call)
    }

    /**
     * `end({ state })` posts the terminal score card; `end({ roomId })` (no
     * state — leaving the room, standing up, unmounting the table) CANCELS
     * the ongoing notification.
     *
     * The old code read only `state`, so a stateless end resolved to
     * `LiveGameNotification.end(context, null)`, which returned immediately
     * and left a `setOngoing(true)` notification the user could not dismiss
     * sitting in the shade forever. Hence the `roomId` fallback.
     *
     * `roomId` is additive and keeps the iOS contract intact: the Swift
     * plugin reads `call.options["state"]` only and ends every activity it
     * owns regardless, so the extra key is simply ignored there. When JS
     * sends neither, we fall back to sweeping the live channel — better an
     * over-eager cancel than a permanent notification.
     *
     * NOTE: unlike start/update this does NOT bail out when notifications are
     * disabled. Permission can be revoked while a notification is already
     * posted, and that is precisely the case where the cancel must still run.
     */
    @PluginMethod
    fun end(call: PluginCall) {
        val state = LiveGameState.fromJson(call.getObject("state"))
        val roomId = call.getString("roomId")
        LiveGameNotification.end(context, state, roomId)
        call.resolve()
    }

    private fun applyState(call: PluginCall) {
        if (!notificationsAllowed()) {
            // Contract: start/update resolve without throwing when permission
            // isn't granted rather than rejecting the call.
            call.resolve()
            return
        }
        val state = LiveGameState.fromJson(call.getObject("state"))
        if (state == null) {
            call.reject("state is required")
            return
        }
        // fromForeground: a plugin call means the Activity is alive, so the
        // task-swipe watcher service may legally be started (see
        // LiveGameTaskWatcherService).
        LiveGameNotification.render(context, state, fromForeground = true)
        call.resolve()
    }

    private fun notificationsAllowed(): Boolean {
        return NotificationManagerCompat.from(context).areNotificationsEnabled()
    }
}
