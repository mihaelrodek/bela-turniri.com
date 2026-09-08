import { http } from "../api/http"
import { t } from "../i18n"
import type { BlokLink } from "./types"

/* ──────────────────────────────────────────────────────────────────────────
   "Poveži blok sa stolom", PLAYER side — the four endpoints of BLOK-LINK.md
   §2.2 that the phone at the table calls: targets, request, mine, and the
   score push (plus breaking the link, which either party may do).

   WHERE THIS FILE LIVES, AND WHY IT IS NOT `api/blokLink.ts`
   ─────────────────────────────────────────────────────────
   `src/api/blokLink.ts` holds the ORGANISER's half of the same contract —
   the tournament's link list, approve, reject — and is imported by the
   organiser's Ždrijeb screen. The two halves have opposite requirements and
   almost no overlap: the organiser's calls are foreground actions that toast,
   these run in the background from a scorepad whose entire contract is "no
   server, no auth" and must not. Keeping them apart also keeps the whole
   network surface of the blok inside `src/blok/`, where BLOK.md's "one
   directory, no server" rule can still be checked by eye.

   THE TOAST POLICY IS THE INVERSE OF THE REST OF THE APP
   ─────────────────────────────────────────────────────
     - the two calls the user consciously makes — sending a request, breaking
       the link — DO toast, because somebody is standing there waiting;
     - everything else is `silent: true`. The score push in particular runs
       after every deal; letting the interceptor toast it would turn one flaky
       minute of bar Wi-Fi into a column of red boxes over a live game. Its
       failures are a small state in the header strip instead (§3.1/§3.3).
   ────────────────────────────────────────────────────────────────────── */

export type BlokLinkStatus = "PENDING" | "APPROVED" | "REJECTED" | "REVOKED"

const LINK_STATUSES: readonly string[] = ["PENDING", "APPROVED", "REJECTED", "REVOKED"]

/**
 * The wire's `status`, if it is one of the four the contract defines.
 *
 * Types describe an agreement, not a guarantee: this value decides whether
 * the scorepad starts pushing scores, so an unrecognised string must not be
 * written into the link and then silently believed. `null` means "do not
 * change what we already had".
 */
export function asBlokLinkStatus(value: unknown): BlokLinkStatus | null {
    return typeof value === "string" && LINK_STATUSES.includes(value)
        ? (value as BlokLinkStatus)
        : null
}

/** One pair as the targets/link payloads carry it. */
export type BlokLinkPairDto = {
    id: number
    name: string
}

/**
 * A table in the tournament's active round — `GET /blok-links/targets`.
 *
 * `linkable` is the backend's verdict and the ONLY thing the UI gates on;
 * `reason` is the machine code behind a `false` (`MATCH_HAS_BYE`,
 * `LINK_EXISTS`, …) so the picker can explain the greyed-out row. A code we
 * have no wording for falls back to a generic line rather than showing the
 * raw code to the player.
 */
export type BlokLinkTargetDto = {
    matchId: number
    tableNo: number | null
    roundNumber: number
    pair1: BlokLinkPairDto
    pair2: BlokLinkPairDto | null
    linkable: boolean
    reason?: string | null
}

/**
 * A table the signed-in player is sitting at right now — one element of
 * `GET /blok-links/suggestions` (BLOK-LINK.md §8.2).
 *
 * Every field is required, unlike `BlokLinkDto`'s optional display fields, and
 * for the opposite reason: this payload is not an echo of something the client
 * already picked — it IS the pick. The strip names the tournament, the round,
 * the table and both pairs before the player agrees to anything, because the
 * whole point of the offer is that they can recognise their own table in it
 * without opening a picker.
 */
export type BlokLinkSuggestionDto = {
    tournamentUuid: string
    tournamentSlug?: string | null
    tournamentName: string
    roundId?: number
    roundNumber: number
    matchId: number
    tableNo: number | null
    /** The player's own pair — this is what makes the offer skip step three. */
    myPairId: number
    myPairName: string
    opponentPairId?: number
    opponentPairName: string
}

