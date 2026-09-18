import Capacitor

/**
 * Capacitor 8 only auto-discovers plugins that ship as their own CocoaPods
 * pod / SPM package (declared in `capacitor.config.json`'s plugin list at
 * `cap sync` time). `GuestKeychainPlugin` lives directly in the App target
 * instead — it is one Swift file, private to this app, with nothing to
 * publish — so it needs to be registered by hand. Capacitor's documented
 * way to do that for a local plugin is exactly this: subclass
 * `CAPBridgeViewController`, override `capacitorDidLoad()` (called once the
 * bridge exists, before the web view starts loading), and call
 * `bridge?.registerPluginInstance(_:)`.
 *
 * `Base.lproj/Main.storyboard` is pointed at this subclass instead of
 * `CAPBridgeViewController` directly (its `customClass` attribute), so this
 * is the one and only place `GuestKeychainPlugin` is wired in — no
 * AppDelegate/SceneDelegate change needed.
 */
class AppBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(GuestKeychainPlugin())
        bridge?.registerPluginInstance(BelaLiveActivityPlugin())
    }
}
