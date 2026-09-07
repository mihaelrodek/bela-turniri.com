import type { ReactNode } from "react"
import { Center, Spinner } from "@chakra-ui/react"
import { Navigate } from "react-router-dom"
import { useGameEnabled } from "./hooks/useGameEnabled"

/**
 * Wraps the `/igra` routes. Renders nothing (a brief spinner) while the
 * production flag is loading, bounces to the home page once it resolves to
 * off, and otherwise renders the real page. See `hooks/useGameEnabled.ts`
 * for how the flag itself is toggled on the server.
 */
export default function GameFeatureGate({ children }: { children: ReactNode }) {
    const enabled = useGameEnabled()

    if (enabled === null) {
        return (
            <Center minH="40vh">
                <Spinner />
            </Center>
        )
    }
    if (!enabled) return <Navigate to="/" replace />
    return children
}
