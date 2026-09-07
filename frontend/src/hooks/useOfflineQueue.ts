import { useCallback, useEffect, useMemo, useState } from "react"
import { updateMatchScore } from "../api/round"
import { setPairPaid } from "../api/tournaments"
import {
    addMatchDrink,
    markMatchPaid,
    markMatchUnpaid,
    removeMatchDrink,
} from "../api/cjenik"
import { showError } from "../toaster"
import { t } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   useOfflineQueue — one durable, ordered queue for the writes the organiser
   makes at the table.

   The whole problem this solves: the tournament is run from a phone, in a
   café or a hall, on Wi-Fi that comes and goes. A score typed while the
   connection is down must not be lost, and the retry that follows must not
   apply it twice. So every queued operation carries an `opId` (a UUID) that
   goes out as `X-Client-Op-Id`; the backend's IdempotencyService remembers
   it and answers a replay with the stored response instead of re-running
   the mutation.

   ONE queue, not one per component: the drain is strictly ordered across
   every kind, so two edits to the same match land in the order the
   organiser made them. That only works if there is a single drain loop —
   hence the module-level store below rather than per-hook state.

   Deliberately NOT queued: round draw, round finish, tournament
   start/finish/reset, pair replace. Those reorder global state (who plays
   whom, who is eliminated) and replaying them against a server that has
   moved on needs real conflict resolution, not a replay marker. Offline
   they fail with the usual toast and the organiser reconnects first.

   ONE queue per TAB, one key for all of them: `bela:opq:v1` is shared, and
   an organiser with the bracket open in one tab and the bill in another is
   ordinary. Each tab keeps its own in-memory copy and its own drain loop,
   so the two have to be reconciled or they corrupt each other: a tab that
   overwrote the key with its own snapshot would resurrect ops the other tab
   had already drained, and the pill would count work that no longer exists.
   Two rules keep them honest, both below:

     - every write is a read-modify-write against the CURRENT stored value
       (`mergeWithStored`) — a tab may only add what it just created and
       remove what it just settled, never republish its stale view of the
       rest;
     - a `storage` event reconciles in the other direction — ops that
       appeared are adopted, ops that vanished were drained by the other tab
       and are settled locally so `_pending` clears here too.

   No cross-tab lock. Both tabs may send the same op; the backend's
   IdempotencyService claims it once and answers the loser with a transient
   409 (OPERATION_IN_PROGRESS) or replays the stored response, so a race
   costs one retry and can never double-apply. See the note on
   `reconcileFromStorage` for why a lease would be the bigger, worse change.
   ────────────────────────────────────────────────────────────────────── */

const STORAGE_KEY = "bela:opq:v1"

/** Give up auto-retrying after this many failed attempts and surface it. */
const MAX_ATTEMPTS = 8

/** Backoff for the slow retry timer: 2 s, 4 s, 8 s … capped at 60 s. */
const RETRY_BASE_MS = 2_000
const RETRY_MAX_MS = 60_000

/** Payload shape per operation kind. */
type PayloadMap = {
    matchScore: { roundId: number; matchId: number; score1: number | null; score2: number | null }
    billAddDrink: { matchId: number; priceId: number; quantity: number }
    billRemoveDrink: { matchId: number; drinkId: number }
    billPay: { matchId: number }
    billUnpay: { matchId: number }
    pairPaid: { pairId: number; paid: boolean }
}

export type QueueKind = keyof PayloadMap

type OpOf<K extends QueueKind> = {
    opId: string
    tournamentUuid: string
    kind: K
    payload: PayloadMap[K]
    createdAt: number
    attempts: number
}

/** A mapped union so `switch (op.kind)` narrows `op.payload` properly. */
export type QueuedOp = { [K in QueueKind]: OpOf<K> }[QueueKind]

export type QueueState = {
    /** Everything still waiting, oldest first. */
    ops: QueuedOp[]
    /** True while the drain loop is running. */
    syncing: boolean
    /** navigator.onLine, kept current by the online/offline events. */
    online: boolean
    /**
     * The head of the queue has failed MAX_ATTEMPTS times. Auto-retry stops
     * so the app doesn't loop forever in the background; the indicator says
     * so and offers a manual retry.
     */
    stuck: boolean
}

