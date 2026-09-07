/* ──────────────────────────────────────────────────────────────────────────
   calendarShared — the pure, React-free half of the calendar screen.

   `CalendarPage`, `CalendarMonthGrid` and `CalendarEventRow` all need the
   same handful of things: one tournament row type, the Mon-first month grid,
   a day bucket map and the "which month should I jump to" search. Keeping
   them here (a plain `.ts` module under components/, same precedent as
   `navChrome.ts` and `tourSteps.ts`) means none of it re-runs per render and
   none of it has to be duplicated in three files.

   NOTHING here formats a date for display — every user-visible date string
   goes through `utils/format.ts` (locale-aware) and every month/weekday name
   through the dictionaries (`pages.calendar.month.*` / `.weekday.*`), so a
   language switch relabels the screen without touching this file.
   ────────────────────────────────────────────────────────────────────── */

import type { TournamentCard } from "../types/tournaments"

/**
 * A tournament as the calendar handles it. `uuid` is always present on the
 * list DTO; `distanceKm` is attached only while the "Blizu mene" toggle is on
 * AND the row has geocoded coordinates, so every consumer must treat it as
 * optional and simply omit the distance chip when it is missing.
 */
export type CalendarTournament = TournamentCard & { uuid: string; distanceKm?: number }

/** Month label keys in calendar order — resolved via `pages.calendar.month.*`. */
export const MONTH_KEYS = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
] as const

/** Weekday label keys, Monday first (hr-HR / sl-SI convention). */
export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const

/** Column indexes of Saturday and Sunday in the Mon-first grid. Amateur bela
 *  tournaments are overwhelmingly weekend events, so those two columns get a
 *  quiet visual accent instead of being just two more days. */
export const WEEKEND_COLUMNS = new Set([5, 6])

/** Distance, in km, under which a tournament is called "blizu" (near). Same
 *  step the tournaments list defaults its radius filter to, so "near" means
 *  the same thing on both screens. */
export { DEFAULT_NEARBY_RADIUS_KM as NEAR_THRESHOLD_KM } from "../utils/distance"

function pad2(n: number): string {
    return String(n).padStart(2, "0")
}

/** Local `yyyy-mm-dd` bucket id. Deliberately built from the local getters,
 *  not `toISOString()`, which would bucket a 00:30 tournament into the
 *  previous day for every timezone east of UTC. */
export function dateKey(d: Date): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Midnight-of-this-day, in ms — the one comparison "is this day past?" needs. */
export function startOfDayMs(d: Date): number {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate()
}

/**
 * A local calendar day as an ISO instant that `utils/format.ts` can render.
 *
 * Pinned to 12:00 rather than midnight on purpose: `new Date(y, m, d)` in a
 * zone that starts DST at 00:00 can land on 23:00 of the previous day, and
 * the formatted heading would then be off by one for a handful of dates a
 * year. Noon is never within an hour of a DST transition anywhere.
 */
export function dayIso(d: Date): string {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0).toISOString()
}

/** Year+month collapsed to a single sortable integer. */
export function monthOrdinal(year: number, month: number): number {
    return year * 12 + month
}

/** Inverse of {@link monthOrdinal}. */
function fromMonthOrdinal(ordinal: number): { year: number; month: number } {
    return { year: Math.floor(ordinal / 12), month: ordinal % 12 }
}

/**
 * Build a Mon-first grid of dates that fully covers the given month.
 * Includes leading days from the prior month so the first row aligns with
 * Monday, and trailing days from the next month only as needed to finish
 * the week containing the last day of the month — never an extra full row.
 */
export function buildMonthGrid(year: number, month: number): Date[][] {
    const first = new Date(year, month, 1)
    // JS getDay(): 0=Sun..6=Sat. We want Monday=0..Sunday=6
    const monIndex = (first.getDay() + 6) % 7
    const gridStart = new Date(year, month, 1 - monIndex)

    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const numRows = Math.ceil((monIndex + daysInMonth) / 7)

    const rows: Date[][] = []
    for (let r = 0; r < numRows; r++) {
        const row: Date[] = []
        for (let c = 0; c < 7; c++) {
            const d = new Date(gridStart)
            d.setDate(gridStart.getDate() + r * 7 + c)
            row.push(d)
        }
        rows.push(row)
    }
    return rows
}

/** Bucket tournaments by their local start day, each bucket sorted by time. */
export function groupByDay(items: readonly CalendarTournament[]): Map<string, CalendarTournament[]> {
    const map = new Map<string, CalendarTournament[]>()
    for (const item of items) {
        if (!item.startAt) continue
        const when = new Date(item.startAt)
        if (Number.isNaN(when.getTime())) continue
        const key = dateKey(when)
        const bucket = map.get(key)
        if (bucket) bucket.push(item)
        else map.set(key, [item])
    }
    for (const bucket of map.values()) {
        bucket.sort((a, b) => startMs(a) - startMs(b))
    }
    return map
}

/** Start instant in ms, or 0 for a row with a missing or broken `startAt`. */
export function startMs(item: CalendarTournament): number {
    if (!item.startAt) return 0
    const ms = new Date(item.startAt).getTime()
    return Number.isNaN(ms) ? 0 : ms
}

/** Every month (as an ordinal) that holds at least one tournament, ascending. */
export function monthsWithEvents(items: readonly CalendarTournament[]): number[] {
    const seen = new Set<number>()
    for (const item of items) {
        if (!item.startAt) continue
        const when = new Date(item.startAt)
        if (Number.isNaN(when.getTime())) continue
        seen.add(monthOrdinal(when.getFullYear(), when.getMonth()))
    }
    return [...seen].sort((a, b) => a - b)
}

/**
 * The month a user staring at an empty month should be offered.
 *
 * Forward first — "when is the next one" is the question this whole screen
 * answers — and only when there is nothing ahead does it fall back to the
 * most recent month behind, so a user who has paged past the end of the
 * season still gets a way back instead of a dead end. `null` means the app
 * genuinely has no tournaments in any month.
 */
export function nearestMonthWithEvents(
    ordinals: readonly number[],
    cursor: number,
): { year: number; month: number } | null {
    let ahead: number | null = null
    let behind: number | null = null
    for (const o of ordinals) {
        if (o > cursor) {
            if (ahead === null || o < ahead) ahead = o
        } else if (o < cursor) {
            if (behind === null || o > behind) behind = o
        }
    }
    const pick = ahead ?? behind
    return pick === null ? null : fromMonthOrdinal(pick)
}
