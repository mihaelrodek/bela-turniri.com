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

    @PluginMethod
    fun end(call: PluginCall) {
        if (!notificationsAllowed()) {
            call.resolve()
            return
        }
        val state = LiveGameState.fromJson(call.getObject("state"))
        LiveGameNotification.end(context, state)
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
        LiveGameNotification.render(context, state)
        call.resolve()
    }

    private fun notificationsAllowed(): Boolean {
        return NotificationManagerCompat.from(context).areNotificationsEnabled()
    }
}
