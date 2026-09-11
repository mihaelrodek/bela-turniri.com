/**
 * Lazy loaders for Capacitor plugins.
 *
 * Every plugin package registers itself as a side effect of being imported
 * (`registerPlugin(...)`), which is exactly the code the web bundle must
 * never carry — `src/platform/index.ts` already explains why that file only
 * imports `@capacitor/core`. Each function below is a `import()` behind a
 * call, not a top-level `import`, so Vite's static analysis never pulls
 * these into the shared chunk; the plugin JS is only fetched the moment one
 * of these functions actually runs, which happens exclusively behind an
 * `isNative` check (see `NativeShell.tsx`). Never import from
 * "@capacitor/app", "@capacitor/status-bar" or "@capacitor/splash-screen"
 * at module scope anywhere else in the app.
 */

export async function nativeApp() {
    return (await import("@capacitor/app")).App
}

/** Returns both the plugin and its Style enum — callers need Style.Dark /
 *  Style.Light to pick the status bar's icon colour. */
export async function nativeStatusBar() {
    const mod = await import("@capacitor/status-bar")
    return { StatusBar: mod.StatusBar, Style: mod.Style }
}

export async function nativeSplashScreen() {
    return (await import("@capacitor/splash-screen")).SplashScreen
}

/** Backs the guest-identity mirror in `game/hooks/guestIdentity.ts` — see that
 *  file's header for why this is only a mirror, not the durable store. */
export async function nativePreferences() {
    return (await import("@capacitor/preferences")).Preferences
}

/**
 * FCM on both platforms — `@capacitor-firebase/messaging`, not an APNs-only
 * plugin, because the backend's `FcmSender` sends through FCM v1 and an
 * APNs-native token would never match a device row it can look up. See
 * `PushBootstrap.tsx` for the request-permission / getToken / register flow
 * and `NativeShell.tsx` for the foreground/tap listeners and the Android
 * notification channel. Same "@capacitor-firebase/" scope carve-out as the
 * "@capacitor/" one above lives in vite.config.ts's manualChunks.
 *
 * Returns the plugin AND its `Importance` enum (same pattern as
 * `nativeStatusBar` returning `Style`) — `NativeShell.tsx` needs
 * `Importance.High` for `createChannel`, and importing the enum at module
 * scope anywhere else would pull the plugin's registerPlugin() side effect
 * into that module's static chunk, same as importing the plugin itself.
 */
export async function nativeMessaging() {
    const mod = await import("@capacitor-firebase/messaging")
    return { FirebaseMessaging: mod.FirebaseMessaging, Importance: mod.Importance }
}
