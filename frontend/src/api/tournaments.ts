import { http } from "./http";
import type {
    CreateTournamentPayload,
    TournamentCard,
    TournamentDetails,
} from "../types/tournaments";
import type { PairDraft, PairShort } from "../types/pairs";

export async function createTournament(payload: CreateTournamentPayload): Promise<TournamentDetails> {
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

    const { data } = await http.post<TournamentDetails>(
        "/tournaments",
        body,
        { successMessage: "Turnir je kreiran." } as any,
    );
    return data;
}

export async function fetchTournaments(
    status: "upcoming" | "finished" = "upcoming",
    opts?: { offset?: number; limit?: number },
): Promise<TournamentCard[]> {
    const params: Record<string, string | number> = { status };
    if (opts?.offset != null) params.offset = opts.offset;
    if (opts?.limit != null) params.limit = opts.limit;
    const { data } = await http.get<TournamentCard[]>("/tournaments", { params });
    return data;
}

/**
 * Backend-side total count for a status bucket. Used by the "Učitaj više"
 * button on the finished list to know when to stop offering more.
 */
export async function fetchTournamentsCount(
    status: "finished" = "finished",
): Promise<number> {
    const { data } = await http.get<{ total: number }>("/tournaments/count", {
        params: { status },
        // No success toast for a background count.
        silent: true,
    } as any);
    return data.total
}

export async function fetchTournamentDetails(uuid: string): Promise<TournamentDetails> {
    const { data } = await http.get<TournamentDetails>(`/tournaments/${uuid}`);
    return data;
}

export async function updateTournament(
    uuid: string,
    payload: CreateTournamentPayload,
): Promise<TournamentDetails> {
    const { data } = await http.put<TournamentDetails>(
        `/tournaments/${uuid}`,
        payload,
        { successMessage: "Turnir je ažuriran." } as any,
    );
    return data;
}

export async function fetchPairs(tournamentId: string): Promise<PairShort[]> {
    const { data } = await http.get<PairShort[]>(`/tournaments/${tournamentId}/pairs`);
    return data;
}

export async function fetchTournamentPairs(uuid: string): Promise<PairShort[]> {
    const { data } = await http.get<PairShort[]>(`/tournaments/${uuid}/pairs`)
    return data
}

export async function replacePairs(tournamentId: string, pairs: Array<PairShort | PairDraft>): Promise<PairShort[]> {
    const hasEmpty = pairs.some(p => !p.name || p.name.trim() === "");
    if (hasEmpty) throw new Error("Pair name cannot be empty.");

    // Include `paid` in the wire payload — backend PairDto carries it and
    // PairMapper persists it (target=paid, source=paid). Without this the
    // bulk save would silently reset paid=false on every replacePairs call,
    // and the "Plati on a not-yet-saved pair" flow would lose its kotizacija
    // flag the moment the pair gets a real id.
    const payload = pairs.map(p => ({
        id: typeof p.id === "number" && p.id > 0 ? p.id : null,
        name: p.name.trim(),
        isEliminated: !!p.isEliminated,
        extraLife: !!p.extraLife,
        wins: Number.isFinite(p.wins) ? p.wins : 0,
        losses: Number.isFinite(p.losses) ? p.losses : 0,
        paid: !!(p as any).paid,
    }));

    const { data } = await http.put<PairShort[]>(`/tournaments/${tournamentId}/pairs`, payload);
    return data;
}

export async function buyExtraLife(tournamentUuid: string, pairId: number): Promise<PairShort> {
    const { data } = await http.post<PairShort>(
        `/tournaments/${tournamentUuid}/pairs/${pairId}/extra-life`,
        undefined,
        { successMessage: "Dodatni život je kupljen." } as any,
    )
    return data
}

export async function finishTournament(uuid: string): Promise<TournamentDetails> {
    const { data } = await http.post<TournamentDetails>(
        `/tournaments/${uuid}/finish`,
        undefined,
        { successMessage: "Turnir je završen." } as any,
    )
    return data
}

export async function startTournament(uuid: string): Promise<TournamentDetails> {
    const { data } = await http.put<TournamentDetails>(
        `/tournaments/${uuid}/start`,
        undefined,
        { successMessage: "Turnir je pokrenut." } as any,
    )
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
    const res = await http.post<TournamentDetails>(
        `/tournaments/${uuid}/reset`,
        {},
        { successMessage: "Turnir je resetiran." } as any,
    )
    return res.data
}

export async function setPairPaid(uuid: string, pairId: number, paid: boolean) {
    const { data } = await http.patch(`/tournaments/${uuid}/pairs/${pairId}/paid`, { paid });
    return data;
}

export async function selfRegisterPair(tournamentUuid: string, name: string): Promise<PairShort> {
    const { data } = await http.post<PairShort>(
        `/tournaments/${tournamentUuid}/pairs/self-register`,
        { name },
        { successMessage: "Prijava poslana." } as any,
    )
    return data
}

export async function approvePair(tournamentUuid: string, pairId: number): Promise<PairShort> {
    const { data } = await http.post<PairShort>(
        `/tournaments/${tournamentUuid}/pairs/${pairId}/approve`,
        undefined,
        { successMessage: "Par je odobren." } as any,
    )
    return data
}

export async function deletePair(tournamentUuid: string, pairId: number): Promise<void> {
    await http.delete(
        `/tournaments/${tournamentUuid}/pairs/${pairId}`,
        { successMessage: "Par je obrisan." } as any,
    )
}

export async function deleteTournament(tournamentUuid: string): Promise<void> {
    await http.delete(
        `/tournaments/${tournamentUuid}`,
        { successMessage: "Turnir je obrisan." } as any,
    )
}
