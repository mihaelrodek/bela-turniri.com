import html2canvas from "html2canvas-pro"
import { jsPDF } from "jspdf"
import { t as tStatic } from "../../i18n"
import { showSuccess } from "../../toaster"
import { isNative } from "../../platform"
import { nativeFilesystem, nativeShare } from "../../platform/nativeIo"
import { blobToBase64 } from "../tournamentQr"
import printCss from "../../pages/rulesPrint.css?raw"

/* ──────────────────────────────────────────────────────────────────────────
   rulesPdf — the rulebook as a downloaded PDF (2026-10-03, owner: "can it
   start a DOWNLOAD instead of opening the print dialog" — mobile print engines
   ignore most of rulesPrint.css and showed a broken 3-page preview).

   THIS MODULE IS LAZY: RulesDocument reaches it only through a dynamic
   `import()` in the button's click handler, so html2canvas-pro and jsPDF
   (~600 kB) never enter the page chunk, the entry, or the precache manifest
   (the manifest follows static imports from its roots only).

   How: the live `.rules-print` node is cloned twice into an off-screen stage,
   each clone cut down to one A4 page (794x1123 CSS px = 210x297 mm at 96 dpi):
     page 1  letterhead + title block + settings strip + sheet 1 + foot line
     page 2  letterhead + sheet 2 + foot line
   The look is NOT re-implemented: `rulesPrint.css` is injected as text with
   `@media print` -> `@media all` and the `body.print-rules` prefix -> the
   page's own `.pdf-capture` class, so the PDF is the print sheet by
   construction. The only overrides (below) turn `position: fixed` (letterhead,
   foot line, background art) into `absolute` inside the page box, since fixed
   would pin to the viewport. Each page is rasterised with html2canvas
   (scale 2, JPEG 0.92) and placed on an A4 page of a jsPDF document.

   Saving, in order: native app -> file in cache + OS share sheet; iOS Safari
   -> Web Share with the file ("Save to Files"), because an anchor download
   after a long await can be dropped there; everything else (and any share
   failure that is not the user cancelling) -> Blob URL anchor with `download`.
   ────────────────────────────────────────────────────────────────────── */

const PAGE_W = 794
const PAGE_H = 1123
/** Cap so a page canvas stays under ~3000 px wide (iOS canvas memory limits). */
const MAX_CANVAS_W = 3000

/** Print rules re-aimed at a `.pdf-capture` box instead of `body.print-rules`. */
const CAPTURE_CSS = `${printCss
    .replace(/@media print/g, "@media all")
    .replace(/body\.print-rules/g, ".pdf-capture")}

.pdf-capture {
    position: relative;
    width: ${PAGE_W}px;
    height: ${PAGE_H}px;
    overflow: hidden;
    box-sizing: border-box;
    background: #fff;
    color-scheme: light;
}
.pdf-capture::before { position: absolute !important; }
.pdf-capture .rules-print .rules-letterhead { position: absolute !important; }
.pdf-capture .rules-print .rules-notice { position: absolute !important; }
.pdf-capture.pdf-page-2 .rules-sheet { padding-top: 22mm; min-height: 205mm; }
`

function settleImage(img: HTMLImageElement): Promise<void> {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve()
    return new Promise((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true })
        img.addEventListener("error", () => resolve(), { once: true })
    })
}

async function rasterise(page: HTMLElement): Promise<string> {
    const scale = Math.min(2, MAX_CANVAS_W / PAGE_W)
    const canvas = await html2canvas(page, {
        scale,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: PAGE_W,
        height: PAGE_H,
        windowWidth: PAGE_W,
        windowHeight: PAGE_H,
        scrollX: 0,
        scrollY: 0,
        logging: false,
    })
    return canvas.toDataURL("image/jpeg", 0.92)
}

/** Renders the two A4 pages of the rulebook that `source` (`.rules-print`) shows. */
export async function renderRulesPdf(source: HTMLElement): Promise<Blob> {
    const style = document.createElement("style")
    style.textContent = CAPTURE_CSS
    const stage = document.createElement("div")
    stage.setAttribute("aria-hidden", "true")
    stage.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W}px;height:${PAGE_H}px;pointer-events:none;`
    try {
        document.head.appendChild(style)
        const pages = [1, 2].map((n) => {
            const page = document.createElement("div")
            // `light` pins Chakra's semantic tokens to the light twins even when
            // the app is in dark mode; paper is white either way.
            page.className = `pdf-capture light pdf-page-${n}`
            const clone = source.cloneNode(true) as HTMLElement
            const sheets = clone.querySelectorAll(".rules-sheet")
            if (n === 1) {
                sheets[1]?.remove()
            } else {
                sheets[0]?.remove()
                clone.querySelector(".rules-titleblock")?.remove()
                clone.querySelector(".rules-sticky")?.remove()
            }
            page.appendChild(clone)
            stage.appendChild(page)
            return page
        })
        document.body.appendChild(stage)

        await document.fonts.ready
        const images = Array.from(stage.querySelectorAll("img"))
        await Promise.all(images.map(settleImage))
        // The faded card artwork is a CSS background: warm it before painting.
        await new Promise<void>((resolve) => {
            const bg = new Image()
            bg.onload = () => resolve()
            bg.onerror = () => resolve()
            bg.src = "/bg-cards-faded.png"
        })
        // Two frames: layout and image decode settle before html2canvas reads it.
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

        const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true })
        for (let i = 0; i < pages.length; i++) {
            const jpeg = await rasterise(pages[i])
            if (i > 0) pdf.addPage("a4", "portrait")
            pdf.addImage(jpeg, "JPEG", 0, 0, 210, 297, undefined, "FAST")
        }
        return pdf.output("blob")
    } finally {
        stage.remove()
        style.remove()
    }
}

function isIos(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

/** Hands the PDF to the user. Toasts success; a cancelled share is silent. */
export async function savePdf(blob: Blob, fileName: string): Promise<void> {
    if (isNative) {
        const base64 = await blobToBase64(blob)
        const { Filesystem, Directory } = await nativeFilesystem()
        const written = await Filesystem.writeFile({ directory: Directory.Cache, path: fileName, data: base64 })
        const Share = await nativeShare()
        try {
            await Share.share({ title: fileName, url: written.uri })
            showSuccess(tStatic("legal.rules.downloaded"))
        } catch {
            // Dismissing the share sheet is not a failure.
        }
        return
    }
    if (isIos() && typeof navigator.canShare === "function" && typeof navigator.share === "function") {
        const file = new File([blob], fileName, { type: "application/pdf" })
        if (navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: fileName })
                showSuccess(tStatic("legal.rules.downloaded"))
                return
            } catch (e) {
                if (e instanceof DOMException && e.name === "AbortError") return
                // Gesture expired or share refused: fall through to the anchor.
            }
        }
    }
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = objectUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Not revoked at once: Safari reads the URL after the click returns.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    showSuccess(tStatic("legal.rules.downloaded"))
}
