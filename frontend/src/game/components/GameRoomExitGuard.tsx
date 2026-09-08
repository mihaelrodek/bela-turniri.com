import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import ConfirmDialog from "../../components/ConfirmDialog"
import { useTranslation } from "../../i18n"
import { useGameSocket } from "../hooks/useGameSocket"

/* ──────────────────────────────────────────────────────────────────────────
   GameRoomExitGuard — "ostani u sobi ili izađi?" when a seated player clicks
   their way out of the table.

   WHY A CLICK INTERCEPT AND NOT `useBlocker`: react-router's blocker only
   exists on a data router (`createBrowserRouter`), and this app mounts a plain
   `<BrowserRouter>` in main.tsx. Converting the whole router to get one
   confirmation is not a trade worth making, so this guards the app's own
   navigation affordance instead — the `<a>` elements every Link renders — in
   the capture phase, before react-router's own handler sees the click.

   Deliberately narrow:
     • only while a game room page is mounted AND we actually hold a seat (a
       spectator drive-by is nobody's business, and neither is a table we
       already left);
     • only for in-app navigation that leaves the current table — opening the
       lobby at /igra therefore goes through the same leave flow, while links
       to a room page stay inside the game area;
     • plain left clicks only: modifier clicks, middle clicks and
       `target="_blank"` open a second tab and take nothing away from us.

   "Ostani u sobi" is a real cancel action: it closes the dialog and leaves
   the player at the table. Only "Izađi iz sobe" navigates away and starts
   the server's two-minute seat hold. `beforeunload` covers the other exit
   (closing the tab), where all we can do is ask the browser to ask.
   ────────────────────────────────────────────────────────────────────── */

/** Another table URL is still a table. The lobby (`/igra`) is an exit from
 * active play and therefore has to start the same leave flow as every other
 * destination. */
function insideGame(pathname: string): boolean {
    return pathname.startsWith("/igra/soba/")
}

export default function GameRoomExitGuard() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    // Passive: the room page itself holds the connection; the guard only reads it.
    const socket = useGameSocket({ passive: true })
    const [pending, setPending] = useState<string | null>(null)

    const seated = socket.room !== null && socket.yourSeat !== null
    const seatedRef = useRef(seated)
    seatedRef.current = seated

    useEffect(() => {
        if (!seated) return
        const onClick = (event: MouseEvent) => {
            if (!seatedRef.current) return
            if (event.defaultPrevented || event.button !== 0) return
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null
            if (!anchor) return
            if (anchor.target && anchor.target !== "_self") return
            if (anchor.hasAttribute("download")) return
            const url = new URL(anchor.href, window.location.href)
            if (url.origin !== window.location.origin) return
            if (insideGame(url.pathname)) return
            event.preventDefault()
            event.stopPropagation()
            setPending(`${url.pathname}${url.search}${url.hash}`)
        }
        document.addEventListener("click", onClick, true)

        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!seatedRef.current) return
            event.preventDefault()
        }
        window.addEventListener("beforeunload", onBeforeUnload)

        return () => {
            document.removeEventListener("click", onClick, true)
            window.removeEventListener("beforeunload", onBeforeUnload)
        }
    }, [seated])

    // The room can die under an open dialog (game over + cleanup, kicked, a
    // reconnect that found nothing). Asking about a seat we no longer have
    // would be nonsense, so just go.
    useEffect(() => {
        if (pending !== null && !seated) {
            const to = pending
            setPending(null)
            navigate(to)
        }
    }, [pending, seated, navigate])

    const stay = useCallback(() => {
        setPending(null)
    }, [])

    const leave = useCallback(() => {
        const to = pending
        setPending(null)
        socket.leaveRoom()
        if (to) navigate(to)
    }, [pending, navigate, socket])

    return (
        <ConfirmDialog
            open={pending !== null}
            title={t("game.exit.title")}
            description={t("game.exit.description")}
            confirmLabel={t("game.exit.leave")}
            cancelLabel={t("game.exit.stay")}
            destructive
            onConfirm={leave}
            onCancel={stay}
        />
    )
}
