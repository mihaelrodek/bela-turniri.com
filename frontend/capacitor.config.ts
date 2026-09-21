import type { CapacitorConfig } from "@capacitor/cli"

/**
 * Capacitor shell config — for BOTH native apps.
 *
 * `webDir` is the very same `dist/` the website ships — the native apps are not
 * a second codebase, they bundle the identical Vite output. Native builds go
 * through `npm run build:native`, which runs the build in Vite's `native` mode
 * (so `.env.native` points the API and WebSocket at the real host instead of
 * the relative `/api` a browser gets from Caddy) and then `cap sync`.
 *
 * `server.url` is deliberately NOT set: the assets must be served from the
 * app bundle so an installed app works offline, exactly like the PWA does.
 *
 * ── Two apps, one config ─────────────────────────────────────────────────
 * The same dist/ feeds two store listings (see src/site.ts):
 *
 *   CAP_APP unset / "full"   com.belaturniri.app  "Bela Turniri"  ios/, android/
 *   CAP_APP=games            games.bela.app       "Bela Games"    ios-games/, android-games/
 *
 * Capacitor reads this file in Node, so `process.env` is the only switch
 * available here — Vite's `import.meta.env` does not exist at CLI time. The
 * `ios.path` / `android.path` options (see
 * node_modules/@capacitor/cli/dist/declarations.d.ts) point each app at its
 * OWN native project directory, which is what makes `cap sync` for one app
 * physically incapable of touching the other's Xcode/Gradle project. They are
 * resolved relative to this config file.
 *
 * `full` names its paths explicitly even though "ios"/"android" are already
 * the CLI defaults — being explicit is how the two rows stay readable as a
 * pair, and it changes nothing about today's behaviour.
 *
 * Everything BELOW the `ios`/`android` blocks (splash, status bar, auth
 * providers, keyboard) is deliberately shared: both apps are the same WebView
 * running the same React tree, and a difference here would be a bug, not a
 * feature.
 */
type AppKey = "full" | "games"

const APPS: Record<AppKey, { appId: string; appName: string; iosPath: string; androidPath: string }> = {
    full: {
        appId: "com.belaturniri.app",
        appName: "Bela Turniri",
        iosPath: "ios",
        androidPath: "android"
    },
    games: {
        // Reverse-DNS of the bela.games domain the games app is the shell for.
        // Must match: ios-games/App/App.xcodeproj PRODUCT_BUNDLE_IDENTIFIER,
        // android-games applicationId + namespace + the Java package dir, the
        // Firebase Console apps, the Apple App ID, and ops/well-known-games/.
        appId: "games.bela.app",
        // Home-screen / launcher label. Kept short (11 chars) so neither iOS
        // nor Android truncates it. The BRAND in the UI is "Bela Online"
        // (src/site.ts `siteName`); this is what the OS prints under the icon.
        appName: "Bela Online",
        iosPath: "ios-games",
        androidPath: "android-games"
    }
}

const APP: AppKey = process.env.CAP_APP === "games" ? "games" : "full"
const target = APPS[APP]

