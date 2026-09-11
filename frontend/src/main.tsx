import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { ChakraProvider, defaultSystem } from "@chakra-ui/react"
import { QueryClientProvider } from "@tanstack/react-query"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { queryClient, CACHE_BUSTER, NON_PERSISTED_KEY_ROOTS } from "./queryClient"
import { persister } from "./persister"
import { ColorModeProvider } from "./color-mode"
import { system } from "./system"
import NativeShell from "./platform/NativeShell"
import AppBackground from "./components/AppBackground"
import { AuthProvider } from "./auth/AuthContext"
import AppToaster from "./components/AppToaster"
import FirstRunInstallPrompt from "./components/FirstRunInstallPrompt"
import { RouteResetErrorBoundary } from "./components/ErrorBoundary"
import PwaNativeGestures from "./components/PwaNativeGestures"
import SwUpdateToast from "./components/SwUpdateToast"
import CookieConsent from "./components/CookieConsent"
import WhatsNewFab from "./whatsNew/WhatsNewFab"
import WhatsNewDialogMount from "./whatsNew/WhatsNewDialogMount"
import App from "./App"


// Everything below the query provider. Built once as an element so the two
// provider variants below can share it verbatim.
const appTree = (
    <AuthProvider>
        <BrowserRouter>
            {/* Inside the router on purpose: the boundary reads the current
                location and clears its error state on every navigation, so a
                crashed page doesn't pin the whole SPA to the error screen. */}
            <RouteResetErrorBoundary>
                <App />
            </RouteResetErrorBoundary>
            {/* Splash hide / status bar style / Android back button — a real
                mount point inside both the router and the colour-mode
                context (see the component above for why it needs both).
                Renders nothing and does nothing at all on the web. */}
            <NativeShell />
            {/* Pull-to-refresh + edge-swipe-back reimplemented in JS —
                installed (standalone) PWAs lose both native gestures
                since there's no browser chrome to own them. No-ops in a
                normal browser tab (isStandalone() guards it). */}
            <PwaNativeGestures />
            {/* GDPR cookie/analytics consent. Renders nothing until the
                stored decision (or lack of one) is known, then a bottom
                sheet on first visit; index.html's GA4 snippet defaults every
                consent signal to denied until this grants it. Mounted here
                (inside BrowserRouter), not alongside the other root-level
                components below — its privacy-policy link is a RouterLink,
                which needs the router context. */}
            <CookieConsent />
            {/* "Novosti" (what's new): a sticky FAB plus its release-notes
                dialog. Both live inside the router — the FAB hides itself on
                a few full-bleed routes (/igra*, /blok*) by reading the
                current path. See WhatsNewDialogMount above for why the
                dialog itself isn't mounted until the FAB is first tapped. */}
            <WhatsNewFab />
            <WhatsNewDialogMount />
        </BrowserRouter>
    </AuthProvider>
)

// With a working localStorage the query cache is persisted, so a cold load
// (hard reload / reopening the installed PWA) paints the last-seen tournament
// list, calendar and map INSTANTLY from disk and then revalidates in the
// background. Where storage is unavailable (`persister` is null — private mode,
// site data blocked) fall back to a plain in-memory provider rather than
// letting a localStorage access throw at module scope.
const withQueryCache = persister ? (
    <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
            persister,
            // How old a persisted snapshot may be and still be restored on a
            // cold load (older → discarded).
            maxAge: 60 * 60_000,
            buster: CACHE_BUSTER,
            dehydrateOptions: {
                // Persist only successful reads, and never auth-dependent ones
                // (own profile, admin, the pair board, public profiles, pair
                // lists, tournament details) — a restored snapshot could
                // otherwise show one user's data to the next person on a
                // shared device.
                shouldDehydrateQuery: (q) =>
                    q.state.status === "success"
                    && !NON_PERSISTED_KEY_ROOTS.has(String(q.queryKey[0])),
            },
        }}
    >
        {appTree}
    </PersistQueryClientProvider>
) : (
    <QueryClientProvider client={queryClient}>{appTree}</QueryClientProvider>
)

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ChakraProvider value={system ?? defaultSystem}>
            {/* True `position: fixed`, mounted at the very top level (above
                the router and every dialog/portal) so no ancestor transform
                can turn it into a containing block for something else and no
                page's own content height can affect where it centres — see
                the component for the iOS `background-attachment: fixed` bug
                this replaces. */}
            <AppBackground />
            <ColorModeProvider>
                {withQueryCache}
            </ColorModeProvider>
            {/* Toast viewport. Mounted at root so toasts survive route
                changes. The shared toaster instance lives in src/toaster.ts
                and is imported by both AppToaster (rendering) and
                api/http.ts (the axios interceptor that creates toasts). */}
            <AppToaster />
            {/* First-launch install nudge. Self-gates on localStorage so it
                only ever appears once per device, and on the install-prompt
                hook so it stays hidden when the app is already installed
                (or the browser doesn't support installation). */}
            <FirstRunInstallPrompt />
            {/* Registers the SW (prod only) and owns its whole lifecycle —
                including the "new version available" reload toast. See the
                component for why sw.js's unconditional skipWaiting() needs
                this client-side half. Renders nothing itself. */}
            <SwUpdateToast />
        </ChakraProvider>
    </React.StrictMode>
)