/**
 * A link as the server describes it — `BlokLink` (BLOK-LINK.md §3.2) minus
 * `syncedGames` / `syncedFinal` / `pendingSince`, which are this device's own
 * bookkeeping about the network and never travel.
 *
 * Every field past `uuid`/`status` is optional on the wire on purpose: §2.2
 * pins what `GET /mine` is for but says nothing about what `POST /blok-links`
 * echoes back, and the call site already knows the tournament, the table and
 * both pair names — it just picked them. Treating them as optional means a
 * leaner POST response degrades to "use what we picked" instead of writing
 * `undefined` into the header strip.
 */
export type BlokLinkDto = {
    uuid: string
    status: BlokLinkStatus
    tournamentUuid?: string | null
    tournamentName?: string | null
    roundNumber?: number | null
    tableNo?: number | null
    matchId?: number | null
    usPairId?: number | null
    usPairName?: string | null
    themPairName?: string | null
    /**
     * The public logbook's token, once the linked series has been saved and the
     * server has issued one (BLOK-LINK.md §6.2). Read by the ORGANISER's screen
     * (`api/blokLink.ts`), not by this side: the blok already knows its own
     * token through `BlokShare`, which is also the only place it can be revoked
     * from. Named here so the wire shape stays described in one piece.
     */
    shareToken?: string | null
}

/**
 * The answer to `POST /blok-links` — and the ONLY response that ever carries a
 * write token (BLOK-LINK.md §7.1).
 *
 * The token is deliberately NOT a field on `BlokLinkDto`, and the shape says
 * why: that record is also what the organiser's `GET /tournaments/{id}/blok-links`
 * returns, to somebody who is not the player. A nullable field on it would have
 * put a bearer secret one forgotten `null` away from a list handed to a third
 * party. Here there is no field to forget.
 *
 * `writeToken` is absent for a signed-in request: the account is the credential
 * then, exactly as before §7.
 */
export type BlokLinkCreatedDto = {
    link: BlokLinkDto
    writeToken?: string | null
}

/**
 * How the write credential travels: a request header, the same shape the waiter
 * sessions already use (`X-Waiter-Token`, `CjenikController`) — which is the
 * precedent §7.1 names for this whole mechanism. The exact name is
 * `BlokLinkController.TOKEN_HEADER`.
 *
 * NOT a query parameter, and the difference is not cosmetic: query strings end
 * up in access logs, in `Referer` headers and in the browser's history, and
 * this string is the entire right to write into somebody's match record.
 */
const WRITE_TOKEN_HEADER = "X-Blok-Link-Token"

/** `{ headers: { … } }` when there is a token, `{}` when there is not. */
function tokenHeaders(writeToken: string | null): { headers?: Record<string, string> } {
    return writeToken === null || writeToken === ""
        ? {}
        : { headers: { [WRITE_TOKEN_HEADER]: writeToken } }
}

/**
 * The write token a link is carrying, or null.
 *
 * Read through an assertion rather than off `BlokLink` directly because
 * `blok/types.ts` is being edited by somebody else as this lands: the field it
 * needs is `writeToken?: string`, and until it is there this is what keeps the
 * whole feature compiling. The assertion is to an INTERSECTION, so it stays
 * correct — and stays a no-op — the moment the field does exist.
 *
 * Absent is a perfectly normal answer: a link requested while signed in has no
 * token at all, because the account is the credential.
 */
export function linkWriteToken(link: { uuid: string }): string | null {
    const token = (link as { uuid: string } & { writeToken?: string | null }).writeToken
    return typeof token === "string" && token !== "" ? token : null
}

/**
 * The link to store after `POST /blok-links` answered.
 *
 * Two callers build the same object from two different starting points — the
 * three-step picker and the one-tap offer of §8 — and getting it wrong in one
 * of them means a header strip that names the wrong table. So the merge rule
 * lives once, here: whatever the server echoed wins, and everything it left out
 * falls back to what the caller already knew, because it just chose it.
 * `??`/`||` rather than a spread, so a `null` or an empty string on the wire
 * cannot blank out a value we hold.
 *
 * The returned type is an intersection because `writeToken` is not on
 * `BlokLink` yet (`blok/types.ts` belongs to another change in flight). It is
 * assignable to `BlokLink` either way, so every consumer compiles unchanged.
 */
