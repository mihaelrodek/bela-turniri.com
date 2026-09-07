import { http } from "./http"
import { t } from "../i18n"

/** One row of a cjenik (tournament or template). */
export type DrinkPriceDto = {
    id?: number | null
    name: string
    price: number | string // BigDecimal serialises as string sometimes; accept both
    sortOrder?: number | null
}

export type MatchDrinkDto = {
    id: number
    priceId?: number | null
    name: string
    unitPrice: number | string
    quantity: number
    lineTotal: number | string
    createdAt: string
}

export type MatchBillDto = {
    matchId: number
    drinks: MatchDrinkDto[]
    total: number | string
    paidAt?: string | null
    paidByUid?: string | null
    /** Display snapshot of who settled it — the organiser's name, or a waiter's invited name. */
    paidByName?: string | null
    /** Surfaced once match is FINISHED (and not BYE) so UI can label the bill. */
    loserPairId?: number | null
    loserPairName?: string | null
}

/* =========================================================
   Per-tournament cjenik
   ========================================================= */

export async function fetchTournamentCjenik(uuid: string): Promise<DrinkPriceDto[]> {
    const { data } = await http.get<DrinkPriceDto[]>(`/tournaments/${uuid}/cjenik`, {
        silent: true,
    })
    return data
}

/**
 * `waiterToken` is set only for a "head waiter" — a credential invited with
 * cjenik rights (`TournamentWaiter.canEditCjenik`) — sent as `X-Waiter-Token`
 * so `CjenikController.putTournamentCjenik` can authorise them without an
 * account. Omitted (or null) for the organiser, whose ordinary Firebase
 * bearer is authorisation enough — see `WaiterAccessService#authorizeCjenikAccess`.
 */
export async function saveTournamentCjenik(
    uuid: string,
    items: DrinkPriceDto[],
    waiterToken?: string | null,
): Promise<DrinkPriceDto[]> {
    const { data } = await http.put<DrinkPriceDto[]>(
        `/tournaments/${uuid}/cjenik`,
        { items },
        waiterToken
            ? { headers: { "X-Waiter-Token": waiterToken }, silent: true }
            : { successMessage: t("common.toast.cjenikSaved") },
    )
    return data
}

export async function saveCjenikAsTemplate(
    uuid: string,
    templateName: string,
): Promise<DrinkPriceDto[]> {
    const { data } = await http.post<DrinkPriceDto[]>(
        `/tournaments/${uuid}/cjenik/save-as-template`,
        null,
        {
            params: { name: templateName },
            successMessage: t("common.toast.templateSavedAs", { name: templateName }),
        },
    )
    return data
}

export async function importCjenikTemplate(
    uuid: string,
    templateName: string,
): Promise<DrinkPriceDto[]> {
    const { data } = await http.post<DrinkPriceDto[]>(
        `/tournaments/${uuid}/cjenik/import-template`,
        null,
        {
            params: { name: templateName },
            successMessage: t("common.toast.templateImported", { name: templateName }),
        },
    )
    return data
}

/* =========================================================
   Per-user template
   ========================================================= */

/** Names of all named templates this user has saved. */
export async function fetchMyTemplateNames(): Promise<string[]> {
    const { data } = await http.get<string[]>(`/user/me/drink-templates`, {
        silent: true,
    })
    return data
}

/** Items of one named template. */
export async function fetchMyTemplate(name: string): Promise<DrinkPriceDto[]> {
    const { data } = await http.get<DrinkPriceDto[]>(
        `/user/me/drink-templates/${encodeURIComponent(name)}/items`,
        { silent: true },
    )
    return data
}

/** Replace items of one named template (creates the template if new). */
export async function saveMyTemplate(
    name: string,
    items: DrinkPriceDto[],
): Promise<DrinkPriceDto[]> {
    const { data } = await http.put<DrinkPriceDto[]>(
        `/user/me/drink-templates/${encodeURIComponent(name)}/items`,
        { items },
        { successMessage: t("common.toast.templateSaved", { name }) },
    )
    return data
}

