import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import {
    Badge,
    Box,
    Button,
    Card,
    HStack,
    IconButton,
    Input,
    Text,
    VStack,
    chakra,
} from "@chakra-ui/react"
import { Link as RouterLink } from "react-router-dom"
import {
    FiArrowLeft,
    FiCheck,
    FiChevronDown,
    FiChevronRight,
    FiDollarSign,
    FiHeart,
    FiInfo,
    FiPhone,
    FiPlus,
    FiTrash2,
    FiUser,
    FiUserPlus,
    FiUsers,
    FiX,
} from "react-icons/fi"
import { FaMedal, FaTrophy } from "react-icons/fa"

import type { PairShort } from "../types/pairs"
import type { PairRequest } from "../api/pairRequests"
import EmptyState from "./EmptyState"
import { CONTENT_STICKY_TOP, NAVBAR_H } from "./navChrome"
import { usePlural, useTranslation } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   "Parovi" — the tournament's pair roster as a master/detail.

   LEFT (lg+) is a scannable list column: one card per pair carrying an
   initials avatar, the name, one small status line, a chevron, a kotizacija
   toggle and the match-history button. Cards are grouped by the state a pair
   is actually in — ČEKAJU ODOBRENJE (self-registrations the organiser has not
   approved yet), then the active pairs, then ELIMINIRANI (out, muted, showing
   the record they went out on). The first and last carry a heading because
   neither is self-evident from the rows; the active block does not, since it
   is the default bucket and its count is a chip in the header strip.
   RIGHT is a detail panel: an empty "Odaberi par"
   state until a card is clicked, then that pair's identity plus every
   per-pair action the organiser has over it (rename, approve, kotizacija,
   život, delete).

   Below lg the two panes never sit side by side — a 390px phone cannot carry
   a list and a panel at once, and a bottom sheet would fight both the pinned
   section band at the top and MobileTabBar at the bottom. Instead the panel
   REPLACES the list (push-to-detail, with a back arrow), so there is always
   exactly one full-width column, the page keeps its own single scroll, and
   nothing new has to be layered over the app chrome.

   This component is presentation only. Every mutation is a prop: the page
   owns the pair state, the offline write queue, the poll/socket refresh and
   the temp-row (negative id) convention, none of which this file knows about.
   ────────────────────────────────────────────────────────────────────── */

/** Where the pinned panes come to rest — navbar + the Container's py={6}. */
const PANE_TOP = CONTENT_STICKY_TOP
/** Viewport left for a pinned pane, minus a 16px breathing gap. The split
 *  only exists at lg+, where the navbar is always at its `md` height. */
const PANE_MAX_H = `calc(100dvh - ${NAVBAR_H.md + 24}px - 16px - env(safe-area-inset-top, 0px))`

/** Avatar with initials, used by the pair cards, the panel and the info dialog. */
export function PairAvatar({ name, eliminated }: { name: string; eliminated?: boolean }) {
    // Bela pairs are almost always named "Marko & Pero", so the separator has
    // to be dropped or every second avatar reads "M&" instead of "MP".
    const initials = (name || "?")
        .split(/\s+/)
        .filter((s) => /[\p{L}\p{N}]/u.test(s))
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join("") || "?"
    return (
        <Box
            w="34px"
            h="34px"
            rounded="full"
            bg={eliminated ? "bg.muted" : "blue.subtle"}
            color={eliminated ? "fg.muted" : "blue.fg"}
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontWeight="semibold"
            fontSize="xs"
            flexShrink={0}
        >
            {initials}
        </Box>
    )
}

/** Small uppercase group header with its count, e.g. "ELIMINIRANI · 4 para". */
function GroupHeading({ label, count }: { label: string; count: number }) {
    const plural = usePlural()
    return (
        <HStack mb="2" gap="2" align="baseline">
            <Text
                fontSize="2xs"
                color="fg.muted"
                fontWeight="semibold"
                letterSpacing="wider"
                textTransform="uppercase"
            >
                {label}
            </Text>
            <Text fontSize="xs" color="fg.muted">
                {plural("tournament.pairs.groupCount", count)}
            </Text>
        </HStack>
    )
}

/** One counter in the header strip: an icon, the number, and its unit.
 *
 *  This replaces the old full-width card of 2xl numerals. The information is
 *  identical — how many pairs, against what cap, how many paid — but a chip
 *  the height of a Badge sits on one line next to the roster buttons instead
 *  of claiming a band of its own above them, which is what "make it denser"
 *  actually means here. `palette` tints the whole chip (yellow over capacity,
 *  green once everyone has paid) rather than colouring the numeral alone.
 *
 *  Exported because the Cjenik tab — the other editable tab on this page —
 *  carries the same header strip and should not grow a private copy of it. */
