import { http } from "./http"

/* ──────────────────────────────────────────────────────────────────────────
   Public "Bela blok" share link (BLOK-HISTORY.md §5.2).

   GET /blok-share/{token} is public — no auth, never toasts (a 404 here is
   the single most likely outcome a recipient hits: a revoked or mistyped
   link, not a real error). It returns the same shape as the owner's
   `GET /user/me/blok-history/{uuid}` (see `api/blokHistory.ts`) minus
   anything identifying the owner — this file deliberately does NOT import
   those types so this page's contract stays pinned to §2.3/§5.2 rather than
   silently drifting if the owner-only DTO changes shape later.

   Any failure (404 unknown/revoked token, network error, 5xx) is treated
   identically by the page: "this link no longer works". There is nothing a
   recipient can do about a transient 500 either, so a single calm state
   covers all of it.
   ────────────────────────────────────────────────────────────────────── */

export type BlokShareSide = "us" | "them"
export type BlokShareTrump = "HERC" | "KARA" | "PIK" | "TREF"

/**
 * How a single game ends (BLOK-HISTORY.md §5.5): `"dosta"` finishes the
 * moment either side passes the target, `"prolaz"` requires the side that
 * CALLED the deal to be the one that passes it. Two games with identical
 * deals have different winners under the two rules, which is exactly why the
 * rule travels inside the record instead of being assumed at render time.
 *
 * OPTIONAL on the wire on purpose: records written before the field existed
 * carry no rule at all, and the contract fixes the reading of those as
 * `"prolaz"` — the documented default. Never treat an absent value as
 * `"dosta"`.
 */
export type BlokShareEndRule = "dosta" | "prolaz"

/** One deal — same fields the owner's client posted (BLOK-HISTORY.md §2.3). */
export interface BlokShareRound {
    caller: BlokShareSide
    cards: { us: number; them: number }
    /** Individual declarations as entered (e.g. `[20, 50]`), never a sum. */
    declarations: { us: number[]; them: number[] }
    stiglja: BlokShareSide | null
    /** The side that showed a belot, or null/absent (BLOK.md §1.2). Optional
     *  for the same reason as on the owner's DTO: the deals ride inside the
     *  record's opaque `payload` (BLOK-HISTORY.md §2.3), so records written
     *  before the field existed simply carry no key — absent = no belot. */
    belot?: BlokShareSide | null
    trump: BlokShareTrump | null
}

/** One game ("partija") within the shared session — a run of deals to `target`. */
export interface BlokShareGame {
    id: string
    createdAt: number
    finishedAt: number | null
    target: number
    winner: BlokShareSide | null
    /** Computed client-side by the owner at save time — never recomputed
     *  server-side (BLOK-HISTORY.md §3.3) — so this is rendered as-is. */
    totals: { us: number; them: number }
    rounds: BlokShareRound[]
    /** Per game, since a series can in principle mix rules. Absent = `"prolaz"`. */
    gameEndRule?: BlokShareEndRule | null
}

/** The public, read-only record behind `/blok/z/{token}`. */
export interface BlokShareRecord {
    target: number
    /** "" on either side means "use the translated MI/VI" (§2.3), same as
     *  the owner's own view. */
    names: { us: string; them: string }
    startedAt: string
    finishedAt: string | null
    /** The session's own result, e.g. 4 and 3. */
    gamesUs: number
    gamesThem: number
    gamesCount: number
    /** Series-level rule, the one the meta line shows ("Do 1001 · prolaz").
     *  Absent = `"prolaz"` (§5.5). */
    gameEndRule?: BlokShareEndRule | null
    games: BlokShareGame[]
}

/**
 * Fetch a shared "Bela blok" record by its share token. Public, no auth.
 *
 * `silent: true` suppresses the axios interceptor's toast entirely — a 404
 * here is an ordinary outcome ("this link no longer works"), not something
 * to shout about in a red toast, and the page renders its own calm empty
 * state for every failure mode.
 */
export async function fetchBlokShare(token: string): Promise<BlokShareRecord> {
    const { data } = await http.get<BlokShareRecord>(
        `/blok-share/${encodeURIComponent(token)}`,
        { silent: true },
    )
    return data
}
