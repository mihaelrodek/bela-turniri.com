import { useEffect, useMemo, useState } from "react"

import {
    deleteTournamentPoster,
    updateTournament,
    uploadTournamentPoster,
} from "../api/tournaments"
import { showError } from "../toaster"
import { t as tStatic, useTranslation } from "../i18n"
import { invalidateTournamentLists } from "../pages/tournament/cache"
import { toLocalOffsetIso } from "../utils/format"
import {
    type TournamentForm,
    tournamentFormFromDto,
    tournamentFormToPayload,
} from "../utils/tournamentForm"
import type { TournamentDetails } from "../types/tournaments"

/* The form model itself — the type, the DTO seed and the payload builder —
   lives in `utils/tournamentForm`, shared with CreateTournamentPage. This
   file owns only what is specific to editing an EXISTING tournament: the
   poster picker (a separate endpoint from the JSON payload), the
   required-field summary the sticky bar reads, and the save. */

// Same validation thresholds as CreateTournamentPage so the UX is identical.
export const POSTER_MAX_MB = 5
export const POSTER_ACCEPT = ["image/jpeg", "image/png", "image/webp"] as const

/**
 * "Uredi turnir" — the inline edit form's whole state machine: the form
 * itself, the poster picker (a separate endpoint from the JSON payload), the
 * required-field summary and the save.
 */
