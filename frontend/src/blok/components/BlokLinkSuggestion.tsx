import { useCallback, useEffect, useState } from "react"
import { Box, Button, HStack, Text, VStack } from "@chakra-ui/react"
import { FiAlertCircle, FiLink2, FiX } from "react-icons/fi"

import { useTranslation } from "../../i18n"
import {
    createdBlokLink,
    fetchBlokLinkSuggestions,
    requestBlokLink,
    type BlokLinkSuggestionDto,
} from "../blokLinkApi"
import type { BlokLink } from "../types"

/* ──────────────────────────────────────────────────────────────────────────
   BlokLinkSuggestion — the blok offers the table the player is already
   sitting at (BLOK-LINK.md §8).

   WHY THIS EXISTS AT ALL
   ──────────────────────
   Everything the three-step picker asks — which tournament, which table,
   which of the two pairs is "us" — the server already knows for a signed-in
   player registered with one of their own pairs. §8.1 spells out when: an
   approved pair of theirs, a live tournament, a match of the active round with
   both pairs in it, and no link on that match yet. When all of it holds there
   is exactly one honest answer, so the blok states it instead of asking three
   questions whose answers are on the table in front of the player.

   WHEN NOTHING IS OFFERED, NOTHING HAPPENS
   ────────────────────────────────────────
   Signed out this component makes no request whatsoever — the blok's oldest
   promise (BLOK.md) is that a scorepad with no account talks to nobody, and
   §8.1's first condition is sign-in anyway. An empty list is the ordinary
   answer for everybody else, and it renders nothing: a kitchen-table blok
   looks exactly as it did before any of this was written.

   THE DISMISSAL HAS TO STICK, AND WHY IT LIVES HERE
   ─────────────────────────────────────────────────
   An offer that returns on every open is nagging, and this one would return
   every time — the server's conditions stay true for as long as the round is
   open. So a dismissal is remembered per MATCH, in this component's own
   localStorage key rather than in `BlokGame`.

   Per match and not per session is the only reading that behaves: the offer is
   about one table in one round, so refusing it must outlive "Nova igra" (same
   table, next game — the offer would otherwise be back mid-series) and must
   NOT outlive the round (a new round is a new table, and a player who said no
   at table 4 has said nothing about table 7).

   It is deliberately NOT in the store: it is a UI preference about an offer,
   not part of the record of an evening's play, and `BlokStorageV1` should not
   grow a field for something that no longer matters once the round closes.
   ────────────────────────────────────────────────────────────────────── */

/** Dismissed match ids. Own key, own version — nothing else reads it. */
const DISMISS_KEY = "bela:blok:link-offer-dismissed:v1"

/**
 * How many refusals are remembered. A tournament evening is a handful of
 * rounds, so this is generous; the cap exists only so a key nothing ever
 * prunes cannot grow without bound on a phone that plays every weekend.
 */
const DISMISS_MAX = 40

/** Read the dismissals. Any unreadable value is "nothing dismissed": the cost
 *  is one offer shown again, against a crash on a private-mode browser. */
function readDismissed(): number[] {
    try {
        const raw = window.localStorage.getItem(DISMISS_KEY)
        if (raw === null) return []
        const parsed: unknown = JSON.parse(raw)
        return Array.isArray(parsed)
            ? parsed.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
            : []
    } catch {
        return []
    }
}

/** Remember one more refusal. Silent on failure — a full or blocked storage
 *  means the offer may come back, which is a nuisance and never a fault. */
function rememberDismissed(matchId: number): void {
    try {
        const next = [matchId, ...readDismissed().filter((id) => id !== matchId)].slice(0, DISMISS_MAX)
        window.localStorage.setItem(DISMISS_KEY, JSON.stringify(next))
    } catch {
        /* private mode, quota, storage disabled — not worth a word to anyone */
    }
}

