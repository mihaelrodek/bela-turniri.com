import UIKit
import Capacitor

/**
 * Scene entry point.
 *
 * IMPORTANT — do NOT build a window with a bare `CAPBridgeViewController()`
 * here. `Info.plist`'s scene manifest sets `UISceneStoryboardFile = Main`,
 * and `Base.lproj/Main.storyboard`'s initial view controller has
 * `customClass = AppBridgeViewController` — the ONLY place the two local
 * plugins (`GuestKeychainPlugin`, `BelaLiveActivityPlugin`) are registered on
 * the bridge. UIKit instantiates that storyboard for us and assigns the
 * result to `self.window` BEFORE `scene(_:willConnectTo:options:)` runs, so
 * replacing `window` here would silently throw the subclass away and leave
 * both plugins unregistered (Live Activity + Keychain dead, with no error).
 *
 * The `if window == nil` branch is a belt-and-braces fallback for the case
 * where the scene manifest ever loses `UISceneStoryboardFile`: it rebuilds
 * the window from the SAME storyboard, so the custom class is preserved
 * either way.
 */
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        if window == nil, let windowScene = scene as? UIWindowScene {
            let storyboard = UIStoryboard(name: "Main", bundle: nil)
            if let root = storyboard.instantiateInitialViewController() {
                let newWindow = UIWindow(windowScene: windowScene)
                newWindow.rootViewController = root
                window = newWindow
                newWindow.makeKeyAndVisible()
            }
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
