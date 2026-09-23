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

export type AdminGameAnalyticsDto = {
    summary: {
        roomsCreated: number
        gamesStarted: number
        completed: number
        abandoned: number
        inProgress: number
        completionRate: number
        abandonmentRate: number
    }
    byTarget: Array<{ label: string; started: number; completed: number; abandoned: number }>
    trumps: Array<{ suit: string; calls: number; successes: number; falls: number; share: number; successRate: number }>
    callPositions: Array<{ position: number; calls: number; successes: number; falls: number; successRate: number }>
    details: {
        deals: number
        averageDealsPerCompletedGame: number
        averageDurationMinutes: number
        declarationPoints: number
        stiglja: number
        belot: number
        autoPlayedActions: number
        publicGames: number
        privateGames: number
        humanOnlyGames: number
        mixedGames: number
        botOnlyGames: number
    }
    lastEventAt: string | null
}

export async function adminGetGameAnalytics(): Promise<AdminGameAnalyticsDto> {
    const { data } = await http.get<AdminGameAnalyticsDto>("/admin/game-analytics")
    return data
}

/** One person in the "who played" list — an account or a named guest. */
export type AdminGamePlayerDto = {
    /** Firebase UID, or null on a guest row (a guest has no identifier). */
    uid: string | null
    /** In-game name, else profile display name, else a shortened uid. */
    name: string
    /** Guest rows are grouped BY NAME, so same-named guests merge into one. */
    kind: "PLAYER" | "GUEST"
    /** EVERY recorded game, including games played against bots or demo people. */
    games: number
    wins: number
    losses: number
    /** Of those, the §8.1-eligible ones — the record the player's profile shows. */
    rankedGames: number
    rankedWins: number
    rankedLosses: number
    lastPlayedAt: string | null
    /** Lifetime confirmed abandonments, never reset. Always 0 for a guest. */
    abandons: number
    karma: number
    maxKarma: number
}

/**
 * Sibling of the analytics aggregate: read from the finished-games table
 * rather than the analytics event log, hence its own endpoint and query key.
 *
 * Analytics view since 2026-09-22: it counts every recorded game, not only
 * the ranked ones, and guests are listed by the name they played under
 * instead of only appearing in the seat counters.
 */
export type AdminGamePlayersDto = {
    totalPlayers: number
    shown: number
    limit: number
    guestSeats: number
    guestWins: number
    botSeats: number
    demoSeats: number
    /** Whole games in which a real person sat with at least one demo person. */
    demoGames: number
    /** Whole games a real person played with bots only. */
    botOnlyGames: number
    players: AdminGamePlayerDto[]
}

export async function adminGetGamePlayers(limit = 200): Promise<AdminGamePlayersDto> {
    const { data } = await http.get<AdminGamePlayersDto>("/admin/game-analytics/players", {
        params: { limit },
    })
    return data
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
