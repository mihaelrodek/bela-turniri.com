import { useEffect, useRef, useState } from "react"
import { Badge, Box, CloseButton, Dialog, HStack, Portal, Text, VStack } from "@chakra-ui/react"
import type { DealScore, Team } from "@bela/engine"
import { useTranslation } from "../../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   DealSummary — what a deal actually paid, shown when the eighth trick is in.

   Bela's scoring has three moving parts a player must be able to audit
   (cards incl. the last-trick 10 and a possible štiglja, the defended
   declarations, and the pass/fall verdict that can hand EVERYTHING to the
   other side), so this lists them as lines rather than announcing a single
   number nobody can check — and the verdict gets a sentence, because "we
   made 90 and still scored 0" is the single most confusing thing that
   happens to somebody learning the game.

   It is a RECEIPT, not a decision (changed 2026-09-08 on the user's
   request): there is no "Sljedeća podjela" button to press. It closes itself
   after AUTO_CLOSE_MS, and the ✕ only skips the remaining seconds.

   Closing it — either way — ACKS the deal (`game.nextDeal`, 2026-09-20). The
   server treats that as one vote per seat and deals again once every
   connected human has voted, so a table of one person and three bots moves on
   the moment this dialog goes away instead of sitting on "Čekaj…" for the
   rest of the server's fallback timer. The ack is sent AFTER the dismissal,
   so the next deal can never arrive behind an open modal, and it is sent at
   most once per deal. A spectator has no seat and therefore no vote
   (`canContinue` is false for them; the server would answer NOT_YOUR_TURN).

   Deliberately not shown: the deal number (the scoreboard already carries
   it) and the prose explaining a fall (the red "Pali smo" badge and a
   0 in "Upisano" say it in the time this dialog is actually on screen).
   ────────────────────────────────────────────────────────────────────── */

/**
 * How long the receipt stays up before it dismisses itself and acks.
 *
 * Budgeted against the server's `dealDoneAutoMs` fallback (5 000 ms): this
 * dialog only opens once the event queue is idle, which is ~2.3 s after the
 * deal was scored (the last card's own dwell plus the trick sweep), so
 * 2.3 s + AUTO_CLOSE_MS has to stay under that timer for the ack — not the
 * timer — to be what moves the table.
 */
const AUTO_CLOSE_MS = 2500

function Row({
    label,
    us,
    them,
    muted = false,
    strong = false,
}: {
    label: string
    us: number
    them: number
    muted?: boolean
    strong?: boolean
}) {
    return (
        <HStack justify="space-between" gap="3">
            <Text fontSize="sm" color={muted ? "fg.muted" : "fg"} fontWeight={strong ? "bold" : "normal"}>
                {label}
            </Text>
            <HStack gap="4" minW="110px" justify="end">
                <Text
                    textStyle="mono"
                    fontSize="sm"
                    minW="42px"
                    textAlign="end"
                    fontWeight={strong ? "bold" : "normal"}
                >
                    {us}
                </Text>
                <Text
                    textStyle="mono"
                    fontSize="sm"
                    minW="42px"
                    textAlign="end"
                    color="fg.muted"
                    fontWeight={strong ? "bold" : "normal"}
                >
                    {them}
                </Text>
            </HStack>
        </HStack>
    )
}

