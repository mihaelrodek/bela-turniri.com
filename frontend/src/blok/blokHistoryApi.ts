import { http } from "../api/http"
import { isRecordableGame, totalsOf, winnerOf } from "./store"
import type { BlokDealerSeat, BlokGame, BlokGameEndRule, BlokSide } from "./types"

/* ──────────────────────────────────────────────────────────────────────────
   "Povijest blokova na profilu", PHONE side — the one call the scorepad makes
   for it: `POST /user/me/blok-history`, the whole closed series in one record
   (BLOK-HISTORY.md §2.3).

   WHY A FILE OF ITS OWN AND NOT `blokLinkApi.ts`
   ──────────────────────────────────────────────
   Same reason `blokLinkApi.ts` is not `src/api/blokLink.ts`: these two things
   share a directory, not a contract. The link is a live conversation with an
   organiser about a match in progress; this is a personal logbook posted once,
   at the end, to the player's own profile. They fail differently, retry
   differently and are read by different screens — the profile section imports
   nothing from here (it has its own module under `src/api/`), because the only
   endpoint the SCOREPAD needs is the write.

   SILENT, LIKE THE SCORE PUSH AND FOR THE SAME REASON
   ───────────────────────────────────────────────────
   Nobody is standing over this call. It runs after "Nova igra" has already
   emptied the screen, and it runs again by itself when the network returns.
   A red toast per failed attempt would announce a problem the player cannot
   act on and that the retry is about to fix. Failure is state — the series
   stays in `pendingSessions` — not a notification. The ONE thing that does
   speak up is success, once, so "gdje mi je serija" has an answer.

   THE NUMBERS ARE COMPUTED HERE, NOT ON THE SERVER
   ────────────────────────────────────────────────
   `winner` and `totals` come from `totalsOf` / `winnerOf`, i.e. from the same
   `scoreManualDeal` that drew the numbers on screen (BLOK.md §1). The history
   must show exactly what the player saw at the table, and re-deriving the fall
   rule in Java would create a second source of truth for it — see
   BLOK-HISTORY.md §3.3, which is why the backend stores these rather than
   recomputing them.
   ────────────────────────────────────────────────────────────────────── */

/** One deal, stripped of the local `id` — the array order IS the order. */
export type BlokHistoryRoundDto = {
    caller: BlokSide
    cards: Record<BlokSide, number>
    declarations: Record<BlokSide, number[]>
    stiglja: BlokSide | null
    /**
     * The side that showed a belot, or null (BLOK.md §1.2).
     *
     * NO SCHEMA CHANGE — verified against BLOK-HISTORY.md §2.3/§3.1: the deals
     * travel inside the record's `payload`, a `jsonb` column the server stores
     * whole and is documented never to recompute (§3.3), and the summary
     * columns (`games_us`, `target`, dates, names) hold nothing per-deal. So a
     * new field on a round rides along with the existing POST and nothing on
     * the backend has to move. `winner` and `totals` already carry the belot's
     * consequence: they are computed here by the same engine that drew it.
     */
    belot: BlokSide | null
    trump: string | null
}

export type BlokHistoryGameDto = {
    id: string
    createdAt: number
    finishedAt: number | null
    target: number
    /**
     * How this game ended — BLOK-HISTORY.md §5.5.
     *
     * It travels because `winner` is NOT checkable without it: the same deals
     * produce a different winner under "dosta" and under "prolaz", so a record
     * carrying the winner alone (on the profile, or behind a share link) is a
     * number nobody can re-derive. Sent per game rather than only per series
     * because the setting can be changed between two games of one evening.
     */
    gameEndRule: BlokGameEndRule
    /**
     * The seat that dealt this game's FIRST deal — BLOK.md §3.3.4.
     *
     * It travels because it is the one thing about a game the deals cannot
     * reproduce. Every later dealer of the game is derived from it and the
     * direction, so recording this one seat records the whole rotation; and
     * from the next game's point of view it is the fact the rotation carries
     * on FROM, whether it simply steps round the table or steps past the pair
     * that lost.
     *
     * `null` when nobody ever named a dealer — the blok was only guessing, and
     * a guess is not worth writing down as a fact about the evening.
     */
    dealer: BlokDealerSeat | null
    winner: BlokSide | null
    totals: Record<BlokSide, number>
    rounds: BlokHistoryRoundDto[]
}

/** The whole series, exactly as BLOK-HISTORY.md §2.3 spells it. */
export type BlokHistoryPayload = {
    sessionId: string
    target: number
    /** The series-level rule, for the summary column §5.5 asks for. Taken from
     *  the LAST game, exactly like `target` and `names` — same reason. */
    gameEndRule: BlokGameEndRule
    names: Record<BlokSide, string>
    startedAt: number
    finishedAt: number
    games: BlokHistoryGameDto[]
}

function toGameDto(game: BlokGame): BlokHistoryGameDto {
    return {
        id: game.id,
        createdAt: game.createdAt,
        finishedAt: game.finishedAt,
        target: game.target,
        gameEndRule: game.gameEndRule,
        dealer: game.dealer.chosen ? game.dealer.first : null,
        winner: winnerOf(game),
        totals: totalsOf(game),
        rounds: game.rounds.map((round) => ({
            caller: round.caller,
            cards: { us: round.cards.us, them: round.cards.them },
            declarations: {
                us: [...round.declarations.us],
                them: [...round.declarations.them],
            },
            stiglja: round.stiglja,
            belot: round.belot,
            trump: round.trump,
        })),
    }
}

