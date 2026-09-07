/** Sizing helpers for the fullscreen round board (kept out of the .tsx so
 *  fast refresh sees a components-only module). */

export type FsSize = "smaller" | "larger"

/** Same lifetime as the tournaments list's grid/list preference: a viewing
 *  choice that must survive closing and reopening the overlay (and navigating
 *  away and back) within the tab, and reset on the next visit. */
export const FS_SIZE_STORAGE_KEY = "bela:fullscreen-round-size"

export function readStoredFsSize(): FsSize {
    try {
        return window.sessionStorage.getItem(FS_SIZE_STORAGE_KEY) === "smaller" ? "smaller" : "larger"
    } catch {
        /* private mode — fall back to the default */
        return "larger"
    }
}

/**
 * Columns for `n` cards.
 *
 * Below `singleRowCap`, everything fits one clean row — a round of 3 gets
 * 3 columns, never 2 cards on a wide row plus one stranded alone on the
 * next. Past that, columns grow with `sqrt(n)` so the grid stays a landscape
 * shape instead of stacking into far too many short rows (the previous fixed
 * thresholds topped out at 5 columns no matter how big the round was, which
 * is what made a 20+ table round unreadably squashed). `larger` keeps rows a
 * little taller per column (bigger cards, so fewer of them fit); `smaller`
 * packs rows tighter.
 */
export function fsColumns(n: number, size: FsSize): number {
    if (n <= 0) return 1
    const singleRowCap = size === "larger" ? 5 : 8
    if (n <= singleRowCap) return n
    const aspect = size === "larger" ? 1.3 : 2.2
    const rows = Math.max(1, Math.round(Math.sqrt(n / aspect)))
    return Math.max(singleRowCap, Math.ceil(n / rows))
}

/** Displayed score for one side: what is on screen (typed, or optimistically
 *  written by the offline queue) wins over what the server last returned —
 *  the same precedence `winnerOf` uses, so the number and the highlight can
 *  never disagree. Empty string means "no score yet, show nothing". */
export function fsScoreText(typed: string | undefined, saved: number | null | undefined): string {
    if (typed != null && typed !== "") return typed
    return saved != null ? String(saved) : ""
}
