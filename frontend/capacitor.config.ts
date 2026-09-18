import type { CapacitorConfig } from "@capacitor/cli"

/**
 * Capacitor shell config.
 *
 * `webDir` is the very same `dist/` the website ships — the native apps are not
 * a second codebase, they bundle the identical Vite output. Native builds go
 * through `npm run build:native`, which runs the build in Vite's `native` mode
 * (so `.env.native` points the API and WebSocket at the real host instead of
 * the relative `/api` a browser gets from Caddy) and then `cap sync`.
 *
 * `server.url` is deliberately NOT set: the assets must be served from the
 * app bundle so an installed app works offline, exactly like the PWA does.
 */
const config: CapacitorConfig = {
    appId: "com.belaturniri.app",
    appName: "Bela Turniri",
    webDir: "dist",
    ios: {
        contentInset: "automatic"
    },
    android: {
        allowMixedContent: false
    },
    plugins: {
        // Hidden manually from JS once React has painted (see src/platform/NativeShell.tsx,
        // NativeShell), not the default auto-hide — auto-hide can beat
        // hydration and flash an empty WebView between the native splash
        // and the first real frame.
        SplashScreen: {
            launchAutoHide: false
        },
        // Off: the OS reserves native space for the status bar above the
        // WebView instead of drawing it over app content, so the app never
        // has to paint its own inset to avoid the bar. NativeShell still
        // sets the bar's icon STYLE (light/dark) at runtime to follow the
        // app's colour mode — that can't be expressed statically here.
        StatusBar: {
            overlaysWebView: false
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
        // Shrinks the WebView's body instead of leaving it full height under
        // an overlaying keyboard, so a focused input — the blok score entry,
        // the create-tournament form — stays above the software keyboard
        // instead of hiding behind it. `resizeOnFullScreen` keeps the same
        // behaviour on Android, where the StatusBar plugin above already
        // puts the app in a fullscreen-ish layout.
        Keyboard: {
            resize: "body",
            resizeOnFullScreen: true
        }
    }
}

export default config