export default function BlokLinkSuggestion({
    signedIn,
    sessionId,
    onLinked,
}: {
    /** From `AuthContext`. False means this component does nothing at all —
     *  no request, no render (§8.1, condition 1). */
    signedIn: boolean
    /** The series this table would keep, carried into the request (§6.2). */
    sessionId: string
    /** Accepted: the link the scorepad now carries, PENDING until approved. */
    onLinked: (link: BlokLink) => void
}) {
    const { t } = useTranslation()
    const [offer, setOffer] = useState<BlokLinkSuggestionDto | null>(null)
    const [busy, setBusy] = useState(false)
    const [failed, setFailed] = useState(false)

    /* One read, on mount. Not polled: the answer changes when a round is drawn,
       which is minutes apart and always accompanied by the player picking the
       phone up — and a strip that appeared under somebody's thumb mid-deal
       would be worse than one they have to reopen the blok to see. */
    useEffect(() => {
        if (!signedIn) return
        let cancelled = false
        void fetchBlokLinkSuggestions()
            .then((items) => {
                if (cancelled) return
                const dismissed = readDismissed()
                setOffer(items.find((item) => !dismissed.includes(item.matchId)) ?? null)
            })
            .catch(() => {
                /* Offline, or a backend without §8 yet. Offering nothing is the
                   correct behaviour for both, and the menu's manual path is
                   untouched — so there is nothing to report to anybody. */
            })
        return () => {
            cancelled = true
        }
    }, [signedIn])

    const accept = useCallback(async () => {
        if (offer === null || busy) return
        setBusy(true)
        setFailed(false)
        try {
            // No `requestedByName`: §8 offers are signed-in by definition, so
            // the account names the requester (§7.1).
            const dto = await requestBlokLink({
                matchId: offer.matchId,
                usPairId: offer.myPairId,
                sessionId,
            })
            onLinked(createdBlokLink(dto, {
                tournamentUuid: offer.tournamentUuid,
                tournamentName: offer.tournamentName,
                roundNumber: offer.roundNumber,
                tableNo: offer.tableNo,
                matchId: offer.matchId,
                usPairId: offer.myPairId,
                usPairName: offer.myPairName,
                themPairName: offer.opponentPairName,
            }))
            setOffer(null)
        } catch {
            // 400/409 are silenced by the API module, and here that is doubly
            // right: `LINK_EXISTS` means somebody at the same table was one tap
            // faster, which is not the player's mistake to be told off for. One
            // quiet line, and the offer stays so they can try again.
            setFailed(true)
        } finally {
            setBusy(false)
        }
    }, [offer, busy, sessionId, onLinked])

    const dismiss = useCallback(() => {
        if (offer === null) return
        rememberDismissed(offer.matchId)
        setOffer(null)
    }, [offer])

    if (!signedIn || offer === null) return null

    /* "Runda 3 · Stol 4" — labels joined by a middot, not a translated
       sentence, exactly as `BlokLinkStrip` does it: the order is the same in
       both languages and neither part is a countable noun. */
    const where = [
        t("blok.link.round", { n: offer.roundNumber }),
        offer.tableNo === null
            ? t("blok.link.tableUnknown")
            : t("blok.link.table", { n: offer.tableNo }),
    ].join(" · ")

    return (
        <Box
            // The same brand-tinted panel the rest of the blok uses for "here
            // is something you can do", never the yellow of "waiting on
            // somebody" — nothing is pending until the player taps.
            colorPalette="brand"
            mt="3"
            px="3"
            py="2.5"
            rounded="l2"
            borderWidth="1px"
            borderColor="colorPalette.emphasized"
            bg="colorPalette.subtle"
        >
            <HStack gap="2.5" align="start">
                <Box color="colorPalette.fg" flexShrink="0" mt="0.5" display="flex" aria-hidden="true">
                    <FiLink2 size={16} />
                </Box>

                <VStack gap="0" align="start" flex="1" minW="0">
                    <Text fontSize="sm" fontWeight="semibold" color="colorPalette.fg" maxW="100%">
                        {t("blok.link.offer.title", { tournament: offer.tournamentName })}
                    </Text>
                    <Text fontSize="xs" color="fg.muted" truncate maxW="100%">
                        {where}
                    </Text>
                    <Text fontSize="xs" color="fg.subtle" truncate maxW="100%">
                        {t("blok.link.offer.pairs", {
                            pair: offer.myPairName,
                            opponent: offer.opponentPairName,
                        })}
                    </Text>

                    {failed ? (
                        <HStack gap="1.5" mt="1" color="fg.muted">
                            <Box flexShrink="0" display="flex" aria-hidden="true">
                                <FiAlertCircle size={12} />
                            </Box>
                            <Text fontSize="xs">{t("blok.link.error.generic")}</Text>
                        </HStack>
                    ) : null}

                    <HStack gap="2" mt="2">
                        <Button
                            size="xs"
                            colorPalette="brand"
                            loading={busy}
                            onClick={() => { void accept() }}
                        >
                            {t("blok.link.offer.action")}
                        </Button>
                        <Button size="xs" variant="ghost" onClick={dismiss} disabled={busy}>
                            <FiX /> {t("blok.link.offer.dismiss")}
                        </Button>
                    </HStack>
                </VStack>
            </HStack>
        </Box>
    )
}
