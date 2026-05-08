import { http } from "./http"

export type MyTournamentParticipation = {
    tournamentUuid: string
    tournamentName: string
    tournamentLocation?: string | null
    tournamentStartAt?: string | null
    tournamentStatus?: "DRAFT" | "STARTED" | "FINISHED" | null
    winnerName?: string | null

    pairId: number
    pairName: string
    pendingApproval: boolean
    eliminated: boolean
    extraLife: boolean
    wins: number
    losses: number
    isWinner: boolean
}

/** All tournaments the current user has self-registered a pair for. */
export async function listMyTournaments(): Promise<MyTournamentParticipation[]> {
    const { data } = await http.get<MyTournamentParticipation[]>("/user/me/tournaments")
    return data
}

/** Profile fields the user can edit themselves, plus read-only display info. */
export type UserProfile = {
    phoneCountry: string | null
    phone: string | null
    /** Mirrored from Firebase via /user/me/sync. */
    displayName?: string | null
    /** Public handle for /profile/{slug}. Generated server-side. */
    slug?: string | null
}

export async function getProfile(): Promise<UserProfile> {
    const { data } = await http.get<UserProfile>("/user/me/profile")
    return data
}

export async function updateProfile(payload: { phoneCountry: string | null; phone: string | null }): Promise<UserProfile> {
    const { data } = await http.put<UserProfile>("/user/me/profile", payload)
    return data
}

/**
 * Push the current Firebase displayName up to the backend so it can persist
 * it + assign a public slug. Idempotent — fire-and-forget on every login.
 */
export async function syncProfile(displayName: string | null | undefined): Promise<UserProfile> {
    const { data } = await http.post<UserProfile>("/user/me/sync", {
        displayName: displayName ?? null,
    })
    return data
}
