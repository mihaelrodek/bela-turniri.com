import { useCallback, useMemo, useState } from "react"
import type { Dispatch, SetStateAction } from "react"

import {
    fetchTournamentDetails,
    fetchTournamentPairs,
    finishTournament,
    resetTournament as apiResetTournament,
    setAllowRepeats as apiSetAllowRepeats,
    startTournament,
} from "../api/tournaments"
import {
    drawRound,
    fetchRounds,
    finishRound,
    hardResetRound,
    overrideMatchScore,
    updateMatchScore,
} from "../api/round"
import { showError } from "../toaster"
import { t as tStatic, useTranslation } from "../i18n"
import { errorMessage } from "../utils/apiError"
import { invalidateTournamentLists } from "../pages/tournament/cache"
import { type MatchLocal, type RoundLocal, toRoundLocal } from "../utils/tournamentMatch"
import type { RoundDto } from "../types/round"
import type { PairShort } from "../types/pairs"
import type { TournamentDetails } from "../types/tournaments"

/** The one queue kind this hook pushes — see hooks/useOfflineQueue. */
type EnqueueMatchScore = (
    kind: "matchScore",
    payload: { roundId: number; matchId: number; score1: number | null; score2: number | null },
) => unknown

type Args = {
    uuid: string | undefined
    t: TournamentDetails | null
    setT: Dispatch<SetStateAction<TournamentDetails | null>>
    rounds: RoundLocal[]
    setRounds: Dispatch<SetStateAction<RoundLocal[]>>
    setPairs: Dispatch<SetStateAction<PairShort[]>>
    setCollapsedRounds: Dispatch<SetStateAction<Record<number, boolean>>>
    allowRepeats: boolean
    setAllowRepeats: Dispatch<SetStateAction<boolean>>
    /** Discards fetches already in flight, so one that STARTED before an
     *  optimistic write can't land after it and repaint the row. */
    cancelInFlight: () => void
    /** Still-queued ops — "Završi rundu" refuses while any are outstanding. */
    pendingOpsRef: { current: readonly unknown[] }
    requireOnlineFor: (title: string) => boolean
    enqueueOp: EnqueueMatchScore
    refreshAll: () => Promise<void>
}

/**
 * The ždrijeb's whole write side: score entry (queued), round lifecycle
 * (draw / finish / hard reset) and tournament lifecycle (start / finish /
 * reset), plus the confirmation-dialog state each of the destructive ones
 * routes through.
 *
 * The structural operations here are deliberately NOT queued — they reorder
 * global state (who plays whom, who is eliminated) and replaying them onto a
 * server that has moved on would need real conflict resolution, not a replay
 * marker. Offline they refuse through `requireOnlineFor`.
 */