/**
 * Build the record for one series, or null when there is nothing to file.
 *
 * ── A RECORD NEVER CONTAINS HALF A GAME — BLOK-HISTORY.md §5.6 ─────────────
 * Only games that were actually WON go in. The filter is `isRecordableGame`
 * (deals present AND a winner under that game's own end rule), applied HERE,
 * at the single point where a record is assembled, so every path into the
 * profile obeys it: closing the series, the retry that follows it, and
 * "Podijeli" — which saves before it asks for a token. Filtering only in the
 * store would have left the share path posting a game still being played, and
 * since the POST is an upsert that half game would then sit in the very record
 * the close is about to complete.
 *
 * `games` arrives oldest-first from `gamesInSession`, unfiltered — "what this
 * device holds"; what may be FILED is decided here. The series-level `target`,
 * `gameEndRule` and `names` are taken from the LAST game that survived the
 * filter: all three can be changed mid-series from "Postavke", and what the
 * table ended up calling itself is what belongs on the record. Each game also
 * carries its OWN `gameEndRule`, which is the one that actually judged its
 * `winner`. `startedAt`/`finishedAt` bracket the filed games.
 *
 * Null therefore means "nothing finished yet", which is an ordinary state: a
 * series whose only game is still being played files nothing at all — and
 * `resetSession` keeps nothing behind for it either, so it leaves no marker to
 * retry forever.
 */
export function buildSessionPayload(
    sessionId: string,
    games: BlokGame[],
): BlokHistoryPayload | null {
    const filed = games.filter(isRecordableGame)
    if (filed.length === 0) return null
    const last = filed[filed.length - 1]
    return {
        sessionId,
        target: last.target,
        gameEndRule: last.gameEndRule,
        names: { us: last.names.us, them: last.names.them },
        startedAt: filed[0].createdAt,
        finishedAt: filed.reduce(
            (latest, g) => Math.max(latest, g.finishedAt ?? g.createdAt),
            filed[0].createdAt,
        ),
        games: filed.map(toGameDto),
    }
}

/* ──────────────────────────────────────────────────────────────────────────
   WHAT THE SERVER HANDS BACK, AND WHY IT IS READ DEFENSIVELY
   ─────────────────────────────────────────────────────────
   Two things the phone actually needs out of a save: the record's `uuid` (the
   address of every /share call) and, once one exists, the share `token`. Both
   are read through the narrow readers below rather than by trusting a cast,
   because this client and the endpoint it talks to ship independently: a
   deployment where the API predates the share columns must degrade to "saved,
   not shareable" rather than to a crash inside a scorepad.

   The token's FIELD NAME is read as either `shareToken` or `token` for the
   same reason — §5.2 names the concept, not the wire key, and the reader
   costs one line where a guess would cost a support ticket.
   ────────────────────────────────────────────────────────────────────── */

/** The saved record, as much of it as the phone cares about. */
export type BlokHistoryRecord = {
    uuid: string
    /** The public share token, or null while the series has never been shared. */
    shareToken: string | null
}

function readString(source: unknown, ...keys: string[]): string | null {
    if (typeof source !== "object" || source === null) return null
    for (const key of keys) {
        const value = (source as Record<string, unknown>)[key]
        if (typeof value === "string" && value !== "") return value
    }
    return null
}

function readRecord(data: unknown): BlokHistoryRecord | null {
    const uuid = readString(data, "uuid")
    if (uuid === null) return null
    return { uuid, shareToken: readString(data, "shareToken", "token") }
}

/**
 * Send one series to the profile.
 *
 * Idempotent on `sessionId` server-side — and since §5.1 this is an UPSERT, not
 * a write-once: the same series is posted again after every "Spremi i započni
 * novu", and the server merges the new games into the record it already has,
 * keeping its `uuid` and therefore keeping any share link alive. That is the
 * whole mechanism behind saving at every new game, and the reason the local
 * copy is never deleted before a 200.
 *
 * Returns the record when the response carried one, `null` when it did not —
 * a save is a success either way, only sharing needs the `uuid`.
 */
export async function uploadBlokSession(
    payload: BlokHistoryPayload,
): Promise<BlokHistoryRecord | null> {
    const { data } = await http.post<unknown>("/user/me/blok-history", payload, { silent: true })
    return readRecord(data)
}

/**
 * Issue (or re-read) the public share token for a saved series — §5.2.
 *
 * The token is NOT the record's `uuid`: records exist without their owner ever
 * agreeing to publish them, so guessing a `uuid` must reveal nothing. The
 * server mints a separate random string and this only ever carries it.
 */
export async function createBlokShare(uuid: string): Promise<string | null> {
    const { data } = await http.post<unknown>(
        `/user/me/blok-history/${uuid}/share`,
        undefined,
        { silent: true },
    )
    return readString(data, "shareToken", "token")
}

/** Revoke the link. The record stays; only the public door closes. */
export async function revokeBlokShare(uuid: string): Promise<void> {
    await http.delete(`/user/me/blok-history/${uuid}/share`, { silent: true })
}

/**
 * The public URL for a token — `/blok/z/{token}` (§5.2).
 *
 * Absolute, and built from the live origin rather than from a configured base
 * URL: this string is about to be handed to the OS share sheet or to somebody's
 * clipboard, where a relative path is useless, and a hard-coded production host
 * would put a developer's tap into someone else's inbox.
 */
export function blokShareUrl(token: string): string {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    return `${origin}/blok/z/${token}`
}
