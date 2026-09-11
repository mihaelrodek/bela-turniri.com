import { http } from "./http";
import { t } from "../i18n";
import type {
    CreateTournamentPayload,
    TournamentCard,
    TournamentDetails,
} from "../types/tournaments";
import type { PairDraft, PairShort } from "../types/pairs";

/**
 * Create a tournament.
 *
 * With a poster file this sends ONE multipart request to
 * `/tournaments/multipart` (JSON in the "data" part, the image in "poster")
 * so the tournament and its artwork land in a single transaction; without one
 * it posts plain JSON to `/tournaments`.
 *
 * `resourceId` is passed through with the rest of the payload, and unknown
 * extras (`bannerUrl` when the organiser pasted a URL instead of uploading)
 * survive the normalisation below — hence the spread.
 *
 * Note the Content-Type on the multipart branch: axios's browser adapter
 * unsets it for a FormData body so the browser can append its own boundary,
 * the same trick `uploadTournamentPoster` below relies on.
 */
export async function createTournament(
    payload: CreateTournamentPayload,
    posterFile?: File | null,
): Promise<TournamentDetails> {
    const body: CreateTournamentPayload = {
        ...payload,
        name: payload.name.trim(),
        location: payload.location ?? null,
        details: payload.details ?? null,
        startAt: payload.startAt ?? null,
        status: payload.status ?? "DRAFT",
        // maxPairs is optional — null means "no cap" ("Neodređeno").
        // Pass it straight through; do NOT default to 16.
        maxPairs: payload.maxPairs ?? null,
        entryPrice: payload.entryPrice ?? 0,
        repassagePrice: payload.repassagePrice ?? 0,
        repassageSecondPrice: payload.repassageSecondPrice ?? null,
        repassageUntil: payload.repassageUntil ?? null,
        contactName: payload.contactName ?? null,
        contactPhone: payload.contactPhone ?? null,
        rewardType: payload.rewardType ?? null,
        rewardFirst: payload.rewardFirst ?? null,
        rewardSecond: payload.rewardSecond ?? null,
        rewardThird: payload.rewardThird ?? null,
        resourceId: payload.resourceId ?? null,
    };

    if (posterFile) {
        const fd = new FormData();
        fd.append("data", JSON.stringify(body));
        fd.append("poster", posterFile, posterFile.name);
        const { data } = await http.post<TournamentDetails>(
            "/tournaments/multipart",
            fd,
            {
                headers: { "Content-Type": "multipart/form-data" },
                successMessage: t("common.toast.tournamentCreated"),
            },
        );
        return data;
    }

    const { data } = await http.post<TournamentDetails>(
        "/tournaments",
        body,
        { successMessage: t("common.toast.tournamentCreated") },
    );
    return data;
}

export async function fetchTournaments(
    status: "upcoming" | "finished" = "upcoming",
    opts?: { offset?: number; limit?: number; q?: string },
): Promise<TournamentCard[]> {
    const params: Record<string, string | number> = { status };
    if (opts?.offset != null) params.offset = opts.offset;
    if (opts?.limit != null) params.limit = opts.limit;
    // The backend ignores anything under 2 trimmed chars, so an empty or
    // 1-char box never even reaches it as a query param.
    if (opts?.q && opts.q.trim().length >= 2) params.q = opts.q.trim();
    const { data } = await http.get<TournamentCard[]>("/tournaments", { params });
    return data;
}

/**
 * Backend-side total count for a status bucket. Used by the "Učitaj više"
 * button on the finished list to know when to stop offering more.
 */
/**
 * Tournaments the signed-in user organised, newest start first — feeds the
 * "Učitaj iz predloška" picker on the create-tournament wizard.
 */
export async function fetchMyTournaments(): Promise<TournamentCard[]> {
    const { data } = await http.get<TournamentCard[]>("/tournaments/mine", { silent: true })
    return data
}

export async function fetchTournamentsCount(
    status: "finished" = "finished",
    q?: string,
): Promise<number> {
    const params: Record<string, string> = { status };
    if (q && q.trim().length >= 2) params.q = q.trim();
    const { data } = await http.get<{ total: number }>("/tournaments/count", {
        params,
        // No success toast for a background count.
        silent: true,
    });
    return data.total
}

