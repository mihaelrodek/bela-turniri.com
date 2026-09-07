import { Suspense, useMemo, useState } from "react"
import { Box, Button, chakra, Dialog, Heading, HStack, Input, Text, VStack } from "@chakra-ui/react"

import PairsSection from "../../../components/PairsSection"
import { useTranslation } from "../../../i18n"
import lazyWithReload from "../../../utils/lazyWithReload"
import type { PairRequest } from "../../../api/pairRequests"
import type { UserPairPreset } from "../../../api/userPairPresets"
import type { PairShort } from "../../../types/pairs"
import type { TournamentDetails } from "../../../types/tournaments"

/* The podium selectors only exist for the organiser, only after a tournament
   finishes — a few hundred bytes nobody else ever needs. */
const PodiumEditor = lazyWithReload(() => import("../../../components/PodiumEditor"))

/** What the page's `pairsView` memo hands down — see TournamentDetailsPage. */
export type PairsView = {
    activePairs: PairShort[]
    displayActivePairs: PairShort[]
    displayEliminatedPairs: PairShort[]
    paidCount: number
    secondName: string | null
    thirdName: string | null
}

export type PairsSectionContainerProps = {
    t: TournamentDetails
    uuid: string | undefined
    pairs: PairShort[]
    pairsView: PairsView
    pairRequests: PairRequest[]
    canEditTournament: boolean
    viewerUid?: string | null
    /** True when the roster is locked because the tournament is under way. */
    tournamentAlready: boolean
    savingPairs: boolean
    approvingPairId: number | null
    buyingLifePairId: number | null
    pendingPairPaid: Map<number, boolean>
    onAddPair: () => number
    onChangePairName: (id: number, name: string) => void
    onPairNameBlur: (p: PairShort) => void
    onRemoveTempPair: (id: number) => void
    onRequestDeletePair: (p: PairShort) => void
    onApprovePair: (p: PairShort) => void
    onBuyExtraLife: (p: PairShort) => void
    onTogglePaid: (pairId: number, nextPaid: boolean) => void
    onStagePaid: (pairId: number, nextPaid: boolean) => void
    isLifeEligible: (p: PairShort) => boolean
    onOpenPairInfo: (pairId: number) => void
    /** Opens the dialog — or bounces an anonymous visitor to /prijava. */
    onSelfRegisterClick: () => void
    onPodiumUpdated: (t: TournamentDetails) => void
    /* self-register dialog state, owned by useTournamentPairsEditor so the
       page can fold `selfRegSubmitting` into `anySaveInFlight` */
    selfRegOpen: boolean
    setSelfRegOpen: (open: boolean) => void
    presets: UserPairPreset[]
    selfRegName: string
    setSelfRegName: (name: string) => void
    selfRegSubmitting: boolean
    selfRegError: string | null
    setSelfRegError: (err: string | null) => void
    onSubmitSelfRegister: () => void
}

/**
 * "Parovi" — the roster view plus the self-registration dialog that feeds it.
 *
 * The gating that used to sit in a render IIFE (which re-derived it on every
 * keystroke in a pair-name input) is memoised here, and `PairsSection` itself
 * stays purely presentational.
 */
