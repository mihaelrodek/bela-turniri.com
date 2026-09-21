import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useColorMode } from "../color-mode-hooks"
import { isNative, platform } from "./index"
import { nativeApp, nativeMessaging, nativeSplashScreen, nativeStatusBar } from "./native"
import { applyFoldState, Foldable } from "./foldable"
import { hydrateGuestFromNative } from "../game/hooks/guestIdentity"
import { requestTableExit } from "../game/gameExitGuard"
import { isFullSiteOnlyPath, isGamesHost, isGamesSite, mainSiteUrl, MAIN_ORIGIN } from "../site"
import { t } from "../i18n"
import { toaster } from "../toaster"

/**
 * Any open Zag-based overlay's CONTENT part, topmost first (see below).
 * Chakra v3's Dialog, Drawer (same "dialog" scope, styled differently),
 * Popover and Menu are all `@zag-js/*` state machines built from
 * `createAnatomy(scope)`, which stamps every part with `data-scope="<scope>"`
 * `data-part="<part>"` and, on the open/close-able parts, `data-state`.
 */
const OPEN_OVERLAY_SELECTOR = [
    '[data-scope="dialog"][data-part="content"][data-state="open"]',
    '[data-scope="popover"][data-part="content"][data-state="open"]',
    '[data-scope="menu"][data-part="content"][data-state="open"]',
].join(", ")

/**
 * True if some overlay was open and asked (best-effort) to close.
 *
 * Dispatches a synthetic Escape keydown on `document` rather than closing the
 * DOM node directly: `@zag-js/dismissable`'s `trackEscapeKeydown` already
 * listens for exactly this on `document` (capture phase, regardless of
 * focus — see its source), and its layer stack only acts when the
 * dispatching layer `isTopMost`, so with several overlays stacked this
 * closes only the one on top, same as a real Escape key press would.
 */
function closeTopmostOverlay(): boolean {
    if (!document.querySelector(OPEN_OVERLAY_SELECTOR)) return false
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }))
    return true
}

/**
 * Does THIS app get to swallow an https link to `hostname`?
 *
 * Asked as a predicate rather than matched against a list, because the games
 * product lives on TWO equal apex domains (bela.games and belot.games — see
 * GAMES_DOMAINS in src/site.ts) and the one shell claims both. `isGamesHost`
 * already normalises `www.` and case, so both twins and both their `www.`
 * forms land here; the tournaments shell keeps its single host pair.
 *
 * This must stay in step with what the OS is willing to hand over in the
 * first place — the Associated Domains entitlement on iOS and the App Links
 * intent-filter hosts on Android. The OS decides WHICH links reach
 * `appUrlOpen`; this decides what is done with them once they do.
 */
const MAIN_HOST = new URL(MAIN_ORIGIN).hostname

function isOwnHost(hostname: string): boolean {
    if (isGamesSite) return isGamesHost(hostname)
    const apex = hostname.toLowerCase().replace(/^www\./, "")
    return apex === MAIN_HOST
}

/**
 * A path that exists only on the full site (tournaments, calendar, map…) can
 * still arrive in the games app — a shared link pasted by a friend, an old
 * push payload, a notification for an account that also organises tournaments.
 * The games build has no route for it, so handing it to the router would land
 * on the 404 page. Send it to the system browser on bela-turniri.com instead,
 * where it actually resolves. `window.open(..., "_blank")` is Capacitor's
 * documented escape hatch: the iOS bridge answers it with
 * `UIApplication.open` and the Android bridge with an ACTION_VIEW intent, so
 * in both shells it leaves the WebView rather than navigating inside it.
 */
function leavesThisApp(pathname: string): boolean {
    // `isFullSiteOnlyPath` answers "does the full site alone have this route",
    // which is true in BOTH builds — so the mode check is what makes this a
    // games-only detour. Without it the tournaments app would fling its own
    // /turniri links out into Safari.
    return isGamesSite && isFullSiteOnlyPath(pathname)
}