/**
 * Why an operation left the queue without this tab holding a server payload
 * for it. Both mean the same thing to a subscriber — "the optimistic row on
 * screen is no longer backed by anything local, resync" — and it is only
 * split for logging and for the toast, which belongs to `rejected` alone.
 */
export type DropReason =
    /** The server refused it on the merits; the organiser has been told. */
    | "rejected"
    /** Another tab drained it. The server HAS it; we just never saw the body. */
    | "settledElsewhere"

/** What the drain reports back per operation. */
export type OpOutcome =
    | { status: "ok"; op: QueuedOp; data: unknown }
    | { status: "dropped"; op: QueuedOp; reason?: DropReason }

/* ===================== storage ===================== */

/*
 * Every localStorage touch is wrapped: private mode, "block all cookies"
 * and a full quota all throw. When it does, the queue keeps working purely
 * in memory for this tab — degraded (a reload loses it) but never broken.
 *
 * The blob stays exactly what v1 shipped: a BARE ARRAY of ops, no envelope,
 * no version field, no writer id. Nothing here needed one, so a queue left
 * in a user's localStorage by the previous build loads unchanged and a tab
 * still running that build stays interoperable with a tab running this one.
 */

/**
 * The exact string this tab last put in the key. A `storage` event carrying
 * it is our own write echoed back (or an identical one from elsewhere) and
 * has nothing to reconcile. Browsers do not fire the event in the writing
 * document, so this is belt-and-braces — but the drain writes often enough
 * that a stray echo costing a full reconcile is worth one comparison.
 */
let lastWrittenRaw: string | null = null

/**
 * Ops as stored RIGHT NOW, or `null` when localStorage is unreachable.
 *
 * The null is the whole point of the signature: "unreadable" must never be
 * mistaken for "readable and empty", because the merge below reads an empty
 * store as "another tab drained everything" and would throw the organiser's
 * queue away on a device that simply blocks storage.
 */
function readStored(): QueuedOp[] | null {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        // Anything that doesn't look like an op is dropped rather than fed
        // to the sender — a half-written or older-format entry must not
        // wedge the drain. Extra unknown fields are tolerated on purpose:
        // a future build may stamp more onto an op and this one still reads
        // its queue.
        return parsed.filter(isQueuedOp)
    } catch {
        return null
    }
}

function saveStored(next: QueuedOp[]) {
    try {
        if (next.length === 0) {
            window.localStorage.removeItem(STORAGE_KEY)
            lastWrittenRaw = null
        } else {
            const raw = JSON.stringify(next)
            window.localStorage.setItem(STORAGE_KEY, raw)
            lastWrittenRaw = raw
        }
    } catch {
        /* storage unavailable — the in-memory queue is all we get */
    }
}

function idsOf(list: QueuedOp[]): Set<string> {
    return new Set(list.map((o) => o.opId))
}

/**
 * One order for every tab: oldest first, by the moment the organiser made
 * the change. The sort is stable, so ops sharing a millisecond keep the
 * order they were merged in — which within a tab is the order they were
 * typed in, and that is the order the drain must preserve.
 */
function orderOps(list: QueuedOp[]): QueuedOp[] {
    return [...list].sort((a, b) => a.createdAt - b.createdAt)
}

/**
 * The read-modify-write at the heart of the multi-tab story.
 *
 * `prev` is what this tab held before the mutation, `next` what it wants to
 * hold after. The difference between them is the only thing this tab is
 * entitled to assert; everything else is answered by the store:
 *
 *   - an id this tab just ADDED goes in — no other tab can know it yet;
 *   - an id this tab just REMOVED (sent, dropped, discarded) comes out;
 *   - any other id survives only if it is still in the store. If it is gone,
 *     the other tab drained it and republishing it here would resurrect it.
 *
 * For ids held on both sides the in-memory copy wins: the payloads are
 * identical (an op is immutable once created) and `attempts` is this tab's
 * own retry bookkeeping, which its own backoff is about to read.
 *
 * With storage unreachable there is nothing to merge against and `next`
 * stands as-is.
 */