const config: CapacitorConfig = {
    appId: target.appId,
    appName: target.appName,
    webDir: "dist",
    ios: {
        // FULL-BLEED WEBVIEW, exactly like Android's enforced edge-to-edge.
        //
        // `ios.contentInset` is nothing but
        // `WKWebView.scrollView.contentInsetAdjustmentBehavior` (see
        // node_modules/@capacitor/ios .../CAPInstanceDescriptor.swift and
        // CAPBridgeViewController.prepareWebView). At `automatic`/`always`
        // UIScrollView adds the window's safe-area insets to the scroll
        // content, so the document starts BELOW the notch/Dynamic Island —
        // while `env(safe-area-inset-*)` keeps reporting the real device
        // inset, because WebKit derives it from the view's safeAreaInsets and
        // not from the scroll view's adjustment. Any page that pads itself
        // with `env()` (all of ours — `--safe-top` and friends in index.html)
        // is therefore inset TWICE on iOS: that is the ~70 px of dead space
        // people kept reporting at the top and above the hand.
        //
        // `never` is also Capacitor's own default and the only value under
        // which ONE stylesheet is correct on both platforms: the WebView
        // covers the whole window, the app paints the notch/home-indicator
        // strips itself (StatusBarSafeArea.tsx, AppBackground.tsx), and every
        // edge-anchored element clears them with `var(--safe-*)`.
        //
        // The risk is the mirror image of the win: anything fixed/sticky that
        // FORGETS `var(--safe-*)` now sits under a system bar instead of
        // being saved by the native inset. That is why the audit in
        // game/DESIGN.md §"Sigurne zone i tipkovnica u nativnoj aplikaciji"
        // is part of this change and not an afterthought.
        contentInset: "never",
        path: target.iosPath
    },
    android: {
        allowMixedContent: false,
        path: target.androidPath
    },
    plugins: {
        // Hidden manually from JS once React has painted (see src/platform/NativeShell.tsx,
        // NativeShell), not the default auto-hide — auto-hide can beat
        // hydration and flash an empty WebView between the native splash
        // and the first real frame.
        SplashScreen: {
            launchAutoHide: false
        },
        // ON — the status bar draws OVER the WebView on both platforms.
        //
        // It used to be `false`, which on Android 15+/targetSdk 36 is simply
        // ignored (the plugin's own README: "the overlaysWebView and
        // backgroundColor configuration options no longer have any effect"),
        // and on iOS did two unwanted things at once
        // (node_modules/@capacitor/status-bar/.../StatusBar.swift,
        // `setOverlaysWebView` + `resizeWebView`): it shrank the WKWebView
        // frame by the status-bar height AND parked an opaque `backgroundView`
        // in the gap, coloured from `StatusBarConfig.backgroundColor` whose
        // default is `.black`. That is the black band across the top of a
        // light-mode iPhone. Since the frame shrank natively, the app's own
        // `var(--safe-top)` padding was then a third inset on top of the other
        // two.
        //
        // With `true` (the plugin default) iOS behaves like Android 16: the
        // WebView owns every pixel, the strip over the notch is painted by
        // the app itself (components/StatusBarSafeArea.tsx, which is exactly
        // `--safe-top` tall and themed), and NativeShell keeps setting the bar's
        // icon STYLE at runtime from the app's colour mode. `Info.plist` has
        // `UIViewControllerBasedStatusBarAppearance` = true, which is what lets
        // that runtime style win on iOS.
        StatusBar: {
            overlaysWebView: true
        },
        // Which native sign-in providers the plugin instantiates. This list is
        // NOT cosmetic: the iOS/Android sides only build a provider handler for
        // the ids named here, and `signInWithApple()` / `signInWithGoogle()`
        // reject with "sign-in provider is not enabled" without it.
        // `skipNativeAuth` stays at its default (false) so the NATIVE Firebase
        // SDK is signed in too — @capacitor-firebase/messaging needs that to
        // bind the FCM token to the right account; the JS SDK is signed in a
        // second time from src/auth/AuthContext.tsx with the same credential,
        // which is what keeps onAuthStateChanged/getIdToken working.
        FirebaseAuthentication: {
            skipNativeAuth: false,
            providers: ["apple.com", "google.com"]
        },
        // THE LAYOUT VIEWPORT ITSELF SHRINKS BY THE KEYBOARD — once, on both
        // platforms.
        //
        // `resize` is iOS-only (the plugin's own definitions.d.ts says so) and
        // used to be `"body"`. `ResizeBody` does literally one thing
        // (.../ios/Sources/KeyboardPlugin/Keyboard.m, `resizeElement`):
        // `document.body.style.height = screenHeight - keyboardHeight`. A
        // `position: fixed` box is laid out against the viewport, not against
        // `body`, so every bottom-docked surface in this app — MobileTabBar,
        // the blok action bar, the hand/reactions row, a bottom sheet — stayed
        // exactly where it was, i.e. behind the keyboard. `100dvh` did not
        // move either.
        //
        // `native` (the plugin default) resizes the WKWebView's own frame, so
        // `100dvh`, `position: fixed` and `env(safe-area-inset-bottom)` all
        // follow the keyboard — and that is precisely what Capacitor 8 already
        // does on Android, where `SystemBars` pads the WebView's parent by the
        // IME inset and reports `--safe-area-inset-bottom: 0` while the
        // keyboard is up (.../@capacitor/android/.../plugin/SystemBars.java,
        // `calcSafeAreaInsets` + `initWindowInsetsListener`). One model, both
        // platforms.
        //
        // `resizeOnFullScreen` is gone rather than set to `false`: it is the
        // Android-only legacy workaround, and Capacitor 8's Keyboard plugin
        // short-circuits it anyway — `possiblyResizeChildOfContent` returns
        // immediately when the `SystemBars` class is on the classpath, which
        // in Capacitor 8 it always is. Keeping it set was an invitation to a
        // double shrink the day that guard changes.
        Keyboard: {
            resize: "native"
        }
    }
}

export default config
