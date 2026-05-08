import { http } from "./http"

export type UserPairPreset = {
    uuid: string
    name: string
}

export async function listPresets(): Promise<UserPairPreset[]> {
    const { data } = await http.get<UserPairPreset[]>("/user/pair-presets")
    return data
}

export async function createPreset(name: string): Promise<UserPairPreset> {
    const { data } = await http.post<UserPairPreset>("/user/pair-presets", { name })
    return data
}

export async function updatePreset(uuid: string, name: string): Promise<UserPairPreset> {
    const { data } = await http.put<UserPairPreset>(`/user/pair-presets/${uuid}`, { name })
    return data
}

export async function deletePreset(uuid: string): Promise<void> {
    await http.delete(`/user/pair-presets/${uuid}`)
}
