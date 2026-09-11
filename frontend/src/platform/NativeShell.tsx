import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useColorMode } from "../color-mode-hooks"
import { isNative, platform } from "./index"
import { nativeApp, nativeMessaging, nativeSplashScreen, nativeStatusBar } from "./native"
import { hydrateGuestFromNative } from "../game/hooks/guestIdentity"
import { t } from "../i18n"
import { toaster } from "../toaster"

/**
 * Native-shell wiring — a no-op tree on the web (every effect below bails on
 * `isNative` before touching a Capacitor loader). Mounted from main.tsx
 * inside both `BrowserRouter` and `ColorModeProvider` because it needs both:
 * `useNavigate` for the Android back button, and the app's own light/dark
 * decision (not the OS one — see color-mode.tsx) for the status bar's icon
 * style. Lives in its own file, not inlined in main.tsx, because the entry
 * file has no exports of its own and react-refresh's "only export
 * components" rule wants a component's Fast Refresh boundary to be a real
 * module.
 */
export default function NativeShell() {
    const navigate = useNavigate()
    const { colorMode } = useColorMode()

    // Restore the guest-play identity from the Preferences mirror once at
    // startup, before GameIdentityGate can render its "type a name" form —
    // see guestIdentity.ts for why native needs this at all. Fire-once: the
    // module-level `hydrationReady` flag it flips is what the gate actually
    // waits on, not this effect re-running.
    useEffect(() => {
        if (!isNative) return
        hydrateGuestFromNative()
    }, [])

    // Hide the native splash once React has actually painted, instead of
    // Capacitor's own auto-hide (disabled via launchAutoHide:false in
    // capacitor.config.ts), so the splash never disappears before hydration
    // is ready to take over — that gap would otherwise flash a blank WebView.
    useEffect(() => {
        if (!isNative) return
        nativeSplashScreen()
            .then((SplashScreen) => SplashScreen.hide())
            .catch(() => {
                /* already hidden, or unavailable in this build — non-fatal */
            })
    }, [])

    // Status bar icon colour follows the app's live colour mode, the same
    // value ThemeColorSync (color-mode.tsx) uses for the browser's own
    // chrome. `overlaysWebView: false` in capacitor.config.ts means the OS
    // reserves native space for the bar instead of drawing it over the
    // WebView, so only its icon style — not an inset — needs to track theme.
    useEffect(() => {
        if (!isNative) return
        nativeStatusBar()
            .then(({ StatusBar, Style }) =>
                StatusBar.setStyle({ style: colorMode === "dark" ? Style.Light : Style.Dark }))
            .catch(() => {
                /* cosmetic only — never worth surfacing a failure for */
            })
    }, [colorMode])

    // Universal Links (iOS) / App Links (Android) — a tap on a
    // https://bela-turniri.com/... link on the device hands the URL to the
    // OS, which (once verified via the AASA / assetlinks.json files served
    // at ops/well-known/, see the Caddyfile) opens THIS app instead of the
    // browser and fires `appUrlOpen` with the full URL. Two cases:
    //   - warm start: app already running, listener fires.
    //   - cold start: the OS launches the app WITH the URL, so the first
    //     `appUrlOpen` can be missed — `getLaunchUrl()` is Capacitor's way
    //     to fetch that same URL once after mount.
    // Only `new URL(url).pathname` (+ search/hash) is passed to `navigate`,
    // never the raw string — React Router's `navigate` treats its argument
    // as an in-app path, and a custom scheme or a foreign host slipped in
    // here (a malformed link, or a future scheme this app didn't ask to
    // register) must never be handed to the SPA router as if it were one of
    // its own routes.
    useEffect(() => {
        if (!isNative) return
        const isOurHost = (url: string) => {
            try {
                const { hostname } = new URL(url)
                return hostname === "bela-turniri.com" || hostname === "www.bela-turniri.com"
            } catch {
                return false
            }
        }
        const openInApp = (url: string) => {
            if (!isOurHost(url)) return
            const { pathname, search, hash } = new URL(url)
            navigate(pathname + search + hash)
        }
        let handle: { remove: () => void } | undefined
        let cancelled = false
        nativeApp().then(async (AppPlugin) => {
            const h = await AppPlugin.addListener("appUrlOpen", ({ url }) => openInApp(url))
            if (cancelled) {
                h.remove()
                return
            }
            handle = h
            const launch = await AppPlugin.getLaunchUrl()
            if (launch?.url) openInApp(launch.url)
        })
        return () => {
            cancelled = true
            handle?.remove()
        }
    }, [navigate])

    // Android hardware back button. Mirrors what a back-swipe/back-arrow
    // would do in the browser: go back in the SPA's own history when there
    // is somewhere to go, otherwise this IS the app's root screen, so hand
    // control back to the OS instead of trapping the user with a dead button.
    //
    // appStateChange -> "active" needs no handler here: game/gameConnection.ts
    // already reconnects its socket on its own (ping-timeout -> onclose ->
    // scheduleReconnect), which covers the OS suspending the connection while
    // the app was backgrounded.
    useEffect(() => {
        if (!isNative) return
        let handle: { remove: () => void } | undefined
        let cancelled = false
        nativeApp().then(async (AppPlugin) => {
            const h = await AppPlugin.addListener("backButton", () => {
                if (window.history.length > 1) navigate(-1)
                else AppPlugin.exitApp()
            })
            if (cancelled) h.remove()
            else handle = h
        })
        return () => {
            cancelled = true
            handle?.remove()
        }
    }, [navigate])

    // Android notification channel matching the backend's FCM message
    // (`android.notification.channel_id = "bela"`, see CLAUDE.md's push
    // section) — a channel that doesn't exist yet silently drops the
    // notification on API 26+. Runs on every native launch regardless of
    // sign-in state, unlike PushBootstrap's token registration, because a
    // signed-out device can still be the one that gets reinstalled and
    // needs the channel to exist before anyone ever logs in.
    useEffect(() => {
        if (!isNative) return
        if (platform !== "android") return
        nativeMessaging()
            .then(({ FirebaseMessaging, Importance }) =>
                FirebaseMessaging.createChannel({
                    id: "bela",
                    name: t("common.push.channelName"),
                    importance: Importance.High,
                }))
            .catch(() => {
                /* best-effort — worst case notifications land on the OS's
                   own default channel instead of a "bela"-branded one */
            })
    }, [])

    // Notification tap while backgrounded/killed. `data.url` is the SPA path
    // FcmSender put on the message (e.g. "/turniri/<slug>") — same shape as
    // the Web Push payload sw.js reads. Only a same-origin, in-app path is
    // ever handed to the router: not an absolute URL, not a scheme, and not
    // a protocol-relative "//host" that a malformed or spoofed payload could
    // use to smuggle a foreign destination past this check.
    useEffect(() => {
        if (!isNative) return
        let handle: { remove: () => void } | undefined
        let cancelled = false
        nativeMessaging().then(async ({ FirebaseMessaging }) => {
            const h = await FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
                const data = event.notification.data as { url?: unknown } | undefined
                const url = data?.url
                if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) {
                    navigate(url)
                }
            })
            if (cancelled) h.remove()
            else handle = h
        })
        return () => {
            cancelled = true
            handle?.remove()
        }
    }, [navigate])

    // Foreground delivery. Unlike a backgrounded app, the OS does not draw a
    // system notification while the app is in front — nothing tells the user
    // a push arrived unless the app does it itself, so this mirrors it onto
    // the app's own toaster instead of leaving it silent.
    useEffect(() => {
        if (!isNative) return
        let handle: { remove: () => void } | undefined
        let cancelled = false
        nativeMessaging().then(async ({ FirebaseMessaging }) => {
            const h = await FirebaseMessaging.addListener("notificationReceived", (event) => {
                const { title, body } = event.notification
                toaster.create({
                    type: "info",
                    title: title || t("common.push.fallbackTitle"),
                    description: body,
                    duration: 6000,
                })
            })
            if (cancelled) h.remove()
            else handle = h
        })
        return () => {
            cancelled = true
            handle?.remove()
        }
    }, [])

    return null
}