export default function DealSummary({
    open,
    dealScore,
    myTeam,
    canContinue = false,
    onNextDeal,
    // `busy` stays in the type and is deliberately unused: nothing in this
    // dialog waits on the connection — it is a receipt, and the ack below is
    // fire-and-forget.
}: {
    open: boolean
    dealScore: DealScore | null
    myTeam: Team
    busy?: boolean
    /** We hold a seat, so our ack counts. False for a spectator. */
    canContinue?: boolean
    onNextDeal?: () => void
}) {
    const { t } = useTranslation()

    /* Read through refs, never through effect deps: the auto-close timeout
       below must survive re-renders (the parent passes a fresh arrow for
       `onNextDeal` on every one of them), and re-arming it each render would
       mean it never fires. */
    const nextDealRef = useRef(onNextDeal)
    nextDealRef.current = onNextDeal
    const canContinueRef = useRef(canContinue)
    canContinueRef.current = canContinue
    const ackedDeal = useRef<number | null>(null)

    /* Dismissal is owned HERE, not by the parent: the parent's `open` is
       derived from the phase, and the whole point is to disappear before the
       phase changes. Keyed by deal number so the next deal's receipt shows
       again after this one was dismissed early. */
    const dealNo = dealScore?.dealNo ?? null
    const [dismissedDeal, setDismissedDeal] = useState<number | null>(null)
    const shown = open && dealNo !== null && dismissedDeal !== dealNo

    /** Close, then tell the table we are done with this receipt — once. */
    const dismiss = (deal: number): void => {
        setDismissedDeal(deal)
        if (!canContinueRef.current || ackedDeal.current === deal) return
        ackedDeal.current = deal
        nextDealRef.current?.()
    }

    // Hooks run before the early return: `dealScore` is null between deals.
    useEffect(() => {
        if (!shown || dealNo === null) return
        const id = setTimeout(() => dismiss(dealNo), AUTO_CLOSE_MS)
        return () => clearTimeout(id)
        // `dismiss` reads everything it needs from refs, so this timer is
        // deliberately not re-armed when the parent re-renders.
    }, [shown, dealNo])

    if (!dealScore) return null

    const theirTeam: Team = myTeam === "A" ? "B" : "A"
    const weCalled = dealScore.callerTeam === myTeam
    const goodForUs = dealScore.passed === weCalled

    return (
        <Dialog.Root open={shown} placement="center" closeOnInteractOutside={false}>
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "sm" }}>
                        <CloseButton
                            aria-label={t("common.close")}
                            position="absolute"
                            top="2"
                            right="2"
                            size="sm"
                            variant="ghost"
                            onClick={() => dismiss(dealScore.dealNo)}
                        />
                        <Dialog.Body pt="5">
                            <VStack gap="2" align="stretch">
                                <HStack gap="2" wrap="wrap">
                                    <Badge
                                        size="sm"
                                        variant="solid"
                                        colorPalette={goodForUs ? "green" : "red"}
                                    >
                                        {weCalled
                                            ? dealScore.passed ? t("game.deal.wePassed") : t("game.deal.weFell")
                                            : dealScore.passed ? t("game.deal.theyPassed") : t("game.deal.theyFell")}
                                    </Badge>
                                    {dealScore.stiglja && (
                                        <Badge size="sm" variant="solid" colorPalette="brand">
                                            {dealScore.stiglja === myTeam
                                                ? t("game.deal.stigljaUs")
                                                : t("game.deal.stigljaThem")}
                                        </Badge>
                                    )}
                                </HStack>

                                <HStack justify="end" gap="4" pt="1">
                                    <Text fontSize="2xs" color="fg.muted" minW="42px" textAlign="end">
                                        {t("game.score.us")}
                                    </Text>
                                    <Text fontSize="2xs" color="fg.muted" minW="42px" textAlign="end">
                                        {t("game.score.them")}
                                    </Text>
                                </HStack>

                                <Row
                                    label={t("game.deal.cardPoints")}
                                    us={dealScore.cardPoints[myTeam]}
                                    them={dealScore.cardPoints[theirTeam]}
                                />
                                <Row
                                    label={t("game.deal.declarationPoints")}
                                    us={dealScore.declarationPoints[myTeam]}
                                    them={dealScore.declarationPoints[theirTeam]}
                                    muted
                                />
                                <Box borderTopWidth="1px" borderColor="border.subtle" pt="2">
                                    <Row
                                        label={t("game.deal.awarded")}
                                        us={dealScore.total[myTeam]}
                                        them={dealScore.total[theirTeam]}
                                        strong
                                    />
                                </Box>
                            </VStack>
                        </Dialog.Body>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
