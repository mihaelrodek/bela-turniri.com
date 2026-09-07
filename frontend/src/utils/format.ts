/* ──────────────────────────────────────────────────────────────────────────
   Shared date / time / money formatters.

   Before this file the same `Intl.DateTimeFormat("hr-HR", …)` block was
   pasted into six pages (`formatDate` ×6, `formatTime` ×4) and the money
   helpers into five, which is how TournamentsPage ended up rendering a date
   without a year while the details page next to it rendered one with.

   There are exactly THREE date shapes in the app and they are all here:

     formatDate         "pon, 22. tra 2026."   list rows, detail tiles
     formatDateShort    "pon, 22. tra"         space-tight cards + map popups
     formatDateCompact  "22. tra 2026."        admin rows, pair-request rows

   The empty/failed fallback is an em dash by default because that is what
   every current call site renders; pass `fallback` to opt out (the map and
   calendar want "" so an absent time collapses instead of showing a dash).

   The Intl locale follows the active UI language rather than being pinned:
   the app ships Croatian and Slovenian, and a Slovenian speaker reading
   Croatian month names next to translated copy looks like a bug. `getLocale`
   is read at call time, not at module load, so a language switch takes
   effect on the next render — which every consumer does anyway, since they
   also call `t()`. Currency stays EUR: both countries use it.
   ────────────────────────────────────────────────────────────────────── */

import { getLocale } from "../i18n"

/** UI locale ("hr") to the BCP-47 tag Intl wants ("hr-HR"). */
const INTL_TAGS: Record<string, string> = { hr: "hr-HR", sl: "sl-SI" }

function intlTag(): string {
    return INTL_TAGS[getLocale()] ?? "hr-HR"
}

/** Two-digit zero pad — the building block of every manual date string here. */
export const pad2 = (n: number): string => String(n).padStart(2, "0")

/** Format helper that never throws: a malformed ISO string yields `fallback`
 *  rather than "Invalid Date" (or, on some engines, a RangeError). */
function fmt(
    iso: string | null | undefined,
    opts: Intl.DateTimeFormatOptions,
    fallback: string,
): string {
    if (!iso) return fallback
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return fallback
    try {
        return new Intl.DateTimeFormat(intlTag(), opts).format(d)
    } catch {
        return fallback
    }
}

/** Full date with weekday and year — "pon, 22. tra 2026." */
export function formatDate(iso?: string | null, fallback = "—"): string {
    return fmt(iso, { weekday: "short", day: "2-digit", month: "short", year: "numeric" }, fallback)
}

/** Weekday + day + month, no year — for cards where the year is implied. */
export function formatDateShort(iso?: string | null, fallback = "—"): string {
    return fmt(iso, { weekday: "short", day: "2-digit", month: "short" }, fallback)
}

/** Day + month + year, no weekday — dense admin/list rows. */
export function formatDateCompact(iso?: string | null, fallback = "—"): string {
    return fmt(iso, { day: "2-digit", month: "short", year: "numeric" }, fallback)
}

/** Wall-clock time — "19:00". */
export function formatTime(iso?: string | null, fallback = "—"): string {
    return fmt(iso, { hour: "2-digit", minute: "2-digit" }, fallback)
}

/** Compact date + time on one line — "22. tra 2026. • 19:00". */
export function formatDateTime(iso?: string | null, fallback = ""): string {
    if (!iso) return fallback
    const date = formatDateCompact(iso, fallback)
    const time = formatTime(iso, fallback)
    if (date === fallback || time === fallback) return fallback
    return `${date} • ${time}`
}

/* ---------- money ---------- */

/**
 * Localised currency — "12,50 €". Accepts the string form the edit forms hold
 * their inputs in (comma or dot decimal separator) as well as a number.
 */
export function formatEur(value: number | string | null | undefined): string {
    if (value == null || value === "") return "—"
    const n = typeof value === "string" ? Number(value.replace(",", ".")) : value
    if (!Number.isFinite(n)) return "—"
    return new Intl.NumberFormat(intlTag(), { style: "currency", currency: "EUR" }).format(n)
}

/**
 * Terse amount with a trailing euro sign — "30€", "12.50€". Returns `null`
 * when there is nothing to show so a caller can drop the whole row; use
 * `formatAmount(n) ?? "—"` where a placeholder is wanted instead.
 */
export function formatAmount(n?: number | null): string | null {
    if (typeof n !== "number" || !Number.isFinite(n)) return null
    const s = n.toFixed(2)
    return `${s.endsWith(".00") ? s.slice(0, -3) : s}€`
}

/** Number → the bare string an edit input holds: "30", "12.50", "" when unset. */
export function numberToMoneyStr(n?: number | null): string {
    if (typeof n !== "number" || !Number.isFinite(n)) return ""
    const s = n.toFixed(2)
    return s.endsWith(".00") ? s.slice(0, -3) : s
}

/** Edit-input string → number, or `null` when it doesn't parse. */
export function moneyToNumber(s?: string | null): number | null {
    if (!s) return null
    const n = parseFloat(s.replace(",", "."))
    return Number.isFinite(n) ? n : null
}

/**
 * Same as {@link moneyToNumber} but tolerant of the decorated values the
 * live "€/par → €/igrač" hint reads back out of a field ("30 €"), and it
 * yields NaN rather than null so the hint can bail with `Number.isFinite`.
 */
export function parseMoneyLoose(v: string): number {
    const n = parseFloat((v ?? "").replace(/[ €]/g, "").replace(",", "."))
    return Number.isFinite(n) ? n : NaN
}

/**
 * Keep only digits and at most one decimal point while the user types.
 * Minus signs are stripped outright — no price in this app is negative.
 */
export function sanitizeMoney(raw: string): string {
    let s = raw.replace(/-/g, "").replace(/[^\d.,]/g, "").replace(",", ".")
    if (s.startsWith(".")) s = "0" + s
    const parts = s.split(".")
    if (parts.length > 2) s = parts[0] + "." + parts.slice(1).join("")
    return s
}

/** Digits only — pair counts, round numbers. */
export function sanitizeInt(raw: string): string {
    return raw.replace(/[^\d]/g, "")
}

/* ---------- form date/time <-> ISO ---------- */

/** ISO instant → the `yyyy-MM-dd` an `<input type="date">` expects. */
export function isoToDate(iso?: string | null): string {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** ISO instant → the `HH:mm` an `<input type="time">` expects. */
export function isoToTime(iso?: string | null): string {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/**
 * Local date + time strings → an OffsetDateTime the backend parses,
 * e.g. "2025-11-02T19:00:00+01:00".
 *
 * Deliberately NOT `toISOString()`: that would send UTC, and a tournament
 * starting at 19:00 in Zagreb must stay 19:00 for everyone reading the page
 * — the offset carries the organiser's wall-clock intent.
 */
export function toLocalOffsetIso(dateStr: string, timeStr: string): string | null {
    if (!dateStr || !timeStr) return null
    const [y, m, d] = dateStr.split("-").map(Number)
    const [hh, mm] = timeStr.split(":").map(Number)
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0)
    const tz = -dt.getTimezoneOffset()
    const sign = tz >= 0 ? "+" : "-"
    const hhOff = pad2(Math.floor(Math.abs(tz) / 60))
    const mmOff = pad2(Math.abs(tz) % 60)
    return (
        `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}` +
        `T${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:00${sign}${hhOff}:${mmOff}`
    )
}
