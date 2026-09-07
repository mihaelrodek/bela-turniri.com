import { http } from "./http"
import { t } from "../i18n"

/**
 * Admin-only API surface for the "Dashboard" tab on the profile page.
 * Every endpoint here requires the Firebase `role: "admin"` custom claim
 * on the caller; backend returns 403 to anyone without it.
 */

/** Tournament row in the dashboard's tournament picker. */
export type AdminTournamentDto = {
    id: number
    uuid: string | null
    slug: string | null
    name: string
    location: string | null
    startAt: string | null
    status: string | null
    /** Firebase UID of the current owner; null for legacy/imported rows. */
    createdByUid: string | null
    /** Display name snapshot copied at create/transfer time. */
    createdByName: string | null
}

/** Unclaimed pair row in a tournament's pair list. */
export type AdminPairDto = {
    id: number
    name: string
    eliminated: boolean
    wins: number
    losses: number
}

/** User row in the attach-target picker. */
export type AdminUserDto = {
    userUid: string
    displayName: string | null
    slug: string | null
}

export type AttachPairResponse = {
    pairId: number
    userUid: string
    displayName: string | null
    /** True when a matching UserPairPreset was created as a side effect. */
    createdPreset: boolean
}

/** All non-deleted tournaments, newest first. */
export async function adminListTournaments(): Promise<AdminTournamentDto[]> {
    const { data } = await http.get<AdminTournamentDto[]>("/admin/tournaments")
    return data
}

/** Pairs from the given tournament that don't yet belong to any registered user. */
export async function adminListUnclaimedPairs(
    tournamentId: number,
): Promise<AdminPairDto[]> {
    const { data } = await http.get<AdminPairDto[]>(
        `/admin/tournaments/${tournamentId}/pairs`,
    )
    return data
}

/**
 * Substring match against displayName (case-insensitive). Empty query
 * returns the first ~25 profiles alphabetically so the dropdown has
 * something visible before the admin starts typing.
 */
export async function adminSearchUsers(query: string): Promise<AdminUserDto[]> {
    const { data } = await http.get<AdminUserDto[]>("/admin/users", {
        params: { q: query },
    })
    return data
}

/**
 * Full list of all registered profiles, alphabetical. Backs the admin
 * "Popis igrača" tab. Distinct from {@link adminSearchUsers} (which
 * is capped for the attach-target dropdown) — here we want every
 * profile so the admin can browse and jump to any user's page.
 */
export async function adminListAllUsers(): Promise<AdminUserDto[]> {
    const { data } = await http.get<AdminUserDto[]>("/admin/users/all")
    return data
}

/**
 * Attach a pair to a user. Side-effects on the backend:
 *   - sets pair.submittedByUid = userUid (pair appears on the user's
 *     profile immediately via the existing participations query);
 *   - if the user has no matching UserPairPreset, creates one so
 *     future tournaments with the same pair name auto-claim too.
 *
 * Common error responses:
 *   - 409 ALREADY_CLAIMED — pair was claimed by someone between the
 *     UI's list fetch and this request. Refresh the unclaimed list.
 *   - 404                  — pair or user not found (user_uid invalid).
 */
export async function adminAttachPair(
    pairId: number,
    userUid: string,
): Promise<AttachPairResponse> {
    const { data } = await http.post<AttachPairResponse>(
        `/admin/pairs/${pairId}/attach`,
        { userUid },
        {
            successMessage: t("common.toast.pairAttached"),
            silentErrorStatuses: [409],
        },
    )
    return data
}

export type TransferTournamentResponse = {
    tournamentId: number
    userUid: string
    displayName: string | null
}

/**
 * Transfer ownership of a tournament to another registered user.
 *
 * <p>After this call the target user is treated exactly as if they had
 * created the tournament themselves: they can edit details, manage
 * pairs, generate rounds, set the podium, etc. The admin loses the
 * implicit-via-creation edit rights but retains admin powers.
 *
 * <p>Both `createdByUid` and `createdByName` are updated on the backend
 * — the latter is a snapshot of the target user's UserProfile
 * displayName so subsequent renders show the new owner without any
 * extra lookup.
 *
 * Common error responses:
 *   - 404 TOURNAMENT_NOT_FOUND — tournament id is invalid or soft-deleted.
 *   - 404 USER_NOT_FOUND       — target userUid has no UserProfile row.
 */
export async function adminTransferTournament(
    tournamentId: number,
    userUid: string,
): Promise<TransferTournamentResponse> {
    const { data } = await http.post<TransferTournamentResponse>(
        `/admin/tournaments/${tournamentId}/transfer`,
        { userUid },
        {
            successMessage: t("common.toast.tournamentTransferred"),
        },
    )
    return data
}

export type TournamentStatusValue = "DRAFT" | "STARTED" | "FINISHED"

export type SetStatusResponse = {
    tournamentId: number
    status: TournamentStatusValue
    previousStatus: TournamentStatusValue | null
}

/**
 * Admin override of a tournament's status. Bypasses the normal lifecycle
 * guards in {@code TournamentController.startTournament} /
 * {@code finishTournament}.
 *
 * <p>Used to correct mis-clicks (wrongly-finished tournaments → revert to
 * STARTED / DRAFT) and to backfill events that ran outside the app
 * (DRAFT → FINISHED retroactively).
 *
 * <p>Side-effects on the backend when reverting OUT OF FINISHED:
 *   - {@code winnerName} cleared
 *   - {@code secondPlaceName} / {@code thirdPlaceName} cleared
 *
 * Rounds + matches are NOT touched — use the existing
 * {@code /tournaments/{uuid}/reset} endpoint when a full wipe is needed.
 */
export async function adminSetTournamentStatus(
    tournamentId: number,
    status: TournamentStatusValue,
): Promise<SetStatusResponse> {
    const { data } = await http.post<SetStatusResponse>(
        `/admin/tournaments/${tournamentId}/status`,
        { status },
        {
            successMessage: t("common.toast.tournamentStatusUpdated"),
        },
    )
    return data
}

/** One row of the admin "Poruke" (contact form) triage inbox. */
export type ContactMessageDto = {
    id: number
    createdAt: string | null
    name: string
    email: string
    subject: string | null
    message: string
    /** Firebase UID of the sender when signed in; informational only. */
    userUid: string | null
    ip: string | null
    locale: string | null
    handled: boolean
}

/** Newest-first, capped at 100 server-side — the whole triage inbox in one call. */
export async function listContactMessages(): Promise<ContactMessageDto[]> {
    const { data } = await http.get<ContactMessageDto[]>("/admin/contact-messages")
    return data
}

/**
 * Flip the triage flag on one message. `handled` defaults to `true` — the
 * common "mark as answered" action; pass `false` to put a message back in
 * the open queue.
 */
export async function markContactMessageHandled(
    id: number,
    handled = true,
): Promise<ContactMessageDto> {
    const { data } = await http.patch<ContactMessageDto>(
        `/admin/contact-messages/${id}/handled`,
        { handled },
        {
            successMessage: t("admin.contactMessages.toast.handled"),
        },
    )
    return data
}
