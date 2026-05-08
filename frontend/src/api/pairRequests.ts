import { http } from "./http"

/** Wire shape returned by the backend (PairRequestDto). */
export type PairRequest = {
    uuid: string
    tournamentUuid: string
    tournamentName: string
    tournamentLocation?: string | null
    tournamentStartAt?: string | null
    playerName: string
    phone: string
    note?: string | null
    status: "OPEN" | "MATCHED"
    createdAt: string
    /** Firebase UID of the original poster — used to gate Spareno/Delete. */
    createdByUid?: string | null
}

export type CreatePairRequestPayload = {
    playerName: string
    phone: string
    note?: string | null
}

/** Create a new pair-finding request for a specific tournament. */
export async function createPairRequest(
    tournamentUuid: string,
    payload: CreatePairRequestPayload,
): Promise<PairRequest> {
    const { data } = await http.post<PairRequest>(
        `/pair-requests/by-tournament/${tournamentUuid}`,
        payload,
    )
    return data
}

/** List all pair-finding requests, optionally filtered by status. */
export async function listPairRequests(
    status?: "open" | "matched",
): Promise<PairRequest[]> {
    const { data } = await http.get<PairRequest[]>("/pair-requests", {
        params: status ? { status } : undefined,
    })
    return data
}

/** List requests for a single tournament. */
export async function listPairRequestsForTournament(
    tournamentUuid: string,
): Promise<PairRequest[]> {
    const { data } = await http.get<PairRequest[]>(
        `/pair-requests/by-tournament/${tournamentUuid}`,
    )
    return data
}

/** Edit an existing request (only the original poster or an admin can do this). */
export async function updatePairRequest(
    requestUuid: string,
    payload: CreatePairRequestPayload,
): Promise<PairRequest> {
    const { data } = await http.put<PairRequest>(
        `/pair-requests/${requestUuid}`,
        payload,
    )
    return data
}

/** Mark a request as matched (the seeker found a partner). */
export async function matchPairRequest(requestUuid: string): Promise<PairRequest> {
    const { data } = await http.post<PairRequest>(
        `/pair-requests/${requestUuid}/match`,
    )
    return data
}

/** Remove a request entirely. */
export async function deletePairRequest(requestUuid: string): Promise<void> {
    await http.delete(`/pair-requests/${requestUuid}`)
}
