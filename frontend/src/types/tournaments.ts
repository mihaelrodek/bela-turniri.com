export type RewardType = "FIXED" | "PERCENTAGE";
export type RepassageUntil = "FINALS" | "SEMIFINALS";
export type TournamentStatus = "DRAFT" | "STARTED" | "FINISHED";

export type TournamentCard = {
    id: number;                // UUID
    uuid: string;                // UUID
    name: string;
    location?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    bannerUrl?: string | null;
    startAt?: string | null;
    maxPairs?: number | null;
    entryPrice?: number | null;
    repassagePrice?: number | null;
    winnerName?: string | null;
    registeredPairs?: number | null;
};

export type TournamentDetails = {
    id: string; // UUID
    uuid: string;
    name: string;
    location?: string | null;
    details?: string | null;
    startAt?: string | null;

    // NOTE: with resources table this might become derived; server may still expose it for now.
    bannerUrl?: string | null;

    entryPrice?: number | null;
    maxPairs?: number | null;
    status?: string | null;

    repassagePrice?: number | null;
    repassageSecondPrice?: number | null;
    repassageUntil?: RepassageUntil | null;

    contactName?: string | null;
    contactPhone?: string | null;

    rewardType?: RewardType | null;
    rewardFirst?: number | null;
    rewardSecond?: number | null;
    rewardThird?: number | null;

    additionalOptions?: string[];
    winnerName?: string | null;

    // Creator info — populated server-side from the verified Firebase ID token.
    createdByUid?: string | null;
    createdByName?: string | null;
};

export type CreateTournamentPayload = {
    // required
    name: string;

    // optional basics
    location?: string | null;
    details?: string | null;
    startAt?: string | null;          // ISO with offset
    status?: TournamentStatus | null; // default DRAFT (server-side safe)

    // limits
    maxPairs: number;                 // not null, default 16 (we send explicit)

    // pricing (renamed)
    entryPrice: number;              // not null, default 0
    repassagePrice: number;          // not null, default 0
    repassageSecondPrice?: number | null; // nullable

    repassageUntil?: RepassageUntil | null;

    // contact
    contactName?: string | null;
    contactPhone?: string | null;

    // rewards
    rewardType?: RewardType | null;
    rewardFirst?: number | null;
    rewardSecond?: number | null;
    rewardThird?: number | null;

    // media via resources table (optional linkage at create time)
    resourceId?: number | null;
};