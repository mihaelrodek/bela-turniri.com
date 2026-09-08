import { useCallback, useMemo, useState } from "react"
import type { Dispatch, SetStateAction } from "react"

import {
    approveBlokLink,
    rejectBlokLink,
    revokeBlokLink,
    type OrganiserBlokLink,
} from "../api/blokLink"

type Args = {
    uuid: string | undefined
    blokLinks: OrganiserBlokLink[]
    setBlokLinks: Dispatch<SetStateAction<OrganiserBlokLink[]>>
}

/**
 * The organiser's write side of "Poveži blok sa stolom" (BLOK-LINK.md §4):
 * approve or reject a pending request, or end an approved link. Mirrors the
 * shape of `useTournamentPairsEditor`'s pair-approval flow — a single-flight
 * id guard per action, a ConfirmDialog-backed "pending" slot for the two
 * decisions that cut something off.
 *
 * Approve needs no confirmation (CLAUDE.md: only reject/destructive actions
 * do) — pressing it again is a no-op once the link is APPROVED. Reject and
 * "end link" (revoke) both do: reject tells the requester their ask was
 * refused, and revoke stops a score sync the player is relying on mid-game.
 */
export function useOrganiserBlokLinks({ uuid, blokLinks, setBlokLinks }: Args) {
    const [approvingLinkUuid, setApprovingLinkUuid] = useState<string | null>(null)
    /** The reject/revoke request currently in flight, if any. */
    const [decidingLinkUuid, setDecidingLinkUuid] = useState<string | null>(null)
    const [pendingRejectLink, setPendingRejectLink] = useState<OrganiserBlokLink | null>(null)
    const [pendingRevokeLink, setPendingRevokeLink] = useState<OrganiserBlokLink | null>(null)

    const onApproveLink = useCallback(async (link: OrganiserBlokLink) => {
        if (!uuid) return
        if (approvingLinkUuid != null) return
        setApprovingLinkUuid(link.uuid)
        try {
            const updated = await approveBlokLink(uuid, link.uuid)
            setBlokLinks((ls) => ls.map((x) => (x.uuid === updated.uuid ? updated : x)))
        } catch (err) {
            // Stays PENDING locally, matching the server. Interceptor toasted.
            console.warn("Odobravanje veze s blokom nije uspjelo", err)
        } finally {
            setApprovingLinkUuid(null)
        }
    }, [uuid, approvingLinkUuid, setBlokLinks])

    /** Runs once the organiser confirms the "Odbij" dialog. */
    const confirmRejectLink = useCallback(async () => {
        if (!uuid || !pendingRejectLink) return
        const target = pendingRejectLink
        setDecidingLinkUuid(target.uuid)
        try {
            const updated = await rejectBlokLink(uuid, target.uuid)
            setBlokLinks((ls) => ls.map((x) => (x.uuid === updated.uuid ? updated : x)))
            setPendingRejectLink(null)
        } catch (err) {
            console.warn("Odbijanje veze s blokom nije uspjelo", err)
        } finally {
            setDecidingLinkUuid(null)
        }
    }, [uuid, pendingRejectLink, setBlokLinks])

    /** Runs once the organiser confirms the "end link" dialog on a match row. */
    const confirmRevokeLink = useCallback(async () => {
        if (!pendingRevokeLink) return
        const target = pendingRevokeLink
        setDecidingLinkUuid(target.uuid)
        try {
            await revokeBlokLink(target.uuid)
            setBlokLinks((ls) => ls.map((x) =>
                x.uuid === target.uuid ? { ...x, status: "REVOKED" } : x,
            ))
            setPendingRevokeLink(null)
        } catch (err) {
            console.warn("Prekid veze s blokom nije uspio", err)
        } finally {
            setDecidingLinkUuid(null)
        }
    }, [pendingRevokeLink, setBlokLinks])

    const pendingLinks = useMemo(
        () => blokLinks.filter((l) => l.status === "PENDING"),
        [blokLinks],
    )
    /** One APPROVED link per match, if any — what a match row renders. */
    const approvedLinkByMatchId = useMemo(() => {
        const m = new Map<number, OrganiserBlokLink>()
        for (const l of blokLinks) if (l.status === "APPROVED") m.set(l.matchId, l)
        return m
    }, [blokLinks])

    return {
        pendingLinks,
        approvedLinkByMatchId,
        approvingLinkUuid,
        decidingLinkUuid,
        onApproveLink,
        pendingRejectLink, setPendingRejectLink,
        confirmRejectLink,
        pendingRevokeLink, setPendingRevokeLink,
        confirmRevokeLink,
    }
}

export default useOrganiserBlokLinks
