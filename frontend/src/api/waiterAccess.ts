import { http } from "./http"
import type { MatchBillDto } from "./cjenik"

/* ──────────────────────────────────────────────────────────────────────────
   Konobarski pristup — "waiter access".

   An organiser invites named venue staff, each getting their OWN four-letter
   code. Redeeming a code gets an opaque token that unlocks the bills of ONE
   tournament — no tournament editing, no pair board — and, for a credential
   invited with `canEditCjenik` set (a "head waiter"), the price list too.
   Everything else stays organiser-only.

   TWO TRUST PATHS, ONE MODULE
   ───────────────────────────
   • Owner-only (`listWaiters`, `inviteWaiter`, `revokeWaiter`,
     `revokeAllWaiters`) ride the ordinary Firebase bearer token that
     `api/http.ts`'s request interceptor attaches.
   • The bill endpoints accept EITHER that same bearer token (the organiser
     acting as bartender, `token: null` below) OR a waiter token in
     `X-Waiter-Token` — see `billConfig`.

   The waiter header is passed PER REQUEST and is deliberately NOT added by
   the global interceptor: `http` is the single axios instance for the whole
   app, and a header carrying a tournament-scoped capability must never ride
   along on a profile read or a tournament write. Each call below therefore
   spells out its own `headers` object.

   Revocation is per waiter, not per tournament: `DELETE waiter-access/{id}`
   drops just that person's sessions, so pulling one code doesn't interrupt
   anyone else still behind the bar. `revoke-all` exists for "shut the whole
   thing down".
   ────────────────────────────────────────────────────────────────────── */

/** One named waiter credential, as the organiser's list shows it. */
export type WaiterDto = {
    id: number
    name: string
    /** Four letters, upper case. */
    code: string
    createdAt: string
    /** "Gazda konobara" — this credential can also replace the price list. */
    canEditCjenik: boolean
}

/** What a successful redeem hands back. `token` is opaque — never parsed. */
export type WaiterRedeemDto = {
    token: string
    tournamentUuid: string
    /** Nullable, like everywhere else: slugs are backfilled lazily and a
     *  legacy row may still have none. Fall back to the uuid. */
    tournamentSlug: string | null
    tournamentName: string
    canEditCjenik: boolean
}

/**
 * One row of the waiter's bill list — a per-match summary, ordered by round
 * then table. Deliberately NOT `MatchBillDto`: the list must stay one request
 * for a whole tournament, so it carries counts and a total instead of the
 * drink rows. The full bill comes from `fetchWaiterBill` when a row is opened.
 */
export type WaiterBillRowDto = {
    matchId: number
    roundNumber: number
    /** Null for a BYE — nobody sits at a table for it. */
    tableNo: number | null
    pair1Name: string | null
    pair2Name: string | null
    /** BigDecimal: sometimes a string on the wire, same as MatchBillDto.total. */
    total: number | string
    paid: boolean
    paidAt: string | null
    drinkCount: number
    /** "SCHEDULED" | "LIVE" | "FINISHED" | … — treated as an opaque string. */
    matchStatus: string
}

/** Body of the add-drink call — the same shape `addMatchDrink` already sends. */
type AddDrinkBody = {
    priceId: number
    quantity?: number
}

/**
 * Per-request config for a bill-endpoint call.
 *
 * `token` is null for the organiser (their ordinary Firebase bearer, already
 * attached by `http`'s interceptor, is enough — see
 * `WaiterAccessService#authorizeBillAccess`) or a waiter's token, sent as
 * `X-Waiter-Token`.
 *
 * `X-Client-Op-Id` is optional but always supplied by the UI: there is no
 * offline queue behind this surface, yet the bar is on the same venue Wi-Fi
 * as everyone else and a double-tap on a stalled request would otherwise put
 * the same rakija on the bill twice. The backend's IdempotencyService
 * applies a given id exactly once.
 *
 * `silent` always — not just for a waiter's stale token. The response
 * interceptor in `api/http.ts` treats a 401 on a signed-in user as a dead
 * Firebase session: it toasts "Sesija je istekla", signs them out and
 * hard-navigates to /prijava. A 401 here means either a stale WAITER token
 * (says nothing about the organiser's own login) or, for the organiser
 * branch, is handled by the SAME caller-side fallback every other silent
 * mutation in this app uses. Every caller below renders its own error.
 */
function billConfig(token: string | null, opId?: string) {
    const headers: Record<string, string> = {}
    if (token) headers["X-Waiter-Token"] = token
    if (opId) headers["X-Client-Op-Id"] = opId
    return { headers, silent: true } as const
}

