import { useEffect, useState } from "react"
import { scoreManualDeal } from "@bela/engine"
import type { RoundOutcome } from "@bela/engine"
import {
    BLOK_SIDES,
    BLOK_STORAGE_KEY,
    DEFAULT_DEAL_DIRECTION,
    DEFAULT_GAME_END_RULE,
    DEFAULT_NEW_GAME_DEALER,
    DEFAULT_TARGET,
    LEGACY_SESSION_ID,
    MAX_SERIES_TARGET,
    MAX_SIDE_NAME,
    type BlokGame,
    type BlokDealerSeat,
    type BlokDealDirection,
    type BlokDealerSetup,
    type BlokGameEndRule,
    type BlokLink,
    type BlokLinkStatus,
    type BlokNewGameDealer,
    type BlokRound,
    type BlokShare,
    type BlokSide,
    type BlokStorageV1,
    type BlokSuit,
} from "./types"
import { dealerAt, firstDealerFor, nextGameDealer } from "./dealer"

/* ──────────────────────────────────────────────────────────────────────────
   useBlok — all the state of the paper scorepad. Contract: `BLOK.md` §5.

   ONE key, ONE writer, NOTHING derived is stored
   ──────────────────────────────────────────────
   `localStorage["bela:blok:v1"]` holds the whole thing (`BlokStorageV1`): the
   game in progress and the archive of finished ones. Totals, the winner, the
   per-deal outcomes and the "who called how often" badges are recomputed from
   `game.rounds` on every render through `scoreManualDeal`. That is the point:
   the blok lets you edit deal #3 of eleven, and a stored running total would
   be wrong from that moment on with nothing on screen to reveal it.

   WHY A MODULE-LEVEL STORE AND NOT PLAIN useState IN THE PAGE
   ──────────────────────────────────────────────────────────
   One page owns this, but the page is not the only component that calls the
   hook — a header badge, an entry sheet and a menu all want the same game, and
   two independent `useState`s over the same key would silently disagree until
   a reload. Same shape as `hooks/useWaiterSession.ts`: a module cache, a set of
   listeners, and every write notifying all of them. No context provider, no
   new dependency.

   NOTHING HERE MAY THROW
   ──────────────────────
   The blok is the offline screen: it runs in private windows, on devices with
   site data blocked, and against whatever an older build or a browser
   extension left under the key. Every `localStorage` read and write is
   wrapped, every loaded value is validated field by field, and even the
   scoring call is guarded — `scoreManualDeal` throws `EngineError` on a deal
   that cannot exist (see its header), and a round that somehow got stored in
   that state must show up as a zero row, never as a white screen. When storage
   is unavailable the in-memory cache alone carries the game: a reload loses
   it, which is degraded but not broken.

   SESSIONS ARE AN ID, NOT A NEW FLOW
   ──────────────────────────────────
   A "serija" (BLOK-HISTORY.md §2.1) is the run of games the same four people
   play at one table — 4:3 and then everyone goes home. It already existed:
   the summary's "Sljedeća partija" archives one game and starts the next. All
   it was missing was a name, so it is exactly one field, `BlokGame.sessionId`,
   inherited by `newGame()` and kept by `discardCurrent()`. Only
   `resetSession()` — the menu's "Nova igra" since §5.6 — closes one and mints
   another. Nothing here is derived from `rounds`, and no game shape
   changed for anyone: a game saved before the field existed is given the one
   shared `LEGACY_SESSION_ID` as it is read, which is why the storage version
   stays at 1 with no migration.

   A second, OPTIONAL field says how long a series is — `BlokGame.seriesTarget`,
   "igra se do 2" — and it is inherited exactly like `target` and `names`, for
   the same reason: every game of one evening has to agree on it. Its default
   is `null`, an OPEN series: nothing declares the evening over, games just
   keep coming, and only the menu's "Nova igra" closes it (§5.6). That is precisely the behaviour
   that existed before this field did, and a game saved without it reads back
   as null — so this too is still v1 with no migration. The series SCORE
   (2 : 1) is not stored anywhere: `seriesWinsIn` counts it from the winners of
   the session's games, on every render, like the totals.

   A THIRD such field says how ONE game ends — `BlokGame.gameEndRule`, "prolaz"
   or "dosta" — inherited the same way and defaulting to "prolaz" since
   2026-09-08 (BLOK-HISTORY.md §5.5; it defaulted to "dosta" before that). It is
   read in exactly one place, `winnerFrom` below; see the block comment there
   for the rule itself and for the one function to change if the reading of
   "prolaz" turns out to be wrong.

   THE TOURNAMENT LINK IS THE ONE NON-DERIVED, NON-GAME FIELD
   ─────────────────────────────────────────────────────────
   `game.link` (BLOK-LINK.md §3.2) records that this scorepad has been linked
   to a table at a live tournament. It is deliberately OPTIONAL — the storage
   version stays at 1 and every game saved before the feature existed loads
   untouched — and this file still performs no network I/O whatsoever: it
   stores what a caller was told by the server and nothing else. Two of its
   fields (`syncedGames`, `pendingSince`) look like stored derived state but
   are not: they describe the CONVERSATION, not the game, and there is nowhere
   else to derive "what did we last manage to send" from.
   ────────────────────────────────────────────────────────────────────── */

/** A deal we could not score (corrupt storage, a build that wrote a shape we
 *  no longer accept). Keeps `perRound` index-aligned with `game.rounds`. */
const ZERO_OUTCOME: RoundOutcome = {
    total: { us: 0, them: 0 },
    cards: { us: 0, them: 0 },
    declarations: { us: 0, them: 0 },
    fell: false,
}

/** Finished games we keep. Unbounded growth eventually blows the quota, and a
 *  failed write loses the CURRENT game too — the one that matters. */
const MAX_ARCHIVE = 50

/** Closed-but-unsent sessions we track. A phone offline for a week is the case
 *  this exists for; a list that never stops growing is not. */
const MAX_PENDING_SESSIONS = 20

/** Sessions the server refused for good. Same cap, same reasoning, and it is
 *  the same order of magnitude on purpose: whatever the queue can hold, the
 *  list of things that came out of it the wrong way can hold too. */
const MAX_REJECTED_SESSIONS = 20

const SUITS: readonly BlokSuit[] = ["HERC", "KARA", "PIK", "TREF"]

const LINK_STATUSES: readonly BlokLinkStatus[] = ["PENDING", "APPROVED", "REJECTED", "REVOKED"]
const DEALER_SEATS: readonly BlokDealerSeat[] = ["self", "rightOpponent", "partner", "leftOpponent"]

/* ===================== ids and empty state ===================== */

/** crypto.randomUUID is missing in older Android WebViews and on http:// origins. */
function newId(): string {
    try {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID()
        }
    } catch {
        /* fall through to the manual id */
    }
    return `blok-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e12).toString(36)}`
}

/**
 * A fresh game. `names` start EMPTY on purpose: an empty name means "no custom
 * name yet", and the screens render the translated default (`blok.side.us` /
 * `blok.side.them`). Storing "MI"/"VI" here would hard-code a user-facing
 * string in a module — against the project rule — and would freeze the
 * Croatian wording into a Slovenian player's saved game.
 */
/**
 * The table conventions a new game inherits from the one before it — the
 * agreements that hold for a whole evening rather than for one game.
 *
 * An object rather than the nine positional parameters this used to take. The
 * settings dialog's own `onSave` was changed to an object for exactly this
 * reason ("a call site of seven bare values is where the wrong two get
 * swapped"), and a tenth boolean-shaped argument here would have been the
 * ninth and tenth in a row that read the same at the call site.
 */
export interface BlokGameSetup {
    target?: number
    names?: Record<BlokSide, string>
    /** The session this game belongs to. A NEW one is minted only when the
     *  caller has none to inherit — BLOK-HISTORY.md §2.1. */
    sessionId?: string
    /** How many won games take the series, or `null`/absent for an open one —
     *  which is the default. */
    seriesTarget?: number | null
    /** How a single game ends — "prolaz" (the default) or "dosta". */
    gameEndRule?: BlokGameEndRule
    dealer?: BlokDealerSetup
    /** Which way the deal goes round the table. */
    dealDirection?: BlokDealDirection
    /** Who deals the first deal of the NEXT game; absent = carry on round. */
    newGameDealer?: BlokNewGameDealer
    /** Whether the "Sljedeći dijeli" strip is shown; absent = shown. */
    showDealer?: boolean
    /** Whether the share control is offered at all; absent = offered. */
    shareEnabled?: boolean
}

