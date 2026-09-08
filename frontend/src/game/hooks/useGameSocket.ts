import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import type { ClientMessage, Reaction } from "@bela/protocol"
import { useAuth } from "../../auth/authContextValue"
import {
    clearError as clearErrorImpl,
    dismissWidget as dismissWidgetImpl,
    getSnapshot,
    leaveRoom as leaveRoomImpl,
    refresh,
    retain,
    send as sendImpl,
    setAuth,
    subscribe,
} from "../gameConnection"
import type { GameSocketState, Retainer } from "../gameConnection"

/* ──────────────────────────────────────────────────────────────────────────
   useGameSocket — React's view of the ONE game connection.

   The socket itself lives in `../gameConnection.ts`, outside React, because
   room membership has to outlive the `/igra/*` pages (see that file's header
   for the full reasoning). This hook is a subscription plus a retainer: while
   a component using it is mounted with `passive: false`, the connection is
   kept open and steered towards the room / lobby that component wants.

   The returned shape is unchanged from when the socket lived in here, so the
   lobby and the table need no rewrite; `activeSeat`, `leaveRoom` and the
   sticky-membership fields are the additions the seat-hold work brought.
   ────────────────────────────────────────────────────────────────────── */

export type { GameSocketState, SeatReaction } from "../gameConnection"

export interface UseGameSocketOptions {
    /** Room to (re)join as soon as the connection is greeted. */
    roomId?: string
    /** Subscribe to the lobby room list (the lobby page does, a table does not). */
    lobby?: boolean
    /** Dev-only: talk to `mock/mockGameServer.ts` instead of the network. */
    mock?: boolean
    /**
     * Follow the sticky room membership instead of a fixed `roomId`: the
     * connection is retained only while we are still a member of some room.
     * This is what lets the app-wide widget exist without opening a socket for
     * every visitor of the site.
     */
    sticky?: boolean
    /** Read the store without keeping the connection alive. */
    passive?: boolean
}

export interface GameSocket extends GameSocketState {
    send: (msg: ClientMessage) => void
    /** `chat.react` — rate-limited to one per `LIMITS.reactionCooldownMs` by
     *  the sender (`ReactionsBar`) and by the server. */
    sendReaction: (reaction: Reaction) => void
    clearError: () => void
    /** Leave the room; a running game starts the server's two-minute seat hold. */
    leaveRoom: () => void
    /** Hide the floating "active room" widget without leaving. */
    dismissWidget: () => void
}

export function useGameSocket(options: UseGameSocketOptions = {}): GameSocket {
    const { roomId, lobby = false, mock = false, sticky = false, passive = false } = options
    const { user } = useAuth()
    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

    const uid = user?.uid ?? null
    const userRef = useRef(user)
    userRef.current = user

    // Sticky consumers steer at whatever room we still belong to; everyone else
    // at the room they were given.
    const wantRoomId = sticky ? (state.stickyRoomId ?? undefined) : roomId
    const active = !passive && (!sticky || state.stickyRoomId !== null)

    // One retainer object per mounted consumer, mutated in place so changing an
    // option never churns the connection.
    const retainerRef = useRef<Retainer>({ roomId: wantRoomId, lobby, mock, active })

    useEffect(() => {
        setAuth(uid, async () => userRef.current?.getIdToken())
    }, [uid])

    useEffect(() => {
        const retainer = retainerRef.current
        return retain(retainer)
    }, [])

    useEffect(() => {
        const retainer = retainerRef.current
        retainer.roomId = wantRoomId
        retainer.lobby = lobby
        retainer.mock = mock
        retainer.active = active
        refresh()
    }, [wantRoomId, lobby, mock, active])

    const send = useCallback((msg: ClientMessage) => sendImpl(msg), [])
    const sendReaction = useCallback((reaction: Reaction) => sendImpl({ t: "chat.react", reaction }), [])
    const clearError = useCallback(() => clearErrorImpl(), [])
    const leaveRoom = useCallback(() => leaveRoomImpl(), [])
    const dismissWidget = useCallback(() => dismissWidgetImpl(), [])

    return useMemo(
        () => ({ ...state, send, sendReaction, clearError, leaveRoom, dismissWidget }),
        [state, send, sendReaction, clearError, leaveRoom, dismissWidget],
    )
}

/** The app-wide widget's view: no socket at all unless a membership survives. */
export function useActiveRoom(): GameSocket {
    return useGameSocket({ sticky: true })
}