export function createdBlokLink(
    created: BlokLinkCreatedDto,
    fallback: Omit<BlokLink, "uuid" | "status" | "syncedGames" | "syncedFinal" | "pendingSince">,
): BlokLink & { writeToken?: string } {
    const dto = created.link
    const writeToken = typeof created.writeToken === "string" && created.writeToken !== ""
        ? created.writeToken
        : undefined
    return {
        uuid: dto.uuid,
        // A brand-new request is PENDING by definition (§2.2), so an
        // unrecognised status falls back to that rather than to whatever the
        // server said — the one status that must never be inferred is APPROVED.
        status: asBlokLinkStatus(dto.status) ?? "PENDING",
        tournamentUuid: dto.tournamentUuid || fallback.tournamentUuid,
        tournamentName: dto.tournamentName || fallback.tournamentName,
        roundNumber: dto.roundNumber ?? fallback.roundNumber,
        tableNo: dto.tableNo ?? fallback.tableNo,
        matchId: dto.matchId ?? fallback.matchId,
        usPairId: dto.usPairId ?? fallback.usPairId,
        usPairName: dto.usPairName || fallback.usPairName,
        themPairName: dto.themPairName || fallback.themPairName,
        // Nothing has been sent for this link yet — and a series score of 0:0 is
        // a real value the first push has to state, so this is `null` ("never
        // sent"), not `{us: 0, them: 0}`.
        syncedGames: null,
        syncedFinal: false,
        pendingSince: null,
        ...(writeToken === undefined ? {} : { writeToken }),
    }
}

/**
 * The machine code behind a failed call, or null.
 *
 * Same two wire shapes `hooks/useOfflineQueue.ts` documents: the `ApiError`
 * envelope (`{ code, message, … }`) and a bare code as the entire body
 * (`errors/ApiCodes`, thrown as `ClientErrorException("ROUND_COMPLETED", 409)`),
 * which axios hands back as a plain string because it is not valid JSON.
 * Free prose, HTML and empty bodies are "no code" — the caller then treats
 * the failure as transient and retries, which is the safe direction: a link
 * killed by mistake costs the player a re-request, a link kept alive by
 * mistake costs one more rejected push.
 */
const CODE_SHAPE = /^[A-Z][A-Z0-9_]{2,63}$/