function mergeWithStored(prev: QueuedOp[], next: QueuedOp[]): QueuedOp[] {
    const stored = readStored()
    if (stored === null) return next

    const prevIds = idsOf(prev)
    const nextIds = idsOf(next)
    const storedIds = idsOf(stored)

    // Stored order first so adopted ops keep their relative places, then our
    // own copies overwrite in situ (a Map keeps the original slot on re-set).
    const byId = new Map<string, QueuedOp>()
    for (const op of stored) byId.set(op.opId, op)
    for (const op of next) byId.set(op.opId, op)

    const keep: QueuedOp[] = []
    for (const [id, op] of byId) {
        if (prevIds.has(id) && !nextIds.has(id)) continue    // we just settled it
        if (nextIds.has(id) && !prevIds.has(id)) {           // we just created it
            keep.push(op)
            continue
        }
        if (!storedIds.has(id)) continue                     // drained by another tab
        keep.push(op)
    }
    return orderOps(keep)
}

const KNOWN_KINDS: QueueKind[] = [
    "matchScore", "billAddDrink", "billRemoveDrink", "billPay", "billUnpay", "pairPaid",
]

function isQueuedOp(value: unknown): value is QueuedOp {
    if (typeof value !== "object" || value === null) return false
    const o = value as Record<string, unknown>
    return typeof o.opId === "string"
        && typeof o.tournamentUuid === "string"
        && typeof o.kind === "string"
        && KNOWN_KINDS.includes(o.kind as QueueKind)
        && typeof o.payload === "object" && o.payload !== null
        && typeof o.createdAt === "number"
        && typeof o.attempts === "number"
}

/** crypto.randomUUID is missing in older Android WebViews and on http:// origins. */
export function newOpId(): string {
    try {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID()
        }
    } catch {
        /* fall through to the manual id */
    }
    return `op-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e12).toString(36)}`
}

/* ===================== failure classification ===================== */

/** HTTP status of an axios-shaped rejection, or null for a network error. */
function statusOf(err: unknown): number | null {
    if (typeof err !== "object" || err === null) return null
    const res = (err as { response?: { status?: unknown } }).response
    if (!res || typeof res.status !== "number") return null
    return res.status
}

/** Shape of a bare machine code: SCREAMING_SNAKE, nothing else. */
const CODE_SHAPE = /^[A-Z][A-Z0-9_]*$/

/**
 * The machine-readable code the backend put in the error body, or null when
 * the body carries none.
 *
 * The backend answers in two wire shapes and both have to be understood:
 *
 *  - the `ApiError` envelope (`errors/ApiError.java`) — a JSON object whose
 *    `code` field is the machine code ("OPERATION_IN_PROGRESS", "CONFLICT",
 *    "NOT_FOUND"); axios parses it into an object;
 *  - a bare code as the WHOLE body (`errors/ApiCodes.java`,
 *    `ClientErrorException("ALREADY_CLAIMED", 409)`) — "UNPAID_REQUIRED",
 *    "ALREADY_FINISHED", "INSUFFICIENT_PAIRS" … which axios hands back as a
 *    plain string because it is not valid JSON.
 *
 * Anything else — free prose, an HTML page, an empty body — is "no code",
 * and the caller treats a codeless conflict as transient.
 */
function errorCodeOf(err: unknown): string | null {
    if (typeof err !== "object" || err === null) return null
    const data = (err as { response?: { data?: unknown } }).response?.data
    if (typeof data === "string") {
        const bare = data.trim()
        return CODE_SHAPE.test(bare) ? bare : null
    }
    if (typeof data === "object" && data !== null) {
        const code = (data as { code?: unknown }).code
        if (typeof code === "string" && CODE_SHAPE.test(code.trim())) return code.trim()
    }
    return null
}

/**
 * 409s that mean "ask again in a moment", not "no".
 *
 * `IdempotencyService` answers OPERATION_IN_PROGRESS on two purely transient
 * paths: a claim race it lost where the winner's row is not yet readable,
 * and a replay that lands on a claim row still carrying the in-progress
 * sentinel. Both clear by themselves; the op must stay queued and be
 * retried, because the mutation may never have run at all.
 */
const TRANSIENT_CONFLICT_CODES = new Set(["OPERATION_IN_PROGRESS"])

