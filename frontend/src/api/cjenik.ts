import { http } from "./http"

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
    } as any)
    return data
}

export async function saveTournamentCjenik(
    uuid: string,
    items: DrinkPriceDto[],
): Promise<DrinkPriceDto[]> {
    const { data } = await http.put<DrinkPriceDto[]>(
        `/tournaments/${uuid}/cjenik`,
        { items },
        { successMessage: "Cjenik spremljen" } as any,
    )
    return data
}

export async function saveCjenikAsTemplate(uuid: string): Promise<DrinkPriceDto[]> {
    const { data } = await http.post<DrinkPriceDto[]>(
        `/tournaments/${uuid}/cjenik/save-as-template`,
        null,
        { successMessage: "Spremljeno kao predložak" } as any,
    )
    return data
}

export async function importCjenikTemplate(uuid: string): Promise<DrinkPriceDto[]> {
    const { data } = await http.post<DrinkPriceDto[]>(
        `/tournaments/${uuid}/cjenik/import-template`,
        null,
        { successMessage: "Predložak učitan" } as any,
    )
    return data
}

/* =========================================================
   Per-user template
   ========================================================= */

export async function fetchMyDrinkTemplate(): Promise<DrinkPriceDto[]> {
    const { data } = await http.get<DrinkPriceDto[]>(`/user/me/drink-template`, {
        silent: true,
    } as any)
    return data
}

export async function saveMyDrinkTemplate(
    items: DrinkPriceDto[],
): Promise<DrinkPriceDto[]> {
    const { data } = await http.put<DrinkPriceDto[]>(
        `/user/me/drink-template`,
        { items },
        { successMessage: "Predložak spremljen" } as any,
    )
    return data
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
        { silent: true } as any,
    )
    return data
}

export async function addMatchDrink(
    uuid: string,
    matchId: number,
    priceId: number,
    quantity: number = 1,
): Promise<MatchBillDto> {
    const { data } = await http.post<MatchBillDto>(
        `/tournaments/${uuid}/matches/${matchId}/drinks`,
        { priceId, quantity },
        { silent: true } as any,
    )
    return data
}

export async function removeMatchDrink(
    uuid: string,
    matchId: number,
    drinkId: number,
): Promise<MatchBillDto> {
    const { data } = await http.delete<MatchBillDto>(
        `/tournaments/${uuid}/matches/${matchId}/drinks/${drinkId}`,
        { silent: true } as any,
    )
    return data
}

export async function markMatchPaid(
    uuid: string,
    matchId: number,
): Promise<MatchBillDto> {
    const { data } = await http.post<MatchBillDto>(
        `/tournaments/${uuid}/matches/${matchId}/pay`,
        null,
        { successMessage: "Plaćeno" } as any,
    )
    return data
}

export async function markMatchUnpaid(
    uuid: string,
    matchId: number,
): Promise<MatchBillDto> {
    const { data } = await http.post<MatchBillDto>(
        `/tournaments/${uuid}/matches/${matchId}/unpay`,
        null,
        { successMessage: "Označeno kao neplaćeno" } as any,
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
    } as any)
    return data
}
