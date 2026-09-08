import { Component, type ErrorInfo, type ReactNode } from "react"
import { useLocation } from "react-router-dom"
import { Box, Button, Heading, HStack, Text, VStack } from "@chakra-ui/react"
import { t } from "../i18n"
import OfflineNotice from "./OfflineNotice"
import { OFFLINE_CHUNK_ERROR } from "../utils/lazyWithReload"

type Props = {
    children: ReactNode
    /**
     * Change this value to clear a caught error and re-render `children`.
     * `RouteResetErrorBoundary` below feeds it the router location key, so a
     * component that crashed on one page doesn't pin the whole SPA to the
     * error screen for the rest of the session.
     */
    resetKey?: string | number
}
type State = {
    hasError: boolean
    /** The page's code is simply not on this device and there is no network to
     *  fetch it with — a different thing from a crash, and it gets a different
     *  screen (see `OfflineNotice`). */
    offline: boolean
}

/**
 * Top-level safety net: any uncaught render error (a crashing component, or a
 * lazy chunk that fails even after the one-shot reload in App.tsx) is caught
 * here and shown as a friendly "refresh" screen instead of a blank white page.
 */
export default class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, offline: false }

    static getDerivedStateFromError(error: unknown): State {
        // `name`, not `instanceof`: the error is thrown inside a lazily-loaded
        // module and crosses React's boundary machinery on the way here.
        const offline = error instanceof Error && error.name === OFFLINE_CHUNK_ERROR
        return { hasError: true, offline }
    }

    componentDidUpdate(prev: Props) {
        // A navigation happened while the error screen was up — give the new
        // route a clean slate. Without this the boundary stays latched and
        // every subsequent link click renders the same error page.
        if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
            this.setState({ hasError: false, offline: false })
        }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // A route chunk that is not on an offline device is an expected state,
        // not a defect — it gets its own screen and stays out of the console,
        // where a stack trace would only be noise.
        if (error.name === OFFLINE_CHUNK_ERROR) return
        // Surface for debugging; no external error reporting is wired up.
        console.error("[ErrorBoundary]", error, info.componentStack)
    }

    render() {
        if (!this.state.hasError) return this.props.children
        if (this.state.offline) return <OfflineNotice />
        return (
            <Box minH="100dvh" display="flex" alignItems="center" justifyContent="center" p="6">
                <VStack gap="4" textAlign="center" maxW="sm">
                    {/* No emoji here: the joker rendered as a white card on a
                        dark page, which read as a stray card left over from
                        the app's own deck rather than as an error mark. */}
                    <Heading size="md">{t("common.errorBoundary.title")}</Heading>
                    <Text fontSize="sm" color="fg.muted">
                        {t("common.errorBoundary.description")}
                    </Text>
                    <HStack gap="3">
                        <Button
                            variant="outline"
                            onClick={() => window.location.assign("/")}
                        >
                            {t("common.errorBoundary.home")}
                        </Button>
                        <Button colorPalette="blue" onClick={() => window.location.reload()}>
                            {t("common.errorBoundary.refresh")}
                        </Button>
                    </HStack>
                </VStack>
            </Box>
        )
    }
}

/**
 * Router-aware wrapper. Must be rendered INSIDE <BrowserRouter> — it reads the
 * location key (a fresh value per history entry, including repeat visits to the
 * same path) and hands it to the boundary as `resetKey`.
 */
export function RouteResetErrorBoundary({ children }: { children: ReactNode }) {
    const location = useLocation()
    return <ErrorBoundary resetKey={location.key}>{children}</ErrorBoundary>
}