export default function PairsSectionContainer({
    t,
    uuid,
    pairs,
    pairsView,
    pairRequests,
    canEditTournament,
    viewerUid,
    tournamentAlready,
    savingPairs,
    approvingPairId,
    buyingLifePairId,
    pendingPairPaid,
    onAddPair,
    onChangePairName,
    onPairNameBlur,
    onRemoveTempPair,
    onRequestDeletePair,
    onApprovePair,
    onBuyExtraLife,
    onTogglePaid,
    onStagePaid,
    isLifeEligible,
    onOpenPairInfo,
    onSelfRegisterClick,
    onPodiumUpdated,
    selfRegOpen,
    setSelfRegOpen,
    presets,
    selfRegName,
    setSelfRegName,
    selfRegSubmitting,
    selfRegError,
    setSelfRegError,
    onSubmitSelfRegister,
}: PairsSectionContainerProps) {
    const { t: tr } = useTranslation()

    const [pairRequestsCollapsed, setPairRequestsCollapsed] = useState(false)

    const tournamentLocked = t.status === "FINISHED"

    // True when the current user already has at least one pair (pending or
    // approved) in this tournament. We DON'T use this to hide the button —
    // multiple registrations are legitimate (e.g. a captain entering several
    // teams). It only relabels the button so a user who already has a pair
    // sees "Prijavi još jedan par" instead of the default.
    const userAlreadyRegistered = useMemo(
        () => !!viewerUid && pairs.some((p) => p.submittedByUid === viewerUid),
        [viewerUid, pairs],
    )

    // Self-registration is offered to everyone until the tournament starts
    // EXCEPT the organiser / admins. Owners already have a "Dodaj par"
    // affordance, and showing both to the same person was misleading — they
    // are functionally close enough that organisers hesitated over which to
    // click. Hiding the self-register button for owners + admins keeps "Dodaj
    // par" as the single canonical path.
    const showSelfRegisterButton = !tournamentAlready && !canEditTournament

    // Hide presets the current user has already submitted to *this*
    // tournament (case-insensitive), so they can't accidentally re-register
    // the same pair.
    const availablePresets = useMemo(() => {
        const alreadyRegisteredNames = new Set(
            pairs
                .filter((p) => viewerUid && p.submittedByUid === viewerUid)
                .map((p) => p.name?.trim().toLowerCase())
                .filter(Boolean) as string[],
        )
        return presets.filter((p) => !alreadyRegisteredNames.has(p.name.trim().toLowerCase()))
    }, [pairs, presets, viewerUid])

    return (
        <>
            <PairsSection
                status={t.status}
                winnerName={t.winnerName}
                secondName={pairsView.secondName}
                thirdName={pairsView.thirdName}
                pairs={pairs}
                displayActivePairs={pairsView.displayActivePairs}
                displayEliminatedPairs={pairsView.displayEliminatedPairs}
                paidCount={pairsView.paidCount}
                capacity={typeof t.maxPairs === "number" ? t.maxPairs : null}
                pairRequests={pairRequests}
                pairRequestsCollapsed={pairRequestsCollapsed}
                onTogglePairRequests={() => setPairRequestsCollapsed((v) => !v)}
                tournamentAlready={tournamentAlready}
                tournamentLocked={tournamentLocked}
                canEdit={canEditTournament}
                userAlreadyRegistered={userAlreadyRegistered}
                showSelfRegisterButton={showSelfRegisterButton}
                savingPairs={savingPairs}
                approvingPairId={approvingPairId}
                buyingLifePairId={buyingLifePairId}
                pendingPairPaid={pendingPairPaid}
                onAddPair={onAddPair}
                onChangePairName={onChangePairName}
                onPairNameBlur={onPairNameBlur}
                onRemoveTempPair={onRemoveTempPair}
                onRequestDeletePair={onRequestDeletePair}
                onApprovePair={onApprovePair}
                onBuyExtraLife={onBuyExtraLife}
                onTogglePaid={onTogglePaid}
                onStagePaid={onStagePaid}
                isLifeEligible={isLifeEligible}
                onOpenPairInfo={onOpenPairInfo}
                onSelfRegisterClick={onSelfRegisterClick}
                podiumSlot={
                    /* Podium selectors — visible only to the organiser, only
                       after the tournament finishes. Lets them record who came
                       2nd and 3rd so silver + bronze styling kicks in. Calls
                       PATCH /tournaments/{uuid}/podium directly on change; the
                       backend validates the names and returns the canonical
                       details. */
                    tournamentLocked && canEditTournament && pairs.length > 0 ? (
                        <Suspense fallback={null}>
                            <PodiumEditor
                                tournamentUuid={uuid ?? ""}
                                winnerName={t.winnerName ?? null}
                                secondPlaceName={t.secondPlaceName ?? null}
                                thirdPlaceName={t.thirdPlaceName ?? null}
                                pairs={pairs}
                                onUpdated={onPodiumUpdated}
                            />
                        </Suspense>
                    ) : undefined
                }
            />

            {/* ===== Self-register pair dialog ===== */}
            <Dialog.Root
                open={selfRegOpen}
                onOpenChange={(e) => {
                    if (!e.open) {
                        setSelfRegOpen(false)
                        setSelfRegError(null)
                        setSelfRegName("")
                    }
                }}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="md">
                        <Dialog.Header py="3" px="4" borderBottomWidth="1px" borderColor="border.emphasized">
                            <Heading size="sm">{tr("tournament.pairs.registerPair")}</Heading>
                        </Dialog.Header>
                        <Dialog.Body py="4" px="4">
                            <VStack align="stretch" gap="3">
                                {availablePresets.length > 0 && (
                                    <Box>
                                        <Text fontSize="xs" color="fg.muted" mb="1.5" fontWeight="medium">
                                            {tr("tournament.selfReg.savedPairs")}
                                        </Text>
                                        <HStack gap="1.5" wrap="wrap">
                                            {availablePresets.map((p) => (
                                                <Button
                                                    key={p.uuid}
                                                    size="xs"
                                                    variant={selfRegName === p.name ? "solid" : "outline"}
                                                    colorPalette={selfRegName === p.name ? "blue" : "gray"}
                                                    onClick={() => setSelfRegName(p.name)}
                                                >
                                                    {p.name}
                                                </Button>
                                            ))}
                                        </HStack>
                                    </Box>
                                )}

                                <Box>
                                    <Text fontSize="xs" color="fg.muted" mb="1.5" fontWeight="medium">
                                        {tr("tournament.pairs.nameLabel")}
                                    </Text>
                                    <Input
                                        autoFocus
                                        placeholder={tr("tournament.selfReg.namePlaceholder")}
                                        value={selfRegName}
                                        onChange={(e) => setSelfRegName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault()
                                                onSubmitSelfRegister()
                                            }
                                        }}
                                    />
                                </Box>

                                <Text fontSize="xs" color="fg.muted">
                                    {tr("tournament.selfReg.pendingNote.before")} <chakra.b color="yellow.fg">{tr("tournament.selfReg.pendingNote.bold")}</chakra.b> {tr("tournament.selfReg.pendingNote.after")}
                                </Text>

                                {selfRegError && (
                                    <Box borderWidth="1px" borderColor="red.muted" bg="red.subtle" rounded="md" p="2">
                                        <Text fontSize="sm" color="red.fg">{selfRegError}</Text>
                                    </Box>
                                )}
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer py="3" px="4" borderTopWidth="1px" borderColor="border.emphasized">
                            <HStack justify="flex-end" gap="2">
                                <Button
                                    variant="ghost"
                                    onClick={() => setSelfRegOpen(false)}
                                    disabled={selfRegSubmitting}
                                >
                                    {tr("common.cancel")}
                                </Button>
                                <Button
                                    variant="solid"
                                    colorPalette="blue"
                                    loading={selfRegSubmitting}
                                    disabled={!selfRegName.trim() || selfRegSubmitting}
                                    onClick={onSubmitSelfRegister}
                                >
                                    {tr("tournament.selfReg.submit")}
                                </Button>
                            </HStack>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>
        </>
    )
}