export function useTournamentRounds({
    uuid,
    t,
    setT,
    rounds,
    setRounds,
    setPairs,
    setCollapsedRounds,
    allowRepeats,
    setAllowRepeats,
    cancelInFlight,
    pendingOpsRef,
    requireOnlineFor,
    enqueueOp,
    refreshAll,
}: Args) {
    const { t: tr } = useTranslation()

    /* ---------- In-flight guards ----------
       Every one of these gates a button so a double tap (or an impatient
       second click on a slow connection) can't fire the same mutation
       twice. They also collectively pause the live poll — a poll response
       landing mid-save would overwrite the optimistic local state the save
       is about to confirm. */
    const [creatingRound, setCreatingRound] = useState(false)
    const [finishingRoundId, setFinishingRoundId] = useState<number | null>(null)
    const [savingMatchId, setSavingMatchId] = useState<number | null>(null)
    const [savingPM, setSavingPM] = useState(false)
    // Lifecycle transitions. Both are one-way and expensive to undo, so the
    // button must lock the moment it is pressed rather than a render later.
    const [startingTournament, setStartingTournament] = useState(false)
    const [finishingTournament, setFinishingTournament] = useState(false)
    const [resettingTournament, setResettingTournament] = useState(false)
    const [hardResettingRound, setHardResettingRound] = useState(false)

    // Two-phase confirmations that replaced window.confirm().
    const [resetTournamentOpen, setResetTournamentOpen] = useState(false)
    const [pendingHardResetRound, setPendingHardResetRound] = useState<number | null>(null)
    const [unpaidOpen, setUnpaidOpen] = useState(false)
    // Manual round generation — for the late-bracket stage.
    const [manualRoundOpen, setManualRoundOpen] = useState(false)
    const [manualConfirmOpen, setManualConfirmOpen] = useState(false)

    /* ---------- Per-match local editing ---------- */

    const enterEdit = useCallback((roundId: number, matchId: number) => {
        setRounds(rs =>
            rs.map(r =>
                r.id !== roundId ? r : {
                    ...r,
                    matches: r.matches.map(m =>
                        m.id !== matchId ? m : {
                            ...m,
                            _editing: true,
                            _score1: m.score1 != null ? String(m.score1) : "",
                            _score2: m.score2 != null ? String(m.score2) : "",
                            _dirty: true,
                        }
                    )
                }
            )
        )
    }, [setRounds])

    const cancelEdit = useCallback((roundId: number, matchId: number) => {
        setRounds(rs =>
            rs.map(r =>
                r.id !== roundId ? r : {
                    ...r,
                    matches: r.matches.map(m =>
                        m.id !== matchId ? m : {
                            ...m,
                            _editing: false,
                            _score1: m.score1 != null ? String(m.score1) : "",
                            _score2: m.score2 != null ? String(m.score2) : "",
                            _dirty: false,
                        }
                    )
                }
            )
        )
    }, [setRounds])

    const setLocalMatchScore = useCallback((
        roundId: number,
        matchId: number,
        which: "A" | "B",
        raw: string,
    ) => {
        const v = raw.replace(/[^\d]/g, "")
        setRounds((rs): RoundLocal[] =>
            rs.map((r) =>
                r.id !== roundId
                    ? r
                    : {
                        ...r,
                        matches: r.matches.map((m): MatchLocal =>
                            m.id !== matchId
                                ? m
                                : {
                                    ...m,
                                    _score1: which === "A" ? v : m._score1,
                                    _score2: which === "B" ? v : m._score2,
                                    _dirty: true,
                                }
                        ),
                    }
            )
        )
    }, [setRounds])

    /**
     * Patch just one match's `paidAt` after the bill dialog wrote it, so the
     * badge updates without a full rounds refetch. Stable, so the memoised
     * match row doesn't re-render the whole round for it.
     */
    const patchMatchPaidAt = useCallback((
        roundId: number,
        matchId: number,
        paidAt: string | null,
    ) => {
        setRounds((rs) =>
            rs.map((rr) =>
                rr.id !== roundId
                    ? rr
                    : {
                        ...rr,
                        matches: rr.matches.map((mx) =>
                            mx.id !== matchId ? mx : { ...mx, paidAt },
                        ),
                    },
            ),
        )
    }, [setRounds])

    /**
     * Save one table's result.
     *
     * The write does NOT go straight down the wire: it goes into the offline
     * queue, which sends it immediately when there is a connection and holds
     * it (in localStorage, across reloads) when there isn't. A score typed in
     * a hall with no signal must survive, and the retry that follows must not
     * apply it twice — which the queue's per-op X-Client-Op-Id guarantees.
     *
     * The row is marked `_pending` rather than `_dirty`: the organiser is done
     * with it, so the Spremi button goes quiet, but the poll and the websocket
     * refresh still know not to repaint it (withPendingScores).
     */
    const saveMatch = useCallback(async (roundId: number, m: MatchLocal) => {
        if (!uuid) return
        const n1 = m._score1 && m._score1.trim() !== "" ? Number(m._score1) : undefined
        const n2 = m._score2 && m._score2.trim() !== "" ? Number(m._score2) : undefined
        if (n1 !== undefined && !Number.isFinite(n1)) return
        if (n2 !== undefined && !Number.isFinite(n2)) return

        const score1 = n1 ?? null
        const score2 = n2 ?? null
        enqueueOp("matchScore", { roundId, matchId: m.id, score1, score2 })

        setRounds((rs): RoundLocal[] =>
            rs.map((r) =>
                r.id !== roundId
                    ? r
                    : {
                        ...r,
                        matches: r.matches.map((mx) =>
                            mx.id !== m.id ? mx : {
                                ...mx,
                                score1,
                                score2,
                                _score1: score1 != null ? String(score1) : "",
                                _score2: score2 != null ? String(score2) : "",
                                _dirty: false,
                                _editing: false,
                                _pending: true,
                            }
                        ),
                    }
            )
        )

        // Any fetch that started before this write is now stale — drop it
        // rather than let it repaint the score we just saved.
        cancelInFlight()
    }, [uuid, enqueueOp, setRounds, cancelInFlight])

    const saveEditedMatch = useCallback(async (roundId: number, m: MatchLocal) => {
        if (!uuid) return
        const n1 = m._score1 && m._score1.trim() !== "" ? Number(m._score1) : null
        const n2 = m._score2 && m._score2.trim() !== "" ? Number(m._score2) : null

        if (m.pair1Id && m.pair2Id) {
            if (n1 == null || n2 == null || !Number.isFinite(n1) || !Number.isFinite(n2) || n1 === n2) {
                // `tStatic` — this callback's dependency array stays as it is.
                showError(
                    tStatic("tournament.match.invalidScoreTitle"),
                    tStatic("tournament.match.invalidScoreDescription"),
                )
                return
            }
        }

        if (savingMatchId != null) return
        setSavingMatchId(m.id)
        try {
            const updatedRound = await overrideMatchScore(uuid, roundId, m.id, { score1: n1, score2: n2 })

            setRounds(rs =>
                rs.map(r =>
                    r.id !== updatedRound.id ? r : toRoundLocal(updatedRound)
                )
            )

            // Overriding a finished score can flip a winner, which rolls
            // wins/losses/elimination back on the server and can even clear
            // the tournament's stored winner — so both pairs and details
            // have to be re-read. Fired in parallel, not one after the other.
            const [pairList, details] = await Promise.all([
                fetchTournamentPairs(uuid),
                fetchTournamentDetails(uuid),
            ])
            setPairs(pairList)
            setT(details)
        } catch (e) {
            // Leave the row in edit mode with the typed scores intact so the
            // organiser can correct and retry; interceptor already toasted.
            console.warn("Spremanje ispravljenog rezultata nije uspjelo", e)
        } finally {
            setSavingMatchId(null)
        }
    }, [uuid, savingMatchId, setRounds, setPairs, setT])

    /* ---------- Rounds ---------- */

    /**
     * Append a server-returned RoundDto to our local rounds state with
     * the extra editor fields the UI tracks per-match.
     */
    function appendRoundLocally(created: RoundDto) {
        setRounds((rs) => [...rs, toRoundLocal(created)])
    }

    async function onCreateRound() {
        if (!uuid) return
        if (creatingRound) return
        // Structural: the draw decides who plays whom. Never queued.
        if (!requireOnlineFor(tr("tournament.round.notGeneratedTitle"))) return
        setCreatingRound(true)
        try {
            const created = await drawRound(uuid) // persisted on server
            appendRoundLocally(created)
        } catch (e) {
            // Nothing was appended locally, so state is already consistent
            // with the server. The interceptor showed why it failed.
            console.warn("Generiranje runde nije uspjelo", e)
        } finally {
            setCreatingRound(false)
        }
    }

    function onClickManualRound() {
        // Confirmation step — the organiser said they want to be sure before
        // opening the bigger form, since this skips the random draw and they
        // are committing to a specific bracket layout.
        setManualConfirmOpen(true)
    }

    function onConfirmManualRound() {
        // Structural, like the auto-draw: refuse before opening the form
        // rather than letting the organiser build a whole bracket and then
        // lose it to a failed POST.
        if (!requireOnlineFor(tr("tournament.round.notGeneratedTitle"))) return
        setManualConfirmOpen(false)
        setManualRoundOpen(true)
    }

    function onManualRoundCreated() {
        // Re-fetch the canonical rounds list rather than trying to derive it
        // from a single dialog response. Keeps display state honest when the
        // dialog ran multiple persistence steps.
        if (!uuid) return
        fetchTournamentDetails(uuid).then(setT).catch(() => {})
        ;(async () => {
            try {
                const fresh = await fetchRounds(uuid)
                setRounds(fresh.map(toRoundLocal))
            } catch { /* toaster handles it */ }
        })()
    }

    /** Runs after the organiser confirms in the round-reset ConfirmDialog. */
    async function hardReset(roundId: number) {
        // Both refusals below used to `return` silently, leaving the
        // ConfirmDialog open on a spinner-less "Potvrdi" the organiser could
        // keep pressing with no idea why nothing happened.
        if (!uuid) {
            setPendingHardResetRound(null)
            showError(tr("tournament.round.cannotResetTitle"), tr("tournament.round.notLoaded"))
            return
        }
        const round = rounds.find(r => r.id === roundId)
        if (round?.status === "COMPLETED") {
            setPendingHardResetRound(null)
            showError(
                tr("tournament.round.cannotResetTitle"),
                tr("tournament.round.completedCannotReset"),
            )
            return
        }
        if (hardResettingRound) return
        if (!requireOnlineFor(tr("tournament.round.cannotResetTitle"))) {
            setPendingHardResetRound(null)
            return
        }
        setHardResettingRound(true)
        try {
            await hardResetRound(uuid, roundId)
            await refreshAll()
            setPendingHardResetRound(null)
        } catch (e) {
            console.warn("Resetiranje runde nije uspjelo", e)
        } finally {
            setHardResettingRound(false)
        }
    }

    async function finishWholeRound(r: RoundLocal) {
        if (!uuid) return
        if (finishingRoundId != null) return
        // Finishing a round eliminates pairs and reshapes the bracket, so it
        // is never queued — offline it refuses outright.
        if (!requireOnlineFor(tr("tournament.round.notFinishedTitle"))) return
        // It also must not overtake scores that are still queued: those are
        // saves the organiser already made, and closing the round without
        // them would compute standings from a stale board.
        if (pendingOpsRef.current.length > 0) {
            showError(
                tr("tournament.round.notFinishedTitle"),
                tr("tournament.round.pendingOps"),
            )
            return
        }
        setFinishingRoundId(r.id)
        try {
            // Flush every unsaved score at once.
            //
            // allSettled, not all: with Promise.all one failed table rejects
            // immediately and the nine that DID save keep their _dirty flag,
            // so pressing "Završi rundu" again re-sent scores the server had
            // already accepted. Now every result is inspected: saved tables
            // are marked clean, failed ones stay dirty and are named in one
            // toast, and the round is NOT finished while any table is missing
            // its score. `silent: true` on each call keeps the interceptor
            // from stacking one toast per table.
            const dirty = r.matches.filter((m) => m.pair1Id && m.pair2Id && m._dirty)
            const results = await Promise.allSettled(dirty.map((m) => updateMatchScore(uuid, r.id, m.id, {
                score1: m._score1 && m._score1 !== "" ? Number(m._score1) : null,
                score2: m._score2 && m._score2 !== "" ? Number(m._score2) : null,
            }, { silent: true })))

            const savedIds = new Set<number>()
            const failedTables: string[] = []
            results.forEach((res, i) => {
                const m = dirty[i]
                if (res.status === "fulfilled") savedIds.add(m.id)
                else failedTables.push(String(m.tableNo))
            })

            // Clear _dirty on the tables that did land, so a retry only
            // re-sends what actually failed.
            if (savedIds.size > 0) {
                setRounds((rs): RoundLocal[] =>
                    rs.map((x) =>
                        x.id !== r.id ? x : {
                            ...x,
                            matches: x.matches.map((mx) =>
                                savedIds.has(mx.id) ? { ...mx, _dirty: false } : mx
                            ),
                        }
                    )
                )
            }

            if (failedTables.length > 0) {
                showError(
                    tr("tournament.round.someScoresFailedTitle"),
                    tr("tournament.round.someScoresFailedDescription", {
                        tables: failedTables.join(", "),
                    }),
                )
                return
            }

            const updated = await finishRound(uuid, r.id)

            setRounds(rs => rs.map(x => (x.id === r.id ? toRoundLocal(updated) : x)))

            cancelInFlight()

            // One refetch at the end — finishing a round eliminates losers
            // and bumps wins/losses on every pair that played.
            const refreshedPairs = await fetchTournamentPairs(uuid)
            setPairs(refreshedPairs)
        } catch (e) {
            // Scores stay _dirty locally so nothing the organiser typed is
            // lost and "Završi rundu" can simply be pressed again.
            console.warn("Završavanje runde nije uspjelo", e)
        } finally {
            setFinishingRoundId(null)
        }
    }

    const toggleRoundCollapsed = useCallback((id: number) =>
        setCollapsedRounds((cr) => ({ ...cr, [id]: !cr[id] })), [setCollapsedRounds])

    /* ---------- Tournament lifecycle ---------- */

    async function onStartTournament() {
        if (!uuid) return
        if (startingTournament) return
        if (!requireOnlineFor(tr("tournament.start.notStartedTitle"))) return
        setStartingTournament(true)
        try {
            const updated = await startTournament(uuid)
            setT(updated)
            invalidateTournamentLists()
        } catch (err) {
            // startTournament passes silentErrorStatuses:[409], so the 409
            // branches below MUST surface their own message — nothing else
            // will. Non-409 failures were already toasted by the interceptor.
            const res = (err as { response?: { status?: number; data?: unknown } })?.response
            if (res?.status === 409 && res?.data === "UNPAID_REQUIRED") {
                setUnpaidOpen(true) // open modal
                return
            }
            if (res?.status === 409 && res?.data === "INSUFFICIENT_PAIRS") {
                showError(
                    tr("tournament.start.cannotStartTitle"),
                    tr("tournament.start.insufficientPairs"),
                )
                return
            }
            if (res?.status === 409 && res?.data === "ALREADY_FINISHED") {
                showError(tr("tournament.finish.alreadyFinished"))
                return
            }
            if (res?.status === 409) {
                showError(tr("tournament.start.cannotStartTitle"), errorMessage(err))
                return
            }
            console.warn("Pokretanje turnira nije uspjelo", err)
        } finally {
            setStartingTournament(false)
        }
    }

    async function onFinishTournament() {
        if (!uuid) return
        if (finishingTournament) return
        if (!requireOnlineFor(tr("tournament.finish.notFinishedTitle"))) return
        setFinishingTournament(true)
        try {
            const updated = await finishTournament(uuid)
            setT(updated)
            invalidateTournamentLists()

            setCollapsedRounds(() => {
                const next: Record<number, boolean> = {}
                rounds.forEach(r => {
                    next[r.id] = true
                })
                return next
            })
        } catch (err) {
            // finishTournament passes silentErrorStatuses:[409], so the bare
            // backend codes below MUST be translated here — nothing else will
            // toast them. Non-409 failures were handled by the interceptor.
            const res = (err as { response?: { status?: number; data?: unknown } })?.response
            if (res?.status === 409) {
                const code = typeof res.data === "string" ? res.data : ""
                if (code === "ALREADY_FINISHED") {
                    showError(tr("tournament.finish.alreadyFinished"))
                } else if (code === "ROUND_IN_PROGRESS") {
                    showError(
                        tr("tournament.finish.cannotFinishTitle"),
                        tr("tournament.finish.roundInProgress"),
                    )
                } else {
                    showError(tr("tournament.finish.cannotFinishTitle"), errorMessage(err))
                }
                return
            }
            // Tournament stays STARTED locally, which is what the server
            // still thinks too.
            console.warn("Završavanje turnira nije uspjelo", err)
        } finally {
            setFinishingTournament(false)
        }
    }

    /**
     * Reset the tournament: delete every round, back to DRAFT. Confirmation
     * is the ConfirmDialog mounted at the page root; this only runs once the
     * organiser has clicked "Potvrdi".
     */
    async function onResetTournament() {
        if (!uuid) return
        if (resettingTournament) return
        if (!requireOnlineFor(tr("tournament.reset.notResetTitle"))) return
        setResettingTournament(true)
        try {
            const updated = await apiResetTournament(uuid)
            // No refreshAll() here: the reset response IS the canonical
            // tournament, and every other piece of state we care about is
            // being cleared on the next three lines anyway.
            setT(updated)
            setRounds([])
            setCollapsedRounds({})
            setResetTournamentOpen(false)
            invalidateTournamentLists()
        } catch (e) {
            // Rounds untouched locally = still in sync with the server.
            console.warn("Reset turnira nije uspio", e)
        } finally {
            setResettingTournament(false)
        }
    }

    async function onToggleAllowRepeats(next: boolean) {
        if (!uuid) return
        const prev = allowRepeats
        setAllowRepeats(next)
        setSavingPM(true)
        try {
            const res = await apiSetAllowRepeats(uuid, next)
            setT(res)
        } catch (e) {
            // Revert the optimistic switch; interceptor already toasted.
            setAllowRepeats(prev)
            console.warn("Spremanje postavke ponavljanja nije uspjelo", e)
        } finally {
            setSavingPM(false)
        }
    }

    /* ---------- Derivations the toolbar reads ---------- */

    /**
     * Matches of every round, pre-sorted by table number. Both the round list
     * and the fullscreen dialog used to run `[...r.matches].sort()` inline on
     * every render — i.e. a fresh array + sort per round on every keystroke in
     * a score input.
     */
    const sortedMatchesByRound = useMemo(() => {
        const byRound = new Map<number, MatchLocal[]>()
        for (const r of rounds) {
            byRound.set(r.id, [...r.matches].sort((a, b) => a.tableNo - b.tableNo))
        }
        return byRound
    }, [rounds])

    const hasOngoingRound = rounds.some((r) => r.status !== "COMPLETED")
    const tournamentStarted = (t?.status === "STARTED") || rounds.length > 0
    const showResetTournament =
        (t?.status === "STARTED" && rounds.length === 0) ||
        (rounds.length === 1 && rounds[0].number === 1 && rounds[0].status !== "COMPLETED")

    return {
        // in-flight
        creatingRound, finishingRoundId, savingMatchId, savingPM,
        startingTournament, finishingTournament, resettingTournament, hardResettingRound,
        // dialogs
        resetTournamentOpen, setResetTournamentOpen,
        pendingHardResetRound, setPendingHardResetRound,
        unpaidOpen, setUnpaidOpen,
        manualRoundOpen, setManualRoundOpen,
        manualConfirmOpen, setManualConfirmOpen,
        // per-match
        enterEdit, cancelEdit, setLocalMatchScore, saveMatch, saveEditedMatch, patchMatchPaidAt,
        // rounds
        onCreateRound, onClickManualRound, onConfirmManualRound, onManualRoundCreated,
        hardReset, finishWholeRound, toggleRoundCollapsed,
        // tournament
        onStartTournament, onFinishTournament, onResetTournament, onToggleAllowRepeats,
        // derived
        sortedMatchesByRound, hasOngoingRound, tournamentStarted, showResetTournament,
    }
}

export default useTournamentRounds
