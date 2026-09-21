import { useEffect, useSyncExternalStore } from "react"
import { Box } from "@chakra-ui/react"
import { SystemBars, SystemBarsStyle, SystemBarType } from "@capacitor/core"
import { isNative, platform } from "../platform"

/* ──────────────────────────────────────────────────────────────────────────
   StatusBarSafeArea — a permanent, deterministic strip over the notch/Dynamic
   Island inset, so iOS never has anything else to sample for the status-bar
   tint.

   Bug report (2026-09-20, user, installed iOS PWA): after an error toast at
   the game table, the status-bar strip stayed solid red long after the toast
   itself was gone. `toaster.ts` / `navChrome.ts`'s `TOAST_TOP_OFFSET` already
   keeps every toast's own box below the navbar (`max(env(safe-area-inset-
   top), offset)` in zag-js's placement math — see node_modules/@zag-js/toast
   — so no toast box ever touches `top: 0`), and the navbar itself pads into
   the inset with its own background (`NavBar.tsx`, `paddingTop:
   var(--safe-top)`). That should already keep the strip a stable colour. It
   evidently still doesn't on every device/iOS build: WebKit's
   status-bar tinting (colloquially "iOS 26") samples page content near the
   top edge and is reported to sometimes cache a stale sample rather than
   re-reading it once a page has `overflow: hidden` locked (the game table
   does exactly this while mounted — see GameRoomPage.tsx's scroll-lock
   effect). Rather than depend on every future fixed/sticky element at the
   top staying out of that sampled band, this component makes the sampled
   pixels themselves unconditionally deterministic: a real, opaque, themed
   box that always occupies exactly the safe-area-inset-top strip, above
   EVERYTHING (including toasts) in stacking order.

   `bg.opaque` (system.ts) is the same white / gray.900 the navbar's own
   glass background resolves to without translucency — i.e. this strip reads
   as a seamless continuation of the header, not a visible patch, in both
   themes.

   `zIndex={1001}`: one above the navbar (1000), and deliberately BELOW every
   overlay — dialogs, sheets, the belot stage. At `max` it was a bright band
   across the top of every dimmed backdrop and full-screen stage on a notched
   phone. Toasts never reach the top edge (`TOAST_TOP_OFFSET`), so they need
   no covering.

   `pointerEvents="none"`: this must never swallow a tap. On every device
   without a safe-area inset (Android, desktop, an ordinary browser tab)
   `var(--safe-top)` (index.html) resolves to 0, so the box has zero height
   and is a complete no-op there — same variable NavBar.tsx and
   navChrome.ts's `TOAST_TOP_OFFSET` read, not a bare `env(...)`, since below
   WebView 140 that resolves to 0px even under Android 16 edge-to-edge where
   Capacitor's own `--safe-area-inset-top` still carries the real value.
   Modelled on `AppBackground.tsx`'s own top-level `position: fixed` sibling
   — mounted above the router and every portal so no ancestor
   transform/filter can turn it into a containing block for something else. */

/* ── Which colour mode is live, without a provider ─────────────────────────
   This component is mounted OUTSIDE `ColorModeProvider` (main.tsx: it sits
   next to it, not inside, so it can also out-stack the toast viewport), so
   `useColorMode()` is not available here. The provider's own contract is that
   it writes `class="dark"` on <html> (next-themes, `attribute="class"` — and
   index.html's pre-paint script writes the same class), which makes the DOM
   the one source both halves already agree on. A MutationObserver on that
   single attribute is cheaper than a context subscription and cannot drift
   from what the page is actually painted as. */
function subscribeColorMode(onChange: () => void) {
    const observer = new MutationObserver(onChange)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
}

function isDarkMode() {
    return document.documentElement.classList.contains("dark")
}

export default function StatusBarSafeArea() {
    const dark = useSyncExternalStore(subscribeColorMode, isDarkMode, () => false)

    /* ── Android's NAVIGATION bar icons ────────────────────────────────────
       `@capacitor/status-bar`'s `setStyle` — the one NativeShell.tsx calls on
       every colour-mode change — touches `setAppearanceLightStatusBars` and
       nothing else (node_modules/@capacitor/status-bar/android/.../StatusBar.java).
       The gesture/3-button bar therefore keeps whatever appearance the OS
       theme gave it, and since targetSdk 36 forces that bar transparent over
       our own content, a dark-mode app under a light OS ends up drawing dark
       icons on a dark surface: an invisible navigation bar.

       Capacitor 8 core ships the fix as a first-class plugin — `SystemBars`
       is exported straight from `@capacitor/core` (types/core-plugins.d.ts),
       whose `setStyle({ bar: "NavigationBar" })` reaches
       `WindowInsetsControllerCompat.setAppearanceLightNavigationBars`. Doing
       it HERE rather than in NativeShell keeps every "what do the system bars
       look like" decision in the component that already paints the strip over
       one of them; NativeShell keeps the status bar because that is where the
       rest of its native wiring lives.

       Android only: on iOS the same call maps to the home-indicator area,
       which iOS tints from the content underneath on its own. `@capacitor/core`
       is already a static import of `src/platform/index.ts`, so naming
       `SystemBars` here adds nothing to the web bundle — and on the web the
       plugin's own web shim resolves to a no-op. */
    useEffect(() => {
        if (!isNative || platform !== "android") return
        SystemBars.setStyle({
            // "The style is based on the device appearance" is exactly what we
            // must NOT use: the device may be light while the app is dark.
            // `Dark` means light icons on a dark background, hence the flip.
            style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
            bar: SystemBarType.NavigationBar,
        }).catch(() => {
            /* cosmetic only — never worth surfacing a failure for */
        })
    }, [dark])

    return (
        <Box
            aria-hidden="true"
            pointerEvents="none"
            position="fixed"
            top="0"
            insetInline="0"
            h="var(--safe-top)"
            bg="bg.opaque"
            zIndex={1001}
        />
    )
}
