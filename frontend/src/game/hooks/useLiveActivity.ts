import { useEffect, useMemo, useRef } from "react"
import type { PluginListenerHandle } from "@capacitor/core"
import type { ClientMessage, LiveActivityState, RoomState, Seat } from "@bela/protocol"
import type { PlayerView } from "@bela/engine"
import { isNative } from "../../platform"
import { nativeLiveActivity } from "../../platform/native"
import type { BelaLiveActivityPlugin } from "../../platform/liveActivityPlugin"
import { teamOf } from "../util/seats"

/* ──────────────────────────────────────────────────────────────────────────
   useLiveActivity — the running game on the lock screen (iOS Live Activity,
   Android Live Update).

   The table page derives one small `LiveActivityState` for the LOCAL player
   and hands it to the native `BelaLiveActivity` plugin: `start` when a seated
   game begins, `update` only when a field actually changed (every call wakes
   the OS widget renderer, and a view refresh that moved nothing the widget
   shows must not cost that), `end` on game over, on leaving the room and on
   unmount.

   Everything here is best effort and SILENT. On the web nothing runs at all;
   on iOS the plugin currently rejects every call (no widget target yet), and
   a lock-screen nicety failing is never worth a toast at the table.
   ────────────────────────────────────────────────────────────────────── */

/* The shape itself is `LiveActivityState` in `@bela/protocol`: the server,
   the backend's FCM relay and both native widgets decode exactly it, so it is
   imported, never restated here. Re-exported for the plugin's typing. */
export type { LiveActivityState }

const PHASES: Record<PlayerView["phase"], LiveActivityState["phase"]> = {
    BIDDING: "bidding",
    PLAYING: "playing",
    DEAL_DONE: "dealDone",
    GAME_OVER: "gameOver",
}

/* One availability probe per app run, shared by every mount: the answer is a
   property of the device and the build, not of the room. Resolves to the
   plugin when usable, null otherwise — a rejection (UNIMPLEMENTED on iOS)
   reads as null too. */
let availability: Promise<BelaLiveActivityPlugin | null> | null = null

function availablePlugin(): Promise<BelaLiveActivityPlugin | null> {
    if (!isNative) return Promise.resolve(null)
    if (availability === null) {
        availability = (async () => {
            try {
                const plugin = await nativeLiveActivity()
                const { available } = await plugin.isAvailable()
                return available ? plugin : null
            } catch {
                return null
            }
        })()
    }
    return availability
}

function sameState(a: LiveActivityState, b: LiveActivityState): boolean {
    return (Object.keys(a) as (keyof LiveActivityState)[]).every((key) => a[key] === b[key])
}

export interface UseLiveActivityArgs {
    room: RoomState | null
    view: PlayerView | null
    yourSeat: Seat | null
    turnDeadline: number | null
    send: (msg: ClientMessage) => void
}

export function useLiveActivity({ room, view, yourSeat, turnDeadline, send }: UseLiveActivityArgs): void {
    const mySeat: Seat | null = view?.seat ?? yourSeat

    const roomId = room?.id ?? null
    const roomPlaying = room?.status === "PLAYING"
    const target = room?.targetScore ?? 0
    const phase = view?.phase ?? null
    const myTeam = mySeat === null ? null : teamOf(mySeat)
    const scoreUs = view && myTeam ? view.score[myTeam] : 0
    const scoreThem = view && myTeam ? view.score[myTeam === "A" ? "B" : "A"] : 0
    const turnSeat = view?.turn ?? null
    const trump = view?.bidding.trump ?? null
    const winnerTeam = view?.winner ?? null

    // Memoised on the primitives, so its identity only moves when a field
    // the widget shows does.
    const state = useMemo<LiveActivityState | null>(() => {
        if (roomId === null || phase === null || mySeat === null || myTeam === null) return null
        return {
            roomId,
            phase: PHASES[phase],
            scoreUs,
            scoreThem,
            target,
            yourTurn: turnSeat !== null && turnSeat === mySeat,
            turnSeat,
            turnDeadline: turnSeat === null ? null : turnDeadline,
            trump,
            winner: phase === "GAME_OVER" && winnerTeam !== null ? (winnerTeam === myTeam ? "us" : "them") : null,
        }
    }, [roomId, phase, mySeat, myTeam, scoreUs, scoreThem, target, turnSeat, turnDeadline, trump, winnerTeam])

    /* Decisions are taken synchronously in the effects; the native calls run
       on one promise chain so a `start` is always settled before the
       `update` that follows it, however fast the view moves. */
    const session = useRef<{ running: boolean; last: LiveActivityState | null; chain: Promise<void> }>({
        running: false,
        last: null,
        chain: Promise.resolve(),
    })

    useEffect(() => {
        const s = session.current
        const run = (op: (plugin: BelaLiveActivityPlugin) => Promise<void>) => {
            s.chain = s.chain
                .then(async () => {
                    const plugin = await availablePlugin()
                    if (plugin) await op(plugin)
                })
                .catch(() => undefined)
        }
        if (!isNative) return

        const live = state !== null && roomPlaying && state.phase !== "gameOver"
        if (live) {
            if (!s.running) {
                s.running = true
                s.last = state
                run((plugin) => plugin.start({ state }))
            } else if (s.last === null || !sameState(s.last, state)) {
                s.last = state
                run((plugin) => plugin.update({ state }))
            }
            return
        }
        if (!s.running) return
        s.running = false
        s.last = null
        // A finished game leaves its final score on the lock screen; leaving
        // the room (or standing up) just removes the activity.
        if (state !== null && state.phase === "gameOver") run((plugin) => plugin.end({ state }))
        else run((plugin) => plugin.end({}))
    }, [state, roomPlaying])

    // Unmount — navigating away from the table ends the activity too.
    useEffect(() => {
        const s = session.current
        return () => {
            if (!s.running) return
            s.running = false
            s.last = null
            s.chain = s.chain
                .then(async () => {
                    const plugin = await availablePlugin()
                    if (plugin) await plugin.end({})
                })
                .catch(() => undefined)
        }
    }, [])

    /* iOS hands out APNs tokens asynchronously; the server needs them to push
       updates while the app is suspended. Android emits neither event, so the
       listeners simply never fire there. */
    useEffect(() => {
        if (!isNative) return
        let cancelled = false
        const handles: PluginListenerHandle[] = []
        const forward = (msg: ClientMessage) => {
            try {
                send(msg)
            } catch {
                // Silent by design — see the header.
            }
        }
        void (async () => {
            try {
                const plugin = await availablePlugin()
                if (!plugin || cancelled) return
                handles.push(await plugin.addListener("activityToken", ({ token }) => {
                    forward({ t: "liveActivity.tokens", activityToken: token })
                }))
                handles.push(await plugin.addListener("pushToStartToken", ({ token }) => {
                    forward({ t: "liveActivity.tokens", pushToStartToken: token })
                }))
                // Unmounted while the listeners were being registered.
                if (cancelled) handles.forEach((handle) => void handle.remove().catch(() => undefined))
            } catch {
                // Not available — nothing to listen to.
            }
        })()
        return () => {
            cancelled = true
            handles.forEach((handle) => void handle.remove().catch(() => undefined))
        }
    }, [send])
}
