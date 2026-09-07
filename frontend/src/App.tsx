import { Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import { Container, Flex, Spinner, Text } from '@chakra-ui/react'
import NavBar from './components/NavBar'
import MobileTabBar from './components/MobileTabBar'
import PushBootstrap from './components/PushBootstrap'
import ThemeSync from './components/ThemeSync'
import LocaleSync from './components/LocaleSync'
import SiteFooter from './components/SiteFooter'
import { RequireAuth } from "./components/RequireAuth"
import GameFeatureGate from "./game/GameFeatureGate"
import { lazyWithReload } from "./utils/lazyWithReload"

/* ──────────────────────────────────────────────────────────────────────────
   Eager imports — small components on the critical path. The tournaments
   list is the landing route, and login/register/404 are tiny, so splitting
   them would only add a round-trip.
   ────────────────────────────────────────────────────────────────────── */
import TournamentsPage from './pages/TournamentsPage'
import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"
import ProfileRedirect from "./pages/ProfileRedirect"
import NotFoundPage from "./pages/NotFoundPage"

/* ──────────────────────────────────────────────────────────────────────────
   Lazy-loaded routes. These either pull in big deps (Leaflet on /karta and
   inside the details page, react-datepicker + the whole organiser console on
   /turniri/novi and /turniri/:uuid) or are only ever reached deep in a flow
   (the claim-token landing pages). Splitting them keeps the initial bundle
   off the critical path for the landing route.
   ────────────────────────────────────────────────────────────────────── */
const CreateTournamentPage = lazyWithReload(() => import('./pages/CreateTournamentPage'))
const TournamentDetailsPage = lazyWithReload(() => import('./pages/TournamentDetailsPage'))
const PublicProfilePage = lazyWithReload(() => import('./pages/PublicProfilePage'))
const MapPage = lazyWithReload(() => import('./pages/MapPage'))
const CalendarPage = lazyWithReload(() => import('./pages/CalendarPage'))
const FindPairPage = lazyWithReload(() => import('./pages/FindPairPage'))
const ClaimPairPage = lazyWithReload(() => import('./pages/ClaimPairPage'))
const ClaimNamePage = lazyWithReload(() => import('./pages/ClaimNamePage'))
const ContactPage = lazyWithReload(() => import('./pages/ContactPage'))
const PrivacyPage = lazyWithReload(() => import('./pages/PrivacyPage'))
const TermsPage = lazyWithReload(() => import('./pages/TermsPage'))
/* Online bela. Its own subtree (src/game) with a WebSocket client, a table
   renderer and the shared @bela/engine types — none of which any other route
   touches, so it is strictly a separate chunk. */
const GameLobbyPage = lazyWithReload(() => import('./game/pages/GameLobbyPage'))
const GameRoomPage = lazyWithReload(() => import('./game/pages/GameRoomPage'))

/** Suspense fallback while a route chunk is being fetched. The min-height
 *  matches roughly what a page's first screenful occupies so the layout
 *  doesn't jump when the real page finally mounts. */
function RouteLoading() {
    return (
        <Flex direction="column" align="center" justify="center" minH="60vh" gap="3">
            <Spinner size="lg" colorPalette="blue" />
            <Text fontSize="sm" color="fg.muted">Učitavanje…</Text>
        </Flex>
    )
}

/**
 * Legacy English-alias redirects. We can't use <Navigate to="/turniri/:uuid">
 * because react-router doesn't expand path params on Navigate destinations
 * — :uuid would be taken literally. These small components pull the param
 * out of the current URL and forward it to the Croatian canonical path,
 * preserving the query string (?bill=, ?match=, ?next=) which push
 * notifications and OAuth back-links rely on.
 *
 * Servers also handle this via 301 in Caddy; these wrappers exist for the
 * edge case of an in-app <Link to="/profile/..."> that snuck past the
 * codemod, or a typed URL inside the already-loaded SPA where the
 * server-side rule never fires.
 */
function LegacyTournamentRedirect() {
    const { uuid, section } = useParams()
    const { search } = useLocation()
    // The section segment rides along so a legacy /tournaments/{slug}/parovi
    // link lands on Parovi, not just on the tournament. Mirrors Caddy's
    // `^/tournaments/(.+)$` → /turniri/{1} 301, which already preserves
    // everything after the route name.
    const tail = section ? `/${section}` : ""
    return <Navigate to={`/turniri/${uuid ?? ""}${tail}${search}`} replace />
}
function LegacyProfileRedirect() {
    const { slug } = useParams()
    const { search } = useLocation()
    return <Navigate to={`/profil/${slug ?? ""}${search}`} replace />
}
function LegacyClaimPairRedirect() {
    const { token } = useParams()
    const { search } = useLocation()
    return <Navigate to={`/preuzmi-par/${token ?? ""}${search}`} replace />
}
function LegacyClaimNameRedirect() {
    const { token } = useParams()
    const { search } = useLocation()
    return <Navigate to={`/preuzmi-ime/${token ?? ""}${search}`} replace />
}

export default function App() {
    // Warm the heaviest "next click" chunk while the browser is idle. From the
    // tournaments list the overwhelmingly common navigation is into a
    // tournament's detail page, so we prefetch that lazy chunk after first
    // paint — opening a tournament then feels instant.
    useEffect(() => {
        const prefetch = () => {
            import("./pages/TournamentDetailsPage").catch(() => {})
        }
        const ric = typeof window.requestIdleCallback === "function"
            ? window.requestIdleCallback
            : null
        const id = ric ? ric(prefetch, { timeout: 3000 }) : window.setTimeout(prefetch, 1500)
        return () => {
            if (ric && typeof window.cancelIdleCallback === "function") {
                window.cancelIdleCallback(id)
            } else {
                window.clearTimeout(id)
            }
        }
    }, [])

    return (
        <>
            {/* Sticky-footer pattern: this column is at least one viewport
                tall, so SiteFooter (mt="auto" below) sits at the bottom of
                the viewport on short pages and right after content on long
                ones — never floating mid-screen. MobileTabBar stays a
                sibling OUTSIDE this column: it's position:fixed, so its own
                place in the DOM doesn't matter, only that it paints last. */}
            <Flex direction="column" minH="100dvh">
                <NavBar />
                {/* Auto-subscribes the user to Web Push once we know who they
                    are. Also listens for SW notification-click navigation
                    messages and routes the SPA without a reload. */}
                <PushBootstrap />
                {/* Pulls the user's saved theme from /user/me/profile on
                    login so the choice follows them across devices. */}
                <ThemeSync />
                {/* Same idea for language: applies the profile's saved locale on
                    login and writes back whatever the navbar picker changes it to. */}
                <LocaleSync />
                <Container maxW="6xl" py={6}>
                {/* All user-facing routes use Croatian slugs. English slugs
                    (/tournaments, /profile, /calendar, …) are kept around
                    purely as <Navigate replace> aliases so existing
                    in-browser links don't break — server-side 301 redirects
                    in Caddy handle the SEO side. */}
                <Suspense fallback={<RouteLoading />}>
                <Routes>
                    <Route path="/" element={<Navigate to="/turniri" replace />} />

                    {/* Croatian (canonical) routes. */}
                    <Route path="/prijava" element={<LoginPage />} />
                    <Route path="/registracija" element={<RegisterPage />} />
                    <Route path="/turniri" element={<TournamentsPage />} />
                    <Route
                        path="/turniri/novi"
                        element={
                            <RequireAuth>
                                <CreateTournamentPage />
                            </RequireAuth>
                        }
                    />
                    {/* The detail page's open section is part of the path:
                        /turniri/:uuid renders Detalji (and stays the one
                        canonical URL per tournament), while /detalji,
                        /parovi, /zdrijeb and /cjenik deep-link straight to a
                        section. One route with an optional segment, not two
                        routes — React Router keeps the same element mounted
                        as the param changes, so switching sections never
                        remounts the page or refetches the tournament. The
                        slugs themselves live in TournamentDetailsPage
                        (SECTION_SLUG); an unknown one falls back to Detalji
                        rather than 404. */}
                    <Route path="/turniri/:uuid/:section?" element={<TournamentDetailsPage />} />
                    {/* Online bela. Both routes require a signed-in user:
                        the game server authenticates the socket with a
                        Firebase ID token, so an anonymous visitor could not
                        get past `hello` anyway. GameFeatureGate is the
                        production kill switch (see its own file) — it sits
                        outside RequireAuth so a signed-out visitor gets
                        bounced to "/" instead of the login page while the
                        feature is off. */}
                    <Route
                        path="/igra"
                        element={
                            <GameFeatureGate>
                                <RequireAuth>
                                    <GameLobbyPage />
                                </RequireAuth>
                            </GameFeatureGate>
                        }
                    />
                    <Route
                        path="/igra/soba/:roomId"
                        element={
                            <GameFeatureGate>
                                <RequireAuth>
                                    <GameRoomPage />
                                </RequireAuth>
                            </GameFeatureGate>
                        }
                    />
                    <Route path="/kalendar" element={<CalendarPage />} />
                    <Route path="/karta" element={<MapPage />} />
                    <Route path="/pronadi-para" element={<FindPairPage />} />
                    {/* /profil bounces to /profil/{my-slug} once the backend
                        has synced. /profil/:slug is publicly visible per
                        product decision. */}
                    <Route path="/profil" element={<ProfileRedirect />} />
                    <Route path="/profil/:slug" element={<PublicProfilePage />} />
                    {/* Pair-sharing claim landing pages — token routes, not
                        SEO-relevant, but translated for consistency. Old
                        share tokens still resolve via the legacy aliases
                        below. */}
                    <Route path="/preuzmi-par/:token" element={<ClaimPairPage />} />
                    <Route path="/preuzmi-ime/:token" element={<ClaimNamePage />} />
                    {/* Static content pages — no auth, no path params, so a
                        plain <Navigate> alias below is enough (no wrapper
                        component needed like the tokenised routes above). */}
                    <Route path="/kontakt" element={<ContactPage />} />
                    <Route path="/privatnost" element={<PrivacyPage />} />
                    <Route path="/uvjeti" element={<TermsPage />} />

                    {/* Legacy English aliases — client-side Navigate for any
                        in-app link or typed URL that slips past Caddy's
                        301. We preserve :param segments so the destination
                        gets the same slug/token. NB: <Navigate to=> doesn't
                        forward path params automatically; the wrappers
                        below extract and forward them. */}
                    <Route path="/login" element={<Navigate to="/prijava" replace />} />
                    <Route path="/register" element={<Navigate to="/registracija" replace />} />
                    <Route path="/tournaments" element={<Navigate to="/turniri" replace />} />
                    <Route path="/tournaments/new" element={<Navigate to="/turniri/novi" replace />} />
                    <Route path="/tournaments/:uuid/:section?" element={<LegacyTournamentRedirect />} />
                    <Route path="/calendar" element={<Navigate to="/kalendar" replace />} />
                    <Route path="/map" element={<Navigate to="/karta" replace />} />
                    <Route path="/find-pair" element={<Navigate to="/pronadi-para" replace />} />
                    <Route path="/profile" element={<Navigate to="/profil" replace />} />
                    <Route path="/profile/:slug" element={<LegacyProfileRedirect />} />
                    <Route path="/claim-pair/:token" element={<LegacyClaimPairRedirect />} />
                    <Route path="/claim-name/:token" element={<LegacyClaimNameRedirect />} />
                    <Route path="/contact" element={<Navigate to="/kontakt" replace />} />
                    <Route path="/privacy" element={<Navigate to="/privatnost" replace />} />
                    <Route path="/terms" element={<Navigate to="/uvjeti" replace />} />

                    {/* Catch-all — keep last so explicit routes win. */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
                </Suspense>
                </Container>
                {/* mt="auto" is the second half of the sticky-footer pattern:
                    on a page shorter than the viewport it gets pushed all the
                    way to the bottom of this flex column; on a longer page it
                    just sits right after the content, no extra gap. */}
                <SiteFooter mt="auto" />
            </Flex>
            {/* Mobile-only bottom tab bar — supplements the hamburger
                drawer in NavBar. The drawer still handles the help-tour
                replay + install affordance, but day-to-day routing is
                one tap away here on mobile. Rendered after (not inside) the
                flex column above: it's position:fixed, so paint order is all
                that matters, and keeping it a sibling means the column's
                min-height math never has to account for it. */}
            <MobileTabBar />
        </>
    )
}