export function emptyGame(setup: BlokGameSetup = {}): BlokGame {
    return {
        id: newId(),
        sessionId: setup.sessionId && setup.sessionId !== "" ? setup.sessionId : newId(),
        createdAt: Date.now(),
        finishedAt: null,
        target: sanitizeTarget(setup.target ?? DEFAULT_TARGET),
        seriesTarget: sanitizeSeriesTarget(setup.seriesTarget),
        gameEndRule: sanitizeGameEndRule(setup.gameEndRule),
        dealer: sanitizeDealerSetup(setup.dealer),
        dealDirection: sanitizeDealDirection(setup.dealDirection),
        newGameDealer: sanitizeNewGameDealer(setup.newGameDealer),
        showDealer: sanitizeShowDealer(setup.showDealer),
        shareEnabled: sanitizeShareEnabled(setup.shareEnabled),
        names: {
            us: (setup.names?.us ?? "").slice(0, MAX_SIDE_NAME),
            them: (setup.names?.them ?? "").slice(0, MAX_SIDE_NAME),
        },
        rounds: [],
    }
}

function emptyStorage(): BlokStorageV1 {
    return {
        version: 1,
        current: emptyGame(),
        archive: [],
        pendingSessions: [],
        rejectedSessions: [],
        share: null,
    }
}

/* ===================== validation of loaded data ===================== */

function sanitizeTarget(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_TARGET
    const rounded = Math.floor(value)
    return rounded >= 1 ? rounded : DEFAULT_TARGET
}

/**
 * Who dealt first, and whether anybody actually said so.
 *
 * `chosen` is absent on every game written before "Smjer kartanja" existed and
 * reads back as `false` — "the blok is guessing" — which is the truth about
 * those games: nothing on disk recorded a decision, so nothing may be claimed
 * as one. That read-time default is what keeps storage at `v1`.
 *
 * The old `direction` field that used to live here is NOT read into the setup
 * any more; `sanitizeDealDirection` picks it up one level higher, on the game.
 */
function sanitizeDealerSetup(value: unknown): BlokDealerSetup {
    if (typeof value !== "object" || value === null) {
        return { first: "self", chosen: false }
    }
    const setup = value as Partial<BlokDealerSetup>
    return {
        first: DEALER_SEATS.includes(setup.first as BlokDealerSeat) ? setup.first as BlokDealerSeat : "self",
        chosen: setup.chosen === true,
    }
}

/**
 * Which way the deal goes round the table — `"right"` by default (BLOK.md
 * §3.3.2).
 *
 * Also reads the OLD spelling, which is the whole of the "migration": a game
 * written while the direction lived on `dealer` carries `"clockwise"` /
 * `"counterclockwise"`, and dropping those would silently re-seat a table that
 * had explicitly said which way it deals. `"clockwise"` is `"left"` and
 * `"counterclockwise"` is `"right"` — from the scorekeeper's seat at the bottom
 * of the drawn table, dealing to the right traces counter-clockwise on screen.
 * Nothing is rewritten on disk, so `BLOK_STORAGE_KEY` stays `v1`.
 */
function sanitizeDealDirection(value: unknown): BlokDealDirection {
    if (value === "left" || value === "clockwise") return "left"
    if (value === "right" || value === "counterclockwise") return "right"
    return DEFAULT_DEAL_DIRECTION
}

/** The tracker is SHOWN unless the game says otherwise: absent, a typo or a
 *  value from a future build all read as `true`, which is what every game
 *  saved before the switch existed meant. Only a literal `false` hides it. */
function sanitizeShowDealer(value: unknown): boolean {
    return value !== false
}

/** Sharing is OFFERED unless the game says otherwise — same read-time default
 *  as `sanitizeShowDealer`, and for the same reason: every game saved before
 *  the switch existed had the share button, so absent must mean `true` and
 *  storage stays `v1`. Only a literal `false` takes it away. */
function sanitizeShareEnabled(value: unknown): boolean {
    return value !== false
}

/** The direction a game written before this rename stored on `dealer`. Read
 *  as `unknown` on purpose — the field is gone from `BlokDealerSetup`. */
function legacyDealerDirection(dealer: unknown): unknown {
    if (typeof dealer !== "object" || dealer === null) return undefined
    return (dealer as { direction?: unknown }).direction
}

/**
 * How many won games take the series, or `null` for an OPEN-ENDED one.
 *
 * `null` is the default and the normal case. A blok simply IS a series that
 * keeps running — 1:0, 2:1, 3:1 — and the only thing that ends it is the
 * player tapping "Nova igra". Naming a number is the optional extra, not the
 * other way round.
 *
 * So ABSENT reads back as `null`, which is precisely the behaviour of every
 * game written before this field existed: that is what lets the storage
 * version stay at 1 with no migration — nothing on disk is rewritten, the
 * value is derived on read. Anything unusable (a string, NaN, 0, -3) becomes
 * `null` for the same reason: an open series can never surprise anybody, while
 * a garbage number would silently declare a series over or unwinnable.
 */
function sanitizeSeriesTarget(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) return null
    const rounded = Math.floor(value)
    if (rounded < 1) return null
    return rounded > MAX_SERIES_TARGET ? MAX_SERIES_TARGET : rounded
}

/**
 * How a single game ends — "prolaz" (the default since 2026-09-08) or "dosta".
 *
 * Everything that is not exactly `"dosta"` reads back as `"prolaz"`: absent, a
 * typo, a number, a value written by some future build. The DEFAULT FLIPPED on
 * the user's decision (BLOK-HISTORY.md §5.5), and this function is where that
 * flip is felt: a game stored WITHOUT the field — every game saved before the
 * setting shipped — is now played and judged as "prolaz". That is a real
 * change to data already on the phone and it is intended; nothing is rewritten
 * on disk, so the storage version stays at 1 with no migration, and a game
 * that explicitly stored `"dosta"` keeps it.
 *
 * Note the test is on `"dosta"`, not on the default: with the default now
 * being "prolaz", falling back through `=== "prolaz"` would have silently
 * converted every explicitly-chosen "dosta" game as well.
 */
/** Who deals the next GAME: `"next"` unless the game says `"winner"`. Absent,
 *  a typo or a value from a future build all read as `"next"`, which is what
 *  every game saved before the setting existed did — storage stays `v1`. */
function sanitizeNewGameDealer(value: unknown): BlokNewGameDealer {
    return value === "winner" ? "winner" : DEFAULT_NEW_GAME_DEALER
}

function sanitizeGameEndRule(value: unknown): BlokGameEndRule {
    return value === "dosta" ? "dosta" : DEFAULT_GAME_END_RULE
}

function isSide(value: unknown): value is BlokSide {
    return value === "us" || value === "them"
}

function isPoints(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0
}

function sanitizeRound(value: unknown): BlokRound | null {
    if (typeof value !== "object" || value === null) return null
    const r = value as Partial<BlokRound>
    if (typeof r.id !== "string" || r.id === "") return null
    if (!isSide(r.caller)) return null
    if (r.stiglja !== null && !isSide(r.stiglja)) return null
    if (typeof r.cards !== "object" || r.cards === null) return null
    if (typeof r.declarations !== "object" || r.declarations === null) return null
    if (!isPoints(r.cards.us) || !isPoints(r.cards.them)) return null

    const declarations: Record<BlokSide, number[]> = { us: [], them: [] }
    for (const side of BLOK_SIDES) {
        const list = r.declarations[side]
        if (!Array.isArray(list)) return null
        if (!list.every(isPoints)) return null
        declarations[side] = [...list]
    }

    const trump = SUITS.includes(r.trump as BlokSuit) ? (r.trump as BlokSuit) : null

    /* TOLERANT, unlike `stiglja` right above, and that difference is the whole
       reason storage stays v1: every deal written before belot existed has no
       such key at all, and a strict `!== null` test would throw all of them
       away as unreadable. Anything that is not literally "us"/"them" —
       absent, null, a typo, a number — reads as "no belot", which is what
       those deals meant. Nothing is rewritten on disk.

       A stored deal that carries BOTH a belot and a štiglja (only reachable by
       hand-editing localStorage) is kept as-is and left for `safeScore`, which
       shows it as a zero row like every other impossible deal — the engine is
       the one place that judges a deal (BLOK.md §1.1). */
    const belot = isSide(r.belot) ? r.belot : null

    return {
        id: r.id,
        caller: r.caller,
        cards: { us: r.cards.us, them: r.cards.them },
        declarations,
        stiglja: r.stiglja,
        belot,
        trump,
    }
}

/**
 * The tournament link, if this game has one (BLOK-LINK.md §3.2).
 *
 * Strict on every field and `undefined` on the slightest doubt, for one
 * reason: a half-read link is a link that would start PUTting scores at a
 * `uuid` we are not sure of. Losing it costs the player one re-request from
 * the menu; keeping a broken one costs somebody else's match record. The
 * field is optional, so dropping it leaves a perfectly ordinary offline game
 * behind — which is also why the storage version stays at 1.
 */
