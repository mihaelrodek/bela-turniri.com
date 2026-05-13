import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import { Container } from '@chakra-ui/react'
import NavBar from './components/NavBar'
import PushBootstrap from './components/PushBootstrap'
import ThemeSync from './components/ThemeSync'
import TournamentsPage from './pages/TournamentsPage'
import CreateTournamentPage from './pages/CreateTournamentPage'
import TournamentDetailsPage from './pages/TournamentDetailsPage'
import FindPairPage from "./pages/FindPairPage"
import CalendarPage from "./pages/CalendarPage"
import MapPage from "./pages/MapPage"
import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"
import ProfileRedirect from "./pages/ProfileRedirect"
import PublicProfilePage from "./pages/PublicProfilePage"
import ClaimPairPage from "./pages/ClaimPairPage"
import ClaimNamePage from "./pages/ClaimNamePage"
import NotFoundPage from "./pages/NotFoundPage"
import { RequireAuth } from "./components/RequireAuth"

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
    const { uuid } = useParams()
    const { search } = useLocation()
    return <Navigate to={`/turniri/${uuid ?? ""}${search}`} replace />
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
    return (
        <>
            <NavBar />
            {/* Auto-subscribes the user to Web Push once we know who they
                are. Also listens for SW notification-click navigation
                messages and routes the SPA without a reload. */}
            <PushBootstrap />
            {/* Pulls the user's saved theme from /user/me/profile on
                login so the choice follows them across devices. */}
            <ThemeSync />
            <Container maxW="6xl" py={6}>
                {/* All user-facing routes use Croatian slugs. English slugs
                    (/tournaments, /profile, /calendar, …) are kept around
                    purely as <Navigate replace> aliases so existing
                    in-browser links don't break — server-side 301 redirects
                    in Caddy handle the SEO side. */}
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
                    <Route path="/turniri/:uuid" element={<TournamentDetailsPage />} />
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
                    <Route path="/tournaments/:uuid" element={<LegacyTournamentRedirect />} />
                    <Route path="/calendar" element={<Navigate to="/kalendar" replace />} />
                    <Route path="/map" element={<Navigate to="/karta" replace />} />
                    <Route path="/find-pair" element={<Navigate to="/pronadi-para" replace />} />
                    <Route path="/profile" element={<Navigate to="/profil" replace />} />
                    <Route path="/profile/:slug" element={<LegacyProfileRedirect />} />
                    <Route path="/claim-pair/:token" element={<LegacyClaimPairRedirect />} />
                    <Route path="/claim-name/:token" element={<LegacyClaimNameRedirect />} />

                    {/* Catch-all — keep last so explicit routes win. */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </Container>
        </>
    )
}