/**
 * `opts.silent` suppresses the interceptor's error toast — used by the
 * tournament page's background live-poll, where a transient network blip
 * should not throw a red toast over whatever the user is reading.
 */
export async function fetchTournamentDetails(
    uuid: string,
    opts?: { silent?: boolean },
): Promise<TournamentDetails> {
    const { data } = await http.get<TournamentDetails>(`/tournaments/${uuid}`, {
        silent: opts?.silent,
    });
    return data;
}

export async function updateTournament(
    uuid: string,
    payload: CreateTournamentPayload,
): Promise<TournamentDetails> {
    const { data } = await http.put<TournamentDetails>(
        `/tournaments/${uuid}`,
        payload,
        { successMessage: t("common.toast.tournamentUpdated") },
    );
    return data;
}

/**
 * Replace the tournament's poster image. Sent as multipart so the
 * browser sets the boundary automatically. Owner-only on the backend.
 *
 * Note: we pass "multipart/form-data" explicitly (the same trick the
 * working uploadAvatar uses). Axios detects the FormData body and
 * replaces this value with the proper Content-Type including the
 * boundary. Setting the header to `undefined` is unreliable here
 * because the global axios default Content-Type: application/json
 * can leak through depending on how the merge resolves.
 */
export async function uploadTournamentPoster(
    uuid: string,
    file: File,
): Promise<TournamentDetails> {
    const fd = new FormData()
    fd.append("poster", file)
    const { data } = await http.post<TournamentDetails>(
        `/tournaments/${uuid}/poster`,
        fd,
        {
            headers: { "Content-Type": "multipart/form-data" },
            silent: true, // the JSON save already toasted "Turnir je ažuriran." (common.toast.tournamentUpdated)
        },
    )
    return data
}

/** Remove the tournament's poster. */
export async function deleteTournamentPoster(uuid: string): Promise<TournamentDetails> {
    const { data } = await http.delete<TournamentDetails>(
        `/tournaments/${uuid}/poster`,
        { silent: true },
    )
    return data
}

/** `opts.silent` — see fetchRounds; used by the tournament page live-poll. */
export async function fetchTournamentPairs(uuid: string, opts?: { silent?: boolean }): Promise<PairShort[]> {
    const { data } = await http.get<PairShort[]>(`/tournaments/${uuid}/pairs`, { silent: opts?.silent })
    return data
}

export async function replacePairs(tournamentId: string, pairs: Array<PairShort | PairDraft>): Promise<PairShort[]> {
    const hasEmpty = pairs.some(p => !p.name || p.name.trim() === "");
    if (hasEmpty) throw new Error("Pair name cannot be empty.");

    // Include `paid` in the wire payload — backend PairDto carries it and
    // PairMapper persists it (target=paid, source=paid). Without this the
    // bulk save would silently reset paid=false on every replacePairs call,
    // and the "Plati on a not-yet-saved pair" flow would lose its kotizacija
    // flag the moment the pair gets a real id.
    const payload = pairs.map(p => ({
        id: typeof p.id === "number" && p.id > 0 ? p.id : null,
        name: p.name.trim(),
        isEliminated: !!p.isEliminated,
        extraLife: !!p.extraLife,
        wins: Number.isFinite(p.wins) ? p.wins : 0,
        losses: Number.isFinite(p.losses) ? p.losses : 0,
        paid: !!p.paid,
    }));

    const { data } = await http.put<PairShort[]>(`/tournaments/${tournamentId}/pairs`, payload);
    return data;
}

export async function buyExtraLife(tournamentUuid: string, pairId: number): Promise<PairShort> {
    const { data } = await http.post<PairShort>(
        `/tournaments/${tournamentUuid}/pairs/${pairId}/extra-life`,
        undefined,
        { successMessage: t("common.toast.extraLifeBought") },
    )
    return data
}

export async function finishTournament(uuid: string): Promise<TournamentDetails> {
    // 409 means the backend refused on a business rule (a round still open,
    // more than one pair still active, the tournament already finished). The
    // bare code it returns is not user-facing copy, so the caller translates
    // it into Croatian itself — suppress the generic toast here.
    const { data } = await http.post<TournamentDetails>(
        `/tournaments/${uuid}/finish`,
        undefined,
        {
            successMessage: t("common.toast.tournamentFinished"),
            silentErrorStatuses: [409],
        },
    )
    return data
}