function sanitizeLink(value: unknown): BlokLink | undefined {
    if (typeof value !== "object" || value === null) return undefined
    const l = value as Partial<BlokLink>
    if (typeof l.uuid !== "string" || l.uuid === "") return undefined
    if (!LINK_STATUSES.includes(l.status as BlokLinkStatus)) return undefined
    if (typeof l.matchId !== "number" || !Number.isFinite(l.matchId)) return undefined
    if (typeof l.usPairId !== "number" || !Number.isFinite(l.usPairId)) return undefined

    /* Only `syncedGames` is read, and that is the whole of the "migration" for
       BLOK-LINK.md §6.1. A link written before the revision carries
       `syncedTotals` holding POINT totals (`{us: 543, them: 149}`); under the
       new meaning that is a series score nobody could ever reach, and believing
       it would suppress pushes forever. The rename makes the stale value
       unreadable rather than merely wrong: it reads as `null`, so the first
       push under the new meaning is guaranteed to go out. Storage stays v1 —
       the extra key is simply ignored on read and gone on the next write. */
    const games = l.syncedGames
    const syncedGames =
        typeof games === "object"
        && games !== null
        && typeof games.us === "number"
        && Number.isFinite(games.us)
        && typeof games.them === "number"
        && Number.isFinite(games.them)
            ? { us: games.us, them: games.them }
            : null

    return {
        uuid: l.uuid,
        status: l.status as BlokLinkStatus,
        // The display fields are cosmetic — an empty tournament name renders a
        // slightly poorer strip, it does not misroute a score — so they are
        // coerced rather than treated as grounds to drop the whole link.
        tournamentUuid: typeof l.tournamentUuid === "string" ? l.tournamentUuid : "",
        tournamentName: typeof l.tournamentName === "string" ? l.tournamentName : "",
        roundNumber:
            typeof l.roundNumber === "number" && Number.isFinite(l.roundNumber) ? l.roundNumber : 0,
        tableNo: typeof l.tableNo === "number" && Number.isFinite(l.tableNo) ? l.tableNo : null,
        matchId: l.matchId,
        usPairId: l.usPairId,
        usPairName: typeof l.usPairName === "string" ? l.usPairName : "",
        themPairName: typeof l.themPairName === "string" ? l.themPairName : "",
        syncedGames,
        // Absent in anything written before §6.1, and `false` is the safe
        // reading of "we do not know": it costs one more push, never a missing
        // one.
        syncedFinal: l.syncedFinal === true,
        pendingSince:
            typeof l.pendingSince === "number" && Number.isFinite(l.pendingSince)
                ? l.pendingSince
                : null,
        /* The signed-out device's only proof that this link is its own
           (BLOK-LINK.md §7.1). The server issues it ONCE, at creation, and
           never repeats it — so dropping it here does not degrade anything, it
           ends the link: every later score push 401s and the strip sits stuck
           behind `pendingSince` with no way back. Read tolerantly like the
           cosmetic strings, absent for signed-in links and for anything
           written before §7. */
        ...(typeof l.writeToken === "string" && l.writeToken !== ""
            ? { writeToken: l.writeToken }
            : {}),
    }
}

/**
 * Sessions closed by "Nova igra" whose upload has not been confirmed yet.
 *
 * Absent in anything written before this feature — hence tolerant rather than
 * strict, and hence still storage version 1. Deduplicated and capped: the list
 * only grows while the device is offline, and an unbounded one written by a
 * broken build must not be the thing that blows the quota. The cap drops the
 * OLDEST ids because the newest session is the one the player just finished
 * and the one they would notice missing.
 */
function sanitizeSessionIds(value: unknown, cap: number): string[] {
    if (!Array.isArray(value)) return []
    const seen = new Set<string>()
    for (const id of value) {
        // 64 is the server's `session_id varchar(64)` (BLOK-HISTORY.md §3.1):
        // anything longer could never have been filed under that id anyway.
        if (typeof id === "string" && id !== "" && id.length <= 64) seen.add(id)
    }
    return [...seen].slice(-cap)
}

function sanitizePendingSessions(value: unknown): string[] {
    return sanitizeSessionIds(value, MAX_PENDING_SESSIONS)
}

/**
 * Series the server refused permanently (BLOK.md, the outbox section).
 *
 * Read exactly like `pendingSessions` — tolerant, deduplicated, capped, oldest
 * dropped first — and absent in everything written before the outbox learned
 * to tell a transient failure from a final one, which is why storage stays v1.
 */
function sanitizeRejectedSessions(value: unknown): string[] {
    return sanitizeSessionIds(value, MAX_REJECTED_SESSIONS)
}

/**
 * The profile record this series was last saved as, and its share token
 * (BLOK-HISTORY.md §5.1/§5.2).
 *
 * Strict, and `null` on the slightest doubt, for the same reason `sanitizeLink`
 * is: a half-read record would make "Podijeli" issue a token against somebody
 * else's `uuid`, or make "Prekini dijeljenje" claim to have revoked a link that
 * is still live. Losing it costs one extra upload — the POST is idempotent on
 * `sessionId` and hands the same `uuid` back — which is the cheapest possible
 * failure here. Optional on read, so storage stays v1 with no migration.
 */
function sanitizeShare(value: unknown): BlokShare | null {
    if (typeof value !== "object" || value === null) return null
    const s = value as Partial<BlokShare>
    if (typeof s.sessionId !== "string" || s.sessionId === "") return null
    if (typeof s.uuid !== "string" || s.uuid === "") return null
    return {
        sessionId: s.sessionId,
        uuid: s.uuid,
        // An unusable token is "not shared", never a token we then print into a
        // link: a broken URL handed to a friend is worse than no link at all.
        token: typeof s.token === "string" && s.token !== "" ? s.token : null,
    }
}

function sanitizeGame(value: unknown): BlokGame | null {
    if (typeof value !== "object" || value === null) return null
    const g = value as Partial<BlokGame>
    if (typeof g.id !== "string" || g.id === "") return null

    const rounds: BlokRound[] = []
    if (Array.isArray(g.rounds)) {
        // A single unreadable deal is dropped rather than taking the game with
        // it — ten good deals are worth more than a strict parse.
        for (const raw of g.rounds) {
            const round = sanitizeRound(raw)
            if (round !== null) rounds.push(round)
        }
    }

    const link = sanitizeLink(g.link)

    return {
        id: g.id,
        // A game saved before sessions existed joins the one shared "legacy"
        // session rather than being dropped or given an id of its own: the
        // first "Nova igra" then files everything that was already on this
        // phone as one record, and nothing is lost. No migration, still v1.
        sessionId:
            typeof g.sessionId === "string" && g.sessionId !== ""
                ? g.sessionId
                : LEGACY_SESSION_ID,
        createdAt: typeof g.createdAt === "number" && Number.isFinite(g.createdAt) ? g.createdAt : Date.now(),
        finishedAt: typeof g.finishedAt === "number" && Number.isFinite(g.finishedAt) ? g.finishedAt : null,
        target: sanitizeTarget(g.target),
        // Missing on every game saved before series had a length, and `null`
        // — an open series — is exactly what those games meant. See
        // `sanitizeSeriesTarget`: no migration, still v1.
        seriesTarget: sanitizeSeriesTarget(g.seriesTarget),
        // Absent reads as "prolaz" since 2026-09-08 (BLOK-HISTORY.md §5.5),
        // which DOES re-judge games stored before the setting existed — see
        // `sanitizeGameEndRule`. Still v1, still nothing rewritten on disk.
        gameEndRule: sanitizeGameEndRule(g.gameEndRule),
        dealer: sanitizeDealerSetup(g.dealer),
        // Absent means "right" — but a game written while the direction still
        // lived on `dealer` is read forward rather than reset, so a table that
        // had said "u lijevo" keeps saying it. Still v1, still nothing
        // rewritten on disk (`sanitizeDealDirection`).
        dealDirection: sanitizeDealDirection(g.dealDirection ?? legacyDealerDirection(g.dealer)),
        // Absent means "carry on round the table" — what every game saved
        // before this setting existed did (`sanitizeNewGameDealer`).
        newGameDealer: sanitizeNewGameDealer(g.newGameDealer),
        // Absent means SHOWN: every game saved before the switch existed had
        // the strip, and only a literal `false` takes it away.
        showDealer: sanitizeShowDealer(g.showDealer),
        // Same rule for the share control — absent means OFFERED, still v1.
        shareEnabled: sanitizeShareEnabled(g.shareEnabled),
        names: {
            us: typeof g.names?.us === "string" ? g.names.us : "",
            them: typeof g.names?.them === "string" ? g.names.them : "",
        },
        rounds,
        // Spread rather than `link: undefined`: an explicit undefined key
        // survives into `JSON.stringify` as a dropped field anyway, but it
        // also makes `"link" in game` true, and the sync hook reads the
        // field's presence as "this game has ever been linked".
        ...(link ? { link } : {}),
    }
}

/* ===================== the module store ===================== */

let cache: BlokStorageV1 | null = null
const listeners = new Set<() => void>()