/**
 * True when the operation is genuinely invalid and will fail identically
 * forever: a 4xx other than 408 (timeout), 429 (rate limit) and the
 * transient 409s below. Those, every 5xx, and "no response at all" are
 * transient and stay queued.
 *
 * 401 is deliberately NOT permanent-dropped here: http.ts already refreshes
 * the token and bounces to the login page, and dropping the organiser's
 * scores because their token blinked would be the worst possible outcome.
 *
 * 409 is classified by the CODE in the body, never by the status alone. A
 * conflict carrying a business code ("UNPAID_REQUIRED", "ALREADY_FINISHED",
 * "ALREADY_REGISTERED", "INSUFFICIENT_PAIRS", "TOURNAMENT_ALREADY_STARTED",
 * "CONFLICT" from a domain guard clause …) is a verdict on the merits and is
 * dropped; a conflict carrying OPERATION_IN_PROGRESS, or none at all, is the
 * idempotency layer telling us to come back — dropping it would delete the
 * organiser's score with only a toast as evidence.
 */
function isPermanentFailure(err: unknown): boolean {
    const status = statusOf(err)
    if (status === null) return false
    if (status === 401) return false
    if (status === 408 || status === 429) return false
    if (status === 409) {
        const code = errorCodeOf(err)
        if (code === null) return false
        return !TRANSIENT_CONFLICT_CODES.has(code)
    }
    return status >= 400 && status < 500
}

/** Human name for an operation, used when one has to be dropped. Resolved at
 *  call time (not module load) so it follows the active language. */
function describe(op: QueuedOp): string {
    return t(`tournament.sync.op.${op.kind}`)
}

/* ===================== the store ===================== */

type StateListener = (s: QueueState) => void
type OutcomeListener = (o: OpOutcome) => void

let ops: QueuedOp[] = []
let loaded = false
let syncing = false
let stuck = false
let online = true
let draining = false
/** A flush was asked for while one was running — run one more pass after. */
let rerun = false
let retryTimer: ReturnType<typeof setTimeout> | null = null
let consecutiveFailures = 0
let wired = false

const stateListeners = new Set<StateListener>()
const outcomeListeners = new Set<OutcomeListener>()

function snapshot(): QueueState {
    return { ops, syncing, online, stuck }
}

function emit() {
    const s = snapshot()
    stateListeners.forEach((fn) => fn(s))
}

/**
 * Commit a new queue: merge the intent against the store, keep the merged
 * result in memory, write it back, tell the subscribers. `ops` is only ever
 * assigned here and in `reconcileFromStorage`, so no closure anywhere needs
 * to capture the array — everything reads the module binding at call time.
 */
function persist(next: QueuedOp[]) {
    const prev = ops
    const merged = mergeWithStored(prev, next)
    ops = merged
    saveStored(merged)
    emit()

    /* The merge may have dropped ops this tab still meant to keep: another
       tab drained them between our last look and this write. Removing them
       is right — they are done — but nothing has told the page yet, and a
       row whose optimistic overlay just vanished would sit on stale server
       data until the next poll. The `storage` event normally reports these
       first (and then finds nothing left to do); this covers the race where
       the write got here before the event did. */
    const mergedIds = idsOf(merged)
    const nextIds = idsOf(next)
    for (const op of prev) {
        if (!nextIds.has(op.opId) || mergedIds.has(op.opId)) continue
        outcomeListeners.forEach((fn) => fn({ status: "dropped", op, reason: "settledElsewhere" }))
    }
}

/**
 * Take one operation out of the queue and report it, but only if it is
 * still ours to settle: between the send starting and its answer arriving,
 * another tab may have drained the very same op and the reconcile may have
 * already reported it. Returns false in that case, so the caller does not
 * toast a drop twice or patch a row from an answer nobody is waiting for.
 */
function settle(op: QueuedOp, outcome: OpOutcome): boolean {
    if (!ops.some((x) => x.opId === op.opId)) return false
    persist(ops.filter((x) => x.opId !== op.opId))
    outcomeListeners.forEach((fn) => fn(outcome))
    return true
}

/**
 * Send one operation. Everything goes out `silent` — the queue's own
 * indicator is the feedback, and a drained batch of ten scores must not
 * stack ten green toasts.
 */