export function CounterChip({
    icon,
    value,
    label,
    palette,
}: {
    icon: ReactNode
    value: number
    label: string
    palette?: "green" | "yellow"
}) {
    return (
        <HStack
            gap="1.5"
            px="2.5"
            py="1"
            rounded="full"
            borderWidth="1px"
            borderColor={palette ? `${palette}.muted` : "border.subtle"}
            bg={palette ? `${palette}.subtle` : "bg.subtle"}
            color={palette ? `${palette}.fg` : "fg.muted"}
            minW="0"
        >
            <Box flexShrink={0} display="flex" aria-hidden>
                {icon}
            </Box>
            <Text fontSize="sm" fontWeight="bold" lineHeight="1.2" flexShrink={0}>
                {value}
            </Text>
            <Text fontSize="xs" lineHeight="1.2" truncate>
                {label}
            </Text>
        </HStack>
    )
}

type PodiumRank = "first" | "second" | "third" | null

export type PairsSectionProps = {
    /** Tournament status drives the podium marks and every lock below. */
    status: string | null | undefined
    winnerName?: string | null
    secondName: string | null
    thirdName: string | null
    /** The whole roster — used for the counters only. */
    pairs: PairShort[]
    /** Already bucketed + podium-ordered by the page's `pairsView` memo. */
    displayActivePairs: PairShort[]
    displayEliminatedPairs: PairShort[]
    paidCount: number
    capacity: number | null
    /** Open "looking for a partner" ads, shown above the split. */
    pairRequests: PairRequest[]
    pairRequestsCollapsed: boolean
    onTogglePairRequests: () => void
    /** True once the tournament is under way — pair editing is frozen. */
    tournamentAlready: boolean
    /** True once FINISHED — everything is frozen. */
    tournamentLocked: boolean
    canEdit: boolean
    /** Whether the current visitor already registered a pair here. */
    userAlreadyRegistered: boolean
    showSelfRegisterButton: boolean
    savingPairs: boolean
    approvingPairId: number | null
    buyingLifePairId: number | null
    /** Pair ids whose paid flag is still sitting in the offline queue. */
    pendingPairPaid: Map<number, boolean>
    /** Adds an unsaved (negative id) row and returns its temp id. */
    onAddPair: () => number
    onChangePairName: (id: number, name: string) => void
    onPairNameBlur: (p: PairShort) => void
    /** Drops an unsaved row outright; saved pairs go through the dialog. */
    onRemoveTempPair: (id: number) => void
    onRequestDeletePair: (p: PairShort) => void
    onApprovePair: (p: PairShort) => void
    onBuyExtraLife: (p: PairShort) => void
    onTogglePaid: (pairId: number, nextPaid: boolean) => void
    /** Stamps the intended paid value BEFORE the name input's blur fires. */
    onStagePaid: (pairId: number, nextPaid: boolean) => void
    /** May this pair still buy a repasaž life right now? */
    isLifeEligible: (p: PairShort) => boolean
    onOpenPairInfo: (id: number) => void
    onSelfRegisterClick: () => void
    /** PodiumEditor, rendered by the page only when it applies. */
    podiumSlot?: ReactNode
}

