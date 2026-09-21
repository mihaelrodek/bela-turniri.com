import { registerPlugin, type PluginListenerHandle } from "@capacitor/core"
import type { LiveActivityState } from "@bela/protocol"

/**
 * The app's own `BelaLiveActivity` plugin — an iOS Live Activity / Android
 * Live Update showing the running game on the lock screen.
 *
 * `registerPlugin` runs at module scope here, which is exactly why this file
 * is only ever reached through `nativeLiveActivity()` in `native.ts`: the
 * dynamic import makes it a lazy chunk of its own, so the web bundle never
 * carries the proxy. There is no npm package behind it — the native halves
 * live in the Android and iOS projects — hence a file instead of a
 * `import("@capacitor/…")`.
 *
 * Until the iOS widget target exists every call there rejects with
 * UNIMPLEMENTED; callers treat any rejection as "not available".
 */
export interface BelaLiveActivityPlugin {
    isAvailable(): Promise<{ available: boolean }>
    start(options: { state: LiveActivityState }): Promise<void>
    update(options: { state: LiveActivityState }): Promise<void>
    /**
     * `{ state }` — the game ended: leave the final score on the lock screen.
     * `{ roomId }` — the user just left: take the activity down NOW.
     *
     * `roomId` is what Android needs to cancel its per-room ongoing
     * notification (a `setOngoing(true)` notification is not user-dismissible,
     * so a stateless end that cancelled nothing left it stuck forever). iOS
     * reads only `state` and ends every activity it owns, so the extra key is
     * inert there — the contract stays one shape for both platforms.
     */
    end(options: { state?: LiveActivityState; roomId?: string }): Promise<void>
    /** iOS only: the per-activity APNs token the server pushes updates to. */
    addListener(
        eventName: "activityToken",
        listener: (event: { token: string }) => void,
    ): Promise<PluginListenerHandle>
    /** iOS only: the token that lets the server START an activity remotely. */
    addListener(
        eventName: "pushToStartToken",
        listener: (event: { token: string }) => void,
    ): Promise<PluginListenerHandle>
}

/** Default export on purpose: the loader reads `.default`, so the plugin's
 *  name appears only in this lazy chunk and never in the eager one. */
export default registerPlugin<BelaLiveActivityPlugin>("BelaLiveActivity")
