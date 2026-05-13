import { Routes, Route, Navigate } from 'react-router-dom'
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
                <Routes>
                    <Route path="/" element={<Navigate to="/tournaments" replace />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/tournaments" element={<TournamentsPage />} />
                    <Route
                        path="/tournaments/new"
                        element={
                            <RequireAuth>
                                <CreateTournamentPage />
                            </RequireAuth>
                        }
                    />
                    <Route path="/tournaments/:uuid" element={<TournamentDetailsPage />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/map" element={<MapPage />} />
                    <Route path="/find-pair" element={<FindPairPage />} />
                    {/* /profile bounces to /profile/{my-slug} once the
                        backend has synced. /profile/:slug is publicly visible
                        per product decision. */}
                    <Route path="/profile" element={<ProfileRedirect />} />
                    <Route path="/profile/:slug" element={<PublicProfilePage />} />
                    {/* Pair-sharing claim landing page. Public; the page
                        itself handles the "not logged in" case by linking
                        to /login?next=/claim-pair/{token} so the user lands
                        back here after auth. */}
                    <Route path="/claim-pair/:token" element={<ClaimPairPage />} />
                    {/* Preset-level (name) sharing — superseded /claim-pair
                        for new shares. Friend lands here after the primary
                        copies a Podijeli sa partnerom link. */}
                    <Route path="/claim-name/:token" element={<ClaimNamePage />} />
                    {/* Catch-all — keep last so explicit routes win. */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </Container>
        </>
    )
}