/**
 * Human-readable text out of a failed waiter call.
 *
 * The backend answers a wrong code with the standard `ApiError` envelope and
 * a message already in the caller's language (`X-Locale` is on every request),
 * so it is shown to the user as-is rather than re-derived from the status.
 * Falls back to the caller's own line when the body carries nothing useful.
 */
export function waiterErrorText(e: unknown, fallback: string): string {
    const data = (e as { response?: { data?: unknown } } | null)?.response?.data
    if (typeof data === "string" && data.trim()) return data.trim()
    if (data && typeof data === "object") {
        const msg = (data as Record<string, unknown>).message
        if (typeof msg === "string" && msg.trim()) return msg.trim()
    }
    return fallback
}

/* =========================================================
   Owner-only: managing waiters
   ========================================================= */

/** Every active waiter of the tournament, oldest invite first. */
export async function listWaiters(idOrSlug: string): Promise<WaiterDto[]> {
    const { data } = await http.get<WaiterDto[]>(
        `/tournaments/${idOrSlug}/waiter-access`,
        { silent: true },
    )
    return data
}

/** Invite one named waiter — mints a fresh four-letter code just for them. */
export async function inviteWaiter(
    idOrSlug: string,
    name: string,
    canEditCjenik: boolean = false,
): Promise<WaiterDto> {
    const { data } = await http.post<WaiterDto>(
        `/tournaments/${idOrSlug}/waiter-access`,
        { name, canEditCjenik },
        { silent: true },
    )
    return data
}

/** Withdraw one waiter's access. Their sessions only — everyone else keeps working. */
export async function revokeWaiter(idOrSlug: string, waiterId: number): Promise<void> {
    await http.delete(
        `/tournaments/${idOrSlug}/waiter-access/${waiterId}`,
        { silent: true },
    )
}

/** Withdraw every active waiter's access at once. */
export async function revokeAllWaiters(idOrSlug: string): Promise<void> {
    await http.post(
        `/tournaments/${idOrSlug}/waiter-access/revoke-all`,
        null,
        { silent: true },
    )
}

/* =========================================================
   Public: redeeming a code
   ========================================================= */

/**
 * Trade a four-letter code for a session token. No auth.
 *
 * Silent on purpose: this is a form, and a wrong code belongs next to the
 * field rather than in a toast that floats away from it. A 400 here always
 * means "wrong code" — there is no machine code to branch on.
 */
export async function redeemWaiterCode(
    idOrSlug: string,
    code: string,
): Promise<WaiterRedeemDto> {
    const { data } = await http.post<WaiterRedeemDto>(
        `/tournaments/${idOrSlug}/waiter-access/redeem`,
        { code },
        { silent: true },
    )
    return data
}

/* =========================================================
   Bill access — organiser (token: null) or a waiter's token
   ========================================================= */

/** Every match's bill for the tournament, ordered by round then table. */
export async function fetchWaiterBills(
    idOrSlug: string,
    token: string | null,
): Promise<WaiterBillRowDto[]> {
    const { data } = await http.get<WaiterBillRowDto[]>(
        `/tournaments/${idOrSlug}/waiter/bills`,
        billConfig(token),
    )
    return data
}

/** One match's full bill — the same DTO the organiser's own bill view uses. */
export async function fetchWaiterBill(
    idOrSlug: string,
    matchId: number,
    token: string | null,
): Promise<MatchBillDto> {
    const { data } = await http.get<MatchBillDto>(
        `/tournaments/${idOrSlug}/waiter/bills/${matchId}`,
        billConfig(token),
    )
    return data
}

export async function addWaiterDrink(
    idOrSlug: string,
    matchId: number,
    token: string | null,
    priceId: number,
    quantity: number = 1,
    opId?: string,
): Promise<MatchBillDto> {
    const body: AddDrinkBody = { priceId, quantity }
    const { data } = await http.post<MatchBillDto>(
        `/tournaments/${idOrSlug}/waiter/bills/${matchId}/drinks`,
        body,
        billConfig(token, opId),
    )
    return data
}

export async function removeWaiterDrink(
    idOrSlug: string,
    matchId: number,
    token: string | null,
    drinkId: number,
    opId?: string,
): Promise<MatchBillDto> {
    const { data } = await http.delete<MatchBillDto>(
        `/tournaments/${idOrSlug}/waiter/bills/${matchId}/drinks/${drinkId}`,
        billConfig(token, opId),
    )
    return data
}

/** Mark the bill paid (or un-paid). Returns the recomputed bill. */
export async function setWaiterBillPaid(
    idOrSlug: string,
    matchId: number,
    token: string | null,
    paid: boolean,
    opId?: string,
): Promise<MatchBillDto> {
    const { data } = await http.patch<MatchBillDto>(
        `/tournaments/${idOrSlug}/waiter/bills/${matchId}/paid`,
        { paid },
        billConfig(token, opId),
    )
    return data
}
