import { buildIcs, downloadIcs, icsFileName } from "../../utils/ics"
import type { TournamentDetails } from "../../types/tournaments"

/**
 * True when the tournament carries a start time we can put in a DTSTART.
 * Both the toolbar button and the mobile overflow menu gate on it.
 */
export function hasCalendarDate(t: TournamentDetails): boolean {
    if (!t.startAt) return false
    return !Number.isNaN(new Date(t.startAt).getTime())
}

/**
 * Builds and downloads the one-event .ics. Shared by the button below and the
 * mobile overflow menu, which has no button to hang the logic off.
 *
 * A downloaded file rather than a Google/Apple deep link on purpose: the .ics
 * is the one format every calendar on every platform imports, and it needs no
 * account, no popup blocker exemption and no per-vendor URL builder.
 */
export async function downloadTournamentIcs(t: TournamentDetails): Promise<void> {
    if (!hasCalendarDate(t)) return
    const url = typeof window !== "undefined" ? window.location.href : undefined
    // Never rejects. Both callers fire it straight from an onClick/onSelect
    // without awaiting, and since the native branch (write to the cache dir,
    // then open the share sheet) became async a failed write would otherwise
    // surface as an unhandled rejection. A cancelled share sheet is already
    // swallowed inside `downloadIcs`; this catches the rarer real failures.
    try {
        await downloadIcs(
        icsFileName(t.name),
        buildIcs({
            // Must match the UID the subscription feed emits
            // (GET /api/calendar/tournaments.ics → `<uuid>@bela-turniri.com`).
            // Calendar clients dedupe on UID, so a different shape here would
            // give anyone who both subscribes AND downloads a single
            // tournament the same event twice.
            uid: `${t.uuid}@bela-turniri.com`,
            summary: t.name,
            location: t.location,
            description: t.details,
            url,
            start: new Date(t.startAt as string),
        }),
        )
    } catch (err) {
        console.warn("Preuzimanje kalendarskog događaja nije uspjelo", err)
    }
}
