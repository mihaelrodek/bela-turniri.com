import {
    isoToDate,
    isoToTime,
    moneyToNumber,
    numberToMoneyStr,
    pad2,
    toLocalOffsetIso,
} from "./format"
import { DEFAULT_DIAL_CODE, joinPhone, splitPhone } from "./phone"
import type {
    CreateTournamentPayload,
    RepassageUntil,
    RewardType,
    TournamentDetails,
} from "../types/tournaments"

/* ──────────────────────────────────────────────────────────────────────────
   ONE form model for both tournament forms.

   CreateTournamentPage and the detail page's "Uredi" form had grown two
   independent shapes for the same eleven fields, two payload builders, and —
   worse — two different casings: create stored `"finals"` / `"fixed"` and
   converted with `mapRepassageUntil` / `mapRewardType` shims on submit, while
   edit stored the backend's own `"FINALS"` / `"FIXED"` and needed no shims.
   Every field added since had to be added twice, in two casings.

   The canonical casing here is the BACKEND's. `CreateTournamentRequest`
   (backend/dtos) takes the enums `RepassageUntil { FINALS, SEMIFINALS,
   FIRST_ROUND }` and `RewardType { FIXED, PERCENTAGE }`, so the form holds
   exactly those strings, the radio inputs carry them as their DOM values, and
   the shims are gone rather than reimplemented in one place.

   Empty string means "not set" throughout (maxPairs, the second repassage
   price), the same convention both forms already used; `toPayload` is the one
   place that turns it into the backend's `null`.
   ────────────────────────────────────────────────────────────────────── */

export type TournamentForm = {
    name: string
    location: string
    details: string
    /** yyyy-MM-dd, local. Combined with startTime by `toLocalOffsetIso`. */
    startDate: string
    /** HH:mm, local. */
    startTime: string
    /** "" = no cap ("Neodređeno"). */
    maxPairs: string
    entryPrice: string
    repassagePrice: string
    /** "" = not set → the backend's null wipes any stored second repassage. */
    repassageSecondPrice: string
    repassageUntil: RepassageUntil
    contactName: string
    contactPhoneCountry: string
    contactPhone: string
    rewardType: RewardType
    rewardFirst: string
    rewardSecond: string
    rewardThird: string
    /**
     * Create only. A poster URL typed straight into the form, as opposed to a
     * File handed to the multipart endpoint. The edit form has no equivalent —
     * it uploads to `/tournaments/{uuid}/poster` and never sends `bannerUrl`.
     */
    posterUrl?: string
}

