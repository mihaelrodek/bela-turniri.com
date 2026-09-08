import { useEffect, useState } from "react"
import { Badge, Box, CloseButton, Dialog, HStack, Portal, Text, VStack } from "@chakra-ui/react"
import type { DealScore, Team } from "@bela/engine"
import { useTranslation } from "../../i18n"
import { suitKey } from "../util/cards"
import SuitGlyph from "./SuitGlyph"

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
   request): the server deals the next hand on its own after
   `dealDoneAutoMs`, so there is no "Sljedeća podjela" button to press and
   nobody waits on anybody. This closes itself after AUTO_CLOSE_MS — kept
   just under the server's timer so the next deal never arrives behind an
   open modal — and the ✕ only skips the remaining seconds.

   Deliberately not shown: the deal number (the scoreboard already carries
   it) and the prose explaining a fall (the red "Pali smo" badge and a
   0 in "Upisano" say it in the time this dialog is actually on screen).
   ────────────────────────────────────────────────────────────────────── */

/** How long the receipt stays up. Below `dealDoneAutoMs` on the server. */
const AUTO_CLOSE_MS = 3000

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
    // `busy` / `canContinue` / `onNextDeal` are still passed by the call
    // site and deliberately NOT destructured: the deal now advances
    // server-side, so nothing here waits on them. They stay in the type so
    // the parent keeps compiling until it is next touched.
}: {
    open: boolean
    dealScore: DealScore | null
    myTeam: Team
    busy?: boolean
    canContinue?: boolean
    onNextDeal?: () => void
}) {
    const { t } = useTranslation()

    /* Dismissal is owned HERE, not by the parent: the parent's `open` is
       derived from the phase, and the whole point is to disappear before the
       phase changes. Keyed by deal number so the next deal's receipt shows
       again after this one was dismissed early. */
    const dealNo = dealScore?.dealNo ?? null
    const [dismissedDeal, setDismissedDeal] = useState<number | null>(null)
    const shown = open && dealNo !== null && dismissedDeal !== dealNo

    // Hooks run before the early return: `dealScore` is null between deals.
    useEffect(() => {
        if (!shown || dealNo === null) return
        const id = setTimeout(() => setDismissedDeal(dealNo), AUTO_CLOSE_MS)
        return () => clearTimeout(id)
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
                            onClick={() => setDismissedDeal(dealScore.dealNo)}
                        />
                        <Dialog.Body pt="5">
                            <VStack gap="2" align="stretch">
                                <HStack gap="2" wrap="wrap">
                                    <Badge size="sm" variant="subtle" colorPalette="brand">
                                        <SuitGlyph suit={dealScore.trump} size={12} />
                                        {t(suitKey(dealScore.trump))}
                                    </Badge>
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
