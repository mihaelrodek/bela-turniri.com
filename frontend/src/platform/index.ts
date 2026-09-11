import { Capacitor } from "@capacitor/core"

/**
 * The single place the app is allowed to ask what it is running on.
 *
 * Two rules keep the native shells from becoming a fork of the web app:
 *
 * 1. Native code is always an `else` branch behind `isNative` — it never
 *    replaces the web path. The browser build must keep behaving exactly as
 *    the PWA does today.
 * 2. This module imports `@capacitor/core` and nothing else. A Capacitor
 *    *plugin* import would drag native-only bridge code into the web bundle;
 *    core adds ~8 kB to the vendor chunk, and that is the entire price the
 *    website pays for the apps existing.
 */

/** True inside the iOS/Android WebView, false in any browser (including the PWA). */
export const isNative: boolean = Capacitor.isNativePlatform()

export const platform: "web" | "ios" | "android" = Capacitor.getPlatform() as "web" | "ios" | "android"

/**
 * Where REST calls go. On the web this stays the relative `/api`, which the
 * Vite proxy (dev) and Caddy (prod) route to Quarkus. A native build sets
 * VITE_API_URL in `.env.native`, because a WebView loading `capacitor://` or
 * `https://localhost` has no origin to be relative to.
 */
export const apiBase: string = import.meta.env.VITE_API_URL ?? "/api"

/**
 * Scheme + host for WebSocket URLs, without a trailing slash. Same story:
 * derived from the page on the web, pinned to the real host natively.
 */
export const wsOrigin: string = import.meta.env.VITE_WS_ORIGIN ?? wsOriginFromLocation()

function wsOriginFromLocation(): string {
    if (typeof window === "undefined") return ""
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
    return `${proto}//${window.location.host}`
}
