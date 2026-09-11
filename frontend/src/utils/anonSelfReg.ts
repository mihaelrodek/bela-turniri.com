/* ──────────────────────────────────────────────────────────────────────────
   Registrations filed from this device WITHOUT an account.

   A signed-in registration is recognisable forever: the row carries
   `submittedByUid` and the pair list compares it against the viewer. An
   anonymous one carries nothing — the server deliberately does not know who
   filed it — so "tvoja prijava" can only be answered by the device that filed
   it. That is what this list is: a local receipt, kept so the pairs list can
   still mark the row and so the claim link is not lost the moment the success
   dialog is dismissed.

   Deliberately localStorage and not a cookie or a server row: it is a
   convenience, it is per-device by nature, and losing it costs the user
   nothing that the claim link in the dialog does not already cover. Every
   access is wrapped — Safari private mode throws on read as well as write.
   ────────────────────────────────────────────────────────────────────── */

const KEY = "bela:selfreg:v1"

export type AnonSelfRegistration = {
    tournamentUuid: string
    pairId: number
    claimUrl: string
    name: string
}

export function readAnonRegistrations(): AnonSelfRegistration[] {
    try {
        const raw = localStorage.getItem(KEY)
        if (!raw) return []
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        // Written by an older build, or hand-edited: keep only usable rows.
        return parsed.filter(
            (r): r is AnonSelfRegistration =>
                !!r &&
                typeof r === "object" &&
                typeof (r as AnonSelfRegistration).tournamentUuid === "string" &&
                typeof (r as AnonSelfRegistration).pairId === "number",
        )
    } catch {
        return []
    }
}

export function rememberAnonRegistration(entry: AnonSelfRegistration) {
    try {
        const next = readAnonRegistrations().filter((r) => r.pairId !== entry.pairId)
        next.push(entry)
        localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
        // Storage blocked — the claim link is still on screen, which is the
        // part that actually matters.
    }
}

/** Pair ids this device registered for one tournament. */
export function anonRegisteredPairIds(tournamentUuid: string | undefined): Set<number> {
    if (!tournamentUuid) return new Set()
    return new Set(
        readAnonRegistrations()
            .filter((r) => r.tournamentUuid === tournamentUuid)
            .map((r) => r.pairId),
    )
}