async function send(op: QueuedOp): Promise<unknown> {
    switch (op.kind) {
        case "matchScore":
            return await updateMatchScore(
                op.tournamentUuid, op.payload.roundId, op.payload.matchId,
                { score1: op.payload.score1, score2: op.payload.score2 },
                { silent: true, opId: op.opId },
            )
        case "billAddDrink":
            return await addMatchDrink(
                op.tournamentUuid, op.payload.matchId, op.payload.priceId, op.payload.quantity,
                { opId: op.opId },
            )
        case "billRemoveDrink":
            return await removeMatchDrink(
                op.tournamentUuid, op.payload.matchId, op.payload.drinkId,
                { opId: op.opId },
            )
        case "billPay":
            return await markMatchPaid(op.tournamentUuid, op.payload.matchId, { silent: true, opId: op.opId })
        case "billUnpay":
            return await markMatchUnpaid(op.tournamentUuid, op.payload.matchId, { silent: true, opId: op.opId })
        case "pairPaid":
            return await setPairPaid(
                op.tournamentUuid, op.payload.pairId, op.payload.paid,
                { silent: true, opId: op.opId },
            )
    }
}

function scheduleRetry() {
    if (retryTimer !== null) return
    if (ops.length === 0) return
    const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.min(consecutiveFailures, 5))
    retryTimer = setTimeout(() => {
        retryTimer = null
        void flush()
    }, delay)
}

function clearRetry() {
    if (retryTimer !== null) {
        clearTimeout(retryTimer)
        retryTimer = null
    }
}

/**
 * Drain the queue head-first, in strict order, stopping on the FIRST
 * failure rather than skipping ahead. Order is the point: two scores typed
 * for the same table must reach the server in the order they were typed,
 * and a bill "pay" must never overtake the drink it is paying for.
 */
async function flush(): Promise<void> {
    if (draining) {
        rerun = true
        return
    }
    if (ops.length === 0) return
    if (typeof navigator !== "undefined" && !navigator.onLine) {
        // Nothing to try. The `online` event re-enters here.
        return
    }
    draining = true
    stuck = false
    syncing = true
    emit()
    try {
        while (ops.length > 0) {
            const op = ops[0]
            if (op.attempts >= MAX_ATTEMPTS) {
                // Repeatedly failing without a verdict from the server (a
                // captive portal answering 5xx, a dead backend). Stop and say
                // so instead of hammering forever in the background.
                stuck = true
                break
            }
            try {
                const data = await send(op)
                consecutiveFailures = 0
                settle(op, { status: "ok", op, data })
            } catch (err) {
                if (isPermanentFailure(err)) {
                    // The server rejected it on the merits — a match that no
                    // longer exists, a bill already locked. Retrying can only
                    // fail the same way, so drop it and TELL the organiser
                    // what was lost rather than silently swallowing it.
                    if (settle(op, { status: "dropped", op, reason: "rejected" })) {
                        showError(
                            t("tournament.sync.dropped.title"),
                            t("tournament.sync.dropped.description", { what: describe(op) }),
                        )
                    }
                    continue
                }
                if (!ops.some((x) => x.opId === op.opId)) {
                    // It left the queue while we were sending: another tab
                    // drained it and the `storage` reconcile has already
                    // reported it here. The failure we just caught was most
                    // likely that tab winning the idempotency claim, so
                    // there is nothing to count and nothing to wait for.
                    continue
                }
                // Transient — bump the attempt counter and stop the drain so
                // the ops behind this one keep their place in line.
                consecutiveFailures += 1
                persist(ops.map((x) => (x.opId === op.opId ? { ...x, attempts: x.attempts + 1 } : x)))
                break
            }
        }
    } finally {
        draining = false
        syncing = false
        emit()
        if (rerun) {
            rerun = false
            void flush()
        } else if (ops.length > 0 && !stuck) {
            scheduleRetry()
        }
    }
}

/**
 * Bring this tab's queue back in line with what is in the key now, after
 * ANOTHER tab wrote it.
 *
 * Two directions, and both matter:
 *
 *   - ops in the store this tab has never seen were enqueued next door.
 *     Adopt them: the pill should count the organiser's outstanding work,
 *     not one tab's share of it, and if that tab is closed a moment later
 *     this one is the only thing left that can send them.
 *   - ops this tab holds that are gone from the store were drained next
 *     door. Settle them exactly as a confirmed send does — out of `ops`, an
 *     outcome to the subscribers — so the row stops rendering `_pending`
 *     and refetches the server's copy. Before this, the pill counted
 *     phantom work forever and the rows stayed grey until a reload.
 *
 * The outcome is `dropped` / `settledElsewhere` rather than `ok` because
 * this tab has no response body to hand over: `ok` carries the server's
 * MatchDto/MatchBillDto and its subscribers read it. `dropped` already
 * means "resync from the server", which is precisely the right instruction
 * — the server is the tab that has the truth.
 *
 * WHY NO LEASE. Nothing here stops both tabs sending the same op at once,
 * and it does not need to: every op goes out under `X-Client-Op-Id` and the
 * backend's IdempotencyService claims it with INSERT … ON CONFLICT DO
 * NOTHING, so the winner runs the mutation once and the loser gets either a
 * transient OPERATION_IN_PROGRESS (retried, then confirmed here by the very
 * reconcile above) or the stored response replayed verbatim. A double send
 * therefore costs one wasted request, never a double-applied score. An
 * `op.claimedBy` + TTL lease would buy nothing in exchange for a changed
 * on-disk op shape, a clock to trust, and a new failure mode — a tab killed
 * mid-lease wedging the queue until the TTL expires. Smaller change wins.
 */