export async function startTournament(uuid: string): Promise<TournamentDetails> {
    // 409 statuses (UNPAID_REQUIRED, INSUFFICIENT_PAIRS, ALREADY_FINISHED)
    // are handled by the caller with bespoke modals/alerts — suppress the
    // generic red toast so the user doesn't see two error messages stacked.
    const { data } = await http.put<TournamentDetails>(
        `/tournaments/${uuid}/start`,
        undefined,
        {
            successMessage: t("common.toast.tournamentStarted"),
            silentErrorStatuses: [409],
        },
    )
    return data
}

export async function setAllowRepeats(
    uuid: string,
    allowRepeats: boolean
): Promise<TournamentDetails> {
    const payload = { preserveMatchmaking: !allowRepeats }
    const res = await http.patch<TournamentDetails>(`/tournaments/${uuid}/preserve-matchmaking`, payload)
    return res.data
}

export async function resetTournament(uuid: string): Promise<TournamentDetails> {
    const res = await http.post<TournamentDetails>(
        `/tournaments/${uuid}/reset`,
        {},
        { successMessage: t("common.toast.tournamentReset") },
    )
    return res.data
}

/**
 * Set 2nd + 3rd place after the tournament finishes. Either field may
 * be null/empty to clear that podium position. Backend rejects names
 * that don't match a pair in the tournament, names that match the
 * gold winner, or both fields being identical.
 */
export async function setPodium(
    uuid: string,
    secondPlaceName: string | null,
    thirdPlaceName: string | null,
): Promise<TournamentDetails> {
    const { data } = await http.patch<TournamentDetails>(
        `/tournaments/${uuid}/podium`,
        { secondPlaceName, thirdPlaceName },
        { successMessage: t("common.toast.podiumSaved") },
    )
    return data
}

/**
 * Kotizacija toggle. `opts.opId` carries the offline queue's operation id in
 * `X-Client-Op-Id`; the backend applies each id exactly once, so a toggle
 * typed during an outage can be replayed without flipping the flag twice.
 */
export async function setPairPaid(
    uuid: string,
    pairId: number,
    paid: boolean,
    opts?: { silent?: boolean; opId?: string },
): Promise<PairShort> {
    const { data } = await http.patch<PairShort>(
        `/tournaments/${uuid}/pairs/${pairId}/paid`,
        { paid },
        {
            silent: opts?.silent,
            ...(opts?.opId ? { headers: { "X-Client-Op-Id": opts.opId } } : {}),
        },
    );
    return data;
}

/**
 * Registers a pair. Works signed in AND signed out — an anonymous caller must
 * send `contactPhone`, because the number is then the organiser's only way to
 * reach the registration (backend answers 400 CONTACT_PHONE_REQUIRED without
 * it) and the reply carries a `claimUrl` for attaching the pair to an account
 * later.
 */
export async function selfRegisterPair(
    tournamentUuid: string,
    name: string,
    contactPhone?: string | null,
): Promise<PairShort> {
    const { data } = await http.post<PairShort>(
        `/tournaments/${tournamentUuid}/pairs/self-register`,
        contactPhone ? { name, contactPhone } : { name },
        { successMessage: t("common.toast.registrationSent") },
    )
    return data
}

export async function approvePair(tournamentUuid: string, pairId: number): Promise<PairShort> {
    const { data } = await http.post<PairShort>(
        `/tournaments/${tournamentUuid}/pairs/${pairId}/approve`,
        undefined,
        { successMessage: t("common.toast.pairApproved") },
    )
    return data
}

export async function deletePair(tournamentUuid: string, pairId: number): Promise<void> {
    await http.delete(
        `/tournaments/${tournamentUuid}/pairs/${pairId}`,
        { successMessage: t("common.toast.pairDeleted") },
    )
}

export async function deleteTournament(tournamentUuid: string): Promise<void> {
    await http.delete(
        `/tournaments/${tournamentUuid}`,
        { successMessage: t("common.toast.tournamentDeleted") },
    )
}