function readStorage(): BlokStorageV1 {
    try {
        const raw = window.localStorage.getItem(BLOK_STORAGE_KEY)
        if (!raw) return emptyStorage()
        const parsed: unknown = JSON.parse(raw)
        if (typeof parsed !== "object" || parsed === null) return emptyStorage()
        const stored = parsed as Partial<BlokStorageV1>

        const current = stored.current === null ? null : sanitizeGame(stored.current)
        const archive: BlokGame[] = []
        if (Array.isArray(stored.archive)) {
            for (const raw of stored.archive) {
                const game = sanitizeGame(raw)
                if (game !== null) archive.push(game)
            }
        }

        const kept = archive.slice(0, MAX_ARCHIVE)
        const sessionsWithGames = new Set(kept.map((game) => game.sessionId))

        return {
            version: 1,
            current: current === null ? emptyGame() : withFinishedAt(current),
            archive: kept,
            pendingSessions: sanitizePendingSessions(stored.pendingSessions),
            /* Pruned to markers that still have games behind them, unlike
               `pendingSessions`, which is pruned by the uploader instead (a
               marker with nothing behind it is dropped by
               `forgetPendingSession` on the next attempt — there is no attempt
               coming for a rejected one). A rejected series' games can go two
               ways: the player deletes them, or `MAX_ARCHIVE` pushes them out.
               Either way what is left is a line on screen counting evenings
               this device no longer holds, which is worse than no line. */
            rejectedSessions: sanitizeRejectedSessions(stored.rejectedSessions).filter((id) =>
                sessionsWithGames.has(id),
            ),
            share: sanitizeShare(stored.share),
        }
    } catch {
        // Unparseable JSON, a foreign value under our key, or storage that
        // throws on access (private mode, "block all cookies"). Start clean.
        return emptyStorage()
    }
}

function getStorage(): BlokStorageV1 {
    if (cache === null) cache = readStorage()
    return cache
}

function setStorage(next: BlokStorageV1): void {
    cache = next
    try {
        window.localStorage.setItem(BLOK_STORAGE_KEY, JSON.stringify(next))
    } catch {
        // Quota, private mode, disabled storage. The cache above still holds
        // the game for this page load; only a reload loses it.
    }
    for (const listener of listeners) listener()
}

/* ────────────── THE OTHER TABS OF THIS BROWSER — BLOK-HISTORY.md §5.7 ──────────────

   `window`'s `storage` event fires in every OTHER tab of the origin when
   localStorage changes, and never in the tab that wrote. That asymmetry is
   exactly what is wanted: the writing tab has already told its own subscribers
   through `setStorage`, and the reading tabs get the same call a moment later —
   so a deal typed on the phone appears on the tablet lying beside it with no
   reload, no polling and no network whatsoever. It is the cheapest third of
   §5.7 and the only one that works offline.

   THE EVENT IS A SIGNAL, NOT DATA. `event.newValue` is deliberately ignored and
   the store re-reads through `readStorage`, so a value another tab wrote runs
   the same field-by-field validation as one read at startup — which matters
   most precisely when the other tab is an OLDER BUILD writing a shape this one
   no longer accepts. Trusting `newValue` would be the one way to get an
   unvalidated object into the cache.

   Wired with the first subscriber and unwired with the last, so a page that
   never opens the scorepad adds no global listener at all — the same "costs
   nothing until it is used" rule the link and history hooks follow. */

/** Re-read and fan out, whatever another tab did to our key. */
function onStorageEvent(event: StorageEvent): void {
    // `key === null` is `localStorage.clear()`: everything went, ours with it.
    // Any other key is somebody else's business.
    if (event.key !== null && event.key !== BLOK_STORAGE_KEY) return
    cache = null
    // The first listener's `getStorage()` refills the cache; the rest read it.
    for (const listener of listeners) listener()
}

let crossTabWired = false

function startCrossTabSync(): void {
    if (crossTabWired || typeof window === "undefined") return
    crossTabWired = true
    window.addEventListener("storage", onStorageEvent)
}

function stopCrossTabSync(): void {
    if (!crossTabWired || typeof window === "undefined") return
    crossTabWired = false
    window.removeEventListener("storage", onStorageEvent)
}

/** Read-modify-write of the current game, with the derived `finishedAt` restamped. */
function updateCurrent(change: (game: BlokGame) => BlokGame): void {
    const state = getStorage()
    const current = state.current ?? emptyGame()
    setStorage({ ...state, current: withFinishedAt(change(current)) })
}

/* ===================== derived values ===================== */

/* The four functions below are exported as well as used by the hook: the
   archive screen shows the totals and the winner of games that are NOT the
   current one, and `useBlok()` deliberately exposes only the current game's
   derived values. One implementation, so an archived game is added up exactly
   the way it was while it was being played. */

/** `scoreManualDeal`, but a deal that cannot be scored becomes a zero row.
 *
 *  `target` is the GAME's points target and is read only by a belot deal,
 *  which is awarded exactly that many points (BLOK.md §1.2). It is passed in
 *  rather than stored on the round because it is the agreement the game is
 *  played under, not a fact about the deal — §2, nothing derivable stored
 *  twice. */
function safeScore(round: BlokRound, target: number): RoundOutcome {
    try {
        return scoreManualDeal({
            caller: round.caller,
            cards: round.cards,
            declarations: round.declarations,
            stiglja: round.stiglja,
            belot: round.belot,
            target,
        })
    } catch {
        return ZERO_OUTCOME
    }
}

export function scoreRounds(rounds: BlokRound[], target: number): RoundOutcome[] {
    return rounds.map((round) => safeScore(round, target))
}

export function sumTotals(perRound: RoundOutcome[]): Record<BlokSide, number> {
    const totals: Record<BlokSide, number> = { us: 0, them: 0 }
    for (const outcome of perRound) {
        totals.us += outcome.total.us
        totals.them += outcome.total.them
    }
    return totals
}

/* ───────────── HOW A GAME ENDS — THE ONLY PLACE THE RULE LIVES ─────────────

   Two rules, chosen per game (`BlokGame.gameEndRule`, BLOK.md §3.5):

     "prolaz" — crossing the line is not enough on its own. The game is won by
                the side that crosses it in a deal IT CALLED and PASSED (did
                not fall). Cross while falling, or cross on a deal the
                opponents called, and play goes on into the next deal. The
                DEFAULT since 2026-09-08 (BLOK-HISTORY.md §5.5).

     "dosta"  — the game is over as soon as either side is at or past the
                target; the higher total wins. The blok's original behaviour
                and its former default, so this branch is byte-for-byte what
                this function did before the setting existed.

   Both share the tie rule (BLOK.md §1): equal totals at or above the target
   decide nothing, however far past 1001 they are, and another deal is played.

   AND BOTH ARE OVERRULED BY A BELOT (BLOK.md §1.2). A deal in which one side
   showed eight cards of one suit ends the game for that side — that is what
   the user asked for in plain words ("automatski pobjeđuje tu partiju"), and
   it has to be stated HERE rather than left to the arithmetic, because the
   arithmetic does not say it on its own: under "prolaz" a belot held by the
   side that did NOT call would otherwise be ignored (its caller never passed),
   and under "dosta" a side already sitting on a bigger runaway total would
   take the game off the belot. The award of `target` points is what puts the
   number on the scoreboard; this is what makes it the WIN.

   ⚠ The "prolaz" reading — specifically the CALLER-MUST-PASS half — has not
   been confirmed by the user; it is the way bela is played at a table, and it
   is stated in plain Croatian right under the chips in `TargetDialog` so a
   wrong reading is visible on screen rather than buried here. If it is wrong,
   `passedAndWon` below is the one function to change: nothing else in the app
   decides that a game is over — the header, the summary and the history
   upload all read the answer through `winnerOf`. */

/**
 * "Prolaz": did THIS deal end the game, and for whom?
 *
 * `totals` are the running totals AFTER the deal, `caller`/`fell` describe the
 * deal itself (`fell` is `scoreManualDeal`'s, already computed per round).
 * Returns the caller when they crossed the line in their own passed deal and
 * lead, and null when play continues.
 */
function passedAndWon(
    totals: Record<BlokSide, number>,
    target: number,
    caller: BlokSide,
    fell: boolean,
): BlokSide | null {
    if (fell) return null
    const other: BlokSide = caller === "us" ? "them" : "us"
    if (totals[caller] < target) return null
    // A tie decides nothing, and a caller who passed but is still behind on
    // the running total has not won anything either.
    if (totals[caller] <= totals[other]) return null
    return caller
}

/** The first belot in the deals, or null — the game it sits in is over.
 *
 *  "First" and not "last" so that under either rule the game is decided by the
 *  earliest deal that decides it, exactly like the "prolaz" walk: two belots
 *  in one game means the second was written after the game was already won. */
function firstBelot(rounds: BlokRound[]): BlokSide | null {
    for (const round of rounds) {
        if (round.belot !== null) return round.belot
    }
    return null
}

