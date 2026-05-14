import { http } from "./http"

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
            successMessage: "Par pridružen korisniku.",
            silentErrorStatuses: [409],
        } as any,
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
            successMessage: "Turnir prenesen novom vlasniku.",
        } as any,
    )
    return data
}
