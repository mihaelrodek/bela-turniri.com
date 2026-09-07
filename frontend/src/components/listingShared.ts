/* ──────────────────────────────────────────────────────────────────────────
   listingShared — the pure, React-light half of the tournament listing.

   `TournamentsPage`, `ListingCard` and `ListingRow` all need the same
   handful of things: one row type, the money/date/location normalisers, the
   sort catalogue and the detail prefetch. Keeping them here (a plain module
   under components/, same precedent as `navChrome.ts` and `calendarShared.ts`)
   means none of it is duplicated across the three files and none of it has to
   be re-declared per render.

   NOTHING here formats a date, a time or an amount for display — every
   user-visible date goes through `utils/format.ts` (locale-aware) and every
   month/weekday name through the dictionaries (`pages.calendar.month.*` /
   `.weekday.*`), so a language switch relabels the listing without touching
   this file.
   ────────────────────────────────────────────────────────────────────── */

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { TournamentCard } from "../types/tournaments"
import { fetchTournamentDetails } from "../api/tournaments"
import { qk } from "../queryClient"
import { formatAmount, formatTime } from "../utils/format"
import { usePlural, useTranslation } from "../i18n"
import { MONTH_KEYS, WEEKDAY_KEYS } from "./calendarShared"

/**
 * A tournament as the listing handles it. `uuid` is always present on the
 * list DTO; `distanceKm` is attached only while the radius filter is narrower
 * than "Sve" AND the row has geocoded coordinates, so every consumer must
 * treat it as optional and simply omit the distance chip when it is missing.
 */
export type ListingTournament = TournamentCard & { uuid: string; distanceKm?: number }

/** Which half of the listing a card/row belongs to. Drives the status pill,
 *  the muted treatment and whether the winner block replaces the capacity
 *  bar. */
export type ListingVariant = "upcoming" | "finished"

/**
 * Upper bound of the "U krugu od" slider. Reaching it is semantically "no
 * distance filter" — the predicate short-circuits to "show all", which is
 * also the default. Mirrors `MAP_RADIUS_MAX_KM` on MapPage so the same
 * control means the same thing on both screens.
 */
export const RADIUS_MAX_KM = 100

/** Where the slider lands the first time the user grants us a position: the
 *  same 50 km `DEFAULT_NEARBY_RADIUS_KM` the calendar calls "blizu", so
 *  granting location immediately does something visible instead of leaving
 *  the slider parked on "Sve". */
export { DEFAULT_NEARBY_RADIUS_KM as NEARBY_DEFAULT_KM } from "../utils/distance"

/** Formatted amount, but only for a price worth showing — 0 and null both
 *  collapse to `null` so the caller can drop the whole block. */
export function positiveAmount(n?: number | null): string | null {
    return typeof n === "number" && Number.isFinite(n) && n > 0 ? formatAmount(n) : null
}

/** Compact "Danas" / "Sutra" / "Za N dana" relative label. Pure date logic
 *  only — translation happens at the call site so this can stay outside the
 *  React tree (usePlural/useTranslation are hooks). */
export type RelativeDays =
    | { kind: "today" }
    | { kind: "tomorrow" }
    | { kind: "inDays"; days: number }
    | null

export function relativeDays(iso?: string | null): RelativeDays {
    if (!iso) return null
    const start = new Date(iso)
    if (Number.isNaN(start.getTime())) return null
    const startMs = start.setHours(0, 0, 0, 0)
    const todayMs = new Date().setHours(0, 0, 0, 0)
    const diff = Math.round((startMs - todayMs) / (24 * 60 * 60 * 1000))
    if (diff === 0) return { kind: "today" }
    if (diff === 1) return { kind: "tomorrow" }
    if (diff > 1 && diff <= 14) return { kind: "inDays", days: diff }
    return null
}

/* Normalised location string for card display.
 *
 * Geocoded addresses come back from Nominatim as the full reverse-geocode
 * tail — "Žarovnica, Grad Lepoglava, Varaždinska županija, 42250, Hrvatska".
 * Printing all five segments makes one card look "fuller" than a sibling that
 * only carries a city name and wrecks the visual rhythm across the grid.
 *
 * Rule: keep the first 1–2 comma segments (venue + city in most cases), drop
 * the county / postal code / country tail, then hard-cap the result so the
 * row can never wrap even at 320px. */
