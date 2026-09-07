import { http } from "./http"
import { t } from "../i18n"

/** Preview of a shareable preset, returned by GET /pairs-name/claim/{token}/preview. */
export type PresetClaimPreviewDto = {
    name: string
    primaryName: string | null
    primarySlug: string | null
    alreadyClaimed: boolean
    coOwnerName: string | null
    coOwnerSlug: string | null
}

export type PresetClaimResultDto = {
    claimed: boolean
    presetUuid: string
}

/** Public — used by the claim landing page to preview the preset. */
export async function fetchPresetClaimPreview(
    token: string,
): Promise<PresetClaimPreviewDto> {
    const { data } = await http.get<PresetClaimPreviewDto>(
        `/pairs-name/claim/${encodeURIComponent(token)}/preview`,
        { silent: true },
    )
    return data
}

/**
 * Auth required. Conflict statuses:
 *   - 409 OWNER_SAME      — viewer is the primary owner
 *   - 409 ALREADY_CLAIMED — claimed by a different user
 *   - 404                 — token unknown
 */
export async function claimPreset(token: string): Promise<PresetClaimResultDto> {
    const { data } = await http.post<PresetClaimResultDto>(
        `/pairs-name/claim/${encodeURIComponent(token)}`,
        null,
        {
            successMessage: t("common.toast.pairClaimed"),
            silentErrorStatuses: [409],
        },
    )
    return data
}
