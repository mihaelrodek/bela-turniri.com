import { Routes, Route, Navigate } from 'react-router-dom'
import { Container } from '@chakra-ui/react'
import NavBar from './components/NavBar'
import PushBootstrap from './components/PushBootstrap'
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
                    {/* Catch-all — keep last so explicit routes win. */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </Container>
        </>
    )
}