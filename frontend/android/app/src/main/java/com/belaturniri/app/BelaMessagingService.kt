package com.belaturniri.app

import com.google.firebase.messaging.RemoteMessage
import io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService
import org.json.JSONObject

/**
 * N4.4 — background/killed-app half of the live game update contract.
 *
 * @capacitor-firebase/messaging owns the app's FirebaseMessagingService
 * (io.capawesome...MessagingService) and Android only ever delivers a
 * com.google.firebase.MESSAGING_EVENT intent to a single declared service, so
 * a second, independent FirebaseMessagingService cannot be registered
 * alongside it. That plugin's MessagingService is a plain, non-final public
 * class whose onMessageReceived()/onNewToken() are not final (see
 * node_modules/@capacitor-firebase/messaging/android/src/main/java/io/
 * capawesome/capacitorjs/plugins/firebase/messaging/MessagingService.java) —
 * i.e. it exposes no listener/hook API, but subclassing is safe and is the
 * extension point the library allows. This subclass is registered in
 * AndroidManifest.xml in place of the plugin's own <service> entry (removed
 * there via tools:node="remove", since the merger keys <service> elements by
 * android:name and this subclass necessarily has a different one), still
 * calls super.onMessageReceived() for every message so normal JS-side
 * push/token handling behaves exactly as before, and only additionally
 * intercepts the "bela_live_update" data messages this feature cares about.
 */
class BelaMessagingService : MessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val data = remoteMessage.data
        if (data["type"] != "bela_live_update") return

        val state = data["state"]?.let { stateJson ->
            try {
                LiveGameState.fromJson(JSONObject(stateJson))
            } catch (e: Exception) {
                null
            }
        }

        if (data["event"] == "end") {
            // A remote "end" may legitimately carry no state (the server just
            // wants the ongoing notification gone). end() cancels by roomId in
            // that case rather than returning and leaving it stuck.
            LiveGameNotification.end(applicationContext, state, data["roomId"])
            return
        }

        // A non-end push with no usable state is simply nothing to draw.
        // fromForeground stays false: this can arrive with the app killed,
        // and starting a background service there throws on API 26+.
        LiveGameNotification.render(applicationContext, state ?: return)
    }
}
