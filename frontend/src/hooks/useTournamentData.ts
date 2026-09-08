import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { useQuery } from "@tanstack/react-query"

import { fetchTournamentDetails, fetchTournamentPairs } from "../api/tournaments"
import { fetchRounds } from "../api/round"
import { listPairRequestsForTournament, type PairRequest } from "../api/pairRequests"
import { fetchBlokLinks, type OrganiserBlokLink } from "../api/blokLink"
import { useAuth } from "../auth/authContextValue"
import { qk, queryClient } from "../queryClient"
import { subscribeToOutcomes, useOfflineQueue } from "./useOfflineQueue"
import { useLiveSocket } from "./useLiveSocket"
import { usePolling } from "./usePolling"
import { useCanManageTournament } from "./useCanManageTournament"
import { errorMessage } from "../utils/apiError"
import { t as tStatic } from "../i18n"
import {
    FINISHED_SOCKET_GRACE_MS,
    type MatchLocal,
    type PendingScore,
    type RoundLocal,
    toRoundLocal,
    withPendingPaid,
    withPendingScores,
} from "../utils/tournamentMatch"
import type { MatchDto, RoundDto } from "../types/round"
import type { PairShort } from "../types/pairs"
import type { TournamentDetails } from "../types/tournaments"

/* ──────────────────────────────────────────────────────────────────────────
   The tournament detail page's data layer, on react-query.

   WHY THE CACHE AND NOT `useState`: the tournaments list already prefetches
   `qk.tournamentDetails(idOrSlug)` on card hover/tap (components/
   listingShared.ts). While this page fetched into its own state that prefetch
   only warmed the HTTP layer; keyed on the same registry entries, opening a
   card is now a genuine cache hit and the tiles paint before the network
   answers.

   WHAT THE CACHE HOLDS: not the raw DTOs — the LOCAL row shapes. A round in
   this page carries `_score1`/`_score2`/`_dirty`/`_editing`/`_pending`, and a
   pair list carries temp rows (negative ids) the server has never seen. Those
   are the whole reason the page cannot simply re-render from a refetch, so
   every fetch merges into the previous cached value instead of replacing it
   (`mergeRounds` / `mergePairs` below). The rules are the ones the pre-query
   poll used, unchanged:

     • `_dirty`  — typed, not sent. Never overwritten by a fetch.
     • `_editing`— a finished result reopened for correction. Same.
     • `_pending`— sent to the offline queue, not yet acknowledged. Re-applied
       from the queue AFTER the merge, so a server row can never repaint a
       score the organiser has already saved. This is the offline-queue
       contract (CLAUDE.md, "Realtime and offline") and the reason
       `withPendingScores` runs last, every single time.
     • temp pairs (id ≤ 0) are re-appended; dirty names and staged paid flags
       win over the server's copy.

   WHAT REPLACED THE TOKENS: `loadTokenRef` / `pollTokenRef` are gone. They
   existed to drop the result of a fetch that had been superseded — by a newer
   load, by a tournament switch, or by a local write. react-query does all
   three natively: a query only ever accepts the newest fetch for its key,
   switching `uuid` switches the key, and `queryClient.cancelQueries` (see
   `cancelInFlight`) makes an in-flight refetch's result be discarded rather
   than land on top of an optimistic write. The mutation hooks call that
   instead of bumping a counter.
   ────────────────────────────────────────────────────────────────────── */

export type TournamentData = ReturnType<typeof useTournamentData>

/** Empty-string key when there is no id yet — the queries are disabled anyway. */
const keysFor = (uuid: string | undefined) => {
    const id = uuid ?? ""
    return {
        details: qk.tournamentDetails(id),
        pairs: qk.tournamentPairs(id),
        rounds: qk.rounds(id),
        requests: qk.pairRequestsForTournament(id),
        blokLinks: qk.blokLinks(id),
    }
}

/**
 * Fold a freshly fetched round list into the cached one WITHOUT destroying
 * unsaved work. Only the four local-only fields are carried over from the old
 * row: `{ ...fresh, ...old }` used to spread the whole stale match back on
 * top, throwing away the `status` / `winnerPairId` / `paidAt` the request had
 * just gone and fetched.
 */
