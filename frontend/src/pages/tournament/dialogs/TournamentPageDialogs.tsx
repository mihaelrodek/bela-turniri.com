import { Button, chakra, Dialog, HStack, Text } from "@chakra-ui/react"

import ConfirmDialog from "../../../components/ConfirmDialog"
import { useTranslation } from "../../../i18n"
import type { PairShort } from "../../../types/pairs"

/**
 * The confirmations that must work from ANY section, mounted at the page root.
 *
 * They live together because they share exactly one property: none of them
 * belongs to the section that triggers it. The pair-delete dialog in
 * particular used to sit inside the bracket branch, which meant the delete
 * button on Parovi opened nothing at all.
 */
export default function TournamentPageDialogs({
    tournamentName,
    deleteTournamentOpen,
    deletingTournament,
    onCloseDeleteTournament,
    onConfirmDeleteTournament,
    pendingDeletePair,
    deletingPair,
    onCloseDeletePair,
    onConfirmDeletePair,
    manualConfirmOpen,
    onCloseManualConfirm,
    onConfirmManualRound,
    resetTournamentOpen,
    resettingTournament,
    onCloseResetTournament,
    onConfirmResetTournament,
    hardResetRoundOpen,
    hardResettingRound,
    onCloseHardResetRound,
    onConfirmHardResetRound,
}: {
    tournamentName?: string | null
    /* Admin-only soft delete of the whole tournament. */
    deleteTournamentOpen: boolean
    deletingTournament: boolean
    onCloseDeleteTournament: () => void
    onConfirmDeleteTournament: () => void
    /* One pair. null = closed. */
    pendingDeletePair: PairShort | null
    deletingPair: boolean
    onCloseDeletePair: () => void
    onConfirmDeletePair: () => void
    /* "Do you really want the manual draw?" — step one of two. */
    manualConfirmOpen: boolean
    onCloseManualConfirm: () => void
    onConfirmManualRound: () => void
    /* Wipes every round in the tournament. */
    resetTournamentOpen: boolean
    resettingTournament: boolean
    onCloseResetTournament: () => void
    onConfirmResetTournament: () => void
    /* Wipes one round's matches and rolls the pair statistics back. */
    hardResetRoundOpen: boolean
    hardResettingRound: boolean
    onCloseHardResetRound: () => void
    onConfirmHardResetRound: () => void
}) {
    const { t: tr } = useTranslation()

    return (
        <>
            {/* Admin-only confirm dialog for soft-deleting the entire
                tournament. On confirm we DELETE it and bounce back to the list. */}
            <Dialog.Root
                open={deleteTournamentOpen}
                onOpenChange={(e) => { if (!e.open && !deletingTournament) onCloseDeleteTournament() }}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="sm">
                        <Dialog.Header>{tr("tournament.deleteTournament.title")}</Dialog.Header>
                        <Dialog.Body>
                            <Text>
                                {tr("tournament.deleteTournament.before")}{" "}
                                <chakra.b>{tournamentName}</chakra.b>
                                {tr("tournament.deleteTournament.after")}
                            </Text>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button
                                variant="ghost"
                                onClick={onCloseDeleteTournament}
                                disabled={deletingTournament}
                            >
                                {tr("common.cancel")}
                            </Button>
                            <Button
                                variant="solid"
                                colorPalette="red"
                                loading={deletingTournament}
                                onClick={onConfirmDeleteTournament}
                            >
                                {tr("tournament.deleteTournament.confirm")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>

            {/* Confirm-delete for a single pair. */}
            <Dialog.Root
                open={!!pendingDeletePair}
                onOpenChange={(e) => { if (!e.open && !deletingPair) onCloseDeletePair() }}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="sm">
                        <Dialog.Header>{tr("tournament.deletePair.title")}</Dialog.Header>
                        <Dialog.Body>
                            <Text>
                                {tr("tournament.deletePair.before")}
                                {" "}<chakra.b>{pendingDeletePair?.name}</chakra.b>
                                {" "}{tr("tournament.deletePair.after")}
                            </Text>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button
                                variant="ghost"
                                onClick={onCloseDeletePair}
                                disabled={deletingPair}
                            >
                                {tr("tournament.no")}
                            </Button>
                            <Button
                                variant="solid"
                                colorPalette="red"
                                loading={deletingPair}
                                onClick={onConfirmDeletePair}
                            >
                                {tr("tournament.deletePair.confirm")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>

            {/* Manual round generation — the opt-in prompt. Two steps so the
                organiser explicitly chooses the heavier flow (the auto button
                is still right there one tap away). */}
            <Dialog.Root
                open={manualConfirmOpen}
                onOpenChange={(e) => { if (!e.open) onCloseManualConfirm() }}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="sm">
                        <Dialog.Header>{tr("tournament.manualRound.confirmTitle")}</Dialog.Header>
                        <Dialog.Body>
                            <Text>{tr("tournament.manualRound.confirmBody")}</Text>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <HStack gap="2">
                                <Button variant="ghost" onClick={onCloseManualConfirm}>
                                    {tr("tournament.no")}
                                </Button>
                                <Button
                                    variant="solid"
                                    colorPalette="purple"
                                    onClick={onConfirmManualRound}
                                >
                                    {tr("tournament.manualRound.confirmYes")}
                                </Button>
                            </HStack>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>

            {/* Two-phase confirmations that replaced window.confirm(). The
                native dialog isn't themable, blocks the JS thread, and is
                suppressed outright by some mobile browsers in PWA mode. */}
            <ConfirmDialog
                open={resetTournamentOpen}
                title={tr("tournament.reset.confirmTitle")}
                description={tr("tournament.reset.confirmBody")}
                confirmLabel={tr("tournament.reset.confirmYes")}
                destructive
                busy={resettingTournament}
                onConfirm={onConfirmResetTournament}
                onCancel={onCloseResetTournament}
            />

            <ConfirmDialog
                open={hardResetRoundOpen}
                title={tr("tournament.round.resetConfirmTitle")}
                description={tr("tournament.round.resetConfirmBody")}
                confirmLabel={tr("tournament.reset.confirmYes")}
                destructive
                busy={hardResettingRound}
                onConfirm={onConfirmHardResetRound}
                onCancel={onCloseHardResetRound}
            />
        </>
    )
}
