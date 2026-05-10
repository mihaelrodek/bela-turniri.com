import type { PairShort } from "../types/pairs";
// Use the shared http instance so this file inherits the Firebase auth header
// AND the global success/error toast interceptors. The standalone axios.create
// it used before bypassed both.
import { http as api } from "./http";

export async function getPairs(tournamentId: string): Promise<PairShort[]> {
    const { data } = await api.get(`/tournaments/${tournamentId}/pairs`);
    return (data ?? []).map((p: any) => ({
        id: String(p.id),
        name: p.name,
        isEliminated: !!p.isEliminated,
        extraLife: !!p.extraLife,
    }));
}

export type PairUpsert = {
    id?: string;
    name: string;
    isEliminated?: boolean;
    extraLife?: boolean;
};

export async function replacePairs(
    tournamentId: string,
    pairs: PairShort[]
): Promise<PairShort[]> {
    const { data } = await api.put(`/tournaments/${tournamentId}/pairs`, pairs);
    return (data ?? []).map((p: any) => ({
        id: String(p.id),
        name: p.name,
        isEliminated: !!p.isEliminated,
        extraLife: !!p.extraLife,
    }));
}
