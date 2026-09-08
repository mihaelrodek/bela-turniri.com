import type { ReactNode } from "react"
import { Center, Spinner } from "@chakra-ui/react"
import GameComingSoonPage from "./GameComingSoonPage"
import { useGameEnabled } from "./hooks/useGameEnabled"

/**
 * The ONE place the online-bela kill switch is acted on.
 *
 * The flag itself is unchanged — `ops/toggle-game.sh` still flips a file that
 * Caddy serves as `/game-status.json`, and `hooks/useGameEnabled.ts` still
 * fetches it, so turning the game on or off in production still needs no
 * rebuild. What changed is what the app DOES with the answer:
 *
 *   - "Igraj" is now a permanent item in BOTH navigations. Neither NavBar nor
 *     MobileTabBar reads the flag any more — a menu whose items appear and
 *     disappear is worse than a menu that always tells the truth about where
 *     you can go.
 *   - Off ⇒ every `/igra` route renders {@link GameComingSoonPage}, which
 *     says so plainly and offers a way back. It is NOT a redirect: bouncing
 *     someone to `/turniri` after they deliberately tapped "Igraj" reads as a
 *     broken link.
 *   - On ⇒ the children render exactly as before.
 *
 * Because the children are only *created* here and not rendered while the
 * flag is off, React.lazy never resolves them — a visitor who cannot play
 * still never downloads the game chunk.
 *
 * While the flag is still resolving (`useGameEnabled()` returns `null` before
 * `/game-status.json` answers) we show a spinner, deliberately rendering
 * NEITHER branch: a flash of the lobby that vanishes, or a "dolazi uskoro"
 * that turns into a working game a moment later, would both be worse than a
 * beat of honest waiting. In dev the hook short-circuits to `true`
 * synchronously, so the spinner is a production-only frame.
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
    if (!enabled) return <GameComingSoonPage />
    return children
}