function openOnFullSite(pathAndQuery: string) {
    try {
        window.open(mainSiteUrl(pathAndQuery), "_blank")
    } catch {
        /* no external handler — better a dead tap than a 404 inside the app */
    }
}

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

    // Jetpack WindowManager reports a physical hinge or separating fold in
    // window coordinates. The local Capacitor plugin converts those pixels to
    // CSS pixels; this effect exposes them as root variables shared by the
    // scorepad, game controls, navigation and every portalled dialog.
    useEffect(() => {
        if (!isNative || platform !== "android") return
        let handle: { remove: () => void } | undefined
        let cancelled = false
        Foldable.getState().then(applyFoldState).catch(() => {})
        Foldable.addListener("foldChange", applyFoldState).then((next) => {
            if (cancelled) next.remove()
            else handle = next
        }).catch(() => {})
        return () => {
            cancelled = true
            handle?.remove()
            applyFoldState({
                present: false,
                separating: false,
                orientation: "none",
                state: "none",
                occlusion: "none",
                bounds: { left: 0, top: 0, width: 0, height: 0 },
            })
        }
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
    // chrome. `overlaysWebView: false` in capacitor.config.ts asks the OS to
    // reserve native space for the bar instead of drawing it over the
    // WebView, but on Android 16 / targetSdk 36 that flag no longer has any
    // effect — the WebView draws edge-to-edge regardless, and content needs
    // its own inset (`--safe-top` etc., index.html) to clear it. This effect
    // still only needs to track the icon STYLE, not an inset, on iOS and
    // older Android where the flag still applies.
    useEffect(() => {
        if (!isNative) return
        nativeStatusBar()
            .then(({ StatusBar, Style }) =>
                StatusBar.setStyle({ style: colorMode === "dark" ? Style.Light : Style.Dark }))
            .catch(() => {
                /* cosmetic only — never worth surfacing a failure for */
            })
    }, [colorMode])

    // Universal Links (iOS) / App Links (Android) — a tap on a link to this
    // app's own product (https://bela-turniri.com/... in the tournaments app,
    // https://bela.games/... or https://belot.games/... in the games app,
    // which claims both of its twins) hands the URL to the
    // OS, which (once verified via the AASA / assetlinks.json files served
    // at ops/well-known/ and ops/well-known-games/, see the Caddyfile) opens
    // THIS app instead of the browser and fires `appUrlOpen` with the full
    // URL. Two cases:
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
                return isOwnHost(new URL(url).hostname)
            } catch {
                return false
            }
        }
        const openInApp = (url: string) => {
            if (!isOurHost(url)) return
            const { pathname, search, hash } = new URL(url)
            const target = pathname + search + hash
            // A full-site-only path in the games shell has no route here;
            // hand it to the browser on bela-turniri.com instead of 404-ing.
            if (leavesThisApp(pathname)) openOnFullSite(target)
            else navigate(target)
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
    // Three things get first refusal, in order:
    //   1. The game table (`/igra/soba/:roomId`) asks "ostani u sobi ili
    //      izađi?" before an active game is abandoned — the SAME dialog a
    //      nav-link click shows (`GameRoomExitGuard.tsx`), reached through
    //      `gameExitGuard.ts` since that component's tree is nowhere near
    //      this listener. `requestTableExit` is a no-op (returns false) on
    //      every other route; on the table it asks whenever a seat is held
    //      (waiting room included), and only a spectator goes straight back.
    //   2. Off the table, an open dialog/drawer/popover/menu closes instead
    //      of the page navigating away underneath it (`closeTopmostOverlay`).
    //   3. Otherwise this is a normal back: within the SPA's own history if
    //      there is one to return to, else the app's own root and the
    //      button's job is to leave the app.
    //
    // `window.history.length` used to gate step 3, but it only ever GROWS —
    // it is the size of the whole tab history, not a position in it — so
    // once the player had navigated anywhere this session, walking back to
    // the very first screen left every further back-press with nowhere to
    // go and nothing to do: a dead button instead of an exit. React Router's
    // own history object stamps every entry it pushes/replaces with
    // `{ idx, ... }` in `history.state` (the `history` package's own
    // convention); `idx === 0` is specifically THIS SPA's first entry, which
    // is what "the app's root" means here.
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
                const idx = (window.history.state as { idx?: unknown } | null)?.idx
                const goBack = () => {
                    if (typeof idx === "number" && idx > 0) navigate(-1)
                    else AppPlugin.exitApp()
                }
                // The table goes FIRST: there, back never closes anything and
                // never leaves — it asks (or, pressed again, withdraws the
                // question). Everywhere else an open overlay closes first.
                if (requestTableExit(goBack)) return
                if (closeTopmostOverlay()) return
                goBack()
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
                    // Same split as the deep-link listener: the games shell
                    // has no tournament routes, so a "/turniri/..." payload
                    // (an account that also organises tournaments, a stale
                    // token) opens on the full site instead of 404-ing here.
                    const path = url.split(/[?#]/, 1)[0]
                    if (leavesThisApp(path)) openOnFullSite(url)
                    else navigate(url)
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
