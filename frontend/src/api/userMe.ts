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
    byTargetScore?: Partial<Record<"163" | "501" | "701" | "1001", GameStatCategory>>
}

export type GameReliabilityDto = {
    karma: number
    /** Lifetime abandon count — existing field, never resets. */
    abandons: number
    /** The scale's top ("x/maxKarma"), so the label is never hard-coded. */
    maxKarma: number
    /**
     * Karma redesign (2026-09-21, KARMA-CONTRACT.md): games abandoned inside
     * the rolling window, eligible games FINISHED in the same window, and the
     * window's length in days. All three optional on the TYPE — not because
     * a current backend omits them, but because an older, not-yet-upgraded
     * one would, and `GameStatsCard` must not crash reading a stale response.
     */
    recentAbandons?: number
    recentGames?: number
    windowDays?: number
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
        // 410 ACCOUNT_DELETED is a normal answer here, not a failure: the
        // account was erased on another device (or the Firebase user
        // outlived the server-side delete), and the token in this tab is
        // simply the last thing left of it. Silencing the status keeps the
        // interceptor from red-toasting a boot-time request the user never
        // asked for — `deleted` below is what callers should act on.
        { silent: true, silentErrorStatuses: [410] },
    )
    return data
}

/**
 * Result of a profile sync that tolerates a deleted account.
 *
 * `deleted` is true when the backend answered 410 ACCOUNT_DELETED, i.e. this
 * Firebase session belongs to an account that no longer exists. Nothing is
 * thrown, so the existing login flow continues undisturbed.
 *
 * FOLLOW-UP: `auth/AuthContext.tsx` (not touched here) should call this in
 * place of {@link syncProfile} and sign the user out when `deleted` is true —
 * right now a stale session just renders an empty profile until the next
 * authenticated write fails.
 */
export async function syncProfileTolerant(
    displayName: string | null | undefined,
): Promise<{ profile: UserProfile | null; deleted: boolean }> {
    try {
        return { profile: await syncProfile(displayName), deleted: false }
    } catch (err) {
        const res = (err as { response?: { status?: number; data?: unknown } } | null)?.response
        if (res?.status === 410) return { profile: null, deleted: true }
        throw err
    }
}

/**
 * Erase the signed-in account (App Store requirement: an account created in
 * the app must be deletable from inside it).
 *
 * The server anonymises the profile — name, photo, phone, settings and every
 * block go; tournaments the user organised and results other people played
 * against them stay, rendered as "Obrisani korisnik" — and deletes the
 * Firebase user when it can. The client still calls Firebase's `deleteUser`
 * afterwards as a second path, because a server-side Admin SDK delete can
 * fail on its own while the profile is already gone. Silent: the caller
 * (`pages/profile/DeleteAccountCard`) signs out and toasts once at the end,
 * after both halves have run.
 */
export async function deleteAccount(): Promise<void> {
    await http.delete("/user/me", { silent: true })
}

/* ── Blocks ─────────────────────────────────────────────────────────────── */

/** One blocked user, as listed on "Blokirani korisnici". */
export type BlockedUser = {
    uid: string
    slug: string | null
    displayName: string | null
    avatarUrl: string | null
    avatarPreset: string | null
}

export async function listBlocks(): Promise<BlockedUser[]> {
    const { data } = await http.get<BlockedUser[]>("/user/me/blocks", { silent: true })
    return data
}

/**
 * Block a user by Firebase UID. Server effects, both ways: their public
 * profile 404s for you and yours for them, and tournaments they created drop
 * out of your `/tournaments` list — which is why every caller invalidates
 * `qk.tournaments` as well as `qk.blocks`. Silent so the caller can word the
 * consequence ("Korisnik je blokiran…") instead of a bare "Spremljeno".
 */
export async function blockUser(uid: string): Promise<void> {
    await http.put(`/user/me/blocks/${encodeURIComponent(uid)}`, undefined, { silent: true })
}

export async function unblockUser(uid: string): Promise<void> {
    await http.delete(`/user/me/blocks/${encodeURIComponent(uid)}`, { silent: true })
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

export async function fetchMyGameReliability(): Promise<GameReliabilityDto> {
    const { data } = await http.get<GameReliabilityDto>("/user/me/game-reliability", { silent: true })
    return data
}
