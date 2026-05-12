import { http } from "./http"

/**
 * Viewer-aware preset row. Both owners (the primary creator and the
 * claimed co-owner) see the same preset — fields here are framed
 * relative to "you" so the UI doesn't need to translate roles.
 */
export type UserPairPreset = {
    uuid: string
    name: string
    /** When true, the public profile hides participations under this name from non-owner viewers. */
    hidden: boolean
    /** "PRIMARY" if you created the preset, "CO_OWNER" if you claimed it via a share link. */
    myRole: "PRIMARY" | "CO_OWNER"
    /** Display info about the OTHER owner — null until the preset is claimed. */
    partnerSlug: string | null
    partnerName: string | null
    /** Share-link token, only emitted to PRIMARY when no one's claimed yet. */
    claimToken: string | null
    /** True if there's a pending archive request that you filed. */
    archiveRequestedByMe: boolean
    /** True if the partner filed an archive request awaiting your response. */
    archiveRequestedByPartner: boolean
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

/**
 * Delete an unclaimed preset. For claimed presets the backend returns
 * 409 CO_OWNED_USE_ARCHIVE_FLOW — the UI should call requestArchive
 * instead.
 */
export async function deletePreset(uuid: string): Promise<void> {
    await http.delete(`/user/pair-presets/${uuid}`, {
        silentErrorStatuses: [409],
    } as any)
}

/* =========================================================
   Archive-request lifecycle (for claimed presets)
   ========================================================= */

/** File a request to archive the preset. Partner gets a push. */
export async function requestPresetArchive(uuid: string): Promise<UserPairPreset> {
    const { data } = await http.post<UserPairPreset>(
        `/user/pair-presets/${uuid}/archive-request`,
        null,
        { successMessage: "Zahtjev poslan — čeka se odgovor partnera." } as any,
    )
    return data
}

/** Accept the partner's request — archives the preset. */
export async function confirmPresetArchive(uuid: string): Promise<void> {
    await http.post(
        `/user/pair-presets/${uuid}/archive-confirm`,
        null,
        { successMessage: "Par obrisan." } as any,
    )
}

/**
 * Cancel a pending request. Works for both sides:
 *   - Requester calls it to cancel (changed their mind)
 *   - Partner calls it to reject (declines the archive)
 */
export async function cancelPresetArchive(uuid: string): Promise<void> {
    await http.delete(
        `/user/pair-presets/${uuid}/archive-request`,
        { successMessage: "Zahtjev otkazan." } as any,
    )
}
