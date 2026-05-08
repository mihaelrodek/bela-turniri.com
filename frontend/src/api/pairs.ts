import axios from "axios";
import type { PairShort } from "../types/pairs";

const api = axios.create({ baseURL: "/api" });

export async function getPairs(tournamentId: string): Promise<PairShort[]> {
    const { data } = await api.get(`/tournaments/${tournamentId}/pairs`);
    return (data ?? []).map((p: any) => ({
        id: String(p.id),
        name: p.name,
        isEliminated: !!p.isEliminated,
        extraLife: !!p.extraLife, // <— NEW
    }));
}

export type PairUpsert = {
    id?: string;           // omit/undefined for new pairs
    name: string;
    isEliminated?: boolean;
    extraLife?: boolean;   // <— NEW
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
        extraLife: !!p.extraLife, // <— NEW
    }));
}