export async function renameMyTemplate(
    oldName: string,
    newName: string,
): Promise<void> {
    await http.post(
        `/user/me/drink-templates/${encodeURIComponent(oldName)}/rename`,
        { newName },
        { successMessage: t("common.toast.templateRenamed") },
    )
}

export async function deleteMyTemplate(name: string): Promise<void> {
    await http.delete(
        `/user/me/drink-templates/${encodeURIComponent(name)}`,
        { successMessage: t("common.toast.templateDeletedNamed", { name }) },
    )
}

/* =========================================================
   Per-match bill
   ========================================================= */

export async function fetchMatchBill(
    uuid: string,
    matchId: number,
): Promise<MatchBillDto> {
    const { data } = await http.get<MatchBillDto>(
        `/tournaments/${uuid}/matches/${matchId}/bill`,
        { silent: true },
    )
    return data
}

/**
 * `opts.opId` is the offline queue's operation id, sent as
 * `X-Client-Op-Id`. The bartender adds drinks on a phone at the table,
 * which is exactly where the signal dies; the backend applies a given id
 * exactly once, so a replayed add can never put the same rakija on the bill
 * twice. Set per request — `api/http.ts` is shared by every call and most
 * of them are not queued.
 */
type OpIdOpts = { opId?: string }

/** Per-request config carrying the idempotency header, or nothing. */
function opIdHeader(opts?: OpIdOpts) {
    return opts?.opId ? { headers: { "X-Client-Op-Id": opts.opId } } : {}
}

export async function addMatchDrink(
    uuid: string,
    matchId: number,
    priceId: number,
    quantity: number = 1,
    opts?: OpIdOpts,
): Promise<MatchBillDto> {
    const { data } = await http.post<MatchBillDto>(
        `/tournaments/${uuid}/matches/${matchId}/drinks`,
        { priceId, quantity },
        { silent: true, ...opIdHeader(opts) },
    )
    return data
}

export async function removeMatchDrink(
    uuid: string,
    matchId: number,
    drinkId: number,
    opts?: OpIdOpts,
): Promise<MatchBillDto> {
    const { data } = await http.delete<MatchBillDto>(
        `/tournaments/${uuid}/matches/${matchId}/drinks/${drinkId}`,
        { silent: true, ...opIdHeader(opts) },
    )
    return data
}

export async function markMatchPaid(
    uuid: string,
    matchId: number,
    opts?: OpIdOpts & { silent?: boolean },
): Promise<MatchBillDto> {
    const { data } = await http.post<MatchBillDto>(
        `/tournaments/${uuid}/matches/${matchId}/pay`,
        null,
        { silent: opts?.silent, successMessage: t("common.toast.matchPaid"), ...opIdHeader(opts) },
    )
    return data
}

export async function markMatchUnpaid(
    uuid: string,
    matchId: number,
    opts?: OpIdOpts & { silent?: boolean },
): Promise<MatchBillDto> {
    const { data } = await http.post<MatchBillDto>(
        `/tournaments/${uuid}/matches/${matchId}/unpay`,
        null,
        { silent: opts?.silent, successMessage: t("common.toast.matchUnpaid"), ...opIdHeader(opts) },
    )
    return data
}

/* =========================================================
   Per-user invoice history
   ========================================================= */

export type UserInvoiceDto = {
    matchId: number
    tournamentId: number
    tournamentName: string
    tournamentRef: string
    tournamentStartAt?: string | null
    roundNumber?: number | null
    tableNo?: number | null
    myPairName?: string | null
    opponentPairName?: string | null
    total: number | string
    paidAt?: string | null
    /** True if MY pair was the loser of this match. */
    lost: boolean
    finished: boolean
}

export async function fetchMyInvoices(): Promise<UserInvoiceDto[]> {
    const { data } = await http.get<UserInvoiceDto[]>(`/user/me/invoices`, {
        silent: true,
    })
    return data
}
