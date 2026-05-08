import {http} from "./http"
import type { RoundDto, MatchDto } from "../types/round"

export async function fetchRounds(uuid: string): Promise<RoundDto[]> {
    const { data } = await http.get<RoundDto[]>(`/tournaments/${uuid}/rounds`)
    return data
}

export async function drawRound(uuid: string): Promise<RoundDto> {
    const { data } = await http.post<RoundDto>(`/tournaments/${uuid}/rounds/draw`)
    return data
}

export async function updateMatchScore(
    uuid: string,
    roundId: number,
    matchId: number,
    body: { score1: number | null; score2: number | null }
): Promise<MatchDto> {
    const { data } = await http.put<MatchDto>(
        `/tournaments/${uuid}/rounds/${roundId}/matches/${matchId}`,
        body
    )
    return data
}

/** Prefer deleting the whole round if your backend supports it; otherwise delete only matches. */
export async function hardResetRound(uuid: string, roundId: number): Promise<void> {
    try {
        await http.delete(`/tournaments/${uuid}/rounds/${roundId}`)
    } catch {
        await http.delete(`/tournaments/${uuid}/rounds/${roundId}/matches`)
    }
}

export async function finishRound(tournamentUuid: string, roundId: number): Promise<RoundDto> {
    const { data } = await http.put<RoundDto>(`/tournaments/${tournamentUuid}/rounds/${roundId}/finish`)
    return data
}

export async function overrideMatchScore(
    uuid: string,
    roundId: number,
    matchId: number,
    payload: { score1: number | null; score2: number | null }
): Promise<RoundDto> {
    const res = await http.patch<RoundDto>(
        `/tournaments/${uuid}/rounds/${roundId}/matches/${matchId}/override-score`,
        payload
    )
    return res.data
}