function reconcileFromStorage() {
    const stored = readStored()
    if (stored === null) return
    if (!loaded) {
        ops = orderOps(stored)
        loaded = true
        emit()
        return
    }

    const storedIds = idsOf(stored)
    const mineById = new Map(ops.map((o) => [o.opId, o] as const))
    const settledElsewhere = ops.filter((o) => !storedIds.has(o.opId))
    const adopted = stored.filter((o) => !mineById.has(o.opId))
    if (settledElsewhere.length === 0 && adopted.length === 0) return

    // Our own copy wins where both hold the op — same reasoning as in
    // mergeWithStored: `attempts` is this tab's backoff bookkeeping.
    ops = orderOps(stored.map((o) => mineById.get(o.opId) ?? o))
    if (ops.length === 0) {
        consecutiveFailures = 0
        stuck = false
        clearRetry()
    }
    // State first, outcomes second: a subscriber that resyncs on the outcome
    // must already see the op gone from `pending`, or it would repaint the
    // optimistic row it is trying to replace.
    emit()
    for (const op of settledElsewhere) {
        outcomeListeners.forEach((fn) => fn({ status: "dropped", op, reason: "settledElsewhere" }))
    }
    // Adopted work is somebody else's to send first — that tab flushed the
    // moment it enqueued. Take it on the ordinary retry timer instead of
    // racing: if the other tab is alive it will be gone before the timer
    // fires, and if it is not, this tab sends it a couple of seconds later.
    if (adopted.length > 0 && ops.length > 0 && !stuck) scheduleRetry()
}

function onOnline() {
    online = true
    consecutiveFailures = 0
    stuck = false
    clearRetry()
    emit()
    void flush()
}

function onOffline() {
    online = false
    emit()
}

// Coming back to the tab is the other moment worth retrying at: a phone
// that was asleep in a pocket never fires an `online` event.
function onVisibilityChange() {
    if (document.hidden) return
    online = typeof navigator === "undefined" ? true : navigator.onLine
    // A tab that was hidden for an hour may have missed nothing — `storage`
    // fires in background tabs too — but it costs one read to be sure.
    reconcileFromStorage()
    emit()
    if (online) void flush()
}

function onStorage(e: StorageEvent) {
    if (e.storageArea && e.storageArea !== window.localStorage) return
    // key === null is localStorage.clear(); anything else is another key.
    if (e.key !== null && e.key !== STORAGE_KEY) return
    if (e.newValue !== null && e.newValue === lastWrittenRaw) return
    reconcileFromStorage()
}

/**
 * Attach the window listeners once, on first use.
 *
 * These four are deliberately never removed: they belong to the module, not
 * to any component. The queue has to keep draining while the organiser
 * navigates between pages, so unmounting the last `useOfflineQueue` must not
 * unhook the drain — a queued score would then sit there until something
 * else happened to mount. The per-component subscription IS removed, in the
 * hook's effect cleanup below; that is the listener tied to a lifetime.
 */
function ensureWired() {
    if (wired) return
    wired = true
    if (typeof window === "undefined") return
    online = typeof navigator === "undefined" ? true : navigator.onLine
    ops = orderOps(readStored() ?? [])
    loaded = true
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    window.addEventListener("storage", onStorage)
    document.addEventListener("visibilitychange", onVisibilityChange)
}

