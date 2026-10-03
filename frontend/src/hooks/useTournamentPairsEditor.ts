import { useEffect, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"

import {
    approvePair,
    buyExtraLife,
    deletePair,
    replacePairs,
    restorePair,
    selfRegisterPair,
} from "../api/tournaments"
import { listPresets, type UserPairPreset } from "../api/userPairPresets"
import { useAuth } from "../auth/authContextValue"
import { showError, toaster } from "../toaster"
import { useTranslation } from "../i18n"
import { errorMessage } from "../utils/apiError"
import { rememberAnonRegistration } from "../utils/anonSelfReg"
import { DEFAULT_DIAL_CODE, joinPhone } from "../utils/phone"
import type { PairShort } from "../types/pairs"

/** The one queue kind this hook pushes — see hooks/useOfflineQueue. */
type EnqueuePairPaid = (kind: "pairPaid", payload: { pairId: number; paid: boolean }) => unknown

type Args = {
    uuid: string | undefined
    pairs: PairShort[]
    setPairs: Dispatch<SetStateAction<PairShort[]>>
    /** Rows the organiser has typed into — the poll steps around them. */
    dirtyPairIdsRef: { current: Set<number> }
    /** Paid flags staged by "Plati"'s mousedown, read by the blur save. */
    pendingPaidRef: { current: Map<number, boolean> }
    /** Discards fetches already in flight, so one that STARTED before an
     *  optimistic write can't land after it and repaint the row. */
    cancelInFlight: () => void
    requireOnlineFor: (title: string) => boolean
    enqueueOp: EnqueuePairPaid
    /** Re-reads "Obrisani parovi" after a delete / restore. */
    refetchDeletedPairs: () => unknown
}

/**
 * Every mutation the Parovi section can make: the roster editor (add,
 * rename, delete, the blur auto-save), kotizacija, approvals, repasaž lives
 * and self-registration.
 *
 * The in-flight booleans are returned rather than kept private because the
 * page ORs them into `anySaveInFlight`, which is what pauses the live poll —
 * a tick landing mid-save would overwrite the optimistic state the save is
 * about to confirm.
 */
export function useTournamentPairsEditor({
    uuid,
    pairs,
    setPairs,
    dirtyPairIdsRef,
    pendingPaidRef,
    cancelInFlight,
    requireOnlineFor,
    enqueueOp,
    refetchDeletedPairs,
}: Args) {
    const { t: tr } = useTranslation()
    const { user } = useAuth()

    const [savingPairs, setSavingPairs] = useState(false)
    const [approvingPairId, setApprovingPairId] = useState<number | null>(null)
    const [buyingLifePairId, setBuyingLifePairId] = useState<number | null>(null)

    // Confirmation state for the pair delete dialog. null = closed, otherwise
    // holds the pair the user is about to delete.
    const [pendingDeletePair, setPendingDeletePair] = useState<PairShort | null>(null)
    const [deletingPair, setDeletingPair] = useState(false)
    const [restoringPairId, setRestoringPairId] = useState<number | null>(null)

    // Self-register pair dialog
    const [selfRegOpen, setSelfRegOpen] = useState(false)
    const [presets, setPresets] = useState<UserPairPreset[]>([])
    const [selfRegName, setSelfRegName] = useState("")
    const [selfRegSubmitting, setSelfRegSubmitting] = useState(false)
    const [selfRegError, setSelfRegError] = useState<string | null>(null)

    /* Signing in is BETTER (own registrations, edit/withdraw, notifications)
       but it is not required. An anonymous visitor gets this nudge first and
       can walk past it — see SelfRegisterNudgeDialog. */
    const [selfRegNudgeOpen, setSelfRegNudgeOpen] = useState(false)

    /* Phone, anonymous-only: split into dial code + local part exactly like
       the profile editor, so one number has one stored shape app-wide. */
    const [selfRegPhoneCountry, setSelfRegPhoneCountry] = useState(DEFAULT_DIAL_CODE)
    const [selfRegPhone, setSelfRegPhone] = useState("")

    /* The claim link handed back for an anonymous registration. Held in state
       rather than toasted: it is the only handle the visitor has on a pair
       that belongs to no account, and a toast that scrolls away would lose it. */
    const [selfRegClaim, setSelfRegClaim] = useState<{ claimUrl: string; name: string } | null>(null)

    /**
     * Single-flight guard for the pair-list bulk save. Without it the
     * name-input onBlur and the Plati click race each other when the user
     * types a name then immediately taps Plati — both would call
     * replacePairs back-to-back with the same temp pair, and the second
     * call would create a duplicate row server-side.
     */
    const savingPairsRef = useRef(false)

    // Load presets when the dialog opens (only for the current user)
    useEffect(() => {
        if (!selfRegOpen || !user) return
        listPresets()
            .then((list) => setPresets(list))
            .catch(() => setPresets([]))
    }, [selfRegOpen, user])

    async function submitSelfRegister() {
        if (!uuid) return
        const name = selfRegName.trim()
        if (!name) {
            setSelfRegError(tr("tournament.selfReg.nameRequired"))
            return
        }
        // Anonymous only: without a number the organiser has a row they can
        // neither confirm nor chase, and the backend refuses it anyway.
        const phone = user ? null : joinPhone(selfRegPhoneCountry, selfRegPhone)
        if (!user && !phone) {
            setSelfRegError(tr("tournament.selfReg.phoneRequired"))
            return
        }
        try {
            setSelfRegSubmitting(true)
            setSelfRegError(null)
            const created = await selfRegisterPair(uuid, name, phone)
            setPairs((ps) => [...ps, created])
            setSelfRegOpen(false)
            setSelfRegName("")
            setSelfRegPhone("")
            if (!user && created.claimUrl) {
                // Receipt on this device, so the pairs list can still mark the
                // row as theirs after a reload.
                rememberAnonRegistration({
                    tournamentUuid: uuid,
                    pairId: created.id,
                    claimUrl: created.claimUrl,
                    name: created.name,
                })
                setSelfRegClaim({ claimUrl: created.claimUrl, name: created.name })
            }
        } catch (e) {
            const data = (e as { response?: { data?: unknown } })?.response?.data
            const code = typeof data === "string" ? data : ""
            if (code === "TOURNAMENT_ALREADY_STARTED") {
                setSelfRegError(tr("tournament.selfReg.alreadyStarted"))
            } else if (code === "ALREADY_REGISTERED") {
                setSelfRegError(tr("tournament.selfReg.alreadyRegistered"))
            } else if (code === "CONTACT_PHONE_REQUIRED") {
                setSelfRegError(tr("tournament.selfReg.phoneRequired"))
            } else if (code === "RATE_LIMITED") {
                setSelfRegError(tr("tournament.selfReg.rateLimited"))
            } else {
                setSelfRegError(errorMessage(e, tr("tournament.selfReg.error")))
            }
        } finally {
            setSelfRegSubmitting(false)
        }
    }

    /**
     * Quick-add (2026-10-03): persists a NEW pair with a real name at once.
     * There is no single-pair create endpoint — the roster is only ever
     * written by the bulk PUT /pairs — so this builds the same payload the
     * blur save does, drops any blank temp rows (they would make the bulk
     * endpoint reject the whole call), appends the new pair with its `paid`
     * flag, and swaps in the server's answer. Not queued: structural, so it
     * refuses offline through requireOnlineFor, like onPairNameBlur.
     *
     * Resolves with the new pair's real id, or an inline error message; the
     * caller keeps the typed text on failure. The axios interceptor has
     * already toasted a failed request.
     */
    async function quickAddPair(
        rawName: string,
        paid: boolean,
    ): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
        const name = rawName.replace(/\s+/g, " ").trim()
        if (!uuid) return { ok: false, error: tr("tournament.pairs.quickError") }
        if (!name) return { ok: false, error: tr("tournament.pairs.nameEmpty") }
        if (savingPairsRef.current) return { ok: false, error: tr("tournament.pairs.quickBusy") }
        if (!requireOnlineFor(tr("tournament.pairs.notSavedTitle"))) {
            return { ok: false, error: tr("tournament.pairs.quickOffline") }
        }
        savingPairsRef.current = true
        setSavingPairs(true)
        try {
            const knownIds = new Set(pairs.filter((p) => p.id > 0).map((p) => p.id))
            const payload = [
                ...buildPairsPayload().filter((p) => p.name.trim() !== ""),
                { id: undefined, name, isEliminated: false, extraLife: false, wins: 0, losses: 0, paid },
            ]
            const saved = await replacePairs(uuid, payload)
            setPairs(saved)
            pendingPaidRef.current.clear()
            dirtyPairIdsRef.current.clear()
            cancelInFlight()
            // The server may append or re-sort; the new row is the one id we
            // did not know. Same-named namesake is the fallback.
            const created =
                saved.find((p) => p.id > 0 && !knownIds.has(p.id)) ??
                saved.find((p) => p.name === name)
            return created ? { ok: true, id: created.id } : { ok: true, id: 0 }
        } catch (e) {
            const msg = errorMessage(e, tr("tournament.pairs.quickError"))
            // A bare machine code (CONFLICT_CODE) is for the SPA to switch on,
            // never to show.
            return { ok: false, error: /^[A-Z0-9_]+$/.test(msg) ? tr("tournament.pairs.quickError") : msg }
        } finally {
            savingPairsRef.current = false
            setSavingPairs(false)
        }
    }

    function changePairName(id: number, name: string) {
        // Remember that this row carries unsaved text so the live poll can
        // step around it — see mergePolledPairs.
        dirtyPairIdsRef.current.add(id)
        setPairs((ps) => ps.map((p) => (p.id === id ? { ...p, name } : p)))
    }

    function removePair(id: number) {
        dirtyPairIdsRef.current.delete(id)
        pendingPaidRef.current.delete(id)
        setPairs((ps) => ps.filter((p) => p.id !== id))
    }

    /**
     * Build the bulk-save payload from the current pair list. Optional
     * `paidOverride` lets the caller flip a single pair's `paid` flag
     * atomically with the save — used by Plati on a not-yet-persisted
     * (temp-id) pair so name + paid commit in a single round trip.
     *
     * In addition to the explicit override, this also consults
     * pendingPaidRef so a click that arrived AFTER blur (via the
     * mousedown-pre-blur path) still wins.
     */
    function buildPairsPayload(paidOverride?: { pairId: number; paid: boolean }) {
        return pairs.map((p) => {
            const pendingPaid = pendingPaidRef.current.get(p.id)
            const paid =
                paidOverride && paidOverride.pairId === p.id
                    ? paidOverride.paid
                    : pendingPaid !== undefined
                        ? pendingPaid
                        : !!p.paid
            return {
                id: p.id > 0 ? p.id : undefined,
                name: p.name,
                isEliminated: !!p.isEliminated,
                extraLife: !!p.extraLife,
                wins: p.wins ?? 0,
                losses: p.losses ?? 0,
                paid,
            }
        })
    }

    /**
     * Auto-save handler fired by the pair-name input's blur event. This is the
     * ONLY path that persists a typed pair name — the old "Spremi promjene"
     * button is gone, so every branch below has to stand on its own:
     *
     *   - Temp pair (negative id) with empty name → silently drop the row
     *     locally. The user clearly didn't intend to add a pair.
     *   - Temp pair with a real name → bulk-save so the pair gets a server
     *     id immediately. Skips when a save is already in flight to avoid
     *     duplicate rows from racing with the Plati click handler.
     *   - Server-saved pair the organiser actually typed into (it is in
     *     `dirtyPairIdsRef`) → the same bulk save, so a rename lands without
     *     a button. A blur with nothing typed is a no-op.
     *   - Server-saved pair blanked to empty → refuse loudly. The bulk
     *     endpoint rejects an empty name, and silently leaving the typed
     *     blank on screen would read as "saved".
     */
    function onPairNameBlur(p: PairShort) {
        if (!uuid) return
        const isTemp = p.id <= 0
        // Nothing was typed into this saved row — blur has nothing to persist.
        if (!isTemp && !dirtyPairIdsRef.current.has(p.id)) return
        if (!p.name.trim()) {
            if (isTemp) {
                removePair(p.id)
                return
            }
            showError(tr("tournament.pairs.nameEmpty"))
            return
        }
        if (savingPairsRef.current) return
        if (pairs.some((q) => !q.name || q.name.trim() === "")) {
            // Don't auto-save while another row is still blank — the bulk
            // endpoint rejects it anyway and the toast would be noisy.
            return
        }
        // Structural — the bulk replace re-writes the whole roster and is not
        // queued. The typed name stays `_dirty` locally, so the next blur (or
        // reconnect) retries it.
        if (!requireOnlineFor(tr("tournament.pairs.notSavedTitle"))) return
        savingPairsRef.current = true
        // Mirror the ref into state as well: `anySaveInFlight` (and therefore
        // the live poll's skip check and every gated button) reads the state,
        // so a blur-triggered save used to be invisible to all of them.
        setSavingPairs(true)
        ;(async () => {
            try {
                const saved = await replacePairs(uuid, buildPairsPayload())
                setPairs(saved)
                pendingPaidRef.current.clear()
                dirtyPairIdsRef.current.clear()
                cancelInFlight()
            } catch {
                /* error toast already surfaced by axios interceptor */
            } finally {
                savingPairsRef.current = false
                setSavingPairs(false)
            }
        })()
    }

    /**
     * "Plati" click handler for a not-yet-persisted pair. Saves the whole
     * list with the paid flag flipped for the target pair, so a single
     * round-trip both persists the row AND records the kotizacija status.
     */
    async function saveTempPairWithPaid(pairId: number, nextPaid: boolean) {
        if (!uuid) return
        const target = pairs.find((p) => p.id === pairId)
        if (!target || !target.name.trim()) {
            showError(tr("tournament.pairs.nameBeforePay"))
            return
        }
        if (savingPairsRef.current) return
        savingPairsRef.current = true
        setSavingPairs(true)
        try {
            const saved = await replacePairs(uuid, buildPairsPayload({ pairId, paid: nextPaid }))
            setPairs(saved)
            pendingPaidRef.current.clear()
            dirtyPairIdsRef.current.clear()
            cancelInFlight()
        } catch (e) {
            // Roll the optimistic paid flip back so the button colour matches
            // the server again; the interceptor already showed the reason.
            pendingPaidRef.current.delete(pairId)
            setPairs((ps) => ps.map((x) => (x.id === pairId ? { ...x, paid: !nextPaid } : x)))
            console.warn("Spremanje para s kotizacijom nije uspjelo", e)
        } finally {
            savingPairsRef.current = false
            setSavingPairs(false)
        }
    }

    async function onTogglePaid(pairId: number, nextPaid: boolean) {
        if (!uuid) return
        // Pair not yet saved server-side — route through the temp-pair
        // path so name + paid are persisted in one bulk call. Without this
        // the legacy setPairPaid hits /pairs/{id} which 404s because the
        // negative id never reached the database.
        if (pairId < 0) {
            await saveTempPairWithPaid(pairId, nextPaid)
            return
        }
        // Queued, like the scores: the kotizacija chip is tapped at the door
        // on the same bad Wi-Fi as everything else, and losing "this pair
        // paid" is exactly the kind of thing that costs the organiser money.
        //
        // No single-flight guard: the queue drains strictly in order, so two
        // quick taps are two ops applied in the order they were made and the
        // last one wins. The chip's optimistic value stays on screen
        // (withPendingPaid) until the op confirms.
        setPairs((ps) => ps.map((x) => (x.id === pairId ? { ...x, paid: nextPaid } : x)))
        enqueueOp("pairPaid", { pairId, paid: nextPaid })
        // A fetch that started before this write must not land after it.
        cancelInFlight()
    }

    /**
     * Stamp a temp row's intended kotizacija value into pendingPaidRef and
     * flip the visible state, from the Plati button's onMouseDown — i.e.
     * BEFORE the name input's blur save reads the ref.
     */
    function stageTempPairPaid(pairId: number, nextPaid: boolean) {
        if (pairId >= 0) return
        pendingPaidRef.current.set(pairId, nextPaid)
        setPairs((ps) => ps.map((x) => (x.id === pairId ? { ...x, paid: nextPaid } : x)))
    }

    /** Approve a self-registered pair (organiser/admin only). */
    async function onApprovePair(p: PairShort) {
        if (!uuid) return
        if (approvingPairId != null) return
        setApprovingPairId(p.id)
        try {
            const updated = await approvePair(uuid, p.id)
            setPairs((ps) => ps.map((x) => (x.id === updated.id ? updated : x)))
        } catch (err) {
            // Pair stays pending locally, matching the server. Interceptor
            // already toasted.
            console.warn("Odobravanje para nije uspjelo", err)
        } finally {
            setApprovingPairId(null)
        }
    }

    /** Buy the repasaž safety-net life for an eliminated-in-waiting pair. */
    async function onBuyExtraLife(p: PairShort) {
        if (!uuid) return
        if (buyingLifePairId != null) return
        setBuyingLifePairId(p.id)
        try {
            const updated = await buyExtraLife(uuid, p.id)
            setPairs((ps) => ps.map((x) => (x.id === updated.id ? updated : x)))
        } catch (err) {
            // Nothing changed locally — the pair keeps the life state the
            // server still reports.
            console.warn("Kupnja dodatnog života nije uspjela", err)
        } finally {
            setBuyingLifePairId(null)
        }
    }

    /**
     * Bring a soft-deleted pair back into the roster (DRAFT only — the server
     * answers 409 once the tournament has started). Resolves with the restored
     * row, or an inline-ready message: the roster-full / already-started 409s
     * are mapped here because the section shows them next to the list instead
     * of as a toast.
     */
    async function restoreDeletedPair(
        pairId: number,
    ): Promise<{ ok: true; pair: PairShort } | { ok: false; error: string }> {
        if (!uuid) return { ok: false, error: tr("tournament.pairs.deleted.error") }
        if (restoringPairId != null) return { ok: false, error: tr("tournament.pairs.quickBusy") }
        if (!requireOnlineFor(tr("tournament.pairs.notSavedTitle"))) {
            return { ok: false, error: tr("tournament.pairs.quickOffline") }
        }
        setRestoringPairId(pairId)
        try {
            const restored = await restorePair(uuid, pairId)
            setPairs((ps) => (ps.some((x) => x.id === restored.id) ? ps : [...ps, restored]))
            cancelInFlight()
            void refetchDeletedPairs()
            return { ok: true, pair: restored }
        } catch (e) {
            // The row may already be gone (restored in another tab) — resync.
            void refetchDeletedPairs()
            const data = (e as { response?: { data?: unknown } })?.response?.data
            const code = typeof data === "string" ? data : ""
            if (code === "PAIRS_FULL") return { ok: false, error: tr("tournament.pairs.deleted.full") }
            if (code === "TOURNAMENT_ALREADY_STARTED") {
                return { ok: false, error: tr("tournament.pairs.deleted.started") }
            }
            const msg = errorMessage(e, tr("tournament.pairs.deleted.error"))
            return { ok: false, error: /^[A-Z0-9_]+$/.test(msg) ? tr("tournament.pairs.deleted.error") : msg }
        } finally {
            setRestoringPairId(null)
        }
    }

    /** Runs once the organiser confirms in the delete-pair dialog. */
    async function confirmDeletePair() {
        if (!pendingDeletePair || !uuid) return
        const target = pendingDeletePair
        try {
            setDeletingPair(true)
            await deletePair(uuid, target.id, { silent: true })
            setPairs((ps) => ps.filter((x) => x.id !== target.id))
            setPendingDeletePair(null)
            void refetchDeletedPairs()
            // Own toast (the request was silent) so it can carry "Opozovi":
            // a mis-tap is undone in one click, and the pair also stays
            // restorable from "Obrisani parovi" after the toast is gone.
            toaster.create({
                type: "success",
                title: tr("tournament.pairs.deleted.toastTitle"),
                description: tr("tournament.pairs.deleted.toastHint"),
                duration: 8000,
                action: {
                    label: tr("tournament.pairs.deleted.undo"),
                    onClick: () => {
                        void restoreDeletedPair(target.id).then((r) => {
                            if (!r.ok) showError(r.error)
                        })
                    },
                },
            })
        } catch (err) {
            // Pair stays in the list — it also still exists server-side.
            // Interceptor toasted.
            console.warn("Brisanje para nije uspjelo", err)
        } finally {
            setDeletingPair(false)
        }
    }

    return {
        savingPairs,
        approvingPairId,
        buyingLifePairId,
        pendingDeletePair,
        setPendingDeletePair,
        deletingPair,
        confirmDeletePair,
        restoringPairId,
        restoreDeletedPair,
        // self-registration
        selfRegOpen,
        setSelfRegOpen,
        selfRegNudgeOpen,
        setSelfRegNudgeOpen,
        selfRegPhoneCountry,
        setSelfRegPhoneCountry,
        selfRegPhone,
        setSelfRegPhone,
        selfRegClaim,
        setSelfRegClaim,
        presets,
        selfRegName,
        setSelfRegName,
        selfRegSubmitting,
        selfRegError,
        setSelfRegError,
        submitSelfRegister,
        // roster editing
        quickAddPair,
        changePairName,
        removePair,
        onPairNameBlur,
        onTogglePaid,
        stageTempPairPaid,
        onApprovePair,
        onBuyExtraLife,
    }
}

export default useTournamentPairsEditor