/** The winner, or null while the game is still on. */
function winnerFrom(
    rounds: BlokRound[],
    perRound: RoundOutcome[],
    target: number,
    gameEndRule: BlokGameEndRule,
): BlokSide | null {
    if (rounds.length === 0) return null

    if (gameEndRule === "prolaz") {
        // Deal by deal, because the rule is about the deal that crossed the
        // line, not about the final totals — which is exactly why this branch
        // cannot be expressed as a check on `sumTotals`.
        const running: Record<BlokSide, number> = { us: 0, them: 0 }
        for (let i = 0; i < rounds.length; i += 1) {
            const outcome = perRound[i] ?? ZERO_OUTCOME
            running.us += outcome.total.us
            running.them += outcome.total.them
            // Checked BEFORE the pass test, and inside the walk rather than
            // ahead of it: a belot wins its own deal outright whoever called
            // it, but it must not reach back and steal a game an earlier deal
            // had already won.
            const belot = rounds[i].belot
            if (belot !== null) return belot
            const won = passedAndWon(running, target, rounds[i].caller, outcome.fell)
            if (won !== null) return won
        }
        return null
    }

    /* "Dosta" reads the FINAL totals and has no notion of when a deal
       happened, so the belot check cannot be folded into it — it is asked
       first, in deal order. In practice the two agree anyway (the belot side
       is +target and therefore almost always ahead); this decides the one case
       where they would not, which is a game that had already run far past the
       line without ending. */
    const belot = firstBelot(rounds)
    if (belot !== null) return belot

    const totals = sumTotals(perRound)
    if (totals.us < target && totals.them < target) return null
    if (totals.us === totals.them) return null
    return totals.us > totals.them ? "us" : "them"
}

/** Totals and winner of any game — the current one or one from the archive. */
export function totalsOf(game: BlokGame): Record<BlokSide, number> {
    return sumTotals(scoreRounds(game.rounds, game.target))
}

export function winnerOf(game: BlokGame): BlokSide | null {
    return winnerFrom(
        game.rounds,
        scoreRounds(game.rounds, game.target),
        game.target,
        game.gameEndRule,
    )
}

/** Stamps or clears `finishedAt` so it always agrees with the derived winner —
 *  deleting or editing a deal can un-finish a game that was already over. */
function withFinishedAt(game: BlokGame): BlokGame {
    const winner = winnerOf(game)
    if (winner !== null && game.finishedAt === null) return { ...game, finishedAt: Date.now() }
    if (winner === null && game.finishedAt !== null) return { ...game, finishedAt: null }
    return game
}

function countCalls(rounds: BlokRound[]): Record<BlokSide, number> {
    const counts: Record<BlokSide, number> = { us: 0, them: 0 }
    for (const round of rounds) counts[round.caller] += 1
    return counts
}

/* ===================== the mutations =====================

   Module-level rather than `useCallback`s inside the hook: none of them reads
   anything from the render (they all read the store back through `getStorage`,
   so two taps in one frame cannot clobber each other), their identity is then
   stable for free — no dependency array to get wrong — and they are callable
   from a plain script, which is the only way this file gets exercised at all:
   the frontend has no test runner. */

function addRound(round: Omit<BlokRound, "id">): void {
    updateCurrent((g) => ({ ...g, rounds: [...g.rounds, { ...round, id: newId() }] }))
}

function updateRound(id: string, round: Omit<BlokRound, "id">): void {
    updateCurrent((g) => ({
        ...g,
        rounds: g.rounds.map((existing) => (existing.id === id ? { ...round, id } : existing)),
    }))
}

function removeRound(id: string): void {
    updateCurrent((g) => ({ ...g, rounds: g.rounds.filter((existing) => existing.id !== id) }))
}

function undoLast(): void {
    updateCurrent((g) => (g.rounds.length === 0 ? g : { ...g, rounds: g.rounds.slice(0, -1) }))
}

function rename(side: BlokSide, name: string): void {
    // A blank name is not a name: it resets the side to its translated default
    // rather than leaving an empty header on screen. The cap is the store's,
    // not the dialog's — see `MAX_SIDE_NAME`.
    const trimmed = name.trim().slice(0, MAX_SIDE_NAME)
    updateCurrent((g) => ({ ...g, names: { ...g.names, [side]: trimmed } }))
}

function setTarget(target: number): void {
    updateCurrent((g) => ({ ...g, target: sanitizeTarget(target) }))
}

/**
 * How many won games take the series ("igra se do 2"), or `null` to leave it
 * open — the default, and the state every blok starts in.
 *
 * Written on the CURRENT game only, like `setTarget`. Games already archived
 * in this session keep the number they were played under, which is honest —
 * and harmless, because the series score is counted from their WINNERS, never
 * from this field.
 */
function setSeriesTarget(seriesTarget: number | null): void {
    updateCurrent((g) => ({ ...g, seriesTarget: sanitizeSeriesTarget(seriesTarget) }))
}

/**
 * How this game ends — "prolaz" (the default) or "dosta" (BLOK.md §3.5).
 *
 * Written on the CURRENT game only, like `setTarget`, and `updateCurrent`
 * restamps `finishedAt` on the way out: switching to "prolaz" on a game that
 * had just been won by crossing the line while falling puts that game back in
 * progress in the same frame, which is the honest reading of the setting the
 * player just chose.
 */
function setGameEndRule(gameEndRule: BlokGameEndRule): void {
    updateCurrent((g) => ({ ...g, gameEndRule: sanitizeGameEndRule(gameEndRule) }))
}

function setDealerSetup(dealer: BlokDealerSetup): void {
    updateCurrent((g) => ({ ...g, dealer: sanitizeDealerSetup(dealer) }))
}

/**
 * Which way the deal goes round the table (BLOK.md §3.3.2) — and the one place
 * that decides what a change of it does to the dealer on screen.
 *
 * A PREFERENCE MAY NEVER OVERWRITE WHAT SOMEBODY SAID OUT LOUD, so the answer
 * depends on `dealer.chosen`, which is exactly the distinction that flag exists
 * for:
 *
 *   chosen === false — nobody has named a dealer, so `first` is still the
 *     blok's guess ("self dealt the first deal"). A guess made under the old
 *     direction has no standing under the new one: `first` is left alone and
 *     the whole sequence is RE-DERIVED, so the seat shown as dealing now may
 *     move. That is the setting doing its job.
 *
 *   chosen === true — somebody tapped a seat. The dealer showing right now
 *     stays that dealer: `first` is recomputed backwards under the new
 *     direction (`firstDealerFor`) so `dealerAt` lands on the same seat, and
 *     only the order AFTER them changes. Which is all "we deal the other way"
 *     can honestly mean mid-game.
 *
 * At deal 0 the two branches agree, because there is no rotation to re-derive.
 */
function setDealDirection(direction: BlokDealDirection): void {
    updateCurrent((g) => {
        const next = sanitizeDealDirection(direction)
        if (next === g.dealDirection) return g
        if (!g.dealer.chosen) return { ...g, dealDirection: next }
        const showing = dealerAt(g.dealer.first, g.dealDirection, g.rounds.length)
        return {
            ...g,
            dealDirection: next,
            dealer: {
                ...g.dealer,
                first: firstDealerFor(showing, next, g.rounds.length),
            },
        }
    })
}

/**
 * Who deals the first deal of the NEXT game (BLOK.md §3.3.4).
 *
 * Nothing about the game being played changes: deals inside a game follow
 * `dealDirection` as they always have, and this seat is read only when
 * `newGame()` builds the next one. That is why — unlike `setDealDirection` —
 * this one never touches `dealer.first`: there is no sequence to re-derive.
 */
function setNewGameDealer(mode: BlokNewGameDealer): void {
    updateCurrent((g) => ({ ...g, newGameDealer: sanitizeNewGameDealer(mode) }))
}

/** Show or hide the "Sljedeći dijeli" strip. Purely a display choice: the
 *  dealer sequence keeps being derived either way, so turning the strip back on
 *  shows the seat it would have shown all along. */
function setShowDealer(showDealer: boolean): void {
    updateCurrent((g) => ({ ...g, showDealer: sanitizeShowDealer(showDealer) }))
}

/**
 * Offer the "Podijeli zapisnik" control, or do not (BLOK.md §3.3.3).
 *
 * A display choice HERE and nothing more: this function does not talk to the
 * server and cannot revoke anything, exactly like every other mutation in this
 * file. Turning it off ALSO means revoking a token the player issued
 * themselves, and that half lives with the caller (`BlokPage`), which is where
 * the network is — and where the one exception can be seen: a series linked to
 * a tournament table is published for the organiser under the same token
 * (BLOK-LINK.md §6.2), so that token is never revoked from here or there.
 */
function setShareEnabled(shareEnabled: boolean): void {
    updateCurrent((g) => ({ ...g, shareEnabled: sanitizeShareEnabled(shareEnabled) }))
}

/* ─────────────────────────── the tournament link ───────────────────────────

   Three mutations, all no-ops when there is nothing to act on, because every
   one of them can be reached from an async callback that resolved after the
   user already tore the link down (a slow PUT landing after "Prekini vezu").

   Note what is NOT here: nothing recomputes, re-derives or repairs a link.
   `BlokLink` is the one thing in this file that is not derivable from
   `rounds` — it is a fact about a conversation with a server — so it is only
   ever written by whoever spoke to that server. */

/** Attach (or replace) the link. Used by the request flow and by the poll that
 *  discovers the organiser's decision. */
