/* ──────────────────────────────────────────────────────────────────────────
   Tiny RFC-5545 .ics builder for „Dodaj u kalendar“.

   Output is a one-event VCALENDAR string that iOS Safari, Android Chrome,
   Outlook and Google Calendar all import on click — no calendar-specific
   APIs, no platform forks.

   The schema is deliberately small (no RRULE, no ORGANIZER, no ATTENDEE): a
   tournament start needs no recurrence, and the SPA has no read access to
   participants' e-mail addresses anyway.
   ────────────────────────────────────────────────────────────────────── */

export type IcsEvent = {
    /** Stable UID, `{uuid}@bela-turniri.com`. Calendar clients dedupe on it,
     *  so this MUST match the UID the subscription feed emits
     *  (GET /api/calendar/tournaments.ics) — otherwise a user who both
     *  subscribes to the feed and downloads a single tournament ends up with
     *  the same event twice. */
    uid: string
    /** Required. Free-text title — the tournament name. */
    summary: string
    /** Optional venue / address text. */
    location?: string | null
    /** Optional long-form description. The deep link is appended
     *  automatically when {@link IcsEvent.url} is set. */
    description?: string | null
    /** Deep link back to the tournament page. Emitted both as the standalone
     *  URL property (Outlook/Google honour it) and at the end of the
     *  description (iOS only renders the description). */
    url?: string | null
    /** Start of the tournament. */
    start: Date
    /** End. Defaults to `start + 3h`, roughly one tournament evening. */
    end?: Date
}

/** RFC-5545 DATE-TIME in UTC: 20260105T140000Z. Clients localise on import. */
function fmtUtc(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0")
    return (
        d.getUTCFullYear() +
        pad(d.getUTCMonth() + 1) +
        pad(d.getUTCDate()) +
        "T" +
        pad(d.getUTCHours()) +
        pad(d.getUTCMinutes()) +
        pad(d.getUTCSeconds()) +
        "Z"
    )
}

/** Escape per RFC-5545 §3.3.11. Without it a Croatian venue containing a
 *  comma makes clients refuse to parse the whole event. */
function esc(s: string): string {
    return s
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;")
}

/** Fold long property lines (§3.1 caps them at 75 octets). 70 chars keeps us
 *  safely under the limit even with multi-byte Croatian diacritics. */
function fold(line: string): string {
    if (line.length <= 70) return line
    const parts: string[] = []
    for (let i = 0; i < line.length; i += 70) {
        parts.push((i === 0 ? "" : " ") + line.slice(i, i + 70))
    }
    return parts.join("\r\n")
}

export function buildIcs(evt: IcsEvent): string {
    const end = evt.end ?? new Date(evt.start.getTime() + 3 * 60 * 60 * 1000)
    const desc = [evt.description, evt.url].filter(Boolean).map(String).join("\\n\\n")
    const lines: Array<string | null> = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//bela-turniri.com//Turnir//HR",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        fold("UID:" + evt.uid),
        // "When this iCal record was created" — required for METHOD:PUBLISH.
        "DTSTAMP:" + fmtUtc(new Date()),
        "DTSTART:" + fmtUtc(evt.start),
        "DTEND:" + fmtUtc(end),
        fold("SUMMARY:" + esc(evt.summary)),
        evt.location ? fold("LOCATION:" + esc(evt.location)) : null,
        desc ? fold("DESCRIPTION:" + desc) : null,
        evt.url ? fold("URL:" + evt.url) : null,
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    // RFC-5545 line break is CRLF. Some Android parsers accept bare LF; iOS
    // Calendar — the strictest of the three — rejects the whole file.
    return lines.filter((l): l is string => l !== null).join("\r\n")
}

/** Trigger a download of the given .ics text. Mobile browsers hand the file
 *  to the OS, which prompts to add the event. */
export function downloadIcs(filename: string, ics: string): void {
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename.toLowerCase().endsWith(".ics") ? filename : `${filename}.ics`
    document.body.appendChild(a)
    a.click()
    // Defer cleanup until the browser has actually dispatched the download.
    setTimeout(() => {
        URL.revokeObjectURL(url)
        a.remove()
    }, 100)
}

/** Filename-safe ASCII slug for the downloaded file. */
export function icsFileName(name: string): string {
    const base = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[đĐ]/g, "d")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase()
    return `${base || "turnir"}.ics`
}