const COUNTRY_TAIL = new Set([
    "hrvatska",
    "croatia",
    "bosna i hercegovina",
    "bih",
    "slovenija",
    "slovenia",
    "srbija",
    "serbia",
    "crna gora",
    "montenegro",
])

export function shortLocation(loc?: string | null): string {
    if (!loc) return ""
    const parts = loc
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        // Postal codes (pure digits) and the country tail are noise on a card.
        .filter((p) => !/^\d[\d\s]*$/.test(p))
        .filter((p) => !COUNTRY_TAIL.has(p.toLowerCase()))
    if (parts.length === 0) return loc.trim()
    const head = parts.slice(0, 2).join(", ")
    return head.length > 38 ? head.slice(0, 36).trimEnd() + "…" : head
}

/** Up to two initials for the poster-less placeholder — "Velika Bela Liga"
 *  becomes "VB", a single-word name its first two letters. */
export function initialsOf(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) return "?"
    if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase()
    return (words[0][0] + words[1][0]).toLocaleUpperCase()
}

/** True when every seat is taken — both numbers have to be known for the
 *  question to even mean anything. */
function isFull(item: ListingTournament): boolean {
    return (
        typeof item.registeredPairs === "number" &&
        typeof item.maxPairs === "number" &&
        item.maxPairs > 0 &&
        item.registeredPairs >= item.maxPairs
    )
}

/**
 * How full the capacity bar is drawn, 0–1. With a real cap it is the actual
 * ratio; with no cap (shown as "x / ∞") an unlimited tournament can never be
 * "full", so progress is SIMULATED with an asymptotic n/(n+5) curve — it
 * grows with every signup and never reaches the end of the track.
 */
export function fillRatio(item: ListingTournament): number {
    const reg = typeof item.registeredPairs === "number" ? item.registeredPairs : 0
    if (typeof item.maxPairs === "number" && item.maxPairs > 0) {
        return Math.min(1, reg / item.maxPairs)
    }
    return reg > 0 ? reg / (reg + 5) : 0
}

/* ── Sorting ───────────────────────────────────────────────────────────────
   Driven by the toolbar's "Sortiraj" menu. Comparators normalise missing
   values so unknowns never interleave with sorted rows: a tournament with no
   date sorts to the END of any date ordering, one with no kotizacija to the
   END of cheapest-first, and so on.
   ────────────────────────────────────────────────────────────────────── */

export type SortMode =
    | "date_asc"
    | "date_desc"
    | "price_asc"
    | "popular"
    | "name_asc"
    | "distance_asc"

/** Menu order. Each key has a `pages.tournaments.sort.<key>` label leaf. */
export const SORT_MODES: readonly SortMode[] = [
    "date_asc",
    "date_desc",
    "price_asc",
    "popular",
    "name_asc",
    "distance_asc",
]

/** True when the mode needs a user position to mean anything — the menu
 *  disables it until the "U krugu od" row has one. */
export function sortNeedsLocation(mode: SortMode): boolean {
    return mode === "distance_asc"
}

export function sortTournaments(
    list: readonly ListingTournament[],
    mode: SortMode,
    localeTag: string,
): ListingTournament[] {
    // Always operate on a copy — `list` comes straight out of a .filter() and
    // mutating it would also mutate the upstream memo on re-render.
    const arr = [...list]
    const dateOf = (t: ListingTournament): number =>
        t.startAt ? new Date(t.startAt).getTime() || Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY

    switch (mode) {
        case "date_desc":
            return arr.sort((a, b) => dateOf(b) - dateOf(a))
        case "price_asc":
            return arr.sort((a, b) => {
                const ap = typeof a.entryPrice === "number" ? a.entryPrice : Number.POSITIVE_INFINITY
                const bp = typeof b.entryPrice === "number" ? b.entryPrice : Number.POSITIVE_INFINITY
                if (ap !== bp) return ap - bp
                return dateOf(a) - dateOf(b)
            })
        case "popular":
            return arr.sort((a, b) => {
                const diff = fillRatio(b) - fillRatio(a)
                if (diff !== 0) return diff
                return dateOf(a) - dateOf(b)
            })
        case "name_asc":
            return arr.sort((a, b) => a.name.localeCompare(b.name, localeTag, { sensitivity: "base" }))
        case "distance_asc":
            return arr.sort((a, b) => {
                // Rows we could not measure (no coordinates, or no position at
                // all) go last rather than pretending to be at distance 0.
                const ad = typeof a.distanceKm === "number" ? a.distanceKm : Number.POSITIVE_INFINITY
                const bd = typeof b.distanceKm === "number" ? b.distanceKm : Number.POSITIVE_INFINITY
                if (ad !== bd) return ad - bd
                return dateOf(a) - dateOf(b)
            })
        case "date_asc":
        default:
            return arr.sort((a, b) => dateOf(a) - dateOf(b))
    }
}