function setLink(link: BlokLink): void {
    updateCurrent((g) => ({ ...g, link }))
}

/** Merge a few fields into the existing link — the sync hook's `syncedGames`
 *  / `pendingSince` bookkeeping and the status flip on a fatal 409. */
function patchLink(patch: Partial<BlokLink>): void {
    updateCurrent((g) => (g.link ? { ...g, link: { ...g.link, ...patch } } : g))
}

/** Forget the link entirely — the blok goes back to being purely local. */
function clearLink(): void {
    updateCurrent((g) => {
        if (!g.link) return g
        // `delete` on a copy rather than a rest-spread: the field must be
        // ABSENT, not present-and-undefined, so a reloaded game is
        // indistinguishable from one that was never linked.
        const next: BlokGame = { ...g }
        delete next.link
        return next
    })
}

/* ───────────── the profile record and its share link ─────────────
   BLOK-HISTORY.md §5.1/§5.2. Two writes, and neither of them talks to a
   server — exactly like the link mutations above, this file only ever RECORDS
   what a caller was told. `useBlokHistoryUpload` owns the requests.

   Why it lives beside the games rather than inside them: it belongs to the
   SERIES, not to any one game, and a series spans the archive plus whatever is
   being played. It is also the one piece of blok state that survives "Nova
   igra" untouched — the whole point of §5.1 is that the next game lands in the
   same record. */

/** Remember which profile record this series is, and whether it has a link. */
function setShare(share: BlokShare): void {
    setStorage({ ...getStorage(), share })
}

/** Forget the record entirely, or just its token. Called after a revoke and
 *  whenever a stored record turns out to belong to a series we no longer hold. */
function clearShare(): void {
    const state = getStorage()
    if (!state.share) return
    setStorage({ ...state, share: null })
}

/**
 * The next game INSIDE this series — the summary's "Sljedeća partija" (§5.6).
 *
 * It is no longer reachable from the menu: since §5.6 the menu's "Nova igra"
 * closes the series (`resetSession`), and this is offered only where it can be
 * meant — under a game that has been won. The series score keeps running.
 */
function newGame(): void {
    const state = getStorage()
    const playing = state.current
    // An untouched game is not worth archiving — "new game" tapped twice would
    // otherwise fill the archive with empty rows.
    const archive =
        playing !== null && playing.rounds.length > 0
            ? [playing, ...state.archive].slice(0, MAX_ARCHIVE)
            : state.archive
    // The same four people usually keep playing: carry the target, the names,
    // the SESSION and — since BLOK-LINK.md §6.1 — the tournament LINK over,
    // and drop only the deals.
    //
    // The link used to be dropped here, on the reading that one match is one
    // game. §6.1 settles it the other way: a match is scored 2:0, so the match
    // IS the series, and "Sljedeća partija" is its next game at the same table
    // against the same two pairs. Dropping the link after game one would have
    // frozen the organiser's record at 1:0 and sent the player back to ask for
    // an approval they already hold. `newGame` is now exactly parallel to
    // `sessionId`: same series, same match, next game. Only "Nova igra" —
    // which closes the series (§5.6) — ends the link.
    const fresh = emptyGame({
        target: playing?.target,
        names: playing?.names,
        sessionId: playing?.sessionId,
        // "Do koliko se igra" is part of the same agreement as the points
        // target and the names: every game of one session has to agree on
        // it, or the header's "2 : 1" would be measured against a bar that
        // moved between games.
        seriesTarget: playing?.seriesTarget,
        // And so is "dosta / prolaz" — the table does not change how a
        // game ends between two games of the same evening.
        gameEndRule: playing?.gameEndRule,
        // Where the deal picks up (BLOK.md §3.3.4). The rotation carries on
        // round the table from where the finished game left it — and under
        // "Novu partiju miješa: pobjednik" it keeps stepping past the losing
        // pair, so the winners deal. `chosen` travels with it: a seat that was
        // NAMED stays named, so the next game's dealer is still a statement
        // rather than a guess.
        dealer: playing
            ? {
                first: nextGameDealer(
                    dealerAt(playing.dealer.first, playing.dealDirection, playing.rounds.length),
                    playing.dealDirection,
                    playing.newGameDealer,
                    winnerOf(playing),
                ),
                chosen: playing.dealer.chosen,
            }
            : undefined,
        // Four more table conventions that do not change between two games of
        // the same evening.
        dealDirection: playing?.dealDirection,
        newGameDealer: playing?.newGameDealer,
        showDealer: playing?.showDealer,
        shareEnabled: playing?.shareEnabled,
    })
    setStorage({
        ...state,
        // `syncedGames` is carried UNTOUCHED: the series score does not change
        // by starting the next game (the win that just happened is already
        // counted, from the archived game), so whatever the organiser last
        // received is still current and there is nothing to resend.
        current: playing?.link ? { ...fresh, link: playing.link } : fresh,
        archive,
    })
}

/**
 * Throw the current game away WITHOUT archiving it — the menu's "Obriši igru".
 *
 * Deliberately not `newGame()`: that one keeps the game as a record, which is
 * the opposite of what a delete promises. The screen used to do this by
 * removing every deal one by one, which meant N writes to localStorage for one
 * user action, each of them a chance to half-fail. Names and target survive:
 * deleting the scores does not mean the four people got up from the table.
 *
 * The tournament LINK survives too, and that is the opposite of `newGame`
 * above on purpose. "Nova igra" means the next match; "obriši igru" means
 * this match was typed in wrong and is being entered again — same table, same
 * two pairs, same approval. Dropping the link there would make the player ask
 * the organiser a second time for a match they are already approved for, and
 * the corrected score would silently stop reaching the record.
 */
function discardCurrent(): void {
    const state = getStorage()
    const playing = state.current
    // The session survives too, for the same reason the link does: the four
    // people are still at the same table, this one game is being typed in
    // again. Only "Nova igra" ends a series (§5.6).
    const fresh = emptyGame({
        target: playing?.target,
        names: playing?.names,
        sessionId: playing?.sessionId,
        seriesTarget: playing?.seriesTarget,
        gameEndRule: playing?.gameEndRule,
        dealer: playing?.dealer,
        dealDirection: playing?.dealDirection,
        newGameDealer: playing?.newGameDealer,
        showDealer: playing?.showDealer,
        shareEnabled: playing?.shareEnabled,
    })
    setStorage({
        ...state,
        // `syncedGames` is forgotten with the deals. Deleting this game can
        // change the SERIES score — it may have been a game somebody had
        // already won — and the memo of what the organiser last received would
        // then be a claim about a game that no longer exists. Nulling it makes
        // the next push unconditional; if the series score turns out to be
        // unchanged, the organiser receives the same two numbers once more,
        // which costs one request and states the truth either way.
        // `pendingSince` goes for the same reason.
        current: playing?.link
            ? {
                ...fresh,
                link: {
                    ...playing.link,
                    syncedGames: null,
                    syncedFinal: false,
                    pendingSince: null,
                },
            }
            : fresh,
    })
}

function deleteArchived(id: string): void {
    const state = getStorage()
    setStorage({ ...state, archive: state.archive.filter((g) => g.id !== id) })
}

/* ───────────────────────── closing a series ─────────────────────────
   The menu's "Nova igra" — BLOK-HISTORY.md §2.2 and §5.6, which merged the
   old "Resetiraj" into it: they were two names for one act. Three things
   happen, and the ORDER matters more than any of them:

     1. the current game is archived like any finished one — but ONLY if it
        actually has a winner (§5.6). A game still being played is thrown away
        with the rest of the series, because a filed record must never contain
        half a game;
     2. the series is closed: a new `sessionId`, an empty current game;
     3. the games of the old series are removed from the archive — but ONLY
        once the server has them.

   Step 3 is why this function does not delete them itself. `resetSession`
   never talks to the network and never waits for it: locally the reset is
   instantaneous, exactly like starting the next game, because the scorepad must stay
   usable in a bar with no signal (the same inversion `useBlokLinkSync`
   documents). The old games stay in the archive marked by `pendingSessions`,
   and `completeSessionUpload` is what actually erases them, called by whoever
   got a 200.

   The trade, chosen deliberately: a session sent TWICE is harmless — the
   server is idempotent on `sessionId` and answers 200 with the existing
   record — while a session deleted before it arrived is gone forever, off a
   device that by design has no backup. So every doubt resolves towards
   keeping the local copy. */

/**
 * May this game enter a filed record? — the rule of BLOK-HISTORY.md §5.6, in
 * one place so the two sides of it cannot drift.
 *
 * A game counts only when it has deals AND a winner. "Has a winner" is
 * `winnerOf`, i.e. derived live under the game's own end rule, never a stored
 * flag: a game whose deciding deal was later edited away stops being finished
 * the moment it stops being finished, and it must then stop being filed too.
 *
 * Two callers, deliberately the only two: `resetSession` (does closing this
 * series leave anything worth keeping for upload?) and `buildSessionPayload`
 * (which games go into the record). A third caller would be a third opinion.
 */
