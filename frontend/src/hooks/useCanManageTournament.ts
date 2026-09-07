import { useCallback, useMemo } from "react"

import { useAuth } from "../auth/authContextValue"
import { showError } from "../toaster"
import { t as tStatic } from "../i18n"
import type { TournamentDetails } from "../types/tournaments"

/**
 * Single source of truth for "may this viewer mutate the tournament", plus
 * the two gates the toolbar and the sidebar derive from it.
 *
 * Mirrors the backend's `services/TournamentAccess.canManage` — admin OR the
 * creator — so the affordances the SPA offers and the writes the API accepts
 * cannot drift apart. It used to be re-derived in four places on the detail
 * page (once per tab render IIFE plus `ownerOrAdminEditable`), all of them
 * spelling out the same `isAdmin || user.uid === t.createdByUid`.
 */
export function useCanManageTournament(t: TournamentDetails | null | undefined) {
    const { user, isAdmin } = useAuth()

    const canEditTournament = isAdmin || (!!user?.uid && user.uid === t?.createdByUid)

    /** Editing is creator-or-admin, and closes once the tournament is over. */
    const showEditAction = !!t && t.status !== "FINISHED" && canEditTournament
    /** Deleting is admin-only — see the backend gating on DELETE /tournaments. */
    const showDeleteAction = !!t && isAdmin

    /**
     * Gate for the STRUCTURAL operations (round draw, round finish,
     * tournament start / finish / reset, bulk pair replace). They are
     * deliberately not queued — replaying them onto a server that has moved
     * on would need real conflict resolution, not a replay marker — so they
     * need a live connection by definition. Failing them with a clear
     * sentence beats letting the generic network toast imply the work might
     * still land.
     *
     * `tStatic` (not the reactive translator) so the callback keeps an empty
     * dependency array and a stable identity for the callers that hold it.
     */
    const requireOnlineFor = useCallback((title: string): boolean => {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
            showError(title, tStatic("tournament.offline.description"))
            return false
        }
        return true
    }, [])

    return useMemo(
        () => ({ canEditTournament, showEditAction, showDeleteAction, requireOnlineFor }),
        [canEditTournament, showEditAction, showDeleteAction, requireOnlineFor],
    )
}

export default useCanManageTournament