/* ── Date stamp + status pill, the two overlays the card and the row share ──
   Both need translated copy, so both are hooks rather than plain helpers.
   ────────────────────────────────────────────────────────────────────── */

/** The four pieces the date tile stacks: "PON" / "03" / "KOL" / "19:00". */
export type DateParts = { weekday: string; day: string; month: string; time: string }

/**
 * Split an instant into the tile's four labels, all locale-aware.
 *
 * The weekday keys (`pages.calendar.weekday.*`) are already the short,
 * upper-case forms the tile wants. The month keys are the full nominative
 * names the calendar's own headings need ("Kolovoz"), so the tile takes the
 * first three characters — which is exactly the conventional abbreviation in
 * both shipped languages (Kolovoz → KOL, avgust → AVG) and, unlike
 * `toLocaleDateString`, keeps the tile speaking whatever language the rest of
 * the screen is in. A language whose abbreviations are not a 3-character
 * prefix would need its own short-month leaves here.
 */
export function useDateParts(): (iso?: string | null) => DateParts | null {
    const { t } = useTranslation()
    return (iso?: string | null) => {
        if (!iso) return null
        const d = new Date(iso)
        if (Number.isNaN(d.getTime())) return null
        // getDay(): 0=Sun..6=Sat → Mon-first index into WEEKDAY_KEYS.
        const weekday = t(`pages.calendar.weekday.${WEEKDAY_KEYS[(d.getDay() + 6) % 7]}`)
        const month = t(`pages.calendar.month.${MONTH_KEYS[d.getMonth()]}`)
        return {
            weekday,
            day: String(d.getDate()).padStart(2, "0"),
            month: month.slice(0, 3).toLocaleUpperCase(),
            time: formatTime(iso, ""),
        }
    }
}

/** What the status pill says, and which accent it wears. */
export type StatusKind = "finished" | "full" | "soon" | "upcoming"
export type ListingStatus = { kind: StatusKind; label: string }

/**
 * Status pill copy for one row. Finished always wins; a full roster is the
 * next most useful thing to know; otherwise the pill carries the "Danas /
 * Sutra / Za N dana" countdown, falling back to a plain "Nadolazeći".
 */
export function useListingStatus(): (item: ListingTournament, variant: ListingVariant) => ListingStatus {
    const { t } = useTranslation()
    const plural = usePlural()
    return (item: ListingTournament, variant: ListingVariant) => {
        if (variant === "finished") {
            return { kind: "finished", label: t("pages.tournaments.badge.finished") }
        }
        if (isFull(item)) {
            return { kind: "full", label: t("pages.tournaments.badge.full") }
        }
        const rel = relativeDays(item.startAt)
        if (rel?.kind === "today") {
            return { kind: "soon", label: t("pages.tournaments.relativeDays.today") }
        }
        if (rel?.kind === "tomorrow") {
            return { kind: "soon", label: t("pages.tournaments.relativeDays.tomorrow") }
        }
        if (rel?.kind === "inDays") {
            return {
                kind: rel.days <= 7 ? "soon" : "upcoming",
                label: plural("pages.tournaments.relativeDays.inDays", rel.days),
            }
        }
        return { kind: "upcoming", label: t("pages.tournaments.badge.upcoming") }
    }
}

/**
 * Prefetch a tournament's detail data into the react-query cache so opening
 * it (click / tap) renders instantly instead of showing a spinner + refetch.
 * The key is slug-or-uuid so it matches EXACTLY what the URL — and therefore
 * TournamentDetailsPage — will read.
 */
export function useTournamentPrefetch(): (idOrSlug?: string | null) => void {
    const queryClient = useQueryClient()
    return useCallback(
        (idOrSlug?: string | null) => {
            if (!idOrSlug) return
            queryClient.prefetchQuery({
                queryKey: qk.tournamentDetails(idOrSlug),
                queryFn: () => fetchTournamentDetails(idOrSlug),
                staleTime: 30_000,
            })
        },
        [queryClient],
    )
}