export function isRecordableGame(game: BlokGame): boolean {
    return game.rounds.length > 0 && winnerOf(game) !== null
}

/** All games belonging to one series, oldest first — the order the history
 *  screen reads them in ("1. partija", "2. partija", …). Unfinished games are
 *  included: this is "what this device holds for the series", and the decision
 *  about what may be FILED is `isRecordableGame`, applied where the record is
 *  built. */
export function gamesInSession(
    /* `Pick` rather than the whole `BlokStorageV1`: these two fields are all it
       has ever read, and saying so lets a caller that already holds the current
       game and the archive (the live-upload hook, whose React dependencies are
       exactly those two identities) ask the question without reaching back into
       the module cache for a `state` it would then not be re-rendered by. Every
       existing caller passes a full state and is unaffected. */
    state: Pick<BlokStorageV1, "current" | "archive">,
    sessionId: string,
): BlokGame[] {
    const games: BlokGame[] = []
    if (state.current && state.current.sessionId === sessionId) games.push(state.current)
    for (const game of state.archive) {
        if (game.sessionId === sessionId) games.push(game)
    }
    // An empty game carries nothing worth a row in the history; it is also
    // what "reset" tapped twice would otherwise upload.
    return games.filter((g) => g.rounds.length > 0).sort((a, b) => a.createdAt - b.createdAt)
}

/**
 * The series score — how many games each side has WON in this session.
 *
 * COUNTED, never stored (BLOK.md §2). It is `winnerOf` over the games of one
 * `sessionId`, the archive and the game in progress alike, so editing or
 * deleting the deal that decided game two moves the 2 : 1 in the header the
 * moment it happens. A running counter kept alongside would be wrong from that
 * edit onwards with nothing on screen to reveal it — the same argument that
 * keeps the totals derived.
 *
 * It is also exactly what the backend does with the uploaded record: it counts
 * `games_us` / `games_them` from each game's `winner` (BLOK-HISTORY.md §3.1),
 * so the number on the phone and the number on the profile cannot disagree.
 */
export function seriesWinsIn(
    state: BlokStorageV1,
    sessionId: string,
): Record<BlokSide, number> {
    const wins: Record<BlokSide, number> = { us: 0, them: 0 }
    for (const game of gamesInSession(state, sessionId)) {
        const won = winnerOf(game)
        if (won !== null) wins[won] += 1
    }
    return wins
}

/**
 * Who has already taken the series, or null while it is still running.
 *
 * ALWAYS null for an open-ended series (`seriesTarget === null`, the default):
 * with no number to reach, nothing declares the evening over except the player
 * tapping "Nova igra". That is not a special case bolted on — it is the blok's
 * original behaviour, and naming a target is what opts into an end.
 */
export function seriesWinnerFrom(
    wins: Record<BlokSide, number>,
    seriesTarget: number | null,
): BlokSide | null {
    if (seriesTarget === null) return null
    if (wins.us >= seriesTarget && wins.us > wins.them) return "us"
    if (wins.them >= seriesTarget && wins.them > wins.us) return "them"
    return null
}

/**
 * Close the current series and open a new one — what the menu's "Nova igra"
 * does since §5.6.
 *
 * `keepForUpload` is the signed-in case: the old games stay put behind a
 * `pendingSessions` marker until the upload confirms. Signed OUT it is false
 * and the games are cleared here and now — there is nowhere for them to go,
 * and BLOK-HISTORY.md §2.2 is explicit that a guest's close still works and
 * sends nothing.
 *
 * AN UNFINISHED GAME IS NOT KEPT — §5.6. The game in progress is archived only
 * when it has a winner; a half-played one is discarded together with the rest
 * of the series, whether or not anything is being uploaded. That is the whole
 * point of the rule: what makes the profile's history worth reading is that a
 * stored series never contains half a game, and keeping the half locally
 * "just in case" would only mean uploading it on the next retry.
 *
 * Returns the id of the series that was just closed, so the caller can hand it
 * to the uploader without re-reading the store.
 */
function resetSession(keepForUpload: boolean): string {
    const state = getStorage()
    const playing = state.current
    const current = playing?.sessionId ?? LEGACY_SESSION_ID

    let archived =
        playing !== null && isRecordableGame(playing)
            ? [playing, ...state.archive].slice(0, MAX_ARCHIVE)
            : state.archive

    // The legacy id groups everything saved before sessions existed — but it
    // is the SAME constant on every device, and the server is idempotent on
    // `sessionId`: a player who used a phone and a tablet would have the
    // second device's batch answered with the first one's record and then
    // delete it locally as "sent". So the legacy series is given a real id at
    // the moment it is closed, stamped onto the games in the same write that
    // marks them pending. Grouping while playing is unchanged; only the name
    // it is filed under becomes unique.
    let closing = current
    if (current === LEGACY_SESSION_ID) {
        const stamped = newId()
        closing = stamped
        archived = archived.map((g) =>
            g.sessionId === LEGACY_SESSION_ID ? { ...g, sessionId: stamped } : g,
        )
    }

    // Nothing to send is not a pending upload: an untouched blok that gets
    // closed must not leave a marker behind that retries forever. And "nothing
    // to send" now means "no FINISHED game" (§5.6) — the same predicate the
    // payload builder uses, so a marker can never outlive a record that would
    // come back empty.
    const hasSomethingToSend = archived.some(
        (g) => g.sessionId === closing && isRecordableGame(g),
    )
    const keep = keepForUpload && hasSomethingToSend

    setStorage({
        version: 1,
        // A brand-new series: `emptyGame` with no session mints one. The
        // tournament link is dropped with it, and this is now the ONLY place
        // that drops one (`newGame` carries it over — BLOK-LINK.md §6.1): a
        // link belongs to one match, a match is one series, and closing the
        // series is the end of both. Sending the final score before the link
        // disappears is the caller's job — `finalizeBlokLink`, called from the
        // "Nova igra" flow, because this function never touches the network.
        // No session id: a brand-new series. Everything else about HOW the
        // table plays survives — target, names, the series length and the
        // end-of-game rule — because the same four people usually start the
        // next evening the same way.
        current: emptyGame({
            target: playing?.target,
            names: playing?.names,
            seriesTarget: playing?.seriesTarget,
            gameEndRule: playing?.gameEndRule,
            // A new evening deals from scratch, and nobody has named anybody
            // yet — `chosen: false`, so the first change of direction is free
            // to re-derive the sequence.
            dealer: { first: "self", chosen: false },
            dealDirection: playing?.dealDirection,
            newGameDealer: playing?.newGameDealer,
            showDealer: playing?.showDealer,
            shareEnabled: playing?.shareEnabled,
        }),
        // Everything of the closing series goes, INCLUDING any unfinished game
        // still sitting in the archive: `keep` only spares the games that are
        // about to be uploaded, and an unfinished one is never among them.
        archive: keep
            ? archived.filter((g) => g.sessionId !== closing || isRecordableGame(g))
            : archived.filter((g) => g.sessionId !== closing),
        pendingSessions: keep
            ? sanitizePendingSessions([
                ...state.pendingSessions.filter((id) => id !== closing),
                closing,
            ])
            : state.pendingSessions.filter((id) => id !== closing),
        // Untouched: a series that was refused for good is refused whatever
        // happens to the series being closed now, and its games stay in the
        // archive behind this marker.
        rejectedSessions: state.rejectedSessions,
        // The record and its link stay ALIVE on the profile — this only drops
        // the phone's pointer at them. A series that has been filed is managed
        // from the profile from that moment on (that is what "Nova igra" means),
        // and keeping a stale `uuid` here would let the next evening's
        // "Podijeli" issue a token against last night's record.
        share: state.share && state.share.sessionId === closing ? null : state.share,
    })
    return closing
}

/** The server has the series: drop its games and its marker. The only place
 *  in this file that deletes a game the player did not ask to delete. */
function completeSessionUpload(sessionId: string): void {
    const state = getStorage()
    setStorage({
        ...state,
        archive: state.archive.filter((g) => g.sessionId !== sessionId),
        pendingSessions: state.pendingSessions.filter((id) => id !== sessionId),
    })
}

/**
 * The server refused this series for good — take it out of the queue, keep
 * every game it holds.
 *
 * THE THIRD OUTCOME, AND WHY THERE HAS TO BE ONE. Until now an upload had two:
 * a 200 (`completeSessionUpload` — the games go) and everything else (kept,
 * retried on the next trigger). "Everything else" is right for a timeout, a
 * 5xx, a captive portal and an expired token, because those all mean "not
 * yet". It is wrong for a 400, which BLOK-HISTORY.md §3.3 emits for a payload
 * that is over one of the record's hard limits: that answer will be identical
 * on every retry until the end of time, so the series would sit at the head of
 * a FIFO queue forever and take every evening behind it down with it.
 *
 * The two obvious ways out are both unacceptable. Retrying anyway blocks the
 * queue; deleting is the one thing this whole subsystem exists to never do —
 * these games are on a device whose premise is that it has no backup. So the
 * marker moves: `pendingSessions` (a promise to send) → `rejectedSessions` (a
 * record that we cannot). The games stay in the archive, the queue behind it
 * moves, and the blok says once, quietly, how many series ended up here.
 */