/** Today's date as yyyy-MM-dd, local — the create form's default start day. */
export function todayDate(): string {
    const d = new Date()
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Now as HH:mm, local — the create form's default start time. */
export function nowTime(): string {
    const d = new Date()
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/**
 * A blank form for "Novi turnir". The two 30 € defaults are the prices a
 * typical Croatian bela tournament actually charges — they are a starting
 * point the organiser overtypes, not a hidden rule.
 */
export function emptyTournamentForm(): TournamentForm {
    return {
        name: "",
        location: "",
        details: "",
        posterUrl: "",
        startDate: todayDate(),
        startTime: nowTime(),
        // Empty by default — max pairs is optional. Left blank it means
        // "no cap" ("Neodređeno").
        maxPairs: "",
        entryPrice: "30",
        repassagePrice: "30",
        repassageSecondPrice: "",
        repassageUntil: "FINALS",
        contactName: "",
        contactPhoneCountry: DEFAULT_DIAL_CODE,
        contactPhone: "",
        rewardType: "FIXED",
        rewardFirst: "",
        rewardSecond: "",
        rewardThird: "",
    }
}

/** Seed the form from a loaded tournament — the "Uredi" entry point. */
export function tournamentFormFromDto(t: TournamentDetails): TournamentForm {
    const phone = splitPhone(t.contactPhone)
    return {
        name: t.name ?? "",
        location: t.location ?? "",
        details: t.details ?? "",
        startDate: isoToDate(t.startAt),
        startTime: isoToTime(t.startAt),
        // Empty string when there's no cap — keeps the edit field blank so
        // "Neodređeno" round-trips instead of silently becoming a number.
        maxPairs: typeof t.maxPairs === "number" ? String(t.maxPairs) : "",
        entryPrice: numberToMoneyStr(t.entryPrice),
        repassagePrice: numberToMoneyStr(t.repassagePrice),
        repassageSecondPrice:
            typeof t.repassageSecondPrice === "number"
                ? numberToMoneyStr(t.repassageSecondPrice)
                : "",
        repassageUntil: (t.repassageUntil as RepassageUntil) ?? "FINALS",
        contactName: t.contactName ?? "",
        contactPhoneCountry: phone.country,
        contactPhone: phone.local,
        rewardType: (t.rewardType as RewardType) ?? "FIXED",
        rewardFirst: numberToMoneyStr(t.rewardFirst),
        rewardSecond: numberToMoneyStr(t.rewardSecond),
        rewardThird: numberToMoneyStr(t.rewardThird),
    }
}

/**
 * Form → wire payload.
 *
 * BOTH endpoints take the same record server-side (`POST /tournaments` and
 * `PUT /tournaments/{uuid}` are both `@Valid CreateTournamentRequest`), but
 * they do NOT read the same fields: the update mapper explicitly ignores
 * `status` (owned by /start, /finish, /reset) and the poster (owned by the
 * multipart upload and /poster). `mode` therefore decides whether the two
 * create-only keys are sent at all, rather than sending them everywhere and
 * relying on the server to ignore them — a shape the SPA states out loud is
 * one that survives the next backend change.
 */
export function tournamentFormToPayload(
    f: TournamentForm,
    mode: "create" | "update",
): CreateTournamentPayload {
    // Max pairs is optional. Empty field → null ("no cap"); a filled field is
    // clamped to the minimum of 2 (the backend's @Min, mirrored here so the
    // organiser gets a sane value instead of a 400).
    const maxPairsRaw = f.maxPairs.trim()
    let maxPairsSafe: number | null = null
    if (maxPairsRaw !== "") {
        const parsed = parseInt(maxPairsRaw, 10)
        maxPairsSafe = Number.isFinite(parsed) && parsed >= 2 ? parsed : 2
    }
    // The two required prices default to 0 rather than null: the backend
    // column is NOT NULL with a 0 default, and "free" is a real answer.
    const entry = moneyToNumber(f.entryPrice) ?? 0
    const rep = moneyToNumber(f.repassagePrice) ?? 0
    // Empty string = not set → send null to wipe the second repassage.
    const rep2 = !f.repassageSecondPrice || !f.repassageSecondPrice.trim()
        ? null
        : moneyToNumber(f.repassageSecondPrice)

    const common = {
        name: f.name.trim(),
        location: f.location.trim() || null,
        details: f.details.trim() || null,
        startAt: toLocalOffsetIso(f.startDate, f.startTime),
        maxPairs: maxPairsSafe,
        entryPrice: entry,
        repassagePrice: rep,
        repassageSecondPrice: rep2,
        repassageUntil: f.repassageUntil,
        contactName: f.contactName.trim() || null,
        contactPhone: joinPhone(f.contactPhoneCountry, f.contactPhone),
        rewardType: f.rewardType,
        rewardFirst: moneyToNumber(f.rewardFirst),
        rewardSecond: moneyToNumber(f.rewardSecond),
        rewardThird: moneyToNumber(f.rewardThird),
    }

    if (mode === "create") {
        // A new tournament is always a draft; the organiser starts it from the
        // Ždrijeb section once pairs have paid. `bannerUrl` is not on
        // CreateTournamentPayload (the poster normally rides the multipart
        // endpoint), which is why this object needs the cast — exactly as the
        // create page's inline payload did before it moved here.
        return { ...common, status: "DRAFT", bannerUrl: f.posterUrl?.trim() || null } as CreateTournamentPayload
    }
    return common as CreateTournamentPayload
}
