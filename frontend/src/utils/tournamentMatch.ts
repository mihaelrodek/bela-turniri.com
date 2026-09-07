import type { MatchDto, RoundDto } from "../types/round"
import type { PairShort } from "../types/pairs"

/* ──────────────────────────────────────────────────────────────────────────
   The tournament detail page's local match/round model, and the pure
   helpers that read it. Extracted verbatim from TournamentDetailsPage so
   the bracket section, the match row and the data hook can all share one
   definition instead of importing each other.
   ────────────────────────────────────────────────────────────────────── */

/* ---------- Local UI types ---------- */
export type MatchLocal = Omit<MatchDto, "score1" | "score2"> & {
    /**
     * Widened from MatchDto's `number | undefined` to also allow `null`.
     * A queued score op carries an explicit `null` for "the organiser
     * cleared this box", and the optimistic row writes that exact value
     * back so the screen matches what will be sent. Casting the optimistic
     * object to MatchLocal instead would have hidden the mismatch rather
     * than modelled it — and `null` really is a value this row can hold
     * between the enqueue and the server's answer.
     */
    score1?: number | null;
    score2?: number | null;
    _score1?: string;
    _score2?: string;
    _dirty?: boolean;
    _editing?: boolean; // <--- added to support "Uredi" mode
    /**
     * A score for this match is sitting in the offline queue, not yet
     * acknowledged by the server. Sibling of `_dirty`/`_editing`: all three
     * mean "the screen is ahead of the server here", so the poll and the
     * websocket refresh must leave the row alone. `_dirty` is "typed, not
     * sent"; `_pending` is "sent to the queue, not confirmed".
     */
    _pending?: boolean;
};

export type RoundLocal = Omit<RoundDto, "matches"> & {
    matches: MatchLocal[];
};

/**
 * How long after a tournament's last write its live socket stays open once
 * the status is FINISHED — long enough for the podium to be typed in, short
 * enough that the SEO long tail holds no idle sockets.
 */
export const FINISHED_SOCKET_GRACE_MS = 30 * 60 * 1000

/** A score op waiting in the offline queue, keyed by match id. */
export type PendingScore = { score1: number | null; score2: number | null };

/**
 * Stamp still-queued scores back on top of a freshly fetched round list.
 *
 * The server snapshot is authoritative for everything EXCEPT the rows the
 * organiser has already saved into the queue — for those the local copy is
 * genuinely newer. Applied after the existing merge rather than inside it,
 * so the hard-won `_dirty`/`_editing` rules stay exactly as they were and
 * this only adds one more reason a row survives a refresh.
 */
export function withPendingScores(
    rounds: RoundLocal[],
    pending: Map<number, PendingScore>,
): RoundLocal[] {
    if (pending.size === 0) return rounds
    return rounds.map((r) => ({
        ...r,
        matches: r.matches.map((m) => {
            const p = pending.get(m.id)
            if (!p) return m
            return {
                ...m,
                score1: p.score1,
                score2: p.score2,
                _score1: p.score1 != null ? String(p.score1) : "",
                _score2: p.score2 != null ? String(p.score2) : "",
                _dirty: false,
                _editing: false,
                _pending: true,
            }
        }),
    }))
}

/** Same idea for the kotizacija flag: a queued toggle outranks the poll. */
export function withPendingPaid(pairs: PairShort[], pending: Map<number, boolean>): PairShort[] {
    if (pending.size === 0) return pairs
    return pairs.map((p) => {
        const paid = pending.get(p.id)
        return paid === undefined ? p : { ...p, paid }
    })
}

/**
 * Winner of a match from the currently-entered (possibly unsaved) scores,
 * falling back to the persisted ones. Pure — lives at module scope so the
 * memoised row renderer doesn't have to list it as a dependency.
 */
export function winnerOf(m: MatchLocal): number | null {
    if (!m.pair1Id || !m.pair2Id) return null
    const a = m._score1 && m._score1 !== "" ? Number(m._score1) : m.score1 ?? null
    const b = m._score2 && m._score2 !== "" ? Number(m._score2) : m.score2 ?? null
    if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) || a === b) return null
    return a > b ? m.pair1Id : m.pair2Id
}

/** Case/whitespace-insensitive name key used for podium name matching. */
export const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase()

/* ---------- Match row: state, colour, geometry ----------
   Colour on the ždrijeb used to be decoration: every playable row was filled
   green and every bye was a saturated blue band, so a glance told you nothing
   you didn't already know. It is now a STATE CHANNEL — one palette per state,
   carried on a 3px left rail and the row border, never as a full fill (a
   board of six tinted rows is noise, and a fill also forces the score inputs
   to sit on a coloured ground that changes under them while typing). */

/** The states a match row can be in, in priority order. */
export type MatchVisualState = "bye" | "editing" | "unsaved" | "finished" | "live" | "open"

