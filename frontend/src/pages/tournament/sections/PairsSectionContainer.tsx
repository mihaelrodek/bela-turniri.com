import { Suspense, useMemo, useState } from "react"
import { Box, Button, chakra, Dialog, Heading, HStack, Input, NativeSelect, Portal, Text, VStack } from "@chakra-ui/react"

import PairsSection from "../../../components/PairsSection"
import SelfRegisterNudgeDialog from "../../../components/SelfRegisterNudgeDialog"
import { useAuth } from "../../../auth/authContextValue"
import { useTranslation } from "../../../i18n"
import { anonRegisteredPairIds } from "../../../utils/anonSelfReg"
import { PHONE_COUNTRIES, sanitizePhone } from "../../../utils/phone"
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
    /* anonymous registration — the nudge that precedes the form, the phone the
       organiser will call, and the claim link handed back afterwards */
    selfRegNudgeOpen: boolean
    setSelfRegNudgeOpen: (open: boolean) => void
    /** "Prijavi se" in the nudge → /prijava, owned by the page (it navigates). */
    onSelfRegisterSignIn: () => void
    selfRegPhoneCountry: string
    setSelfRegPhoneCountry: (code: string) => void
    selfRegPhone: string
    setSelfRegPhone: (phone: string) => void
    selfRegClaim: { claimUrl: string; name: string } | null
    setSelfRegClaim: (claim: { claimUrl: string; name: string } | null) => void
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
    selfRegNudgeOpen,
    setSelfRegNudgeOpen,
    onSelfRegisterSignIn,
    selfRegPhoneCountry,
    setSelfRegPhoneCountry,
    selfRegPhone,
    setSelfRegPhone,
    selfRegClaim,
    setSelfRegClaim,
}: PairsSectionContainerProps) {
    const { t: tr } = useTranslation()
    const { user } = useAuth()
    const [claimLinkCopied, setClaimLinkCopied] = useState(false)

    const [pairRequestsCollapsed, setPairRequestsCollapsed] = useState(false)

    const tournamentLocked = t.status === "FINISHED"

    // True when the current user already has at least one pair (pending or
    // approved) in this tournament. We DON'T use this to hide the button —
    // multiple registrations are legitimate (e.g. a captain entering several
    // teams). It only relabels the button so a user who already has a pair
    // sees "Prijavi još jedan par" instead of the default.
    // For an anonymous visitor there is no uid to compare against — the server
    // deliberately does not know who filed the row — so the only evidence is
    // the receipt this device kept when it registered. Read once per pair-list
    // change; localStorage access is cheap but not free, and this runs on every
    // poll tick otherwise.
    const userAlreadyRegistered = useMemo(() => {
        if (viewerUid) return pairs.some((p) => p.submittedByUid === viewerUid)
        if (user) return false
        const mine = anonRegisteredPairIds(uuid)
        return pairs.some((p) => mine.has(p.id))
        // `pairs` is enough of a trigger: a fresh anonymous registration is
        // appended to it in the same tick the receipt is written.
    }, [viewerUid, pairs, user, uuid])

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
                                {/* Presets are per-account; an anonymous
                                    visitor has none to offer. */}
                                {user && availablePresets.length > 0 && (
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

                                {/* Anonymous only, and required: with no account
                                    behind the row this number is the organiser's
                                    only way to reach the pair. */}
                                {!user && (
                                    <Box>
                                        <Text fontSize="xs" color="fg.muted" mb="1.5" fontWeight="medium">
                                            {tr("tournament.selfReg.phoneLabel")}
                                        </Text>
                                        <HStack gap="2">
                                            <NativeSelect.Root size="sm" width="8.5rem" flexShrink={0}>
                                                <NativeSelect.Field
                                                    aria-label={tr("tournament.selfReg.phoneCountryLabel")}
                                                    value={selfRegPhoneCountry}
                                                    onChange={(e) =>
                                                        setSelfRegPhoneCountry((e.target as HTMLSelectElement).value)
                                                    }
                                                >
                                                    {PHONE_COUNTRIES.map((c) => (
                                                        <option key={c.value} value={c.value}>{c.label}</option>
                                                    ))}
                                                </NativeSelect.Field>
                                                <NativeSelect.Indicator />
                                            </NativeSelect.Root>
                                            <Input
                                                flex="1"
                                                size="sm"
                                                type="tel"
                                                inputMode="numeric"
                                                pattern="[0-9 ]*"
                                                placeholder={tr("tournament.selfReg.phonePlaceholder")}
                                                value={selfRegPhone}
                                                onChange={(e) => setSelfRegPhone(sanitizePhone(e.target.value))}
                                            />
                                        </HStack>
                                        <Text fontSize="xs" color="fg.muted" mt="1.5">
                                            {tr("tournament.selfReg.phoneHint")}
                                        </Text>
                                    </Box>
                                )}

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
                                    disabled={
                                        !selfRegName.trim()
                                        || selfRegSubmitting
                                        || (!user && !selfRegPhone.trim())
                                    }
                                    onClick={onSubmitSelfRegister}
                                >
                                    {tr("tournament.selfReg.submit")}
                                </Button>
                            </HStack>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>

            {/* ===== "Signing in is better, but not required" ===== */}
            <SelfRegisterNudgeDialog
                open={selfRegNudgeOpen}
                onSignIn={onSelfRegisterSignIn}
                onContinue={() => {
                    setSelfRegNudgeOpen(false)
                    setSelfRegOpen(true)
                }}
                onClose={() => setSelfRegNudgeOpen(false)}
            />

            {/* ===== Claim link, after an anonymous registration =====
                A dialog and not a toast: this link is the ONLY way the visitor
                can later attach the registration to an account, and a toast
                that auto-dismisses would take it with it. */}
            <Dialog.Root
                open={!!selfRegClaim}
                onOpenChange={(e) => {
                    if (!e.open) {
                        setSelfRegClaim(null)
                        setClaimLinkCopied(false)
                    }
                }}
                placement="center"
            >
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content maxW={{ base: "92%", md: "md" }}>
                            <Dialog.Header>
                                <Dialog.Title>{tr("tournament.selfReg.claim.title")}</Dialog.Title>
                            </Dialog.Header>
                            <Dialog.Body>
                                <Dialog.Description asChild>
                                    <VStack align="stretch" gap="3">
                                        <Text fontSize="sm">
                                            {tr("tournament.selfReg.claim.pending", {
                                                name: selfRegClaim?.name ?? "",
                                            })}
                                        </Text>
                                        <Text fontSize="sm" color="fg.muted">
                                            {tr("tournament.selfReg.claim.saveLink")}
                                        </Text>
                                        <Box
                                            borderWidth="1px"
                                            borderColor="border.subtle"
                                            bg="bg.subtle"
                                            rounded="md"
                                            p="2"
                                        >
                                            <Text fontSize="xs" wordBreak="break-all" fontFamily="mono">
                                                {selfRegClaim?.claimUrl}
                                            </Text>
                                        </Box>
                                    </VStack>
                                </Dialog.Description>
                            </Dialog.Body>
                            <Dialog.Footer gap="2">
                                <Button
                                    variant="outline"
                                    onClick={async () => {
                                        if (!selfRegClaim) return
                                        try {
                                            await navigator.clipboard.writeText(selfRegClaim.claimUrl)
                                            setClaimLinkCopied(true)
                                        } catch {
                                            // Older Safari / non-secure context: the
                                            // link is on screen and selectable, so
                                            // there is nothing to recover from.
                                            setClaimLinkCopied(false)
                                        }
                                    }}
                                >
                                    {claimLinkCopied
                                        ? tr("tournament.selfReg.claim.copied")
                                        : tr("tournament.selfReg.claim.copy")}
                                </Button>
                                <Button
                                    variant="solid"
                                    colorPalette="brand"
                                    onClick={() => {
                                        setSelfRegClaim(null)
                                        setClaimLinkCopied(false)
                                    }}
                                >
                                    {tr("common.close")}
                                </Button>
                            </Dialog.Footer>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>
        </>
    )
}