export default function PairsSection(props: PairsSectionProps) {
    const { t: tr } = useTranslation()
    const plural = usePlural()
    const {
        status,
        winnerName,
        secondName,
        thirdName,
        pairs,
        displayActivePairs,
        displayEliminatedPairs,
        paidCount,
        capacity,
        pairRequests,
        pairRequestsCollapsed,
        onTogglePairRequests,
        tournamentAlready,
        tournamentLocked,
        canEdit,
        userAlreadyRegistered,
        showSelfRegisterButton,
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
        podiumSlot,
    } = props

    const finished = status === "FINISHED"
    const atCapacity = capacity != null && pairs.length >= capacity
    const overCapacity = capacity != null && pairs.length > capacity

    const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase()
    const podiumRankOf = (p: PairShort): PodiumRank => {
        if (!finished || !p.name) return null
        if (winnerName && norm(p.name) === norm(winnerName)) return "first"
        if (secondName && norm(p.name) === norm(secondName)) return "second"
        if (thirdName && norm(p.name) === norm(thirdName)) return "third"
        return null
    }

    /* Bela's three buckets. `displayActivePairs` / `displayEliminatedPairs`
       arrive already podium-ordered from the page; pending self-registrations
       are lifted out of both so the organiser's queue is the first thing the
       column shows. */
    const pendingPairs = useMemo(
        () => [...displayActivePairs, ...displayEliminatedPairs].filter((p) => !!p.pendingApproval),
        [displayActivePairs, displayEliminatedPairs],
    )
    const activeRows = useMemo(
        () => displayActivePairs.filter((p) => !p.pendingApproval),
        [displayActivePairs],
    )
    const eliminatedRows = useMemo(
        () => displayEliminatedPairs.filter((p) => !p.pendingApproval),
        [displayEliminatedPairs],
    )

    /* ── Master/detail selection ───────────────────────────────────────────
       A brand-new row is a temp id (negative) that the blur save swaps for a
       real one, which would otherwise close the panel the organiser is still
       working in. `lastSelectedName` remembers what was selected so the
       re-keyed row can be picked back up; if the pair genuinely went away
       (deleted) nothing matches and the selection clears, which is right. */
    const [selectedPairId, setSelectedPairId] = useState<number | null>(null)
    const lastSelectedNameRef = useRef<string>("")

    const selectedPair = useMemo(
        () => pairs.find((p) => p.id === selectedPairId) ?? null,
        [pairs, selectedPairId],
    )

    useEffect(() => {
        if (selectedPair) lastSelectedNameRef.current = selectedPair.name
    }, [selectedPair])

    useEffect(() => {
        if (selectedPairId == null) return
        if (pairs.some((p) => p.id === selectedPairId)) return
        // Only a TEMP row can come back under a new id. A saved pair that
        // disappeared was deleted, and re-selecting a namesake (two pairs may
        // legitimately share a name) would be the wrong guess.
        const wanted = selectedPairId < 0 ? norm(lastSelectedNameRef.current) : ""
        const reborn = wanted ? pairs.find((p) => norm(p.name) === wanted) : undefined
        setSelectedPairId(reborn ? reborn.id : null)
    }, [pairs, selectedPairId])

    function handleAddPair() {
        const tempId = onAddPair()
        setSelectedPairId(tempId)
    }

    /* The guided tour anchors on "a pair card": whichever row renders first,
       so the step still finds a target when every pair is pending or out. */
    const tourAnchorId = (pendingPairs[0] ?? activeRows[0] ?? eliminatedRows[0])?.id ?? null

    /* ---------- One card in the LEFT list ---------- */
    function renderPairRow(p: PairShort, eliminated: boolean, tourAnchor: boolean) {
        const hasServerId = typeof p.id === "number" && p.id > 0
        const isPending = !!p.pendingApproval
        const selected = p.id === selectedPairId
        const rank = podiumRankOf(p)
        const isPodium = rank != null
        const paid = !!p.paid
        // Kotizacija is only a thing before the tournament starts, only for an
        // approved pair, and only for whoever can edit the roster — the same
        // gate the panel's "Plati" sits behind.
        const canPayInRow = canEdit && !tournamentLocked && !tournamentAlready && !isPending

        // One status line under the name. Whatever the organiser is scanning
        // for at that moment: the approval queue first, then the running
        // record once matches exist, and the kotizacija state before that —
        // which is the thing they are literally checking at the door.
        const statusLine = isPending
            ? { text: tr("tournament.pairs.pendingApproval"), color: "yellow.fg" }
            : tournamentAlready
                ? {
                    text: eliminated
                        ? `${tr("tournament.pairs.winLoss", { wins: p.wins ?? 0, losses: p.losses ?? 0 })} · ${tr("tournament.pairs.eliminated")}`
                        : p.extraLife
                            ? `${tr("tournament.pairs.winLoss", { wins: p.wins ?? 0, losses: p.losses ?? 0 })} · ${tr("tournament.pairs.noLife")}`
                            : tr("tournament.pairs.winLoss", { wins: p.wins ?? 0, losses: p.losses ?? 0 }),
                    color: "fg.muted",
                }
                : {
                    text: paid ? tr("tournament.pairs.paid") : tr("tournament.pairs.unpaid"),
                    color: paid ? "green.fg" : "red.fg",
                }

        return (
            <Box
                key={p.id}
                role="button"
                tabIndex={0}
                data-tour={tourAnchor ? "detail-first-pair" : undefined}
                onClick={() => setSelectedPairId(p.id)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setSelectedPairId(p.id)
                    }
                }}
                cursor="pointer"
                borderWidth={selected || isPodium || isPending ? "2px" : "1px"}
                borderColor={
                    selected ? "blue.solid"
                        : rank === "first" ? "yellow.solid"
                        : rank === "second" ? "border.emphasized"
                        : rank === "third" ? "orange.solid"
                        : isPending ? "yellow.solid"
                        : "border.subtle"
                }
                rounded="xl"
                px="3"
                py="2.5"
                bg={
                    selected ? "blue.subtle"
                        : rank === "first" ? "yellow.subtle"
                        : rank === "third" ? "orange.subtle"
                        : isPending ? "yellow.subtle"
                        : eliminated ? "bg.subtle"
                        : "bg.panel"
                }
                opacity={!isPodium && eliminated ? 0.85 : 1}
                transition="border-color 0.12s, background 0.12s"
            >
                <HStack gap="2.5" align="center">
                    <PairAvatar name={p.name} eliminated={eliminated && !isPodium} />
                    {rank === "first" && (
                        <Box color="yellow.fg" flexShrink={0} title={tr("tournament.place.first")}>
                            <FaTrophy size={18} />
                        </Box>
                    )}
                    {rank === "second" && (
                        <Box color="fg.muted" flexShrink={0} title={tr("tournament.place.second")}>
                            <FaMedal size={18} />
                        </Box>
                    )}
                    {rank === "third" && (
                        <Box color="orange.fg" flexShrink={0} title={tr("tournament.place.third")}>
                            <FaMedal size={18} />
                        </Box>
                    )}
                    <Box flex="1" minW="0">
                        <Text
                            fontSize="sm"
                            fontWeight={isPodium ? "bold" : "medium"}
                            color="fg.ink"
                            truncate
                        >
                            {p.name?.trim() ? p.name : tr("tournament.pairs.noName")}
                        </Text>
                        <Text fontSize="2xs" color={statusLine.color} fontWeight={600} lineHeight="1.35" truncate>
                            {statusLine.text}
                        </Text>
                    </Box>
                    <Box color={selected ? "blue.fg" : "fg.muted"} flexShrink={0} aria-hidden>
                        <FiChevronRight />
                    </Box>
                    {/* Kotizacija, right in the row. An ACTION, not a badge:
                        at the door the organiser flips "this pair paid" dozens
                        of times and opening the panel for each one is the whole
                        cost. It is a real button with its own label, it stops
                        the row's select-this-pair click, and it goes through
                        exactly the props the panel's "Plati" uses — so the
                        offline queue, the optimistic `_pending` value and the
                        outcome subscription all behave identically. The paid
                        state stays readable without it (the status line under
                        the name still says Plaćeno / Nije plaćeno). */}
                    {canPayInRow && (
                        <IconButton
                            aria-label={paid
                                ? tr("tournament.pairs.markUnpaidTitle")
                                : tr("tournament.pairs.markPaidTitle")}
                            title={paid
                                ? tr("tournament.pairs.markUnpaidTitle")
                                : tr("tournament.pairs.markPaidTitle")}
                            size="xs"
                            variant={paid ? "subtle" : "outline"}
                            colorPalette={paid ? "green" : "red"}
                            // Same mousedown-before-blur trick as the panel: on a
                            // temp row the intended paid value has to be staged
                            // before the name input's blur save reads it.
                            onMouseDown={() => {
                                if (p.id < 0) onStagePaid(p.id, !paid)
                            }}
                            onClick={(e) => {
                                e.stopPropagation()
                                onTogglePaid(p.id, !paid)
                            }}
                            loading={pendingPairPaid.has(p.id) || (savingPairs && p.id < 0)}
                            disabled={savingPairs}
                            flexShrink={0}
                        >
                            <FiDollarSign />
                        </IconButton>
                    )}
                    <IconButton
                        aria-label={tr("tournament.pairs.matchHistory")}
                        size="xs"
                        variant="ghost"
                        onClick={(e) => {
                            e.stopPropagation()
                            onOpenPairInfo(p.id)
                        }}
                        disabled={!hasServerId}
                        title={tr("tournament.pairs.matchHistory")}
                        flexShrink={0}
                    >
                        <FiInfo />
                    </IconButton>
                </HStack>
            </Box>
        )
    }

    /* ---------- The LEFT column ---------- */
    const listPane =
        pairs.length === 0 ? (
            <Box
                borderWidth="1px"
                borderColor="border.subtle"
                borderStyle="dashed"
                rounded="xl"
                bg="bg.panel"
            >
                <EmptyState
                    icon={FiUser}
                    title={tr("tournament.pairs.emptyTitle")}
                    description={
                        canEdit
                            ? tr("tournament.pairs.emptyDescription")
                            : tr("tournament.pairs.emptyDescriptionReadonly")
                    }
                />
            </Box>
        ) : (
            <VStack align="stretch" gap="4">
                {pendingPairs.length > 0 && (
                    <Box>
                        <GroupHeading label={tr("tournament.pairs.pendingHeading")} count={pendingPairs.length} />
                        <VStack align="stretch" gap="2">
                            {pendingPairs.map((p) => renderPairRow(p, !!p.isEliminated, p.id === tourAnchorId))}
                        </VStack>
                    </Box>
                )}

                {/* No heading here on purpose — see the active chip in the
                    header strip. The other two groups keep theirs. */}
                {activeRows.length > 0 && (
                    <VStack align="stretch" gap="2">
                        {activeRows.map((p) => renderPairRow(p, !!p.isEliminated, p.id === tourAnchorId))}
                    </VStack>
                )}

                {eliminatedRows.length > 0 && (
                    <Box>
                        <GroupHeading label={tr("tournament.pairs.eliminatedHeading")} count={eliminatedRows.length} />
                        <VStack align="stretch" gap="2">
                            {eliminatedRows.map((p) => renderPairRow(p, true, p.id === tourAnchorId))}
                        </VStack>
                    </Box>
                )}
            </VStack>
        )

    /* ---------- The RIGHT pane ---------- */
    const detailPane = selectedPair ? (
        <PairDetailPanel
            key={selectedPair.id}
            pair={selectedPair}
            rank={podiumRankOf(selectedPair)}
            tournamentAlready={tournamentAlready}
            tournamentLocked={tournamentLocked}
            canEdit={canEdit}
            savingPairs={savingPairs}
            approvingPairId={approvingPairId}
            buyingLifePairId={buyingLifePairId}
            paidQueued={pendingPairPaid.has(selectedPair.id)}
            lifeEligible={isLifeEligible(selectedPair)}
            onBack={() => setSelectedPairId(null)}
            onChangePairName={onChangePairName}
            onPairNameBlur={onPairNameBlur}
            onApprovePair={onApprovePair}
            onBuyExtraLife={onBuyExtraLife}
            onTogglePaid={onTogglePaid}
            onStagePaid={onStagePaid}
            onDeletePair={() => {
                if (selectedPair.id <= 0) {
                    onRemoveTempPair(selectedPair.id)
                    setSelectedPairId(null)
                    return
                }
                onRequestDeletePair(selectedPair)
            }}
        />
    ) : (
        <Box
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="xl"
            bg="bg.panel"
            minH={{ base: "auto", lg: "320px" }}
            display="flex"
            alignItems="center"
            justifyContent="center"
        >
            <EmptyState
                compact
                icon={FiUsers}
                title={tr("tournament.pairs.detailEmptyTitle")}
                description={tr("tournament.pairs.detailEmptyDescription")}
            />
        </Box>
    )

    const openRequests = pairRequests.filter((r) => r.status === "OPEN")

    return (
        <VStack align="stretch" gap="4">
            {/* Header strip: counter chips on the left, roster actions on the
                right, no card. There is no "Spremi promjene" any more — the
                name input auto-saves on blur (see the page's onPairNameBlur)
                and kotizacija goes through the offline queue, so a manual save
                button had nothing left to do. */}
            <HStack justify="space-between" align="center" gap="2" rowGap="2">
                {/* The chips take the slack and wrap among themselves; the
                    buttons keep their own line-end and never get pushed onto a
                    row of their own at 390px. */}
                <HStack gap="2" wrap="wrap" minW="0" flex="1">
                    <CounterChip
                        icon={<FiUsers size={13} />}
                        value={pairs.length}
                        // "∞" when there's no cap — consistent with the count
                        // shown on the tournament cards / list.
                        label={
                            capacity != null
                                ? plural("tournament.pairs.capacityOf", pairs.length, { max: capacity })
                                : plural("tournament.pairs.capacityUnlimited", pairs.length)
                        }
                        palette={overCapacity ? "yellow" : undefined}
                    />
                    {!tournamentAlready && (
                        <CounterChip
                            icon={<FiDollarSign size={13} />}
                            value={paidCount}
                            label={plural("tournament.pairs.paidEntry", paidCount)}
                            palette={paidCount === pairs.length && pairs.length > 0 ? "green" : undefined}
                        />
                    )}
                    {/* The AKTIVNI group no longer carries a heading of its own —
                        it is the default bucket and "AKTIVNI · 3 para" directly
                        above three obviously-active rows said nothing the rows
                        did not. The count it did carry lives here instead, so
                        it is still one glance away. ČEKAJU ODOBRENJE and
                        ELIMINIRANI keep their headings: those groups are not
                        self-evident and would be unexplained without them. */}
                    <CounterChip
                        icon={<FiCheck size={13} />}
                        value={activeRows.length}
                        label={plural("tournament.pairs.activeCount", activeRows.length)}
                    />
                    {overCapacity && (
                        <Badge variant="solid" colorPalette="yellow" size="sm">
                            {tr("tournament.pairs.overCapacity", { n: pairs.length - (capacity ?? 0) })}
                        </Badge>
                    )}
                </HStack>
                <HStack gap="2" wrap="wrap" justify="flex-end" flexShrink={0}>
                    {/* Self-registration is offered to everyone. Anonymous users
                        get bounced to /prijava with state.from for return-redirect. */}
                    {showSelfRegisterButton && (
                        <Button size="xs" variant="solid" colorPalette="blue" onClick={onSelfRegisterClick}>
                            <FiPlus />{" "}
                            {userAlreadyRegistered
                                ? tr("tournament.pairs.registerAnother")
                                : tr("tournament.pairs.registerPair")}
                        </Button>
                    )}
                    {/* Organizer / admin: full pair management */}
                    {!tournamentLocked && canEdit && (
                        <Button
                            size="xs"
                            variant="outline"
                            onClick={handleAddPair}
                            disabled={tournamentAlready || atCapacity}
                            title={
                                atCapacity
                                    ? tr("tournament.pairs.atCapacityTitle", { max: capacity ?? 0 })
                                    : tr("tournament.pairs.addPairTitle")
                            }
                        >
                            <FiPlus /> {tr("tournament.pairs.addPair")}
                        </Button>
                    )}
                </HStack>
            </HStack>

            {/* Open pair-finding requests — visible only before the tournament
                starts and only if at least one is OPEN. Collapsible so the
                organizer can hide them once they have a handle on who's looking. */}
            {!tournamentAlready && openRequests.length > 0 && (
                <Card.Root variant="outline" rounded="xl" borderColor="blue.muted" bg="blue.subtle" shadow="sm">
                    <Card.Body py="3" px={{ base: "3", md: "4" }}>
                        <HStack justify="space-between" align="center" mb={pairRequestsCollapsed ? "0" : "3"}>
                            <HStack gap="2" align="center">
                                <Box color="blue.fg"><FiUserPlus /></Box>
                                <Text fontWeight="semibold" fontSize="sm">
                                    {tr("tournament.pairRequests.title")}
                                </Text>
                                <Badge variant="solid" colorPalette="blue" size="sm">
                                    {openRequests.length}
                                </Badge>
                            </HStack>
                            <IconButton
                                aria-label={pairRequestsCollapsed ? tr("tournament.expand") : tr("tournament.collapse")}
                                size="xs"
                                variant="ghost"
                                onClick={onTogglePairRequests}
                            >
                                {pairRequestsCollapsed ? <FiChevronRight /> : <FiChevronDown />}
                            </IconButton>
                        </HStack>
                        {!pairRequestsCollapsed && (
                            <Box
                                display="grid"
                                gridTemplateColumns={{ base: "1fr", md: "1fr 1fr", lg: "1fr 1fr" }}
                                gap="2"
                            >
                                {openRequests.map((r) => (
                                    <Box
                                        key={r.uuid}
                                        borderWidth="1px"
                                        borderColor="border.subtle"
                                        rounded="md"
                                        bg="bg.panel"
                                        p="2.5"
                                        display="flex"
                                        flexDirection="column"
                                        gap="1"
                                    >
                                        <HStack gap="2" align="center">
                                            <PairAvatar name={r.playerName} />
                                            <Text fontWeight="semibold" fontSize="sm" flex="1" minW="0" truncate>
                                                {r.playerName}
                                            </Text>
                                        </HStack>
                                        {r.phone && (
                                            <chakra.a
                                                href={`tel:${r.phone.replace(/\s+/g, "")}`}
                                                fontSize="xs"
                                                color="blue.fg"
                                                fontWeight="medium"
                                                display="flex"
                                                alignItems="center"
                                                gap="1.5"
                                                _hover={{ textDecoration: "underline" }}
                                            >
                                                <FiPhone size={11} /> {r.phone}
                                            </chakra.a>
                                        )}
                                        {r.note && (
                                            <Text fontSize="xs" color="fg.muted">{r.note}</Text>
                                        )}
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </Card.Body>
                </Card.Root>
            )}

            {/* Podium selectors — organiser only, FINISHED only. */}
            {podiumSlot}

            {/* With no pairs at all there is nothing to select, so the split
                collapses to the single "Još nema parova" state rather than
                pairing it with a second, redundant "Odaberi par" box. */}
            {pairs.length === 0 && listPane}

            {/* lg+: list beside panel, each pinned under the navbar so a long
                roster scrolls without dragging the panel off screen. */}
            <Box
                display={pairs.length === 0 ? "none" : { base: "none", lg: "grid" }}
                gridTemplateColumns="minmax(0, 1fr) minmax(0, 1.15fr)"
                gap="4"
                alignItems="start"
            >
                <Box
                    position="sticky"
                    top={PANE_TOP}
                    maxH={PANE_MAX_H}
                    overflowY="auto"
                    overscrollBehavior="contain"
                    pr="1"
                    css={{ scrollbarGutter: "stable" }}
                >
                    {listPane}
                </Box>
                <Box
                    position="sticky"
                    top={PANE_TOP}
                    maxH={PANE_MAX_H}
                    overflowY="auto"
                    overscrollBehavior="contain"
                    pr="1"
                    css={{ scrollbarGutter: "stable" }}
                >
                    {detailPane}
                </Box>
            </Box>

            {/* Below lg: push-to-detail — one column, never both. */}
            <Box display={pairs.length === 0 ? "none" : { base: "block", lg: "none" }}>
                {selectedPair ? detailPane : listPane}
            </Box>
        </VStack>
    )
}

/* ──────────────────────────────────────────────────────────────────────────
   The detail pane: one pair's identity and every action over it.
   ────────────────────────────────────────────────────────────────────── */
function PairDetailPanel({
    pair,
    rank,
    tournamentAlready,
    tournamentLocked,
    canEdit,
    savingPairs,
    approvingPairId,
    buyingLifePairId,
    paidQueued,
    lifeEligible,
    onBack,
    onChangePairName,
    onPairNameBlur,
    onApprovePair,
    onBuyExtraLife,
    onTogglePaid,
    onStagePaid,
    onDeletePair,
}: {
    pair: PairShort
    rank: PodiumRank
    tournamentAlready: boolean
    tournamentLocked: boolean
    canEdit: boolean
    savingPairs: boolean
    approvingPairId: number | null
    buyingLifePairId: number | null
    paidQueued: boolean
    lifeEligible: boolean
    onBack: () => void
    onChangePairName: (id: number, name: string) => void
    onPairNameBlur: (p: PairShort) => void
    onApprovePair: (p: PairShort) => void
    onBuyExtraLife: (p: PairShort) => void
    onTogglePaid: (pairId: number, nextPaid: boolean) => void
    onStagePaid: (pairId: number, nextPaid: boolean) => void
    onDeletePair: () => void
}) {
    const { t: tr } = useTranslation()

    const hasServerId = typeof pair.id === "number" && pair.id > 0
    const isPending = !!pair.pendingApproval
    const eliminated = !!pair.isEliminated
    const isPodium = rank != null
    const paid = !!pair.paid
    const canRename = canEdit && !tournamentAlready && !tournamentLocked
    const extraBtnDisabled = pair.extraLife || !lifeEligible || !hasServerId

    return (
        <Box
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="xl"
            bg="bg.panel"
            p={{ base: "3", md: "4" }}
        >
            {/* Tight stack: name, status, actions, one under the other with no
                rule between them. The panel used to space these on `gap="4"`
                with a divider above the buttons, which pushed "Plati" /
                "Ukloni par" a long way down a panel that is only ever three
                short rows tall and left an obvious hole in the middle. */}
            <VStack align="stretch" gap="2.5">
                {/* Identity. The name is editable in place, exactly as it was
                    in the old grid: typing marks the row dirty, blur saves a
                    still-unsaved (temp id) row. */}
                <HStack gap="2.5" align="center">
                    <IconButton
                        aria-label={tr("tournament.pairs.backToList")}
                        title={tr("tournament.pairs.backToList")}
                        size="sm"
                        variant="ghost"
                        display={{ base: "inline-flex", lg: "none" }}
                        onClick={onBack}
                    >
                        <FiArrowLeft />
                    </IconButton>
                    <PairAvatar name={pair.name} eliminated={eliminated && !isPodium} />
                    {rank === "first" && (
                        <Box color="yellow.fg" flexShrink={0} title={tr("tournament.place.first")}>
                            <FaTrophy size={20} />
                        </Box>
                    )}
                    {rank === "second" && (
                        <Box color="fg.muted" flexShrink={0} title={tr("tournament.place.second")}>
                            <FaMedal size={20} />
                        </Box>
                    )}
                    {rank === "third" && (
                        <Box color="orange.fg" flexShrink={0} title={tr("tournament.place.third")}>
                            <FaMedal size={20} />
                        </Box>
                    )}
                    <Box flex="1" minW="0">
                        {canRename ? (
                            <Input
                                size="sm"
                                variant="flushed"
                                autoFocus={pair.id < 0}
                                value={pair.name}
                                onChange={(e) => onChangePairName(pair.id, e.target.value)}
                                onBlur={() => onPairNameBlur(pair)}
                                placeholder={tr("tournament.pairs.nameLabel")}
                                fontWeight="semibold"
                                aria-label={tr("tournament.pairs.nameLabel")}
                            />
                        ) : (
                            <Text fontWeight="semibold" lineHeight="short" wordBreak="break-word">
                                {pair.name?.trim() ? pair.name : tr("tournament.pairs.noName")}
                            </Text>
                        )}
                    </Box>
                </HStack>

                {/* Who filed the registration, when it was a self-registration. */}
                {pair.submittedBySlug && (
                    <Text fontSize="xs" color="fg.muted">
                        {tr("tournament.pairs.submittedBy")}{" "}
                        <RouterLink
                            to={`/profil/${pair.submittedBySlug}`}
                            style={{ color: "var(--chakra-colors-blue-fg)", fontWeight: 500 }}
                        >
                            {pair.submittedByName || pair.submittedBySlug}
                        </RouterLink>
                    </Text>
                )}

                {/* Status pills and the actions share ONE row. The panel is only
                    ever a few lines tall, so a pill on its own line above a button
                    row left an obvious hole; wrap="wrap" lets them fall onto a
                    second line on a narrow screen instead of overflowing. The
                    pills stay visible to everyone; only the actions are gated. */}
                <HStack gap="2" wrap="wrap" align="center">
                    {isPending && (
                        <Badge variant="solid" colorPalette="yellow">
                            {tr("tournament.pairs.pendingApproval")}
                        </Badge>
                    )}
                    {tournamentAlready && (
                        <Badge variant="subtle" colorPalette="gray">
                            {tr("tournament.pairs.winLoss", { wins: pair.wins ?? 0, losses: pair.losses ?? 0 })}
                        </Badge>
                    )}
                    {/* Život status — "Ima život" while the pair is still on its
                        first life, "Nema život" once the safety-net repasaž life
                        is spent. A pair with one loss and no extraLife sits in
                        the buy-now middle zone and shows neither. */}
                    {tournamentAlready && !isPending && !eliminated && (pair.losses ?? 0) === 0 && (
                        <Badge variant="subtle" colorPalette="green">
                            <HStack gap="1"><FiHeart size={10} /> {tr("tournament.pairs.hasLife")}</HStack>
                        </Badge>
                    )}
                    {tournamentAlready && !isPending && !eliminated && pair.extraLife && (
                        <Badge variant="subtle" colorPalette="red">
                            <HStack gap="1"><FiHeart size={10} /> {tr("tournament.pairs.noLife")}</HStack>
                        </Badge>
                    )}
                    {eliminated && (
                        <Badge variant="subtle" colorPalette="gray">{tr("tournament.pairs.eliminated")}</Badge>
                    )}
                    {!tournamentAlready && !isPending && (
                        <Badge variant="subtle" colorPalette={paid ? "green" : "red"}>
                            <HStack gap="1">
                                {paid ? <FiCheck size={10} /> : <FiX size={10} />}
                                {paid ? tr("tournament.pairs.paid") : tr("tournament.pairs.unpaid")}
                            </HStack>
                        </Badge>
                    )}
                    {canEdit && (
                        <>
                        {isPending && (
                            <Button
                                size="xs"
                                variant="solid"
                                colorPalette="green"
                                loading={approvingPairId === pair.id}
                                disabled={approvingPairId != null}
                                onClick={() => onApprovePair(pair)}
                            >
                                <FiCheck /> {tr("tournament.pairs.approve")}
                            </Button>
                        )}
                        {!tournamentAlready && !isPending && (
                            <Button
                                size="xs"
                                variant={paid ? "outline" : "solid"}
                                colorPalette={paid ? "green" : "red"}
                                // onMouseDown fires BEFORE the name-input's blur, so the
                                // intended paid value is stamped now; the blur save runs
                                // next, reads it, and bakes it into its payload.
                                onMouseDown={() => {
                                    if (pair.id < 0) onStagePaid(pair.id, !paid)
                                }}
                                onClick={() => onTogglePaid(pair.id, !paid)}
                                loading={paidQueued || (savingPairs && pair.id < 0)}
                                disabled={savingPairs}
                                title={paid
                                    ? tr("tournament.pairs.markUnpaidTitle")
                                    : tr("tournament.pairs.markPaidTitle")}
                            >
                                <FiDollarSign />{" "}
                                {paid ? tr("tournament.pairs.markUnpaid") : tr("tournament.pairs.pay")}
                            </Button>
                        )}
                        {tournamentAlready && !tournamentLocked && !isPending && (
                            // Repasaž: buys a beaten pair one more life. Disabled
                            // (and tooltip-explained) when already bought, not yet
                            // eligible, or the pair has no server id yet.
                            <Button
                                size="xs"
                                variant="solid"
                                colorPalette={!pair.extraLife && lifeEligible ? "green" : "gray"}
                                disabled={extraBtnDisabled || buyingLifePairId != null}
                                loading={buyingLifePairId === pair.id}
                                onClick={() => onBuyExtraLife(pair)}
                                title={
                                    pair.extraLife ? tr("tournament.pairs.life.alreadyBought")
                                        : lifeEligible ? tr("tournament.pairs.life.buy")
                                        : !hasServerId ? tr("tournament.pairs.life.saveFirst")
                                        : tr("tournament.pairs.life.unavailable")
                                }
                            >
                                <HStack gap="1"><FiHeart /> {tr("tournament.pairs.life.label")}</HStack>
                            </Button>
                        )}
                        {!tournamentAlready && (
                            <Button
                                size="xs"
                                variant="outline"
                                colorPalette="red"
                                onClick={onDeletePair}
                                title={tr("tournament.pairs.removePair")}
                            >
                                <FiTrash2 /> {tr("tournament.pairs.removePair")}
                            </Button>
                        )}
                        </>
                    )}
                </HStack>
            </VStack>
        </Box>
    )
}
