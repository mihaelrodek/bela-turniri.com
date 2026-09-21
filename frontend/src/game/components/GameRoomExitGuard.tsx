import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import ConfirmDialog from "../../components/ConfirmDialog"
import { useTranslation } from "../../i18n"
import { registerExitGuard } from "../gameExitGuard"
import { useGameSocket } from "../hooks/useGameSocket"

/* ──────────────────────────────────────────────────────────────────────────
   GameRoomExitGuard — "ostani u sobi ili izađi?" while a seated player leaves
   an ACTIVE table. A lobby seat is not resumable play: navigation out of a
   waiting or finished room sends `room.leave` immediately and continues.

   WHY A CLICK INTERCEPT AND NOT `useBlocker`: react-router's blocker only
   exists on a data router (`createBrowserRouter`), and this app mounts a plain
   `<BrowserRouter>` in main.tsx. Converting the whole router to get one
   confirmation is not a trade worth making, so this guards the app's own
   navigation affordance instead — the `<a>` elements every Link renders — in
   the capture phase, before react-router's own handler sees the click.

   Deliberately narrow:
     • only asks while a game room page is mounted, we hold a seat, AND the
       room is PLAYING (a spectator drive-by and a lobby seat need no prompt);
     • only for in-app navigation that leaves the current table — opening the
       lobby at /igra therefore goes through the same leave flow, while links
       to a room page stay inside the game area;
     • plain left clicks only: modifier clicks, middle clicks and
       `target="_blank"` open a second tab and take nothing away from us.

   "Ostani u sobi" is a real cancel action: it closes the dialog and leaves
   the player at the table. Only "Izađi iz sobe" navigates away and starts
   the server's two-minute seat hold. `beforeunload` asks only during active
   play; in the lobby the server releases a disconnected seat immediately.

   Also registers with `gameExitGuard.ts` so the Android hardware back button
   (`NativeShell.tsx`, well outside this component's tree) can trigger the
   SAME dialog instead of leaving the seat — or throwing the player out —
   unasked. `pending` therefore carries either a link's destination or a
   back-button's own "resume" callback; `leave()`/the room-died effect below
   settle whichever one is waiting.
   ────────────────────────────────────────────────────────────────────── */

type PendingExit =
    | { source: "link"; to: string }
    | { source: "back"; leaveTable: () => void }

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
    const [pending, setPending] = useState<PendingExit | null>(null)
    const leaveRoom = socket.leaveRoom

    const seated = socket.room !== null && socket.yourSeat !== null
    const playing = socket.room?.status === "PLAYING"
    const seatedRef = useRef(seated)
    const playingRef = useRef(playing)
    seatedRef.current = seated
    playingRef.current = playing

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
            // Waiting rooms and finished games are real lobbies. Leaving one
            // frees the seat now; there is no active turn to preserve and no
            // two-minute return window to advertise.
            if (!playingRef.current) {
                leaveRoom()
                return
            }
            event.preventDefault()
            event.stopPropagation()
            setPending({ source: "link", to: `${url.pathname}${url.search}${url.hash}` })
        }
        document.addEventListener("click", onClick, true)

        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!seatedRef.current) return
            if (!playingRef.current) {
                leaveRoom()
                return
            }
            event.preventDefault()
        }
        window.addEventListener("beforeunload", onBeforeUnload)

        return () => {
            document.removeEventListener("click", onClick, true)
            window.removeEventListener("beforeunload", onBeforeUnload)
        }
    }, [seated, leaveRoom])

    // Android hardware back button (NativeShell.tsx), outside this
    // component's tree entirely. ALWAYS asks while a seat is held (owner's
    // decision, 2026-09-20): a hardware back on the table is far more often a
    // slip of the thumb than a decision, and unlike a nav link it gives no
    // hint of where it leads. A second back while the question is up means
    // "never mind" and closes it. A spectator holds nothing, so there is
    // nothing to ask about.
    const pendingRef = useRef<PendingExit | null>(null)
    pendingRef.current = pending
    useEffect(() => {
        registerExitGuard((leaveTable) => {
            if (pendingRef.current !== null) {
                setPending(null)
                return
            }
            if (!seatedRef.current) {
                leaveTable()
                return
            }
            setPending({ source: "back", leaveTable })
        })
        return () => registerExitGuard(null)
    }, [])

    // The room can die under an open dialog (game over + cleanup, kicked, a
    // reconnect that found nothing). Asking about a seat we no longer have
    // would be nonsense, so just go. A LINK exit is only ever asked about
    // during play, so it also resolves itself when play stops; a BACK exit is
    // asked about in the waiting room too and must survive that.
    useEffect(() => {
        if (pending === null) return
        const moot = pending.source === "link" ? !seated || !playing : !seated
        if (!moot) return
        const p = pending
        setPending(null)
        if (seated) leaveRoom()
        if (p.source === "link") navigate(p.to)
        else p.leaveTable()
    }, [pending, seated, playing, navigate, leaveRoom])

    const stay = useCallback(() => {
        setPending(null)
    }, [])

    const leave = useCallback(() => {
        const p = pending
        setPending(null)
        leaveRoom()
        if (p?.source === "link") navigate(p.to)
        else p?.leaveTable()
    }, [pending, navigate, leaveRoom])

    return (
        <ConfirmDialog
            open={pending !== null}
            title={t("game.exit.title")}
            description={t(playing ? "game.exit.description" : "game.exit.descriptionLobby")}
            confirmLabel={t("game.exit.leave")}
            cancelLabel={t("game.exit.stay")}
            destructive
            onConfirm={leave}
            onCancel={stay}
        />
    )
}
