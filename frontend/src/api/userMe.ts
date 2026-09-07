import { http } from "./http"
import { t } from "../i18n"

export type MyTournamentParticipation = {
    tournamentUuid: string
    /** Pretty URL slug; null on legacy rows pre-backfill. */
    tournamentSlug?: string | null
    tournamentName: string
    tournamentLocation?: string | null
    tournamentStartAt?: string | null
    tournamentStatus?: "DRAFT" | "STARTED" | "FINISHED" | null
    winnerName?: string | null

    pairId: number
    pairName: string
    pendingApproval: boolean
    eliminated: boolean
    extraLife: boolean
    wins: number
    losses: number
    isWinner: boolean
}

export type UserProfile = {
    phoneCountry: string | null
    phone: string | null
    displayName?: string | null
    slug?: string | null
    avatarUrl?: string | null
    /** "light" or "dark"; null until the user picks one. */
    colorMode?: "light" | "dark" | null
    /** BCP-47 base tag ("hr" | "sl"); null until the user picks one. */
    locale?: string | null
}

export async function getProfile(): Promise<UserProfile> {
    const { data } = await http.get<UserProfile>("/user/me/profile")
    return data
}

export async function updateProfile(payload: { phoneCountry: string | null; phone: string | null }): Promise<UserProfile> {
    const { data } = await http.put<UserProfile>(
        "/user/me/profile",
        payload,
        { successMessage: t("common.toast.profileSaved") },
    )
    return data
}

/**
 * Persist the user's theme choice. Sent on its own (no contact fields)
 * because the toggle lives outside the contact-form UX. Silent — the
 * UI flips colors instantly, a "saved" toast would be redundant noise.
 */
export async function updateColorMode(mode: "light" | "dark"): Promise<UserProfile> {
    const { data } = await http.put<UserProfile>(
        "/user/me/profile",
        { colorMode: mode },
        { silent: true },
    )
    return data
}

/**
 * Persist the user's language choice so it follows the account across devices
 * (LocaleSync applies it again on the next login elsewhere). PATCH, not the
 * profile PUT: that endpoint rewrites the contact fields from the body, so a
 * language-only PUT would blank the user's phone number. Silent — the UI has
 * already switched language, a "saved" toast would be noise.
 */
export async function updateLocale(locale: string): Promise<UserProfile> {
    // ToastOpts is declaration-merged into AxiosRequestConfig in
    // api/http.ts, so `silent` is a real, typed option — no cast needed.
    const { data } = await http.patch<UserProfile>(
        "/user/me/profile/locale",
        { locale },
        { silent: true },
    )
    return data
}

/**
 * Push the current Firebase displayName up to the backend so it can persist
 * it + assign a public slug. Idempotent — fire-and-forget on every login.
 * Silent so it doesn't fire a toast every time the auth context boots.
 */
export async function syncProfile(displayName: string | null | undefined): Promise<UserProfile> {
    const { data } = await http.post<UserProfile>(
        "/user/me/sync",
        { displayName: displayName ?? null },
        { silent: true },
    )
    return data
}

export async function uploadAvatar(file: File): Promise<UserProfile> {
    const fd = new FormData()
    fd.append("avatar", file)
    const { data } = await http.post<UserProfile>(
        "/user/me/avatar",
        fd,
        {
            headers: { "Content-Type": "multipart/form-data" },
            successMessage: t("common.toast.avatarSaved"),
        },
    )
    return data
}

export async function deleteAvatar(): Promise<UserProfile> {
    const { data } = await http.delete<UserProfile>(
        "/user/me/avatar",
        { successMessage: t("common.toast.avatarRemoved") },
    )
    return data
}
