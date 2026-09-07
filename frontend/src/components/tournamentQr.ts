import { useCallback, useState } from "react"
import { t as tStatic } from "../i18n"
import { showError, showSuccess } from "../toaster"

/* ──────────────────────────────────────────────────────────────────────────
   tournamentQr — the one place that knows how to address, render and save a
   tournament's branded QR code.

   The QR itself is produced by the backend (`services/QrCodeRenderer`,
   error-correction level H with the app mark in the centre) and served from
   `GET /tournaments/{idOrSlug}/qr.png?size=`; it is ETag'd and hard-cached,
   so nothing here regenerates or post-processes anything.

   Two surfaces show it — `TournamentQrDialog` (the organiser's "display this
   on a screen" modal) and `TournamentQrCard` (the card that lives on the
   Detalji view) — and both need the identical "fetch the PNG, hand it to the
   browser as a download, toast the outcome" routine. That routine lives here
   once, as `useTournamentQrDownload`, rather than being copy-pasted into the
   second caller.

   Why a fetch + object URL instead of a plain `<a download href=…>`: the
   anchor's `download` attribute is only honoured for same-origin responses,
   and in production the API is reached through Caddy on the same origin but
   in dev through the Vite proxy — plus a failed request would silently
   navigate the tab to a broken image instead of telling the user anything.
   Going through `fetch` gives us both the filename and a real error path.

   Same base-URL fallback as api/http.ts (VITE_API_URL, defaulting to "/api")
   rather than importing it: this module is deliberately dependency-free of
   the axios instance, since the QR endpoint is public and unauthenticated.
   ────────────────────────────────────────────────────────────────────── */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api"

/**
 * The path segment the QR endpoints accept — the pretty slug when the row has
 * one, the UUID otherwise. Mirrors `TournamentsRepository.findByUuidOrSlug`.
 */
export function tournamentQrRef(uuid: string, slug?: string | null): string {
    return slug && slug.trim() ? slug : uuid
}

/** Absolute-ish URL of the rendered PNG for `ref`, at `size` px per edge. */
export function tournamentQrImageUrl(ref: string, size = 512): string {
    return `${API_BASE}/tournaments/${encodeURIComponent(ref)}/qr.png?size=${size}`
}

/** Public https://… URL a scan opens — mirrors the backend's own construction. */
export function publicTournamentUrl(uuid: string, slug?: string | null): string {
    return `${window.location.origin}/turniri/${tournamentQrRef(uuid, slug)}`
}

/**
 * Downloads the tournament's QR PNG as `qr-{ref}.png`, toasting success or
 * failure. Returns the pending flag so a caller can put its button into a
 * loading state.
 *
 * Copy comes from `tStatic` rather than `useTranslation()` on purpose: the
 * callback is memoised on `ref` alone, so a language switch mid-flight must
 * not have to re-create it. `tStatic` reads the module-level locale at call
 * time, which is exactly the behaviour we want here.
 */
export function useTournamentQrDownload(ref: string) {
    const [downloading, setDownloading] = useState(false)

    const download = useCallback(async () => {
        setDownloading(true)
        try {
            const res = await fetch(tournamentQrImageUrl(ref))
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const blob = await res.blob()
            const objectUrl = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = objectUrl
            a.download = `qr-${ref}.png`
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(objectUrl)
            showSuccess(tStatic("common.qr.downloadSuccess"))
        } catch {
            showError(
                tStatic("common.qr.downloadFailedTitle"),
                tStatic("common.qr.downloadFailedDescription"),
            )
        } finally {
            setDownloading(false)
        }
    }, [ref])

    return { downloading, download }
}
