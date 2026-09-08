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

/* ---------- One scale factor -----------------------------------------------

   The board used to derive every type size from the viewport divided by the
   number of grid rows, which meant a 15-table round shrank the pair names to
   one or two letters while the table number kept its own 40%-wide column.
   Wrong priority and wrong mechanism.

   The mechanism now: ONE scale factor per size mode multiplies a single set of
   base pixel values. "smaller" is 1×, "larger" is 1.45×. Nothing depends on
   the match count, so a round of 3 and a round of 30 render the same-sized
   card — only how many fit per row changes.

   Why plain pixels and not `vw` are right here: the grid is
   `repeat(auto-fill, minmax(minCol, 1fr))`, so the COLUMN WIDTH stays within
   a factor of `minCol`…`2 × minCol` on every screen — 6 columns on a 1999px
   TV and 12 on a 3840px one, each about 320px wide. Type measured against a
   column that does not itself grow must not grow either. */

const FS_SCALE: Record<FsSize, number> = {
    smaller: 1,
    larger: 1.45,
}

export type FsMetrics = {
    /** `minmax()` floor for the auto-fill grid, px. */
    minCol: number
    /** Gap between cards, px. */
    gap: number
    /** Pair name — the primary content of the card, px. */
    name: number
    /** Score digit, px. */
    score: number
    /** Table number inside its badge, px. */
    tableNo: number
    /** "STOL" / "SLOBODNI" badge caption, px. */
    label: number
    /** Card padding, px. */
    padX: number
    padY: number
    /** Vertical rhythm inside a card, px. */
    rowGap: number
}

/* Base = the "smaller" mode, tuned so that a 1999px-wide board (minus the
   overlay's 2 × 16px padding) auto-fills 6 columns with an 18px name, and the
   "larger" mode 4 columns with a 26px name. A 390px phone falls to a single
   full-width column in both modes (`min(minCol, 100%)` in the template). */
const FS_BASE: FsMetrics = {
    minCol: 300,
    gap: 8,
    name: 18,
    score: 24,
    tableNo: 19,
    label: 11,
    padX: 10,
    padY: 8,
    rowGap: 5,
}

export function fsMetrics(size: FsSize): FsMetrics {
    const k = FS_SCALE[size]
    return {
        minCol: Math.round(FS_BASE.minCol * k),
        gap: Math.round(FS_BASE.gap * k),
        name: Math.round(FS_BASE.name * k),
        score: Math.round(FS_BASE.score * k),
        tableNo: Math.round(FS_BASE.tableNo * k),
        label: Math.round(FS_BASE.label * k),
        padX: Math.round(FS_BASE.padX * k),
        padY: Math.round(FS_BASE.padY * k),
        rowGap: Math.round(FS_BASE.rowGap * k),
    }
}

/** Displayed score for one side: what is on screen (typed, or optimistically
 *  written by the offline queue) wins over what the server last returned —
 *  the same precedence `winnerOf` uses, so the number and the highlight can
 *  never disagree. Empty string means "no score yet, show nothing". */
export function fsScoreText(typed: string | undefined, saved: number | null | undefined): string {
    if (typed != null && typed !== "") return typed
    return saved != null ? String(saved) : ""
}
