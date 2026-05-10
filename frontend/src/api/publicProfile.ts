import { http } from "./http"
import type { MyTournamentParticipation } from "./userMe"

/** PairSummary nested type as returned by /public/users/{slug}. */
export type PairSummary = {
    name: string
    tournamentCount: number
    wins: number
}

export type PublicProfile = {
    slug: string
    displayName: string | null
    phoneCountry: string | null
    phone: string | null
    /**
     * True when the user has a phone on file. Anonymous callers always see
     * {@code phone = null} (redacted by the backend), so the SPA uses this
     * flag to decide whether to render the blurred "Prijavi se da vidiš
     * broj" placeholder vs. nothing.
     */
    hasPhone: boolean
    /** Proxied URL for the user's avatar, or null if none. */
    avatarUrl: string | null
    pairs: PairSummary[]
    tournaments: MyTournamentParticipation[]
}

/** One row of /public/users/{slug}/pairs/{pairId}/matches. */
export type PairMatchRow = {
    roundNumber: number | null
    tableNo: number | null
    opponentName: string | null
    ourScore: number | null
    opponentScore: number | null
    status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "FINISHED" | string | null
    won: boolean | null
    isBye: boolean
}

export type PairMatchHistory = {
    pairId: number
    pairName: string
    tournamentName: string | null
    matches: PairMatchRow[]
}

export async function getPublicProfile(slug: string): Promise<PublicProfile> {
    const { data } = await http.get<PublicProfile>(`/public/users/${encodeURIComponent(slug)}`)
    return data
}

export async function getPairMatchHistory(slug: string, pairId: number): Promise<PairMatchHistory> {
    const { data } = await http.get<PairMatchHistory>(
        `/public/users/${encodeURIComponent(slug)}/pairs/${pairId}/matches`,
    )
    return data
}