/**
 * Colour per state. `null` is deliberate and is the most common row: a match
 * nobody has touched yet gets NO colour at all, which is what makes the ones
 * that do have colour readable.
 *
 *   open      neutral   nothing entered yet
 *   live      yellow    a score is on screen but the match isn't closed
 *   unsaved   orange    typed but not sent, or sent and not yet acknowledged
 *   editing   blue      a finished result reopened for correction
 *   finished  green     decided
 *   bye       blue      not a match at all — a free pass
 */
export const MATCH_STATE_PALETTE: Record<MatchVisualState, string | null> = {
    bye: "blue",
    editing: "blue",
    unsaved: "orange",
    finished: "green",
    live: "yellow",
    open: null,
}

export function matchVisualState(m: MatchLocal): MatchVisualState {
    if (!m.pair2Id) return "bye"
    if (m._editing) return "editing"
    if (m._dirty || m._pending) return "unsaved"
    if (m.status === "FINISHED") return "finished"
    const typed = (m._score1 ?? "") !== "" || (m._score2 ?? "") !== ""
    return typed ? "live" : "open"
}

/** i18n key for the state, used as the row's accessible name and title so the
 *  colour is never the ONLY carrier of the meaning. */
export const MATCH_STATE_KEY: Record<MatchVisualState, string> = {
    bye: "tournament.bracket.bye",
    editing: "tournament.match.stateEditing",
    unsaved: "tournament.match.stateUnsaved",
    finished: "tournament.match.stateFinished",
    live: "tournament.match.stateLive",
    open: "tournament.match.stateOpen",
}

/* Every match row is laid out on the SAME grid, whatever state it is in.
   The trailing action differs per state — a saved row shows an edit pencil, a
   dirty one a save button, a queued one a clock — and when that slot was
   allowed to size itself the names and the score boxes landed on a different
   x on every row. The slot is a fixed reservation now, so the two name
   columns and the score column are pinned across the whole round. */
/* 76px, not 68: the bye row now puts its "Slobodni" pill in THIS column
   instead of leaving it empty, and the pill has to fit without wrapping or
   spilling into the pair name. Arithmetic at the pill's own size (Badge
   size="sm" → 12px text, px="1.5" → 6px a side): "Slobodni" measures ~49px in
   Inter and ~55px in the widest system fallback, + 12px padding = 61–67px.
   68px left nothing for the fallback fonts, so the reservation goes to 76px.
   Every row reads this constant, so the table chips, the bye pills and the
   pair names all stay on the same x. */
export const MATCH_TABLE_COL_W = "76px"
export const MATCH_SCORE_COL_W = "132px"
/* 116px fit the bill chip plus ONE trailing icon (save-when-dirty, or the
   finished-match edit pencil) — but the editing state shows TWO icons (save
   + cancel) side by side, which overflowed the column and painted over the
   pair name next to it. Widened to fit the worst case: bill chip + two xs
   icon buttons + the gaps between them. */
export const MATCH_ACTION_COL_W_OWNER = "150px"
export const MATCH_ACTION_COL_W_VIEWER = "76px"
/**
 * The phone reservation for the organiser's action slot.
 *
 * On a phone the save / cancel / edit controls are real 44px tap targets
 * (they are pressed pitchside, one-handed, in a hurry), so two of them plus
 * the bill chip and their gaps no longer fit the 150px the dense desktop grid
 * reserves. The desktop grid keeps its own width — this one only applies to
 * the phone layout's header row, where the slot is a flex child rather than a
 * grid track.
 */
export const MATCH_ACTION_COL_W_OWNER_PHONE = "176px"

/**
 * Enter walks to the next score box on screen, so a round can be typed in
 * without ever leaving the keyboard or reaching for the next field.
 *
 * The row renders twice — a phone layout and a desktop grid, one of them
 * `display:none` — so the query filters on `offsetParent`, which is null for
 * anything inside a hidden ancestor. That keeps the walk inside the layout
 * the user can actually see.
 */
export function focusNextScoreInput(current: HTMLInputElement) {
    const boxes = Array.from(
        document.querySelectorAll<HTMLInputElement>("input[data-score-input]"),
    ).filter((el) => !el.disabled && el.offsetParent !== null)
    const i = boxes.indexOf(current)
    if (i >= 0 && i + 1 < boxes.length) boxes[i + 1].focus()
    else current.blur()
}

/** A round can be finished once every non-BYE match has a decided score. */
export function canFinish(r: RoundLocal): boolean {
    if (r.matches.length === 0) return false
    return r.matches.every((m) => {
        if (!m.pair1Id || !m.pair2Id) return true
        return winnerOf(m) !== null
    })
}

/** Map a server RoundDto onto the local editor shape (clean, nothing typed). */
export function toRoundLocal(r: RoundDto): RoundLocal {
    return {
        ...r,
        matches: (r.matches ?? []).map((m) => ({
            ...m,
            _score1: m.score1 != null ? String(m.score1) : "",
            _score2: m.score2 != null ? String(m.score2) : "",
            _dirty: false,
            _editing: false,
        })),
    }
}