export function useTournamentEditForm(
    uuid: string | undefined,
    t: TournamentDetails | null,
    setT: (t: TournamentDetails) => void,
) {
    const { t: tr } = useTranslation()

    const [editingDetails, setEditingDetails] = useState(false)
    const [editForm, setEditForm] = useState<TournamentForm | null>(null)

    // Same purpose as `pickedCoords` on CreateTournamentPage — drives the
    // map picker's marker in edit mode. Not sent to the backend; server
    // re-geocodes editForm.location on save. Reset to null whenever edit
    // mode opens (we don't seed from t.latitude/t.longitude because the
    // current TournamentDetails DTO doesn't surface coordinates).
    const [editPickedCoords, setEditPickedCoords] = useState<{ lat: number; lng: number } | null>(null)
    const [savingDetails, setSavingDetails] = useState(false)

    // Poster edit state. Mirrors CreateTournamentPage's poster picker.
    //   posterFile          — newly chosen File (replaces server-side image on save)
    //   posterPreviewUrl    — object URL for the picked File (cleaned up on unmount/replace)
    //   posterRemove        — flag set when user clears the current poster but
    //                         hasn't picked a replacement — Spremi sends a DELETE.
    //   posterUploadErr     — non-fatal validation message (size/type) shown inline.
    const [posterFile, setPosterFile] = useState<File | null>(null)
    const [posterPreviewUrl, setPosterPreviewUrl] = useState<string | null>(null)
    const [posterRemove, setPosterRemove] = useState(false)
    const [posterUploadErr, setPosterUploadErr] = useState<string | null>(null)

    function handlePosterPick(file: File) {
        setPosterUploadErr(null)
        if (!(POSTER_ACCEPT as readonly string[]).includes(file.type)) {
            setPosterUploadErr(tr("tournament.poster.allowedTypes"))
            return
        }
        if (file.size > POSTER_MAX_MB * 1024 * 1024) {
            setPosterUploadErr(tr("tournament.poster.maxSize", { mb: POSTER_MAX_MB }))
            return
        }
        if (posterPreviewUrl) URL.revokeObjectURL(posterPreviewUrl)
        setPosterFile(file)
        setPosterPreviewUrl(URL.createObjectURL(file))
        // Picking a replacement implicitly cancels a pending removal.
        setPosterRemove(false)
    }

    function clearPosterPick() {
        if (posterPreviewUrl) URL.revokeObjectURL(posterPreviewUrl)
        setPosterFile(null)
        setPosterPreviewUrl(null)
        setPosterUploadErr(null)
    }

    function markPosterForRemoval() {
        // Clears any locally-picked replacement AND signals to Spremi that
        // the server-side poster should be deleted.
        clearPosterPick()
        setPosterRemove(true)
    }

    // Clean up object URLs so we don't leak blob memory. Depending on
    // `posterPreviewUrl` (rather than `[]`) means the PREVIOUS url is revoked
    // whenever the user picks a different poster, not just on unmount — with
    // an empty dep array the cleanup closed over the first url forever and
    // every subsequent pick leaked a blob.
    useEffect(() => {
        return () => {
            if (posterPreviewUrl) URL.revokeObjectURL(posterPreviewUrl)
        }
    }, [posterPreviewUrl])

    // Required-field summary used by the sticky save bar. Mirrors
    // CreateTournamentPage exactly so the edit + create UX match:
    // name, location, date, time, and all three reward slots required.
    const editMissingRequired = useMemo(() => {
        if (!editForm) return []
        const missing: string[] = []
        // `tStatic`, not `tr`: adding the reactive translator here would mean
        // adding it to this memo's dependency array. The list is re-derived on
        // every edit-form keystroke anyway.
        if (!editForm.name.trim()) missing.push(tStatic("tournament.edit.required.name"))
        if (!editForm.location.trim()) missing.push(tStatic("tournament.edit.required.location"))
        if (!editForm.startDate) missing.push(tStatic("tournament.edit.required.date"))
        if (!editForm.startTime) missing.push(tStatic("tournament.edit.required.time"))
        if (
            !editForm.rewardFirst.trim() ||
            !editForm.rewardSecond.trim() ||
            !editForm.rewardThird.trim()
        ) {
            missing.push(tStatic("tournament.edit.required.rewards"))
        }
        return missing
    }, [
        editForm?.name,
        editForm?.location,
        editForm?.startDate,
        editForm?.startTime,
        editForm?.rewardFirst,
        editForm?.rewardSecond,
        editForm?.rewardThird,
    ])

    /**
     * True iff the chosen start moment is in the past. Same idea as the
     * minDate on the picker — re-evaluated on every render so a slow
     * form-fill can't slip behind "now". Submit is blocked when true.
     */
    const editStartInPast = useMemo(() => {
        if (!editForm?.startDate || !editForm?.startTime) return false
        const iso = toLocalOffsetIso(editForm.startDate, editForm.startTime)
        if (!iso) return false
        return new Date(iso).getTime() < Date.now()
    }, [editForm?.startDate, editForm?.startTime])

    function enterDetailsEdit() {
        if (!t) return
        setEditForm(tournamentFormFromDto(t))
        setEditPickedCoords(null)
        setEditingDetails(true)
    }

    function cancelDetailsEdit() {
        setEditForm(null)
        setEditPickedCoords(null)
        setEditingDetails(false)
        // Drop any pending poster changes so the next edit opens clean.
        clearPosterPick()
        setPosterRemove(false)
        setPosterUploadErr(null)
    }

    async function saveDetailsEdit() {
        if (!uuid || !editForm) return
        // Same gating as the create form: block if any required field is
        // empty, or if the picked start moment has slipped into the past.
        if (editMissingRequired.length > 0) {
            showError(
                tr("tournament.edit.missingTitle"),
                tr("tournament.edit.missingDescription", { fields: editMissingRequired.join(", ") }),
            )
            return
        }
        if (editStartInPast) {
            showError(tr("tournament.edit.pastTitle"), tr("tournament.edit.pastDescription"))
            return
        }
        try {
            setSavingDetails(true)
            // 1) Save the JSON payload first (text fields). The poster
            //    is on a separate endpoint so we don't block details
            //    saves if a poster upload fails mid-flight.
            let updated = await updateTournament(uuid, tournamentFormToPayload(editForm, "update"))
            // 2) Apply the poster change, if any.
            if (posterFile) {
                updated = await uploadTournamentPoster(uuid, posterFile)
            } else if (posterRemove) {
                updated = await deleteTournamentPoster(uuid)
            }
            setT(updated)
            setEditingDetails(false)
            setEditForm(null)
            clearPosterPick()
            setPosterRemove(false)
            // The name, date, location and poster all show up on the list,
            // calendar and map views — every one of which is persisted to
            // localStorage and would otherwise render the pre-edit copy on
            // the next cold load.
            invalidateTournamentLists()
        } catch (e) {
            // The axios interceptor already toasted the failure. Stay in edit
            // mode with the form untouched so the organiser can fix and retry
            // instead of losing what they typed.
            console.warn("Spremanje izmjena turnira nije uspjelo", e)
        } finally {
            setSavingDetails(false)
        }
    }

    function patchEdit<K extends keyof TournamentForm>(key: K, value: TournamentForm[K]) {
        setEditForm((f) => (f ? { ...f, [key]: value } : f))
    }

    return {
        editingDetails,
        editForm,
        patchEdit,
        enterDetailsEdit,
        cancelDetailsEdit,
        saveDetailsEdit,
        savingDetails,
        editMissingRequired,
        editStartInPast,
        editPickedCoords,
        setEditPickedCoords,
        posterFile,
        posterPreviewUrl,
        posterRemove,
        posterUploadErr,
        handlePosterPick,
        clearPosterPick,
        markPosterForRemoval,
    }
}

export default useTournamentEditForm
