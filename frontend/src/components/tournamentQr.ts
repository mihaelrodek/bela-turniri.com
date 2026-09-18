import { useCallback, useState } from "react"
import { t as tStatic } from "../i18n"
import { showError, showSuccess } from "../toaster"
import { isNative } from "../platform"
import { nativeFilesystem, nativeShare } from "../platform/nativeIo"

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

/** Base64 payload of a Blob, without the `data:…;base64,` prefix —
 *  `Filesystem.writeFile` wants raw base64 when no `encoding` is given (the
 *  PNG is binary, so there is no text encoding to name). */
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"))
        reader.onloadend = () => {
            const result = reader.result as string
            resolve(result.slice(result.indexOf(",") + 1))
        }
        reader.readAsDataURL(blob)
    })
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
            if (isNative) {
                // Same reasoning as `downloadIcs`: a WebView has no download
                // manager to hand an object URL's anchor click to. Write the
                // PNG into the app cache as base64 and hand its file:// URI
                // to the OS share sheet — "Save Image" is one of iOS's share
                // targets, Android offers Photos/Files.
                const base64 = await blobToBase64(blob)
                const fileName = `qr-${ref}.png`.replace(/[^a-zA-Z0-9.-]/g, "")
                const { Filesystem, Directory } = await nativeFilesystem()
                const written = await Filesystem.writeFile({
                    directory: Directory.Cache,
                    path: fileName,
                    data: base64,
                })
                const Share = await nativeShare()
                try {
                    await Share.share({ title: fileName, url: written.uri })
                    showSuccess(tStatic("common.qr.downloadSuccess"))
                } catch {
                    // Cancelling the share sheet is a no-op, not a failure —
                    // matches the web path's silent "click away" outcome.
                }
                return
            }
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
