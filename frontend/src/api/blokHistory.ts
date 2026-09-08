import { http } from "./http"
import { t } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   "Blok" scorepad history — a signed-in player's saved sessions
   (BLOK-HISTORY.md). A session ("serija") is a run of games at one table
   that ends e.g. 4 : 3; each game holds its deals in full detail.

   ASSUMPTION FLAG for whoever wires the backend up next to this: the list
   endpoint's summary fields (`startedAt`/`finishedAt`) are typed here as ISO
   date-time strings, matching every other DTO in `api/` that carries a
   `timestamptz` column (see `UserInvoiceDto.tournamentStartAt` in
   `api/cjenik.ts`). The nested `games[].createdAt`/`finishedAt` inside the
   detail payload are typed as epoch ms, matching EXACTLY what the client
   sends in the `POST` body (BLOK-HISTORY.md §2.3) — the backend stores that
   payload as opaque `jsonb` and is documented to never recompute it
   (§3.3: "brojevi se ne preračunavaju na serveru"), so it should come back
   byte-for-byte. If the real backend disagrees with either shape, this file
   is the one to fix.
   ────────────────────────────────────────────────────────────────────── */

export type BlokHistorySide = "us" | "them"
export type BlokHistoryTrump = "HERC" | "KARA" | "PIK" | "TREF"

/**
 * How a single game ends (BLOK-HISTORY.md §5.5): `"dosta"` finishes the
 * moment either side passes the target, `"prolaz"` requires the side that
 * CALLED the deal to be the one that passes it — the same deals produce a
 * different winner under each, so the rule is part of the record rather than
 * an assumption made when it is drawn.
 *
 * OPTIONAL on the wire on purpose: sessions saved before the field existed
 * carry no rule, and the contract fixes the reading of those as `"prolaz"`.
 * Never default to `"dosta"`.
 */
export type BlokHistoryEndRule = "dosta" | "prolaz"

/** One deal — same shape the client posts (BLOK-HISTORY.md §2.3). */
export interface BlokHistoryRound {
    caller: BlokHistorySide
    cards: { us: number; them: number }
    /** Individual declarations as entered (`[20, 50]`), not a sum. */
    declarations: { us: number[]; them: number[] }
    stiglja: BlokHistorySide | null
    /**
     * The side that showed a belot, or null/absent (BLOK.md §1.2).
     *
     * OPTIONAL on the wire, and no backend change was needed to carry it: the
     * deals live inside the record's `payload` `jsonb` column (BLOK-HISTORY.md
     * §2.3/§3.1), which is stored whole and never recomputed server-side, and
     * the summary columns hold none of this. A session filed before belot
     * existed carries no such key; absent reads as "no belot".
     */
    belot?: BlokHistorySide | null
    trump: BlokHistoryTrump | null
}

/** One game ("partija") within a session — a run of deals to `target`. */
export interface BlokHistoryGame {
    id: string
    createdAt: number
    finishedAt: number | null
    target: number
    winner: BlokHistorySide | null
    /** Computed client-side by the same engine that drew the screen — see
     *  the module doc above; never recomputed here. */
    totals: { us: number; them: number }
    rounds: BlokHistoryRound[]
    /** Per game, since a series can in principle mix rules. Absent = `"prolaz"`. */
    gameEndRule?: BlokHistoryEndRule | null
}

/**
 * List-row shape. `GET /user/me/blok-history` deliberately never returns
 * `payload` (BLOK-HISTORY.md §3.2), so there is no `games` field here — only
 * `fetchBlokHistoryDetail` carries deals.
 */
export interface BlokHistorySummary {
    uuid: string
    target: number
    /** "" on either side means "use the translated MI/VI" (§2.3). */
    names: { us: string; them: string }
    startedAt: string
    /** Nullable: the column is, and a series can be filed before its last
     *  game finished. Every render of it must tolerate null. */
    finishedAt: string | null
    /** The session's own result, e.g. 4 and 3. */
    gamesUs: number
    gamesThem: number
    gamesCount: number
    /** Series-level rule, shown in the row's meta line ("Do 1001 · prolaz").
     *  Present on the summary too, not only the detail, so the list can show
     *  it without fetching a payload. Absent = `"prolaz"` (§5.5). */
    gameEndRule?: BlokHistoryEndRule | null
}

export interface BlokHistoryDetail extends BlokHistorySummary {
    games: BlokHistoryGame[]
}

export async function fetchBlokHistoryList(): Promise<BlokHistorySummary[]> {
    const { data } = await http.get<BlokHistorySummary[]>("/user/me/blok-history", {
        params: { limit: 100, offset: 0 },
    })
    return data
}

/** Full record with every game and deal — fetched only when a session is opened. */
export async function fetchBlokHistoryDetail(uuid: string): Promise<BlokHistoryDetail> {
    const { data } = await http.get<BlokHistoryDetail>(`/user/me/blok-history/${uuid}`)
    return data
}

export async function deleteBlokHistory(uuid: string): Promise<void> {
    await http.delete(`/user/me/blok-history/${uuid}`, {
        successMessage: t("profile.blok.deleted"),
    })
}