function rejectSessionUpload(sessionId: string): void {
    const state = getStorage()
    if (!state.pendingSessions.includes(sessionId)) return
    setStorage({
        ...state,
        pendingSessions: state.pendingSessions.filter((id) => id !== sessionId),
        rejectedSessions: sanitizeRejectedSessions([
            ...state.rejectedSessions.filter((id) => id !== sessionId),
            sessionId,
        ]),
    })
}

/** Forget a pending series WITHOUT deleting anything — for a marker with no
 *  games left behind it (they were deleted from the archive by hand). */
function forgetPendingSession(sessionId: string): void {
    const state = getStorage()
    if (!state.pendingSessions.includes(sessionId)) return
    setStorage({
        ...state,
        pendingSessions: state.pendingSessions.filter((id) => id !== sessionId),
    })
}

/** Everything the mutations do, without React. Only for scripts and for the
 *  hook below — screens use `useBlok()`. */
export const blokActions = {
    addRound,
    updateRound,
    removeRound,
    undoLast,
    rename,
    setTarget,
    setSeriesTarget,
    setGameEndRule,
    setDealerSetup,
    setDealDirection,
    setNewGameDealer,
    setShowDealer,
    setShareEnabled,
    newGame,
    discardCurrent,
    deleteArchived,
    resetSession,
    completeSessionUpload,
    rejectSessionUpload,
    forgetPendingSession,
    setLink,
    patchLink,
    clearLink,
    setShare,
    clearShare,
    read: getStorage,
}

/* ===================== the hook ===================== */

export interface BlokStore {
    game: BlokGame
    totals: Record<BlokSide, number>
    perRound: RoundOutcome[]
    winner: BlokSide | null
    calledCount: Record<BlokSide, number>
    /**
     * The series score: games WON per side in this session, counted from the
     * games of `game.sessionId` (archive + the one in progress). Never stored.
     */
    seriesWins: Record<BlokSide, number>
    /** Who has taken the series, or null while it is still running — always
     *  null when no series length was chosen, which is the default. */
    seriesWinner: BlokSide | null
    addRound(round: Omit<BlokRound, "id">): void
    updateRound(id: string, round: Omit<BlokRound, "id">): void
    removeRound(id: string): void
    undoLast(): void
    rename(side: BlokSide, name: string): void
    setTarget(target: number): void
    /** How many won games take the series, or null to leave it open-ended. */
    setSeriesTarget(seriesTarget: number | null): void
    /** How a single game ends: "prolaz" (default) or "dosta" — BLOK.md §3.5. */
    setGameEndRule(gameEndRule: BlokGameEndRule): void
    /** Name the dealer by hand at any point — `chosen: true` is what makes that
     *  a decision the direction setting must not overwrite. */
    setDealerSetup(dealer: BlokDealerSetup): void
    /** Who deals the first deal of the next game — BLOK.md §3.3.4. */
    setNewGameDealer(mode: BlokNewGameDealer): void
    /** Which way the deal goes round the table — "right" (default) or "left".
     *  Keeps a hand-set dealer where it is; see `setDealDirection`. */
    setDealDirection(direction: BlokDealDirection): void
    /** Show or hide the "Sljedeći dijeli" strip — shown by default. */
    setShowDealer(showDealer: boolean): void
    /** Offer the share control, or do not — offered by default (BLOK.md
     *  §3.3.3). Revoking a token the player issued is the caller's half; a
     *  LINKED series' token is never revoked (BLOK-LINK.md §6.2). */
    setShareEnabled(shareEnabled: boolean): void
    newGame(): void
    /** Discard the current game entirely — no archive row, unlike `newGame`. */
    discardCurrent(): void
    archive: BlokGame[]
    deleteArchived(id: string): void
    /**
     * Close this series and start a new one — the menu's "Nova igra"
     * (BLOK-HISTORY.md §2.2, §5.6). Local and instantaneous either way; with
     * `keepForUpload` the FINISHED games wait in the archive until the upload
     * confirms, and an unfinished one is discarded. Returns the closed
     * `sessionId`.
     */
    resetSession(keepForUpload: boolean): string
    /** Series closed by a "Nova igra" whose upload is not confirmed yet, oldest
     *  first — that IS the send order (`useBlokHistoryUpload`). */
    pendingSessions: string[]
    /** Series the server refused for good. Their games are still in `archive`;
     *  nothing will try to send them again — see `rejectSessionUpload`. */
    rejectedSessions: string[]
    /** The tournament link, or null when this blok is purely local (the norm). */
    link: BlokLink | null
    setLink(link: BlokLink): void
    patchLink(patch: Partial<BlokLink>): void
    clearLink(): void
    /**
     * The profile record this series was last saved as, and its share token —
     * BLOK-HISTORY.md §5.1/§5.2. Null until the series has been saved once,
     * and null again the moment "Nova igra" closes it.
     *
     * Filtered to the CURRENT `sessionId`: a record left over from a series
     * this device no longer holds must never be what "Podijeli" writes to.
     */
    share: BlokShare | null
    setShare(share: BlokShare): void
    clearShare(): void
}

/**
 * Just the outbox — the closed series waiting to reach the profile and the
 * ones that never will.
 *
 * A second, deliberately tiny subscriber to the same module store, for the one
 * caller that is mounted on EVERY page (`BlokOutbox`, wired into `App.tsx` so
 * signing in anywhere flushes the queue). `useBlok()` would answer the same
 * question, but it re-scores every deal of the current game and counts the
 * series on each render — work worth doing on the scorepad and worth doing
 * nowhere else. Subscribing rather than reading once is what makes closing a
 * series on /blok start its upload in the same frame.
 */
export function useBlokOutbox(): { pendingSessions: string[]; rejectedSessions: string[] } {
    const [lists, setLists] = useState(() => {
        const state = getStorage()
        return {
            pendingSessions: state.pendingSessions,
            rejectedSessions: state.rejectedSessions,
        }
    })

    useEffect(() => {
        const listener = () => {
            const state = getStorage()
            // Same identities unless the arrays actually changed, so a deal
            // typed on /blok does not re-render every page that mounts this.
            setLists((held) =>
                held.pendingSessions === state.pendingSessions
                && held.rejectedSessions === state.rejectedSessions
                    ? held
                    : {
                        pendingSessions: state.pendingSessions,
                        rejectedSessions: state.rejectedSessions,
                    },
            )
        }
        listeners.add(listener)
        if (listeners.size === 1) startCrossTabSync()
        listener()
        return () => {
            listeners.delete(listener)
            if (listeners.size === 0) stopCrossTabSync()
        }
    }, [])

    return lists
}

export function useBlok(): BlokStore {
    const [state, setState] = useState<BlokStorageV1>(getStorage)

    useEffect(() => {
        const listener = () => setState(getStorage())
        listeners.add(listener)
        // The first subscriber brings the cross-tab bridge up with it, the last
        // one takes it down (§5.7). Counted off `listeners` rather than kept as
        // its own flag so the two can never disagree.
        if (listeners.size === 1) startCrossTabSync()
        // Another instance — or another TAB — may have written between the
        // first render and here.
        listener()
        return () => {
            listeners.delete(listener)
            if (listeners.size === 0) stopCrossTabSync()
        }
    }, [])

    const game = state.current ?? emptyGame()

    const perRound = scoreRounds(game.rounds, game.target)
    const totals = sumTotals(perRound)
    const winner = winnerFrom(game.rounds, perRound, game.target, game.gameEndRule)
    const calledCount = countCalls(game.rounds)
    // Counted on every render, like the totals — the archive of one session is
    // a handful of games, and a stored tally would drift the first time
    // somebody fixes a deal in game two.
    const seriesWins = seriesWinsIn(state, game.sessionId)
    const seriesWinner = seriesWinnerFrom(seriesWins, game.seriesTarget)

    return {
        game,
        totals,
        perRound,
        winner,
        calledCount,
        seriesWins,
        seriesWinner,
        addRound,
        updateRound,
        removeRound,
        undoLast,
        rename,
        setTarget,
        setSeriesTarget,
        setGameEndRule,
        setDealerSetup,
        setDealDirection,
    setNewGameDealer,
        setShowDealer,
        setShareEnabled,
        newGame,
        discardCurrent,
        archive: state.archive,
        deleteArchived,
        resetSession,
        pendingSessions: state.pendingSessions,
        rejectedSessions: state.rejectedSessions,
        link: game.link ?? null,
        setLink,
        patchLink,
        clearLink,
        // Only ever the CURRENT series' record. A stored pointer whose session
        // is gone (a reset that raced a write, storage restored from a backup)
        // reads as "not saved yet", which is the safe answer: the next save
        // mints or re-finds the record by `sessionId` anyway.
        share:
            state.share && state.share.sessionId === game.sessionId ? state.share : null,
        setShare,
        clearShare,
    }
}