export function blokLinkErrorCode(err: unknown): string | null {
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

/** HTTP status of a failed call, or null when the request never got an answer. */
export function blokLinkErrorStatus(err: unknown): number | null {
    if (typeof err !== "object" || err === null) return null
    const status = (err as { response?: { status?: unknown } }).response?.status
    return typeof status === "number" ? status : null
}

/**
 * Tables in the tournament's active round.
 *
 * Silent: this runs inside the picker, which renders its own inline error and
 * a retry button. A toast over an open dialog would say the same thing twice.
 */
export async function fetchBlokLinkTargets(
    tournamentIdOrSlug: string,
): Promise<BlokLinkTargetDto[]> {
    const { data } = await http.get<BlokLinkTargetDto[]>("/blok-links/targets", {
        params: { tournament: tournamentIdOrSlug },
        silent: true,
    })
    return data
}

/**
 * Ask the organiser to link this phone to a table.
 *
 * `usPairId` is not decoration: without it the organiser receives a number
 * with no indication of whose it is (BLOK-LINK.md §1). It is fixed at request
 * time and never edited — a wrong pick is fixed by breaking the link and
 * asking again.
 *
 * `sessionId` says WHICH series this table is playing (§6.2). The link's whole
 * consequence is that the series' logbook becomes public and reachable from the
 * organiser's bracket, so the server has to be told which record that is at the
 * moment the request is made — not later, when a score arrives and the answer
 * would depend on what the phone happened to be showing.
 *
 * 400/409 error toasts are suppressed: those carry the contract's bare codes
 * (`LINK_EXISTS`, `MATCH_HAS_BYE`, `PAIR_NOT_IN_MATCH` …), and the
 * interceptor would print the raw code at the player. The picker renders the
 * translated sentence inline instead, next to the table it refers to.
 *
 * `requestedByName` is what a SIGNED-OUT player types (§7.1). The organiser
 * approves a person, so a request with no account and no name is one nobody can
 * act on — it is required exactly when there is no session, and omitted when
 * there is one, because then the account already names them and a second,
 * self-declared name would only invite a different one.
 */
export async function requestBlokLink(body: {
    matchId: number
    usPairId: number
    sessionId: string
    requestedByName?: string
}): Promise<BlokLinkCreatedDto> {
    const { data } = await http.post<BlokLinkCreatedDto>("/blok-links", body, {
        successMessage: t("blok.link.requested"),
        silentErrorStatuses: [400, 409],
    })
    return data
}

/** The caller's own links. Silent — it is a background check on a pending request. */
export async function fetchMyBlokLinks(): Promise<BlokLinkDto[]> {
    const { data } = await http.get<BlokLinkDto[]>("/blok-links/mine", { silent: true })
    return data
}

/**
 * One link's current state, for a client with no account — `GET /blok-links/{uuid}`
 * carrying the write token (§7.1).
 *
 * The signed-out counterpart of `/blok-links/mine`: "mine" is answered from the
 * session, and there is none, so the question has to be asked about a specific
 * link and answered by the token. Silent for the same reason as `mine` — it is
 * a background poll on a request nobody is watching.
 */
export async function fetchBlokLinkStatus(
    uuid: string,
    writeToken: string,
): Promise<BlokLinkDto> {
    const { data } = await http.get<BlokLinkDto>(`/blok-links/${uuid}`, {
        silent: true,
        ...tokenHeaders(writeToken),
    })
    return data
}

/**
 * A table this player is sitting at right now — `GET /blok-links/suggestions`
 * (BLOK-LINK.md §8.2).
 *
 * Signed-in only, and the backend answers with an empty array unless every one
 * of §8.1's conditions holds: an approved pair of this player's, in a live
 * tournament, in a match of the active round, with no link on it yet. So an
 * empty list is the ordinary answer and means "offer nothing" — it is never an
 * error state and never rendered as one.
 *
 * Silent: it runs on mount, with nobody waiting on it. A blok that cannot reach
 * the server simply offers nothing, which is exactly what it does when there is
 * nothing to offer.
 */
export async function fetchBlokLinkSuggestions(): Promise<BlokLinkSuggestionDto[]> {
    const { data } = await http.get<BlokLinkSuggestionDto[]>("/blok-links/suggestions", {
        silent: true,
    })
    return data
}

/**
 * Break the link from the player's end — `REVOKED` server-side.
 *
 * 404 and 409 are silenced because both mean the link is already gone (the
 * organiser revoked it, the round closed): the local end must still clear,
 * and a red toast telling the player that the thing they asked to remove was
 * already removed is noise, not information.
 */
export async function revokeMyBlokLink(
    uuid: string,
    writeToken: string | null = null,
): Promise<void> {
    await http.delete(`/blok-links/${uuid}`, {
        successMessage: t("blok.link.unlinked"),
        silentErrorStatuses: [404, 409],
        ...tokenHeaders(writeToken),
    })
}

/**
 * Push the series score to the organiser's record.
 *
 * `us` / `them` are GAMES WON in this series — 2 : 0, 2 : 1 — not point totals
 * (BLOK-LINK.md §6.1). A tournament match is scored in games; the 543 : 149 on
 * the scorepad is the logbook's own business and reaches the organiser only
 * through the public record, never as the match result.
 *
 * FULLY silent, in both directions. This fires when a game ends, from a phone
 * lying on a table — there is no user waiting on it, so a success toast would
 * interrupt the game and an error toast would fire once per lost packet. The
 * caller keeps `pendingSince` on the link instead and retries.
 *
 * `final: false` is a provisional score: the backend writes the numbers but
 * leaves the match `SCHEDULED` (BLOK-LINK.md §2.3), so nobody is eliminated
 * between two games of a series. `final: true` — the series is decided, or the
 * player closed it — goes through the organiser's own scoring path.
 *
 * `sessionId` travels with every push (§6.2): it is what the server attaches
 * the public logbook's share token to.
 *
 * `writeToken` is how a client with no account proves the push is its own
 * (§7.1). A signed-in client sends none and is recognised by its bearer token
 * exactly as before; the backend accepts either, and neither is 401.
 */
export async function pushBlokScore(
    uuid: string,
    body: { us: number; them: number; final: boolean; sessionId: string },
    writeToken: string | null = null,
): Promise<void> {
    await http.put(`/blok-links/${uuid}/score`, body, {
        silent: true,
        ...tokenHeaders(writeToken),
    })
}
