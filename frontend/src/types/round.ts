// src/api/rounds.ts
export type MatchDto = {
    id: number
    tableNo: number
    pair1Id?: number
    pair1Name?: string
    pair2Id?: number
    pair2Name?: string
    score1?: number
    score2?: number
    winnerPairId?: number
    status: "SCHEDULED" | "FINISHED"
    /** ISO timestamp set when the bartender marks the drinks bill paid. */
    paidAt?: string | null
}

export type RoundDto = {
    id: number
    number: number
    status: "IN_PROGRESS" | "COMPLETED"
    matches: MatchDto[]
}