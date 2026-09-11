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
    /**
     * The drawn character picked instead of a photo, or null. Already
     * resolved against `avatarUrl` server-side (`AvatarPresetService.presetFor`):
     * a photo wins whenever one is set, so this and `avatarUrl` are never
     * both non-null at once.
     */
    avatarPreset?: string | null
    /** "light" or "dark"; null until the user picks one. */
    colorMode?: "light" | "dark" | null
    /** BCP-47 base tag ("hr" | "sl"); null until the user picks one. */
    locale?: string | null
    /**
     * "Ime za igru" — the name this user wears at the card table, null when
     * they never set one. READ-ONLY here: it is written over the game socket
     * (`profile.setName`), because the same control has to serve guests, who
     * have no bearer token to reach this endpoint with.
     */
    gameName?: string | null
}

export type GameStatCategory = {
    games: number
    wins: number
    losses: number
    winRate: number
}

export type GameStatsDto = {
    global: GameStatCategory
    byTargetScore?: Partial<Record<"501" | "701" | "1001", GameStatCategory>>
}

export async function getProfile(): Promise<UserProfile> {
    const { data } = await http.get<UserProfile>("/user/me/profile")
    return data
}

/**
 * `avatarPreset` is genuinely optional here — omitted leaves the stored
 * choice untouched, `""` clears it, a known id sets it (400
 * `INVALID_AVATAR_PRESET` for anything else). `phoneCountry`/`phone` are
 * NOT optional on the wire, even though TypeScript can't say so without
 * splitting this into two payload shapes: the backend rewrites both from
 * the body unconditionally on every PUT, so a caller that wants to change
 * only the avatar must still echo back the current phone fields, or it
 * silently blanks them. See `MyDataCard`'s avatar-pick handler.
 */
export async function updateProfile(
    payload: { phoneCountry: string | null; phone: string | null; avatarPreset?: string | null },
    opts?: { silentErrorStatuses?: true | number[] },
): Promise<UserProfile> {
    const { data } = await http.put<UserProfile>(
        "/user/me/profile",
        payload,
        { successMessage: t("common.toast.profileSaved"), ...opts },
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

/**
 * Fetch the signed-in user's game statistics. Silent — stats are a soft,
 * non-critical read; a failure should not disrupt the profile page.
 */
export async function fetchMyGameStats(): Promise<GameStatsDto> {
    const { data } = await http.get<GameStatsDto>(
        "/user/me/game-stats",
        { silent: true },
    )
    return data
}
