import { http } from "./http"

/**
 * Content reports ("Prijavi sadržaj") — the App Store requirement that any
 * user-generated content can be flagged, and that an operator can act on the
 * flag. Three things can be reported: a tournament, a pair inside one, and a
 * player's public profile.
 *
 * Every call here is `silent`: the reporting UI (`components/ReportDialog`)
 * and the admin queue want to word their own outcome — "Hvala, prijava je
 * zaprimljena." reads nothing like the interceptor's generic "Spremljeno".
 */

export type ReportTargetType = "TOURNAMENT" | "PAIR" | "PROFILE"

export type ReportReason = "SPAM" | "OFFENSIVE" | "PERSONAL_DATA" | "OTHER"

/** Longest `message` the backend accepts — the dialog's counter mirrors it. */
export const REPORT_MESSAGE_MAX = 1000

export type CreateReportRequest = {
    targetType: ReportTargetType
    /** UUID for a tournament, numeric pair id as a string, slug for a profile. */
    targetId: string
    reason: ReportReason
    /** Free text, optional, capped at {@link REPORT_MESSAGE_MAX}. */
    message?: string
}

export type CreateReportResponse = { id: number }

/**
 * File one report.
 *
 * Error codes the dialog keys on (all silenced here so it can translate
 * them itself — the bare wire codes are never shown):
 *   - 400 CANNOT_REPORT_SELF — you filed against your own content;
 *   - 429 RATE_LIMITED       — too many reports in a short window;
 *   - 404                    — target vanished between render and submit.
 */
export async function createReport(
    payload: CreateReportRequest,
): Promise<CreateReportResponse> {
    const { data } = await http.post<CreateReportResponse>(
        "/reports",
        payload,
        { silent: true },
    )
    return data
}

/* ── Admin queue ────────────────────────────────────────────────────────── */

export type ReportStatus = "open" | "resolved"

export type ReportResolution = "DISMISSED" | "ACTIONED"

/** One row of the admin "Prijave" queue. */
export type AdminReportDto = {
    id: number
    targetType: ReportTargetType
    targetId: string
    /**
     * Human-readable name of the target resolved server-side (tournament
     * name, pair name, player name). For a PROFILE target the backend sends
     * the slug, which is also what `/profil/{slug}` needs — so the row links
     * straight through; a TOURNAMENT's `targetId` is its UUID, which
     * `/turniri/{uuid}` accepts. A PAIR has no page of its own, so its label
     * stays plain text.
     */
    targetLabel: string | null
    reporterUid: string | null
    reason: ReportReason
    message: string | null
    createdAt: string | null
    resolvedAt: string | null
    resolution: ReportResolution | null
    adminNote: string | null
}

export async function adminListReports(status: ReportStatus): Promise<AdminReportDto[]> {
    const { data } = await http.get<AdminReportDto[]>("/admin/reports", {
        params: { status },
    })
    return data
}

/**
 * Close one report. `resolution` records what the admin decided —
 * DISMISSED ("Odbaci", nothing was wrong) or ACTIONED ("Riješeno", the
 * content was dealt with) — and `note` is an optional internal memo.
 * Silent: the section replaces the row in place and toasts its own line.
 */
export async function adminResolveReport(
    id: number,
    resolution: ReportResolution,
    note?: string,
): Promise<AdminReportDto> {
    const { data } = await http.post<AdminReportDto>(
        `/admin/reports/${id}/resolve`,
        { resolution, note: note?.trim() || undefined },
        { silent: true },
    )
    return data
}

/**
 * How many reports are still waiting. Its own endpoint rather than the
 * length of the list above, because the badge is rendered before (and
 * without) the queue itself. Silent — a failed badge must not toast.
 */
export async function adminCountReports(status: ReportStatus = "open"): Promise<number> {
    const { data } = await http.get<{ total: number }>("/admin/reports/count", {
        params: { status },
        silent: true,
    })
    return data.total
}
