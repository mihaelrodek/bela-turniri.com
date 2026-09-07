import {http} from "./http"
import { t } from "../i18n"
import type { RoundDto, MatchDto } from "../types/round"

/**
 * `opts.silent` suppresses the interceptor's error toast — used by the
 * background live-poll on the tournament page, where a transient network
 * blip should not throw a red toast over whatever the user is reading.
 */
export async function fetchRounds(uuid: string, opts?: { silent?: boolean }): Promise<RoundDto[]> {
    const { data } = await http.get<RoundDto[]>(`/tournaments/${uuid}/rounds`, { silent: opts?.silent })
    return data
}

export async function drawRound(uuid: string): Promise<RoundDto> {
    const { data } = await http.post<RoundDto>(`/tournaments/${uuid}/rounds/draw`)
    return data
}

/** One entry in the manual round body — pair2Id null means BYE. */
export type ManualMatchInput = {
    pair1Id: number
    pair2Id: number | null
    tableNo: number
}

/**
 * Manual round generation — bypasses the random pairing logic by sending
 * the exact list of matches the organiser wants. Used in the late stage
 * of a small bracket where auto-draw doesn't pair the way the organiser
 * wants. Backend validates the request and returns 400 with a
 * descriptive message if any pair is already eliminated, appears twice,
 * or doesn't belong to this tournament.
 */
export async function drawManualRound(
    uuid: string,
    matches: ManualMatchInput[],
): Promise<RoundDto> {
    const { data } = await http.post<RoundDto>(
        `/tournaments/${uuid}/rounds/manual`,
        { matches },
        { successMessage: t("common.toast.roundGenerated") },
    )
    return data
}

/**
 * `opts.silent` suppresses both the success and the error toast. The
 * "finish whole round" action saves every table in one go and would
 * otherwise stack one toast per match; it reports a single summary itself.
 *
 * `opts.opId` is the offline queue's operation id. It travels as
 * `X-Client-Op-Id`, and the backend applies a given id exactly once — which
 * is what makes replaying a score typed during a Wi-Fi outage safe. The
 * header is set per request rather than in an interceptor because
 * `api/http.ts` is shared by every call and most of them are not queued.
 */
export async function updateMatchScore(
    uuid: string,
    roundId: number,
    matchId: number,
    body: { score1: number | null; score2: number | null },
    opts?: { silent?: boolean; opId?: string }
): Promise<MatchDto> {
    const { data } = await http.put<MatchDto>(
        `/tournaments/${uuid}/rounds/${roundId}/matches/${matchId}`,
        body,
        {
            silent: opts?.silent,
            ...(opts?.opId ? { headers: { "X-Client-Op-Id": opts.opId } } : {}),
        }
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

/**
 * Closes a round. This is the ONLY toast the "Završi rundu" flow shows —
 * the per-match score saves it runs first are all `silent`.
 */
export async function finishRound(tournamentUuid: string, roundId: number): Promise<RoundDto> {
    const { data } = await http.put<RoundDto>(
        `/tournaments/${tournamentUuid}/rounds/${roundId}/finish`,
        undefined,
        { successMessage: t("common.toast.roundFinished") },
    )
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