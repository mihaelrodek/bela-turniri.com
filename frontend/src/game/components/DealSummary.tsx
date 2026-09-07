import { Badge, Box, Button, Dialog, Flex, HStack, Portal, Text, VStack } from "@chakra-ui/react"
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

   It does not auto-advance: the next deal starts on `game.nextDeal`, when
   the player has read it.
   ────────────────────────────────────────────────────────────────────── */

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
    busy = false,
    canContinue = true,
    onNextDeal,
}: {
    open: boolean
    dealScore: DealScore | null
    myTeam: Team
    busy?: boolean
    /** False for a spectator, who has nothing to press. */
    canContinue?: boolean
    onNextDeal: () => void
}) {
    const { t } = useTranslation()
    if (!dealScore) return null

    const theirTeam: Team = myTeam === "A" ? "B" : "A"
    const weCalled = dealScore.callerTeam === myTeam
    const goodForUs = dealScore.passed === weCalled

    return (
        <Dialog.Root open={open} placement="center" closeOnInteractOutside={false}>
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "sm" }}>
                        <Dialog.Header pb="2">
                            <Dialog.Title>{t("game.deal.summaryTitle", { n: dealScore.dealNo })}</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
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

                                {!dealScore.passed && (
                                    <Flex
                                        rounded="l2"
                                        bg="bg.subtle"
                                        borderWidth="1px"
                                        borderColor="border.subtle"
                                        px="3"
                                        py="2"
                                    >
                                        <Text fontSize="xs" color="fg.muted">
                                            {t("game.deal.fallExplained")}
                                        </Text>
                                    </Flex>
                                )}
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button
                                colorPalette="brand"
                                loading={busy}
                                disabled={!canContinue}
                                onClick={onNextDeal}
                                w="100%"
                            >
                                {canContinue ? t("game.deal.next") : t("game.deal.waitingForNext")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
