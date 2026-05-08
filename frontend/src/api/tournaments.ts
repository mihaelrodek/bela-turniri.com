// src/api/tournaments.ts
import { http } from "./http";
import type {
    CreateTournamentPayload,
    TournamentCard,
    TournamentDetails,
} from "../types/tournaments";
import type { PairDraft, PairShort } from "../types/pairs";

/** Create a tournament with all fields (new names). */
export async function createTournament(payload: CreateTournamentPayload): Promise<TournamentDetails> {
    // client-side defaults to satisfy not-null constraints
    const body: CreateTournamentPayload = {
        name: payload.name.trim(),
        location: payload.location ?? null,
        details: payload.details ?? null,
        startAt: payload.startAt ?? null,
        status: payload.status ?? "DRAFT",
        maxPairs: payload.maxPairs ?? 16,
        entryPrice: payload.entryPrice ?? 0,
        repassagePrice: payload.repassagePrice ?? 0,
        repassageSecondPrice: payload.repassageSecondPrice ?? null,
        repassageUntil: payload.repassageUntil ?? null,
        contactName: payload.contactName ?? null,
        contactPhone: payload.contactPhone ?? null,
        rewardType: payload.rewardType ?? null,
        rewardFirst: payload.rewardFirst ?? null,
        rewardSecond: payload.rewardSecond ?? null,
        rewardThird: payload.rewardThird ?? null,
        resourceId: payload.resourceId ?? null,
    };

    const { data } = await http.post<TournamentDetails>("/tournaments", body);
    return data;
}

/** List tournaments for a status bucket ("upcoming" or "finished"). */
export async function fetchTournaments(
    status: "upcoming" | "finished" = "upcoming",
): Promise<TournamentCard[]> {
    const { data } = await http.get<TournamentCard[]>("/tournaments", { params: { status } });
    return data;
}

/** Full details by id (UUID). */
export async function fetchTournamentDetails(uuid: string): Promise<TournamentDetails> {
    const { data } = await http.get<TournamentDetails>(`/tournaments/${uuid}`);
    return data;
}

/**
 * Update an existing tournament. Same payload shape as create — backend ignores
 * fields that are owned by other endpoints (status, winner, poster, matchmaking pref).
 * Poster changes still go through the multipart endpoint.
 */
export async function updateTournament(
    uuid: string,
    payload: CreateTournamentPayload,
): Promise<TournamentDetails> {
    const { data } = await http.put<TournamentDetails>(`/tournaments/${uuid}`, payload);
    return data;
}

/** Get pairs for a tournament (ids are Long). */
export async function fetchPairs(tournamentId: string): Promise<PairShort[]> {
    const { data } = await http.get<PairShort[]>(`/tournaments/${tournamentId}/pairs`);
    return data;
}

export async function fetchTournamentPairs(uuid: string): Promise<PairShort[]> {
    const { data } = await http.get<PairShort[]>(`/tournaments/${uuid}/pairs`)
    return data
}

/** Replace pairs (full-list PUT). */
export async function replacePairs(tournamentId: string, pairs: Array<PairShort | PairDraft>): Promise<PairShort[]> {
    const hasEmpty = pairs.some(p => !p.name || p.name.trim() === "");
    if (hasEmpty) throw new Error("Pair name cannot be empty.");

    const payload = pairs.map(p => ({
        id: typeof p.id === "number" && p.id > 0 ? p.id : null,
        name: p.name.trim(),
        isEliminated: !!p.isEliminated,
        extraLife: !!p.extraLife,
        wins: Number.isFinite(p.wins) ? p.wins : 0,
        losses: Number.isFinite(p.losses) ? p.losses : 0,
    }));

    const { data } = await http.put<PairShort[]>(`/tournaments/${tournamentId}/pairs`, payload);
    return data;
}


/** Buy extra life for a pair; backend validates eligibility. */
export async function buyExtraLife(tournamentUuid: string, pairId: number): Promise<PairShort> {
    const { data } = await http.post<PairShort>(`/tournaments/${tournamentUuid}/pairs/${pairId}/extra-life`)
    return data
}

export async function finishTournament(uuid: string): Promise<TournamentDetails> {
    const { data } = await http.post<TournamentDetails>(`/tournaments/${uuid}/finish`)
    return data
}

export async function startTournament(uuid: string): Promise<TournamentDetails> {
    const { data } = await http.put<TournamentDetails>(`/tournaments/${uuid}/start`)
    return data
}

export async function setAllowRepeats(
    uuid: string,
    allowRepeats: boolean
): Promise<TournamentDetails> {
    const payload = { preserveMatchmaking: !allowRepeats }
    const res = await http.patch<TournamentDetails>(`/tournaments/${uuid}/preserve-matchmaking`, payload)
    return res.data
}

export async function resetTournament(uuid: string): Promise<TournamentDetails> {
    const res = await http.post<TournamentDetails>(`/tournaments/${uuid}/reset`, {})
    return res.data
}

export async function setPairPaid(uuid: string, pairId: number, paid: boolean) {
    // Adjust path/verb to match your backend when you add it.
    // Using PATCH since it's a partial update of a single field.
    const { data } = await http.patch(`/tournaments/${uuid}/pairs/${pairId}/paid`, { paid });
    return data; // ideally returns the updated Pair DTO (including .paid)
}

/**
 * Any authenticated user can self-register a pair against a not-yet-started
 * tournament. Returned pair has pendingApproval=true until the organizer flips it.
 */
export async function selfRegisterPair(tournamentUuid: string, name: string): Promise<PairShort> {
    const { data } = await http.post<PairShort>(
        `/tournaments/${tournamentUuid}/pairs/self-register`,
        { name },
    )
    return data
}

/** Organizer (or admin) approves a previously self-registered pair. */
export async function approvePair(tournamentUuid: string, pairId: number): Promise<PairShort> {
    const { data } = await http.post<PairShort>(
        `/tournaments/${tournamentUuid}/pairs/${pairId}/approve`,
    )
    return data
}

/** Delete a single pair from a tournament (organizer/admin only, pre-start). */
export async function deletePair(tournamentUuid: string, pairId: number): Promise<void> {
    await http.delete(`/tournaments/${tournamentUuid}/pairs/${pairId}`)
}

/**
 * Soft-delete a tournament. Admin-only on the backend — the row stays in
 * the DB but is invisible to every read path via the entity's @Where filter.
 */
export async function deleteTournament(tournamentUuid: string): Promise<void> {
    await http.delete(`/tournaments/${tournamentUuid}`)
}