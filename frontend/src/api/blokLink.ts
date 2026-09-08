import { http } from "./http"
import { t } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   "Poveži blok sa stolom" — organiser-side endpoints only (BLOK-LINK.md §2.2).

   The player's blok (frontend/src/blok/) owns the request/mine/score-push
   calls in its own module — this file only ever touches the four endpoints
   `access.loadForEdit(idOrSlug)` gates to the organiser or an admin:
   the tournament's link list, approve, reject, and ending an approved link.

   The `OrganiserBlokLink` shape mirrors the backend's `BlokLinkDto`
   (backend/.../dtos/BlokLinkDto.java) field for field — one shape serves both
   the blok's `GET /blok-links/mine` and this tournament's list, so this file
   only widens the parts the organiser's screen actually reads.
   ────────────────────────────────────────────────────────────────────── */

export type BlokLinkStatus = "PENDING" | "APPROVED" | "REJECTED" | "REVOKED"

/** One row of `GET /tournaments/{idOrSlug}/blok-links` — see `BlokLinkDto`. */
export type OrganiserBlokLink = {
    uuid: string
    status: BlokLinkStatus
    tournamentUuid: string
    tournamentSlug: string | null
    tournamentName: string
    roundId: number
    roundNumber: number
    /** Null on the rare match drawn without a table number. */
    tableNo: number | null
    matchId: number
    usPairId: number
    usPairName: string
    themPairId: number
    themPairName: string
    requestedByUid: string
    requestedByName: string
    createdAt: string
    decidedAt: string | null
    decidedByUid: string | null
    /**
     * The public logbook of the linked table — `/blok/z/{shareToken}` (§6.2).
     *
     * Null until the player's blok has saved the series and the server has
     * minted a token for it, which happens on the first score push of an
     * approved link. So a freshly approved link has none and the bracket simply
     * shows no logbook line yet; one appears, on its own, with the first result.
     *
     * DELIBERATELY PUBLIC: linking is the player's consent that anyone holding
     * the URL may read the whole series, during the tournament and after it.
     * The token is a random string and never the record's `uuid`, so nothing
     * about it can be guessed from the link's own identifiers.
     */
    shareToken: string | null
}

/** Every blok-link request for a tournament, PENDING first per the contract. */
export async function fetchBlokLinks(
    tournamentIdOrSlug: string,
    opts?: { silent?: boolean },
): Promise<OrganiserBlokLink[]> {
    const { data } = await http.get<OrganiserBlokLink[]>(
        `/tournaments/${tournamentIdOrSlug}/blok-links`,
        opts,
    )
    return data
}

/** Approve a pending link — the requester's score pushes start landing after this. */
export async function approveBlokLink(
    tournamentIdOrSlug: string,
    linkUuid: string,
): Promise<OrganiserBlokLink> {
    const { data } = await http.post<OrganiserBlokLink>(
        `/tournaments/${tournamentIdOrSlug}/blok-links/${linkUuid}/approve`,
        undefined,
        { successMessage: t("tournament.blokLinks.toast.approved") },
    )
    return data
}

/** Reject a pending link — nothing was ever written, so this only closes the request. */
export async function rejectBlokLink(
    tournamentIdOrSlug: string,
    linkUuid: string,
): Promise<OrganiserBlokLink> {
    const { data } = await http.post<OrganiserBlokLink>(
        `/tournaments/${tournamentIdOrSlug}/blok-links/${linkUuid}/reject`,
        undefined,
        { successMessage: t("tournament.blokLinks.toast.rejected") },
    )
    return data
}

/**
 * End an APPROVED link. The contract allows either the requester or the
 * organiser to call this (`DELETE /blok-links/{uuid}`, no tournament in the
 * path); this file only uses it from the organiser's match-row control.
 */
export async function revokeBlokLink(linkUuid: string): Promise<void> {
    await http.delete(`/blok-links/${linkUuid}`, {
        successMessage: t("tournament.blokLinks.toast.revoked"),
    })
}