function mergeRounds(
    prev: RoundLocal[] | undefined,
    incoming: RoundDto[],
    pending: Map<number, PendingScore>,
): RoundLocal[] {
    if (!prev) return withPendingScores(incoming.map(toRoundLocal), pending)
    const prevById = new Map(prev.map((r) => [r.id, r]))
    return withPendingScores(
        incoming.map((r) => {
            const old = prevById.get(r.id)
            return {
                ...r,
                matches: r.matches.map((m): MatchLocal => {
                    const om = old?.matches.find((x) => x.id === m.id)
                    if (om && (om._dirty || om._editing)) {
                        return {
                            ...m,
                            _score1: om._score1,
                            _score2: om._score2,
                            _dirty: om._dirty,
                            _editing: om._editing,
                        }
                    }
                    return {
                        ...m,
                        _score1: m.score1 != null ? String(m.score1) : "",
                        _score2: m.score2 != null ? String(m.score2) : "",
                        _dirty: false,
                        _editing: false,
                    }
                }),
            }
        }),
        pending,
    )
}

export function useTournamentData(uuid: string | undefined) {
    const { user, loading: authLoading } = useAuth()

    const keys = useMemo(() => keysFor(uuid), [uuid])
    const enabled = !!uuid && !authLoading

    /**
     * Ids of pair rows the organiser has typed into since the last successful
     * save. A refetch must not overwrite these — a tick landing mid-typing
     * used to replace the whole list with the server's copy and silently
     * discard the rename.
     */
    const dirtyPairIdsRef = useRef<Set<number>>(new Set())

    /**
     * Paid-flag overrides captured BEFORE state has flushed — "Plati"'s
     * onMouseDown stamps the desired value here so the blur save that fires
     * immediately afterwards (mousedown → blur → click, in DOM event order)
     * can include the right paid value in its payload.
     */
    const pendingPaidRef = useRef<Map<number, boolean>>(new Map())

    /** Wall-clock of the last fetch — see the 5 s guard in `refreshLive`. */
    const lastFetchAtRef = useRef(0)

    /**
     * Mirror of the page's `anySaveInFlight` flag for the poll's callback.
     * `refreshLive` must keep a stable identity (it drives usePolling), so it
     * cannot close over the boolean. Assigned by the page during render.
     */
    const anySaveInFlightRef = useRef(false)

    /* ---------- Offline queue ----------
       The organiser runs the tournament from a phone in a hall with bad
       Wi-Fi. The three writes they actually type at the table — a match
       score, a drink on a bill, a kotizacija toggle — go through a durable
       queue instead of straight down the wire, so nothing typed during an
       outage is lost and a replay can never double-apply (each carries an
       X-Client-Op-Id the backend honours exactly once).

       NOT queued, on purpose: the round draw, finishing a round, starting /
       finishing / resetting the tournament, and the bulk pair replace. Those
       reorder global state and replaying them onto a server that has moved on
       would need real conflict resolution, not a replay marker. */
    const { pending: pendingOps, enqueue: enqueueOp } = useOfflineQueue(uuid)

    const pendingScores = useMemo(() => {
        const m = new Map<number, PendingScore>()
        // Later ops win: two edits to the same table render as the last one
        // the organiser made, which is the order they will also be sent in.
        for (const op of pendingOps) {
            if (op.kind === "matchScore") {
                m.set(op.payload.matchId, { score1: op.payload.score1, score2: op.payload.score2 })
            }
        }
        return m
    }, [pendingOps])

    const pendingPairPaid = useMemo(() => {
        const m = new Map<number, boolean>()
        for (const op of pendingOps) {
            if (op.kind === "pairPaid") m.set(op.payload.pairId, op.payload.paid)
        }
        return m
    }, [pendingOps])

    // Ref mirrors: the query functions below run outside React's render, and
    // the debounced socket callback must not be rebuilt when a map changes.
    const pendingScoresRef = useRef(pendingScores)
    pendingScoresRef.current = pendingScores
    const pendingPairPaidRef = useRef(pendingPairPaid)
    pendingPairPaidRef.current = pendingPairPaid
    const pendingOpsRef = useRef(pendingOps)
    pendingOpsRef.current = pendingOps

    /**
     * Fold a freshly fetched pair list into the cached one. Two kinds of row
     * have to survive: temp rows (negative id, added with "Dodaj par" and not
     * yet sent, so they simply do not exist in `incoming`), and rows the
     * organiser has typed into or whose paid flag is staged. Everything else
     * takes the server's version, which is the whole point of refetching.
     */
    const mergePolledPairs = useCallback((prev: PairShort[], incoming: PairShort[]): PairShort[] => {
        const dirtyIds = dirtyPairIdsRef.current
        const pendingPaid = pendingPaidRef.current
        const prevById = new Map(prev.map((p) => [p.id, p]))
        const merged = incoming.map((sp) => {
            const local = prevById.get(sp.id)
            if (!local) return sp
            const keepName = dirtyIds.has(sp.id)
            const stagedPaid = pendingPaid.get(sp.id)
            if (!keepName && stagedPaid === undefined) return sp
            return {
                ...sp,
                ...(keepName ? { name: local.name } : {}),
                ...(stagedPaid !== undefined ? { paid: stagedPaid } : {}),
            }
        })
        // Unsaved rows always sort last in the editor anyway (addPair appends),
        // so re-appending them preserves the order the organiser sees.
        const temps = prev.filter((p) => p.id <= 0)
        return temps.length === 0 ? merged : [...merged, ...temps]
    }, [])

    /* ---------- The four queries ----------
       `silent` is decided per call rather than per query: the FIRST load of a
       key should toast a failure (and does, through the axios interceptor),
       while every background refresh must not — a hall with flaky Wi-Fi would
       otherwise stack a red card every poll tick. "Do we already hold data for
       this key" is exactly that distinction, and it needs no extra flag. */
    const isRefresh = useCallback(
        (key: readonly unknown[]) => queryClient.getQueryData(key) !== undefined,
        [],
    )

    const detailsQ = useQuery({
        queryKey: keys.details,
        enabled,
        queryFn: async () => {
            lastFetchAtRef.current = Date.now()
            return fetchTournamentDetails(uuid as string, { silent: isRefresh(keys.details) })
        },
    })

    const pairsQ = useQuery({
        queryKey: keys.pairs,
        enabled,
        queryFn: async () => {
            const fresh = await fetchTournamentPairs(uuid as string, { silent: isRefresh(keys.pairs) })
            const prev = queryClient.getQueryData<PairShort[]>(keys.pairs)
            const merged = prev ? mergePolledPairs(prev, fresh) : fresh
            // A QUEUED kotizacija toggle is not abandoned work: it is a save
            // the organiser already made that simply hasn't reached the server.
            // It outranks the fetch, always, and survives a page reload too
            // (the queue lives in localStorage).
            return withPendingPaid(merged, pendingPairPaidRef.current)
        },
    })

    const roundsQ = useQuery({
        queryKey: keys.rounds,
        enabled,
        queryFn: async () => {
            const fresh = await fetchRounds(uuid as string, { silent: isRefresh(keys.rounds) })
            const prev = queryClient.getQueryData<RoundLocal[]>(keys.rounds)
            return mergeRounds(prev, fresh, pendingScoresRef.current)
        },
    })

    const requestsQ = useQuery({
        queryKey: keys.requests,
        enabled,
        // A missing / failing pair-request board must never keep the page on
        // its skeleton — it is a side panel on one section.
        queryFn: () => listPairRequestsForTournament(uuid as string).catch(() => [] as PairRequest[]),
    })

    const t = detailsQ.data ?? null
    const pairs = useMemo(() => pairsQ.data ?? [], [pairsQ.data])
    const rounds = useMemo(() => roundsQ.data ?? [], [roundsQ.data])
    const pairRequests = useMemo(() => requestsQ.data ?? [], [requestsQ.data])

    /* The page shows its skeleton until the three queries it actually renders
       from have landed. `requestsQ` is deliberately NOT in here: it is one
       collapsible panel on Parovi, it can only ever resolve (never reject),
       and gating the whole page on it would throw away the head start the
       prefetched details query just bought. */
    const loading = authLoading
        || (enabled && (detailsQ.isPending || pairsQ.isPending || roundsQ.isPending))
    const error = detailsQ.error
        ? errorMessage(detailsQ.error, tStatic("tournament.loadFailed"))
        : null

    const { canEditTournament } = useCanManageTournament(t)

    /**
     * "Poveži blok sa stolom" requests (BLOK-LINK.md). The list endpoint is
     * organiser/admin only, so this stays disabled for every other viewer —
     * a spectator's page never even asks for it, rather than asking and
     * eating a 403 on every poll tick.
     */
    const blokLinksQ = useQuery({
        queryKey: keys.blokLinks,
        enabled: enabled && canEditTournament,
        queryFn: () => fetchBlokLinks(uuid as string, { silent: isRefresh(keys.blokLinks) }),
    })
    const blokLinks = useMemo(() => blokLinksQ.data ?? [], [blokLinksQ.data])

    const setBlokLinks = useCallback<Dispatch<SetStateAction<OrganiserBlokLink[]>>>((update) => {
        queryClient.setQueryData<OrganiserBlokLink[]>(keys.blokLinks, (old) => {
            const prev = old ?? []
            return typeof update === "function"
                ? (update as (l: OrganiserBlokLink[]) => OrganiserBlokLink[])(prev)
                : update
        })
    }, [keys.blokLinks])

    /* ---------- Cache writers ----------
       The mutation hooks were written against `useState` setters and still
       are: these accept the same `SetStateAction` shape and write straight
       into the query cache, so an optimistic patch and a fetched value live in
       exactly one place. */
    const setT = useCallback<Dispatch<SetStateAction<TournamentDetails | null>>>((update) => {
        queryClient.setQueryData<TournamentDetails>(keys.details, (old) => {
            const prev = old ?? null
            const next = typeof update === "function"
                ? (update as (p: TournamentDetails | null) => TournamentDetails | null)(prev)
                : update
            // `undefined` tells react-query "no change"; a null tournament is
            // not a state this page ever writes deliberately, so treat it the
            // same rather than blanking a loaded cache entry.
            return next ?? old
        })
    }, [keys.details])

    const setPairs = useCallback<Dispatch<SetStateAction<PairShort[]>>>((update) => {
        queryClient.setQueryData<PairShort[]>(keys.pairs, (old) => {
            const prev = old ?? []
            return typeof update === "function"
                ? (update as (p: PairShort[]) => PairShort[])(prev)
                : update
        })
    }, [keys.pairs])

    const setRounds = useCallback<Dispatch<SetStateAction<RoundLocal[]>>>((update) => {
        queryClient.setQueryData<RoundLocal[]>(keys.rounds, (old) => {
            const prev = old ?? []
            return typeof update === "function"
                ? (update as (r: RoundLocal[]) => RoundLocal[])(prev)
                : update
        })
    }, [keys.rounds])

    const setPairRequests = useCallback<Dispatch<SetStateAction<PairRequest[]>>>((update) => {
        queryClient.setQueryData<PairRequest[]>(keys.requests, (old) => {
            const prev = old ?? []
            return typeof update === "function"
                ? (update as (p: PairRequest[]) => PairRequest[])(prev)
                : update
        })
    }, [keys.requests])

    /**
     * Discard whatever is in flight for this tournament.
     *
     * The replacement for `loadTokenRef.current += 1`. Every optimistic write
     * calls it for the same reason the counter existed: a fetch that STARTED
     * before the write must not land after it and repaint the row. Cancelled
     * queries keep their current (optimistic) data — react-query drops the
     * resolved value rather than applying it.
     */
    const cancelInFlight = useCallback(() => {
        void queryClient.cancelQueries({ queryKey: keys.details })
        void queryClient.cancelQueries({ queryKey: keys.pairs })
        void queryClient.cancelQueries({ queryKey: keys.rounds })
    }, [keys])

    /* ---------- Refetching ---------- */

    /** Every query for this tournament, awaited. Used by the round hard-reset,
     *  which rewrites enough server state that nothing local is worth keeping. */
    const refreshAll = useCallback(async () => {
        if (!uuid) return
        lastFetchAtRef.current = Date.now()
        const jobs = [
            queryClient.refetchQueries({ queryKey: keys.details }),
            queryClient.refetchQueries({ queryKey: keys.pairs }),
            queryClient.refetchQueries({ queryKey: keys.rounds }),
            queryClient.refetchQueries({ queryKey: keys.requests }),
        ]
        // Organiser/admin only — see blokLinksQ's `enabled` above. Refetching
        // this key for a spectator would fire the request anyway (manual
        // refetches ignore `enabled`) straight into a 403.
        if (canEditTournament) jobs.push(queryClient.refetchQueries({ queryKey: keys.blokLinks }))
        await Promise.all(jobs)
        lastFetchAtRef.current = Date.now()
    }, [uuid, keys, canEditTournament])

    /**
     * The background refresh the poll, the websocket and pull-to-refresh all
     * run. Details as well as rounds+pairs: the status flip to FINISHED (and
     * the podium names that come with it) reached a co-organiser's screen only
     * on a manual reload before it was included, and it is also what stops the
     * poll — `enabled` below reads `t.status`.
     *
     * @param force skip both guards. Only for the two cases with no second
     *        chance: the offline queue DROPPED an operation (the row on screen
     *        is a lie, and the drop lands moments after the request that set
     *        `lastFetchAtRef`), and an explicit pull-to-refresh, which the user
     *        is watching.
     * @returns true when the fetch actually ran, false when a guard bailed —
     *          the websocket path uses this to re-arm instead of losing a ping.
     */
    const refreshLive = useCallback(async (force = false): Promise<boolean> => {
        if (!uuid) return false
        // A save in flight owns the page's state until it resolves. Checked
        // HERE rather than in usePolling's `enabled` flag: flipping `enabled`
        // tears the interval down and rebuilds it, and usePolling fires
        // immediately whenever it becomes enabled — so every save used to end
        // with an instant extra round of requests, and a busy organiser kept
        // the interval in a permanent restart loop.
        if (!force && anySaveInFlightRef.current) return false
        // usePolling also fires on every tab focus. Skip a tick that lands on
        // top of a fetch we just made (initial load, a save that refetched,
        // tab flapping).
        if (!force && Date.now() - lastFetchAtRef.current < 5_000) return false
        lastFetchAtRef.current = Date.now()
        try {
            const jobs = [
                queryClient.refetchQueries({ queryKey: keys.details }),
                queryClient.refetchQueries({ queryKey: keys.pairs }),
                queryClient.refetchQueries({ queryKey: keys.rounds }),
            ]
            // Same reasoning as refreshAll: only ask for this when the viewer
            // can actually see it. The backend broadcasts the `match` scope
            // (not a new one) when a blok link changes, so this ping-driven
            // refresh is genuinely how an organiser's other open tab/device
            // learns about an approval — see BLOK-LINK.md §2.3.6.
            if (canEditTournament) jobs.push(queryClient.refetchQueries({ queryKey: keys.blokLinks }))
            await Promise.all(jobs)
        } catch (e) {
            // Every background call is silent (see `isRefresh`), so nothing was
            // toasted. A failed tick just means we retry next interval.
            // Reported as "ran" on purpose: a re-arming caller would otherwise
            // retry every 700 ms for as long as the backend stays unreachable.
            console.warn("Osvježavanje uživo nije uspjelo", e)
        }
        return true
    }, [uuid, keys, canEditTournament])

    /* ---------- Auth-aware reload ----------
       The backend redacts the organiser's contact phone for anonymous viewers
       (the "Prijavi se da vidiš broj" affordance is driven by that redaction),
       and widens the pair payload for the organiser. The query key is the
       tournament's id/slug ONLY — deliberately, so the list page's prefetch is
       a real hit — so signing in or out has to invalidate it by hand.

       This also throws away local edits, which is right: a login/logout is the
       one navigation-shaped event that abandons whatever was half-typed, and
       it is what the pre-query full reload did too.

       Skipped on the first run: mounting is not an auth change, and refetching
       there would undo the prefetch. */
    const lastUidRef = useRef<string | null | undefined>(undefined)
    useEffect(() => {
        if (authLoading) return
        const uid = user?.uid ?? null
        if (lastUidRef.current === undefined) {
            lastUidRef.current = uid
            return
        }
        if (lastUidRef.current === uid) return
        lastUidRef.current = uid
        dirtyPairIdsRef.current.clear()
        pendingPaidRef.current.clear()
        void queryClient.invalidateQueries({ queryKey: keys.details })
        void queryClient.invalidateQueries({ queryKey: keys.pairs })
        void queryClient.invalidateQueries({ queryKey: keys.rounds })
        void queryClient.invalidateQueries({ queryKey: keys.requests })
        void queryClient.invalidateQueries({ queryKey: keys.blokLinks })
    }, [authLoading, user?.uid, keys])

    /* Switching tournaments switches every query key, but the local overlay
       refs are per-hook, not per-key — they have to be emptied by hand or the
       next tournament would inherit the previous one's dirty pair ids. */
    useEffect(() => {
        dirtyPairIdsRef.current.clear()
        pendingPaidRef.current.clear()
    }, [uuid])

    /* ---------- Collapse state ----------
       Rounds open collapsed so the section starts compact; a round the user
       has already toggled keeps whatever they chose. Seeded from the rounds
       list rather than inside a fetch, so it works the same whether the data
       arrived from the network or straight out of the cache. */
    const [collapsedRounds, setCollapsedRounds] = useState<Record<number, boolean>>({})
    useEffect(() => {
        setCollapsedRounds((prev) => {
            let changed = false
            const next: Record<number, boolean> = { ...prev }
            for (const r of rounds) {
                if (next[r.id] === undefined) {
                    next[r.id] = true
                    changed = true
                }
            }
            // Returning `prev` unchanged matters: a new object every time would
            // re-render the whole bracket on every poll tick.
            return changed ? next : prev
        })
    }, [rounds])

    /* ---------- "Ne ponavljaj protivnike" ----------
       Local state so the switch can flip optimistically, re-synced whenever
       the server's value actually changes. */
    const [allowRepeats, setAllowRepeats] = useState<boolean>(false)
    const serverAllowRepeats = !(t?.preserveMatchmaking ?? true)
    useEffect(() => {
        setAllowRepeats(serverAllowRepeats)
    }, [serverAllowRepeats])

    /* ---------- Realtime (WebSocket) ----------
       The backend pings /ws/live/{uuid} whenever a spectator-visible write
       commits, so a result the organiser types shows up on every open page
       within a second instead of on the next poll tick. The ping carries no
       data: it just runs `refreshLive`, the exact same path the poll uses, so
       all of that function's guards apply unchanged. */
    const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    /**
     * A ping is outstanding: received, but no refresh has actually run for it.
     * `refreshLive` bails on a save in flight and on a fetch younger than 5 s,
     * and `lastFetchAtRef` is bumped by saves too — so the delay computed when
     * the ping arrived is often already stale when the timer fires. Without
     * this flag the ping simply vanished, and with the socket up the poll
     * behind it is 120 s away.
     */
    const livePendingRef = useRef(false)
    /** Unmounted (or the tournament changed) — stop re-arming. */
    const liveDisposedRef = useRef(false)
    // refreshLive's identity changes with `uuid`; keep it in a ref so the
    // debounced callback below never has to be rebuilt.
    const refreshLiveRef = useRef(refreshLive)
    refreshLiveRef.current = refreshLive

    /* ---------- Offline queue: reconciling what the queue sent ----------
       The queue owns the request; this is where its result lands. On success
       the row is patched from the server's canonical MatchDto — status,
       winnerPairId and paidAt included — and the pair list is re-read, because
       finishing a match moves wins/losses and can eliminate the loser. On a
       drop (the server rejected the operation outright) the optimistic row is
       now a lie, so the page resyncs; the queue has already toasted WHAT was
       dropped. */
    useEffect(() => {
        if (!uuid) return
        return subscribeToOutcomes((outcome) => {
            const op = outcome.op
            if (op.tournamentUuid !== uuid) return

            if (outcome.status === "dropped") {
                // Forced: the drop lands seconds after the request that set
                // lastFetchAtRef, so the ordinary 5 s guard would swallow this
                // resync and the row would keep showing the rejected score
                // until the next tick — up to 120 s with the socket connected.
                void refreshLiveRef.current(true)
                return
            }
            if (op.kind === "matchScore") {
                const saved = outcome.data as MatchDto
                setRounds((rs): RoundLocal[] =>
                    rs.map((r) =>
                        r.id !== op.payload.roundId
                            ? r
                            : {
                                ...r,
                                matches: r.matches.map((mx): MatchLocal =>
                                    mx.id !== op.payload.matchId ? mx : {
                                        ...mx,
                                        ...saved,
                                        _score1: saved.score1 != null ? String(saved.score1) : "",
                                        _score2: saved.score2 != null ? String(saved.score2) : "",
                                        _dirty: false,
                                        _editing: false,
                                        _pending: false,
                                    }
                                ),
                            }
                    )
                )
                cancelInFlight()
                void fetchTournamentPairs(uuid, { silent: true })
                    .then((list) => setPairs((prev) => withPendingPaid(
                        mergePolledPairs(prev, list), pendingPairPaidRef.current,
                    )))
                    .catch((e) => console.warn("Osvježavanje parova nakon rezultata nije uspjelo", e))
                return
            }
            if (op.kind === "pairPaid") {
                // 204, no body — the optimistic chip already shows the right
                // state and the op has just left the pending map, so the next
                // refetch is free to confirm it.
                cancelInFlight()
            }
        })
    }, [uuid, mergePolledPairs, setRounds, setPairs, cancelInFlight])

    /**
     * Arm the debounced live refetch, and RE-ARM it when a guard swallowed the
     * run: `refreshLive` returns false when it bailed, and the ping is only
     * considered delivered once one actually fetched.
     */
    const armLiveRefresh = useCallback(() => {
        if (liveDisposedRef.current) return
        // A single organiser action can emit several pings (a round draw
        // touches rounds AND pairs); collapse a burst into one refetch.
        if (liveTimerRef.current !== null) return
        // refreshLive drops a tick that lands within 5 s of the previous fetch.
        // For a poll that's right (nothing was lost — the next tick comes
        // soon); for a ping it would silently swallow a real change, so
        // instead of firing early we wait the guard out.
        const sinceLastFetch = Date.now() - lastFetchAtRef.current
        const delay = Math.max(700, 5_100 - sinceLastFetch)
        liveTimerRef.current = setTimeout(() => {
            liveTimerRef.current = null
            void refreshLiveRef.current().then((ran) => {
                if (ran) livePendingRef.current = false
                // Still outstanding: the delay is recomputed from the CURRENT
                // lastFetchAtRef, so a save that moved the guard forward is
                // waited out rather than lost.
                else if (livePendingRef.current) armLiveRefreshRef.current()
            })
        }, delay)
    }, [])
    // Self-reference for the re-arm above, so the callback keeps an empty
    // dependency array and a stable identity.
    const armLiveRefreshRef = useRef(armLiveRefresh)
    armLiveRefreshRef.current = armLiveRefresh

    const onLiveUpdate = useCallback(() => {
        livePendingRef.current = true
        armLiveRefreshRef.current()
    }, [])

    useEffect(() => {
        liveDisposedRef.current = false
        return () => {
            liveDisposedRef.current = true
            if (liveTimerRef.current !== null) clearTimeout(liveTimerRef.current)
        }
    }, [])

    /* ---------- Pull-to-refresh ----------
       `PwaNativeGestures` invalidates + refetches every mounted query and then
       fires `bela:refresh` for pages that need more than that. This page does:
       its own guards would otherwise swallow the refetch the user just asked
       for with a visible gesture, so the event forces one through. */
    useEffect(() => {
        const onRefresh = () => { void refreshLiveRef.current(true) }
        window.addEventListener("bela:refresh", onRefresh)
        return () => window.removeEventListener("bela:refresh", onRefresh)
    }, [])

    /**
     * A FINISHED tournament keeps its socket for a short grace window.
     *
     * The minute after the final is exactly when spectators care most: the
     * organiser flips the tournament to FINISHED and then types the podium
     * into the Parovi section. Before this the socket shut off the instant the
     * status changed, so everyone watching saw the finish and then nothing.
     *
     * There is no `finishedAt` column — FINISH only flips `status` and stamps
     * `winnerName`. `updatedAt` is the closest thing, and it behaves better
     * than a dedicated timestamp would: every podium edit bumps it again, so
     * the window follows the organiser instead of expiring mid-edit.
     */
    const finishedAtMs = t?.status === "FINISHED" && t.updatedAt
        ? new Date(t.updatedAt).getTime()
        : null
    const [finishedRecently, setFinishedRecently] = useState(false)
    useEffect(() => {
        if (finishedAtMs === null || Number.isNaN(finishedAtMs)) {
            setFinishedRecently(false)
            return
        }
        const remaining = FINISHED_SOCKET_GRACE_MS - (Date.now() - finishedAtMs)
        if (remaining <= 0) {
            setFinishedRecently(false)
            return
        }
        setFinishedRecently(true)
        // Close the socket the moment the window lapses. Without the timer a
        // tab left open on a just-finished tournament would hold its socket
        // indefinitely, because nothing else re-renders to re-evaluate this.
        const id = setTimeout(() => setFinishedRecently(false), remaining)
        return () => clearTimeout(id)
    }, [finishedAtMs])

    // Socket only for tournaments that can still change under the reader:
    // DRAFT (self-registrations, approvals, kotizacija), STARTED (the whole
    // ždrijeb) and a just-FINISHED one (the podium being filled in). An older
    // FINISHED tournament is read-only, and its page is the long tail of
    // traffic — holding an idle socket open for each view would cost far more
    // than it's worth.
    const { connected: liveConnected } = useLiveSocket(
        !loading && (t?.status === "DRAFT" || t?.status === "STARTED" || finishedRecently)
            ? t?.uuid
            : undefined,
        onLiveUpdate,
    )

    /*
     * `liveConnected` must NOT reach usePolling raw. It flips on every
     * reconnect, the flip changes `intervalMs`, a changed interval tears the
     * poll down and rebuilds it — and usePolling fires its callback
     * immediately on (re)mount. So a socket flap (deploy, proxy idle-kill)
     * cost every open page three extra GETs at the exact moment the backend
     * was coming back up. Committing the flip only once it has held for 5 s
     * means a flap is invisible to the interval.
     */
    const [liveConnectedSettled, setLiveConnectedSettled] = useState(false)
    useEffect(() => {
        const id = setTimeout(() => setLiveConnectedSettled(liveConnected), 5_000)
        return () => clearTimeout(id)
    }, [liveConnected])

    usePolling(
        () => { void refreshLive() },
        // With the socket up, the poll is only a safety net against a missed
        // ping, so it can back right off; without it, it's the only way the
        // page learns anything, so keep the old cadence.
        liveConnectedSettled ? 120_000 : (canEditTournament ? 45_000 : 20_000),
        // FINISHED and DRAFT tournaments don't change under the reader, so the
        // poll simply stops. `anySaveInFlight` deliberately does NOT appear
        // here — see the guard at the top of refreshLive.
        t?.status === "STARTED" && !loading,
    )

    return {
        // data
        t, setT,
        pairs, setPairs,
        rounds, setRounds,
        pairRequests, setPairRequests,
        blokLinks, setBlokLinks,
        collapsedRounds, setCollapsedRounds,
        allowRepeats, setAllowRepeats,
        loading, error,
        // fetching
        refreshAll, refreshLive,
        // offline queue
        pendingOps, enqueueOp, pendingScores, pendingPairPaid, pendingOpsRef,
        // machinery shared with the mutation hooks
        mergePolledPairs,
        cancelInFlight, anySaveInFlightRef, dirtyPairIdsRef, pendingPaidRef,
    }
}

export default useTournamentData
