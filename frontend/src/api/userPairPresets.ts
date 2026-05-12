import { http } from "./http"

export type UserPairPreset = {
    uuid: string
    name: string
    /** When true, the public profile hides participations under this name from non-owner viewers. */
    hidden: boolean
    /** Display slug of the partner who claimed the share link, null if unclaimed. */
    coOwnerSlug?: string | null
    coOwnerName?: string | null
    /** Share-link token, only emitted to the owner of the preset. */
    claimToken?: string | null
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
    const { data } = await http.put<UserPairPreset>(
        `/user/pair-presets/${uuid}`,
        { name },
    )
    return data
}

/** Flip the visibility flag without sending the full preset shape. */
export async function setPresetVisibility(
    uuid: string,
    hidden: boolean,
): Promise<UserPairPreset> {
    const { data } = await http.post<UserPairPreset>(
        `/user/pair-presets/${uuid}/visibility`,
        { hidden },
        {
            successMessage: hidden
                ? "Par sakriven od drugih"
                : "Par vidljiv svima",
        } as any,
    )
    return data
}

export async function deletePreset(uuid: string): Promise<void> {
    // The backend returns 409 with body "CLAIMED_PAIR_PRESENT" when the
    // name is anchoring a co-owned pair — let the caller handle that
    // with its own copy instead of the generic 409 toast.
    await http.delete(`/user/pair-presets/${uuid}`, {
        silentErrorStatuses: [409],
    } as any)
}