function enqueueOp<K extends QueueKind>(
    tournamentUuid: string,
    kind: K,
    payload: PayloadMap[K],
): QueuedOp {
    ensureWired()
    if (!loaded) {
        ops = orderOps(readStored() ?? [])
        loaded = true
    }
    const op = {
        opId: newOpId(),
        tournamentUuid,
        kind,
        payload,
        createdAt: Date.now(),
        attempts: 0,
    } as QueuedOp
    persist([...ops, op])
    clearRetry()
    // Online: go now, so the common case still feels instant. Offline: it
    // simply waits for the `online` event.
    void flush()
    return op
}

/** Manual "try again" for a stuck queue. */
function retryNow() {
    consecutiveFailures = 0
    stuck = false
    clearRetry()
    persist(ops.map((x) => ({ ...x, attempts: 0 })))
    void flush()
}

/**
 * Throw away everything still queued. Only for the explicit "odustani"
 * escape hatch on a permanently stuck queue — never call it on a failure.
 */
function discardAll() {
    clearRetry()
    consecutiveFailures = 0
    stuck = false
    persist([])
}

/** Subscribe to per-operation outcomes. Returns an unsubscribe function. */
export function subscribeToOutcomes(fn: OutcomeListener): () => void {
    ensureWired()
    outcomeListeners.add(fn)
    return () => { outcomeListeners.delete(fn) }
}

/* ===================== the hook ===================== */

/** One frozen empty array for every hook with no tournament, so "nothing
 *  pending" never looks like a change to a memo downstream. */
const NO_OPS: QueuedOp[] = []

/** `snapshot()` builds a fresh object every emit, but the fields inside it
 *  usually did not move — an online/offline tick reuses the very same `ops`
 *  array. Comparing them keeps a queue-unrelated emit from re-rendering
 *  every subscriber. */
function sameState(a: QueueState, b: QueueState): boolean {
    return a.ops === b.ops
        && a.syncing === b.syncing
        && a.online === b.online
        && a.stuck === b.stuck
}

/**
 * Read the queue and push work into it.
 *
 * `tournamentUuid` scopes the `pending*` selectors — the queue itself is
 * global (one drain loop per tab, reconciled across tabs through the shared
 * key) but a page only cares about its own tournament's operations.
 *
 * Everything handed back is memoised: `pending` feeds two Maps in
 * useTournamentData and a per-match filter in MatchBillButton, and a fresh
 * array on every render would rebuild all of them for nothing.
 */
export function useOfflineQueue(tournamentUuid: string | undefined) {
    ensureWired()
    const [state, setState] = useState<QueueState>(snapshot)

    useEffect(() => {
        const listener: StateListener = (s) => setState((prev) => (sameState(prev, s) ? prev : s))
        stateListeners.add(listener)
        // Re-read once on mount: the store may have been hydrated by another
        // component before this one subscribed.
        setState((prev) => {
            const s = snapshot()
            return sameState(prev, s) ? prev : s
        })
        // A queue left behind by the previous session — or by another tab
        // that was closed mid-drain — goes out as soon as something mounts,
        // without waiting for an `online` event that will never fire on an
        // already-connected device.
        reconcileFromStorage()
        void flush()
        // The subscription is the one listener with a component's lifetime,
        // and it is removed here. The module's window listeners outlive every
        // mount on purpose — see ensureWired.
        return () => { stateListeners.delete(listener) }
    }, [])

    /* `state.ops` only changes identity when the queue really changed (a
       plain online/offline emit reuses the same array), so keying on it is
       enough to keep `pending` referentially stable across the renders that
       matter — useTournamentData builds two Maps from it on every change. */
    const mine = useMemo(
        () => (tournamentUuid
            ? state.ops.filter((o) => o.tournamentUuid === tournamentUuid)
            : NO_OPS),
        [state.ops, tournamentUuid],
    )

    const enqueue = useCallback(<K extends QueueKind>(kind: K, payload: PayloadMap[K]) => {
        if (!tournamentUuid) return null
        return enqueueOp(tournamentUuid, kind, payload)
    }, [tournamentUuid])

    return useMemo(() => ({
        /** Operations still queued for THIS tournament, oldest first. */
        pending: mine,
        /** Total still queued across every tournament — what the pill counts. */
        pendingCount: state.ops.length,
        syncing: state.syncing,
        online: state.online,
        stuck: state.stuck,
        enqueue,
        retryNow,
        discardAll,
    }), [mine, state.ops, state.syncing, state.online, state.stuck, enqueue])
}
