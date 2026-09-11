// src/types/pairs.ts
export type PairShort = {
    id: number;           // Long in backend
    name: string;
    isEliminated: boolean;
    extraLife: boolean;
    wins: number;
    losses: number;
    paid: boolean;
    submittedByUid?: string | null;
    pendingApproval?: boolean;
    /** Public slug of the user who self-registered the pair (null for organizer-added). */
    submittedBySlug?: string | null;
    /** Display name of the submitter, mirrored from Firebase. */
    submittedByName?: string | null;
    /** Firebase UID of the partner who claimed co-ownership via the share link. */
    coSubmittedByUid?: string | null;
    coSubmittedBySlug?: string | null;
    coSubmittedByName?: string | null;
    /** Opaque token for the /claim-pair/{token} URL — only sent to the primary submitter. */
    claimToken?: string | null;
    /**
     * Phone of a pair registered without an account. Organiser-only: the API
     * sends it solely to a viewer who may manage the tournament, so it is
     * absent (null) in every public listing.
     */
    contactPhone?: string | null;
    /**
     * Absolute /preuzmi-par/{token} link, present ONLY in the reply to an
     * anonymous self-registration — the submitter's one handle on a pair that
     * belongs to no account yet.
     */
    claimUrl?: string;
};

// Local-only helper for brand-new rows before the server assigns an id.
// We'll strip id when sending (id: null on create/update payload).
export type PairDraft = Omit<PairShort, "id"> & { id?: number };