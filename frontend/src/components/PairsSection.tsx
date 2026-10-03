import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode, RefObject } from "react"
import {
    Badge,
    Box,
    Button,
    Card,
    Checkbox,
    HStack,
    IconButton,
    Input,
    InputGroup,
    Text,
    VStack,
    chakra,
} from "@chakra-ui/react"
import { Link as RouterLink } from "react-router-dom"
import {
    FiCheck,
    FiChevronDown,
    FiChevronRight,
    FiDollarSign,
    FiFlag,
    FiHeart,
    FiInfo,
    FiPhone,
    FiPlus,
    FiRotateCcw,
    FiSearch,
    FiTrash2,
    FiUser,
    FiUserPlus,
    FiUsers,
    FiX,
} from "react-icons/fi"
import { FaMedal, FaTrophy } from "react-icons/fa"

import type { PairShort } from "../types/pairs"
import type { PairRequest } from "../api/pairRequests"
import { useAuth } from "../auth/authContextValue"
import EmptyState from "./EmptyState"
import SyncIndicator from "./SyncIndicator"
import ReportDialog from "./ReportDialog"
import { CONTENT_STICKY_TOP, NAVBAR_H, NAVBAR_TOP } from "./navChrome"
import { usePlural, useTranslation } from "../i18n"
import { formatDateTime } from "../utils/format"

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
   section band at the top and MobileTabBar at the bottom.

   2026-09-22: the phone layout used to REPLACE the list with the panel
   (push-to-detail, back arrow). That hid the roster behind every single
   tap — an organiser checking off kotizacija at the door paid a screen
   change per pair and lost their place in the list each time. The panel now
   EXPANDS IN PLACE under its own row (accordion, one open at a time, the
   chevron rotates and the row carries aria-expanded), so the surrounding
   pairs stay on screen and a second tap closes it. The back arrow is gone
   with the mode it belonged to. lg+ keeps the real side-by-side split: it
   has the width for it, and a list that stays put next to a pinned panel is
   strictly better than an accordion that reflows the column under the
   pointer.

   2026-10-03: "Dodaj par" no longer creates an empty row that is then named
   in the panel. A QUICK-ADD field sits permanently above the roster: type a
   name, Enter, and the pair is persisted at once (see QuickAddBar and the
   page's quickAddPair), flashed and scrolled to at the top of the active
   block, with the caret kept in the field for the next one. The "Dodaj par"
   buttons only focus that field. From 8 pairs on a search box sits above the
   list; it filters what is LISTED, never what is counted.

   2026-10-03 (layout): the three counter chips left the top strip. At lg+ they
   sit in the right column under the detail panel; below lg they sit between
   the quick-add card and the first row. The strip keeps only the
   self-registration button, so the organiser's tab starts at the quick-add card.

   2026-10-03 (soft delete): a removed pair is kept server-side and listed in
   "Obrisani parovi" directly after the roster, with a "Vrati" button, until
   the tournament starts.

   This component is presentation only. Every mutation is a prop: the page
   owns the pair state, the offline write queue, the poll/socket refresh and
   the temp-row (negative id) convention, none of which this file knows about.
   ────────────────────────────────────────────────────────────────────── */

/** Where the pinned panes come to rest — navbar + the Container's py={6}. */
/** Viewport left for a pinned pane, minus a 16px breathing gap. The split
 *  only exists at lg+, where the navbar is always at its `md` height. */
/** The sticky site footer (~64px) now lives at the bottom of the viewport on
 *  desktop, so a pinned pane must stop above it — otherwise its last rows sit
 *  behind the footer and cannot be scrolled into view (2026-10-03, reported). */
const SITE_FOOTER_H = 64
/** Height of the pinned quick-add card (measured, see `qaRef`), CSS var set on the root. */
const QA_H = "var(--pairs-qa-h, 0px)"
const PANE_MAX_H = `calc(100dvh - ${NAVBAR_H.md + 24}px - ${QA_H} - 24px - ${SITE_FOOTER_H}px - var(--safe-top))`
/** Height of the tournament page's pinned mobile band (title + section pills),
 *  measured into a CSS var; 0 on lg+, where it is display:none. */
const BAND_H = "var(--pairs-band-h, 0px)"
// Phone: everything pinned here must sit BELOW that band, not just the navbar —
// flush against it (no gap), so the list cannot show through between the two;
// the breathing room is the pinned card's own opaque top padding.
const QA_TOP = { base: `calc(${NAVBAR_TOP.base} + ${BAND_H})`, lg: CONTENT_STICKY_TOP.md }
const PANE_TOP_BELOW_QA = {
    base: `calc(${NAVBAR_TOP.base} + ${BAND_H} + ${QA_H})`,
    md: `calc(${CONTENT_STICKY_TOP.md} + ${QA_H})`,
}

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
 *  `size="xs"` is the mobile chip-row variant (see the base/sm header strip
 *  below): tighter padding and a smaller numeral so three chips plus a scroll
 *  affordance fit a 320px-wide phone without wrapping.
 *
 *  Exported because the Cjenik tab — the other editable tab on this page —
 *  carries the same header strip and should not grow a private copy of it. */
export function CounterChip({
    icon,
    value,
    label,
    palette,
    size = "sm",
    fill = false,
}: {
    icon: ReactNode
    value: number
    label: string
    palette?: "green" | "yellow"
    size?: "sm" | "xs"
    /** Share the row's width equally with the other chips, content centred. */
    fill?: boolean
}) {
    const dense = size === "xs"
    return (
        <HStack
            gap={dense ? "1" : "1.5"}
            px={dense ? "2" : "2.5"}
            py={dense ? "0.5" : "1"}
            rounded="full"
            borderWidth="1px"
            borderColor={palette ? `${palette}.muted` : "border.subtle"}
            bg={palette ? `${palette}.subtle` : "bg.subtle"}
            color={palette ? `${palette}.fg` : "fg.muted"}
            minW="0"
            flexShrink={fill ? 1 : 0}
            flex={fill ? "1 1 auto" : undefined}
            justifyContent={fill ? "center" : undefined}
        >
            <Box flexShrink={0} display="flex" aria-hidden>
                {icon}
            </Box>
            <Text
                fontSize={dense ? "xs" : "sm"}
                fontWeight="bold"
                fontFamily="mono"
                fontVariantNumeric="tabular-nums"
                lineHeight="1.2"
                flexShrink={0}
            >
                {value}
            </Text>
            <Text fontSize="xs" lineHeight="1.2" truncate>
                {label}
            </Text>
        </HStack>
    )
}

type PodiumRank = "first" | "second" | "third" | null

/** Result of persisting a quick-added pair — `id` 0 means "saved, row not
 *  located". On failure `error` is already user-facing text. */
export type QuickAddResult = { ok: true; id: number } | { ok: false; error: string }
export type QuickAddPair = (name: string, paid: boolean) => Promise<QuickAddResult>

/** Restore a soft-deleted pair; on failure `error` is already user-facing text
 *  (the roster-full / already-started 409s are mapped by the editor hook). */
export type RestorePair = (
    pairId: number,
) => Promise<{ ok: true; pair: PairShort } | { ok: false; error: string }>

/** Case/diacritics-insensitive, whitespace-collapsed comparison key. Used by
 *  the duplicate warning and the roster search. */
function fold(v: string | null | undefined): string {
    return (v ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/gi, "d")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
}

/** Searching only earns its row once the roster is long enough to scroll. */
const SEARCH_MIN_PAIRS = 8
const PAIR_NAME_MAX = 200
/** How long a freshly added row stays highlighted. */
const FLASH_MS = 1500

function readQuickPaid(key: string): boolean {
    try {
        return localStorage.getItem(key) === "1"
    } catch {
        return false
    }
}
function writeQuickPaid(key: string, v: boolean) {
    try {
        localStorage.setItem(key, v ? "1" : "0")
    } catch {
        /* storage blocked — the choice just is not remembered */
    }
}

/* The permanent quick-add row. Enter adds; a duplicate name asks first.
   The input is never disabled while a save is in flight (a disabled input
   drops focus and, on iOS, the keyboard) — submits are just ignored. A real,
   already-mounted input also means "Dodaj par" can focus it inside the tap
   gesture, which is all iOS needs, so the old off-screen keyboard proxy is
   gone. */
function QuickAddBar({
    inputRef,
    storageKey,
    existingNames,
    disabled,
    disabledTitle,
    fullMessage,
    onQuickAddPair,
    onAdded,
}: {
    inputRef: RefObject<HTMLInputElement | null>
    storageKey: string
    existingNames: string[]
    disabled: boolean
    disabledTitle: string
    /** Short message shown instead of the hint when the roster is full. */
    fullMessage: string | null
    onQuickAddPair: QuickAddPair
    onAdded: (id: number) => void
}) {
    const { t: tr } = useTranslation()
    const [value, setValue] = useState("")
    const [paid, setPaid] = useState(() => readQuickPaid(storageKey))
    const [dup, setDup] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [announce, setAnnounce] = useState("")
    const busyRef = useRef(false)

    const name = value.replace(/\s+/g, " ").trim()

    async function submit(force: boolean) {
        if (busyRef.current || disabled || !name) return
        if (!force && existingNames.some((n) => fold(n) === fold(name))) {
            setDup(true)
            return
        }
        busyRef.current = true
        setBusy(true)
        setError(null)
        setDup(false)
        const res = await onQuickAddPair(name, paid)
        busyRef.current = false
        setBusy(false)
        if (res.ok) {
            setValue("")
            setAnnounce(tr("tournament.pairs.quickAdded", { name }))
            if (res.id) onAdded(res.id)
        } else {
            setError(res.error)
        }
        inputRef.current?.focus({ preventScroll: true })
    }

    const hasError = !!error
    return (
        // A card of its own (2026-10-03, owner): the field, the "Označi plaćeno"
        // switch and the button read as one control instead of loose parts.
        <VStack
            align="stretch"
            gap="1.5"
            data-tour="quick-add-pair"
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border.emphasized"
            rounded="xl"
            shadow="sm"
            p={{ base: "3", md: "3.5" }}
        >
            <Box
                display="flex"
                flexWrap={{ base: "wrap", md: "nowrap" }}
                alignItems="center"
                gap="2"
            >
                <InputGroup
                    startElement={<FiUserPlus />}
                    w="auto"
                    flex={{ base: "1 1 100%", md: "1 1 0" }}
                    minW="0"
                >
                    <Input
                        ref={inputRef}
                        value={value}
                        onChange={(e) => {
                            setValue(e.target.value)
                            if (dup) setDup(false)
                            if (error) setError(null)
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault()
                                // While the duplicate warning is up, Enter must
                                // not silently confirm it — use the buttons.
                                if (!dup) void submit(false)
                            } else if (e.key === "Escape" && dup) {
                                e.preventDefault()
                                setDup(false)
                            }
                        }}
                        placeholder={tr("tournament.pairs.quickPlaceholder")}
                        aria-label={tr("tournament.pairs.quickLabel")}
                        aria-invalid={hasError || undefined}
                        maxLength={PAIR_NAME_MAX}
                        enterKeyHint="done"
                        autoComplete="off"
                        // 16px minimum: iOS zooms the page on focus below it.
                        fontSize="16px"
                        bg="bg.panel"
                        disabled={disabled}
                        title={disabled ? disabledTitle : undefined}
                    />
                </InputGroup>
                <Checkbox.Root
                    checked={paid}
                    onCheckedChange={(e) => {
                        const v = e.checked === true
                        setPaid(v)
                        writeQuickPaid(storageKey, v)
                    }}
                    disabled={disabled}
                    flexShrink={0}
                    px="3"
                    py="2"
                    rounded="lg"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    bg="bg.subtle"
                >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label fontSize="sm" fontWeight="normal">
                        {tr("tournament.pairs.quickPaid")}
                    </Checkbox.Label>
                </Checkbox.Root>
                <Button
                    size="sm"
                    colorPalette="blue"
                    onClick={() => void submit(false)}
                    disabled={disabled || !name || dup}
                    loading={busy}
                    flexShrink={0}
                    ml={{ base: "auto", md: "0" }}
                    minH="40px"
                >
                    <FiPlus /> {tr("tournament.pairs.quickAdd")}
                </Button>
            </Box>
            <Box aria-live="polite" role="status">
                {dup && (
                    <HStack gap="2" wrap="wrap" color="yellow.fg" fontSize="sm">
                        <Text>{tr("tournament.pairs.quickDuplicate")}</Text>
                        <Button size="xs" variant="outline" colorPalette="yellow" onClick={() => void submit(true)}>
                            {tr("tournament.pairs.quickDuplicateAnyway")}
                        </Button>
                        <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                                setDup(false)
                                inputRef.current?.focus({ preventScroll: true })
                            }}
                        >
                            {tr("tournament.pairs.quickCancel")}
                        </Button>
                    </HStack>
                )}
                {error && (
                    <Text fontSize="sm" color="red.fg">
                        {error}
                    </Text>
                )}
                {!error && !dup && disabled && fullMessage && (
                    <Text fontSize="sm" color="fg.muted">
                        {fullMessage}
                    </Text>
                )}
            </Box>
            {/* Screen-reader-only confirmation; the highlight is the visual one. */}
            <Box
                aria-live="polite"
                role="status"
                position="absolute"
                w="1px"
                h="1px"
                overflow="hidden"
                clipPath="inset(50%)"
                whiteSpace="nowrap"
            >
                {announce}
            </Box>
        </VStack>
    )
}
export type PairsSectionProps = {
    /** Tournament status drives the podium marks and every lock below. */
    status: string | null | undefined
    winnerName?: string | null
    secondName: string | null
    thirdName: string | null
    /** Keys the remembered "Odmah plaćeno" choice per tournament. */
    tournamentUuid?: string
    /** The whole roster — used for the counters only. */
    pairs: PairShort[]
    /** Soft-deleted pairs ("Obrisani parovi"); the container passes [] unless
     *  the viewer may restore them (organiser/admin, tournament not started). */
    deletedPairs: PairShort[]
    restoringPairId: number | null
    onRestorePair: RestorePair
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
    /** Persists a brand-new named pair at once (quick-add field). */
    onQuickAddPair: QuickAddPair
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
        deletedPairs,
        restoringPairId,
        onRestorePair,
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
        onQuickAddPair,
        tournamentUuid,
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
    // Pairs quick-added in this visit go FIRST (newest on top), so the row the
    // organiser just typed is where the eye already is instead of at the
    // bottom of a long roster. Unsaved (temp id) rows follow, then the rest in
    // the page's own order.
    const [recentIds, setRecentIds] = useState<number[]>([])
    const activeRows = useMemo(() => {
        const rows = displayActivePairs.filter((p) => !p.pendingApproval)
        const recent = recentIds
            .map((id) => rows.find((p) => p.id === id))
            .filter((p): p is PairShort => !!p)
        const rest = rows.filter((p) => !recentIds.includes(p.id))
        return [...recent, ...rest.filter((p) => p.id < 0), ...rest.filter((p) => p.id >= 0)]
    }, [displayActivePairs, recentIds])
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
        if (pairs.some((p) => p.id === selectedPairId)) {
            return
        }
        // Only a TEMP row can come back under a new id. A saved pair that
        // disappeared was deleted, and re-selecting a namesake (two pairs may
        // legitimately share a name) would be the wrong guess.
        const wanted = selectedPairId < 0 ? norm(lastSelectedNameRef.current) : ""
        const reborn = wanted ? pairs.find((p) => norm(p.name) === wanted) : undefined
        setSelectedPairId(reborn ? reborn.id : null)
    }, [pairs, selectedPairId])

    /* ── Quick add + search ─────────────────────────────────────────── */
    const quickInputRef = useRef<HTMLInputElement | null>(null)
    const [flashId, setFlashId] = useState<number | null>(null)
    const flashTimerRef = useRef<number | undefined>(undefined)
    const scrolledFlashRef = useRef<number | null>(null)
    const [query, setQuery] = useState("")

    const handleAdded = useCallback((id: number) => {
        setRecentIds((r) => [id, ...r.filter((x) => x !== id)])
        setFlashId(id)
        scrolledFlashRef.current = null
        window.clearTimeout(flashTimerRef.current)
        flashTimerRef.current = window.setTimeout(() => setFlashId(null), FLASH_MS)
    }, [])
    useEffect(() => () => window.clearTimeout(flashTimerRef.current), [])

    /* "Obrisani parovi": collapsed by default from 4 rows up, open below that.
       The choice is lifted here because the list is mounted twice (lg+ pane
       and the single column) and both copies must agree. */
    const [deletedOpenChoice, setDeletedOpenChoice] = useState<boolean | null>(null)
    const [restoreError, setRestoreError] = useState<string | null>(null)
    // Collapsed by default (owner, 2026-10-03); opens only when the organiser asks.
    const deletedOpen = deletedOpenChoice ?? false
    const showDeleted = canEdit && !tournamentAlready && !tournamentLocked && deletedPairs.length > 0
    async function handleRestore(p: PairShort) {
        setRestoreError(null)
        const r = await onRestorePair(p.id)
        if (r.ok) handleAdded(r.pair.id)
        else setRestoreError(r.error)
    }

    // Scroll the new row into view once it exists in the DOM. The pairs prop
    // can lag the add by a render (react-query notifies asynchronously), so
    // this re-runs on `pairs` until the row is found. Both list copies are
    // mounted; the hidden one has no offsetParent.
    useEffect(() => {
        if (flashId == null || scrolledFlashRef.current === flashId) return
        const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-pair-row="${flashId}"]`))
        const el = nodes.find((n) => n.offsetParent !== null)
        if (!el) return
        scrolledFlashRef.current = flashId
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" })
    }, [flashId, pairs, activeRows])

    const showSearch = pairs.length >= SEARCH_MIN_PAIRS || query !== ""
    const foldedQuery = fold(query)
    // The selected pair always stays listed: filtering must never yank the row
    // whose panel (or accordion) the organiser has open.
    const matches = (p: PairShort) =>
        !foldedQuery || p.id === selectedPairId || fold(p.name).includes(foldedQuery)
    const visiblePending = pendingPairs.filter(matches)
    const visibleActive = activeRows.filter(matches)
    const visibleEliminated = eliminatedRows.filter(matches)
    const noResults =
        foldedQuery !== "" &&
        visiblePending.length + visibleActive.length + visibleEliminated.length === 0

    // The quick-add card is pinned under the navbar; the panes and the search
    // pin BELOW it, so its measured height goes into a CSS variable on the root.
    const rootRef = useRef<HTMLDivElement>(null)
    const qaRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const el = qaRef.current
        const root = rootRef.current
        const band = document.querySelector<HTMLElement>("[data-tournament-band]")
        if (!root) return
        const apply = () => {
            root.style.setProperty("--pairs-qa-h", el ? `${Math.ceil(el.getBoundingClientRect().height)}px` : "0px")
            root.style.setProperty("--pairs-band-h", band ? `${Math.ceil(band.getBoundingClientRect().height)}px` : "0px")
        }
        apply()
        const ro = new ResizeObserver(apply)
        if (el) ro.observe(el)
        if (band) ro.observe(band)
        window.addEventListener("resize", apply)
        return () => {
            ro.disconnect()
            window.removeEventListener("resize", apply)
        }
    }, [canEdit, tournamentLocked])

    const searchBox = showSearch ? (
        <InputGroup
            startElement={<FiSearch />}
            endElement={
                query ? (
                    <IconButton
                        aria-label={tr("tournament.pairs.searchClear")}
                        size="2xs"
                        variant="ghost"
                        onClick={() => setQuery("")}
                    >
                        <FiX />
                    </IconButton>
                ) : undefined
            }
            w="full"
            flexShrink={0}
        >
            <Input
                size="sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Escape" && query) setQuery("")
                }}
                placeholder={tr("tournament.pairs.searchPlaceholder")}
                aria-label={tr("tournament.pairs.searchPlaceholder")}
                fontSize="16px"
                bg="bg.panel"
            />
        </InputGroup>
    ) : null

    /* Removing a pair — the one destructive action, shared by the panel's
       "Ukloni" and the inline reject on a pending row. An unsaved (temp id)
       row is dropped outright; a saved one goes through the page's
       ConfirmDialog, exactly as before. */
    function handleDeletePair(p: PairShort) {
        if (p.id <= 0) {
            onRemoveTempPair(p.id)
            setSelectedPairId((cur) => (cur === p.id ? null : cur))
            return
        }
        onRequestDeletePair(p)
    }

    function renderDetailPanel(pair: PairShort) {
        return (
            <PairDetailPanel
                key={pair.id}
                pair={pair}
                rank={podiumRankOf(pair)}
                tournamentAlready={tournamentAlready}
                tournamentLocked={tournamentLocked}
                canEdit={canEdit}
                savingPairs={savingPairs}
                approvingPairId={approvingPairId}
                buyingLifePairId={buyingLifePairId}
                paidQueued={pendingPairPaid.has(pair.id)}
                lifeEligible={isLifeEligible(pair)}
                onChangePairName={onChangePairName}
                onPairNameBlur={onPairNameBlur}
                onApprovePair={onApprovePair}
                onBuyExtraLife={onBuyExtraLife}
                onTogglePaid={onTogglePaid}
                onStagePaid={onStagePaid}
                onDeletePair={() => handleDeletePair(pair)}
            />
        )
    }

    /* The guided tour anchors on "a pair card": whichever row renders first,
       so the step still finds a target when every pair is pending or out. */
    const tourAnchorId = (pendingPairs[0] ?? activeRows[0] ?? eliminatedRows[0])?.id ?? null

    /* ---------- One card in the LEFT list ----------
       `inline` is the below-lg accordion mode: the row renders its own detail
       panel underneath itself when it is the selected one. The lg+ split
       passes false — there the panel lives in the right-hand pane. */
    function renderPairRow(p: PairShort, eliminated: boolean, tourAnchor: boolean, inline: boolean) {
        const hasServerId = typeof p.id === "number" && p.id > 0
        const isPending = !!p.pendingApproval
        const selected = p.id === selectedPairId
        const flashing = p.id === flashId
        const rank = podiumRankOf(p)
        const isPodium = rank != null
        const paid = !!p.paid
        // Kotizacija is only a thing before the tournament starts, only for an
        // approved pair, and only for whoever can edit the roster — the same
        // gate the panel's "Plati" sits behind.
        const canPayInRow = canEdit && !tournamentLocked && !tournamentAlready && !isPending
        // Approve / reject, right in the pending row — same gate as the two
        // buttons in the panel ("Odobri" is canEdit + pending; "Ukloni" is
        // canEdit + not-yet-started), so nothing becomes reachable here that
        // was not reachable one tap deeper.
        const canApproveInRow = canEdit && isPending
        const canRejectInRow = canEdit && isPending && !tournamentAlready

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

        // Accordion semantics: a second tap on the open row closes it again.
        // On lg+ that reads as "deselect", which is the same gesture.
        const toggle = () => setSelectedPairId((cur) => (cur === p.id ? null : p.id))

        const row = (
            <Box
                key={p.id}
                role="button"
                tabIndex={0}
                aria-expanded={selected}
                data-tour={tourAnchor ? "detail-first-pair" : undefined}
                data-pair-row={p.id}
                onClick={toggle}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        toggle()
                    }
                }}
                cursor="pointer"
                borderWidth={selected || flashing || isPodium || isPending ? "2px" : "1px"}
                borderColor={
                    selected ? "blue.solid"
                        : flashing ? "green.solid"
                        : rank === "first" ? "yellow.solid"
                        : rank === "second" ? "border.emphasized"
                        : rank === "third" ? "tan"
                        : isPending ? "yellow.solid"
                        : "border.subtle"
                }
                rounded="xl"
                px="3"
                py="2.5"
                bg={
                    selected ? "blue.subtle"
                        : flashing ? "green.subtle"
                        : rank === "first" ? "yellow.subtle"
                        : rank === "third" ? "tan.subtle"
                        : isPending ? "yellow.subtle"
                        : eliminated ? "bg.subtle"
                        : "bg.panel"
                }
                opacity={!isPodium && eliminated ? 0.85 : 1}
                transition={flashing ? "border-color 0.12s, background 0.12s" : "border-color 0.6s, background 0.6s"}
                css={{ "@media (prefers-reduced-motion: reduce)": { transition: "none" } }}
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
                        <Box color="tan" flexShrink={0} title={tr("tournament.place.third")}>
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
                    {/* Approve / reject without opening the pair. The queue
                        an organiser works through at the door is ČEKAJU
                        ODOBRENJE, and every decision there used to cost a
                        detail screen. Both stop the row's own click so the
                        accordion does not toggle underneath the tap, and both
                        call exactly the props the panel's buttons call —
                        onApprovePair and the shared handleDeletePair, which
                        keeps the ConfirmDialog on the destructive one.
                        Approve is not confirmed: it is trivially reversible
                        with "Ukloni", a reject is not. */}
                    {canApproveInRow && (
                        <IconButton
                            aria-label={tr("tournament.pairs.approveTitle")}
                            title={tr("tournament.pairs.approveTitle")}
                            size="xs"
                            variant="solid"
                            colorPalette="green"
                            rounded="full"
                            boxSize={{ base: "40px", md: "28px" }}
                            minW={{ base: "40px", md: "28px" }}
                            onClick={(e) => {
                                e.stopPropagation()
                                onApprovePair(p)
                            }}
                            loading={approvingPairId === p.id}
                            disabled={approvingPairId != null || !hasServerId}
                            flexShrink={0}
                        >
                            <FiCheck />
                        </IconButton>
                    )}
                    {canRejectInRow && (
                        <IconButton
                            aria-label={tr("tournament.pairs.rejectTitle")}
                            title={tr("tournament.pairs.rejectTitle")}
                            size="xs"
                            variant="outline"
                            colorPalette="red"
                            rounded="full"
                            boxSize={{ base: "40px", md: "28px" }}
                            minW={{ base: "40px", md: "28px" }}
                            onClick={(e) => {
                                e.stopPropagation()
                                handleDeletePair(p)
                            }}
                            disabled={approvingPairId === p.id}
                            flexShrink={0}
                        >
                            <FiX />
                        </IconButton>
                    )}
                    {/* The chevron doubles as the accordion affordance below
                        lg, where the panel opens under this row; at lg+ the
                        panel is a separate column, so it keeps pointing at it. */}
                    <Box
                        color={selected ? "blue.fg" : "fg.muted"}
                        flexShrink={0}
                        aria-hidden
                        display="flex"
                        transform={selected ? { base: "rotate(90deg)", lg: "none" } : "none"}
                        transition="transform 0.15s"
                    >
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
                    {/* On a pending row below md the two 40px decision buttons
                        need the width, and "Povijest mečeva" is empty anyway
                        for a pair that has not been approved, let alone
                        played — so that is what gives way, not the chevron
                        the accordion depends on. It comes back at md+. */}
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
                        display={
                            canApproveInRow || canRejectInRow
                                ? { base: "none", md: "inline-flex" }
                                : "inline-flex"
                        }
                    >
                        <FiInfo />
                    </IconButton>
                </HStack>
            </Box>
        )

        if (!inline) return row

        return (
            <Box key={p.id}>
                {row}
                {selected && <Box mt="2">{renderDetailPanel(p)}</Box>}
            </Box>
        )
    }

    /* ---------- The LEFT column ----------
       `inline` is threaded straight through to the rows: the below-lg copy
       renders the open pair's panel under its own row, the lg+ copy does not
       (its panel is the right-hand pane). Both copies stay mounted and are
       toggled by `display`, exactly as before. */
    const renderList = (inline: boolean) =>
        pairs.length > 0 && noResults ? (
            <Box
                borderWidth="1px"
                borderColor="border.subtle"
                borderStyle="dashed"
                rounded="xl"
                bg="bg.panel"
            >
                <EmptyState
                    compact
                    icon={FiSearch}
                    title={tr("tournament.pairs.searchNoResults")}
                    description={tr("tournament.pairs.searchNoResultsDescription")}
                    action={
                        <Button size="xs" variant="outline" onClick={() => setQuery("")}>
                            {tr("tournament.pairs.searchClearFilter")}
                        </Button>
                    }
                />
            </Box>
        ) : pairs.length === 0 ? (
            <Box
                borderWidth="1px"
                borderColor="border.subtle"
                borderStyle="dashed"
                rounded="xl"
                bg="bg.panel"
            >
                <EmptyState
                    icon={FiUser}
                    title={tr(
                        finished
                            ? "tournament.pairs.finishedEmptyTitle"
                            : "tournament.pairs.emptyTitle",
                    )}
                    description={
                        finished
                            ? tr("tournament.pairs.finishedEmptyDescription")
                            : canEdit
                                ? tr("tournament.pairs.emptyDescription")
                                : tr("tournament.pairs.emptyDescriptionReadonly")
                    }
                />
            </Box>
        ) : (
            <VStack align="stretch" gap="4">
                {visiblePending.length > 0 && (
                    <Box>
                        <GroupHeading label={tr("tournament.pairs.pendingHeading")} count={visiblePending.length} />
                        <VStack align="stretch" gap="2">
                            {visiblePending.map((p) => renderPairRow(p, !!p.isEliminated, p.id === tourAnchorId, inline))}
                        </VStack>
                    </Box>
                )}

                {/* No heading here on purpose — see the active chip in the
                    header strip. The other two groups keep theirs. */}
                {visibleActive.length > 0 && (
                    <VStack align="stretch" gap="2">
                        {visibleActive.map((p) => renderPairRow(p, !!p.isEliminated, p.id === tourAnchorId, inline))}
                    </VStack>
                )}

                {visibleEliminated.length > 0 && (
                    <Box>
                        <GroupHeading label={tr("tournament.pairs.eliminatedHeading")} count={visibleEliminated.length} />
                        <VStack align="stretch" gap="2">
                            {visibleEliminated.map((p) => renderPairRow(p, true, p.id === tourAnchorId, inline))}
                        </VStack>
                    </Box>
                )}
            </VStack>
        )

    /* ---------- The RIGHT pane ---------- */
    const detailPane = selectedPair ? renderDetailPanel(selectedPair) : (
        // Roughly the height of a selected pair's panel: a small icon and two
        // short lines, NOT the tall `EmptyState` block it used to be
        // (2026-10-03, owner: "still bigger than the selected pair").
        <HStack
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="xl"
            bg="bg.panel"
            gap="3"
            px={{ base: "3", md: "4" }}
            py="3.5"
            align="center"
            // Same height as a selected pair's panel: ~106 CSS px (name row +
            // action row + padding). An earlier 222px came from reading a 2x
            // retina screenshot as 1x — the panel is half of that.
            minH={{ base: "auto", lg: "106px" }}
        >
            <Box
                flexShrink={0}
                boxSize="40px"
                rounded="full"
                bg="brand.subtle"
                color="brand.fg"
                display="flex"
                alignItems="center"
                justifyContent="center"
            >
                <FiUsers size={18} />
            </Box>
            <Box minW="0">
                <Text fontWeight="semibold" fontSize="sm">{tr("tournament.pairs.detailEmptyTitle")}</Text>
                <Text fontSize="xs" color="fg.muted">{tr("tournament.pairs.detailEmptyDescription")}</Text>
            </Box>
        </HStack>
    )

    const openRequests = pairRequests.filter((r) => r.status === "OPEN")

    /* The three counters. They no longer sit in a strip above the quick-add
       card: at lg+ they live in the right column under the detail panel, below
       lg they sit between the quick-add card and the first row (the old phone
       scroll row, relocated). Always the whole, unfiltered roster. */
    const counterChips = (dense: boolean) => {
        const iconSize = dense ? 12 : 13
        const size = dense ? "xs" : "sm"
        return (
            <>
                <CounterChip
                    fill
                    size={size}
                    icon={<FiUsers size={iconSize} />}
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
                        fill
                        size={size}
                        icon={<FiDollarSign size={iconSize} />}
                        value={paidCount}
                        label={plural("tournament.pairs.paidEntry", paidCount)}
                        palette={paidCount === pairs.length && pairs.length > 0 ? "green" : undefined}
                    />
                )}
                {/* The AKTIVNI group has no heading of its own — it is the
                    default bucket — so its count lives here. ČEKAJU ODOBRENJE
                    and ELIMINIRANI keep theirs. */}
                <CounterChip
                    fill
                    size={size}
                    icon={<FiCheck size={iconSize} />}
                    value={activeRows.length}
                    label={plural("tournament.pairs.activeCount", activeRows.length)}
                />
                {overCapacity && (
                    <Badge variant="solid" colorPalette="yellow" size="sm" flexShrink={0}>
                        {tr("tournament.pairs.overCapacity", { n: pairs.length - (capacity ?? 0) })}
                    </Badge>
                )}
            </>
        )
    }
    // Both rows span the whole width available and centre their chips, which
    // share it equally (2026-10-03, owner). Below lg the row wraps instead of
    // scrolling sideways, so nothing is hidden off-screen.
    // The organiser's sync pill ("Spremam…", "N promjena čeka", offline) is
    // part of THIS screen: it sits right under the counters, centred, instead
    // of up beside the tournament's name (2026-10-03, owner). Hidden while
    // idle, like before.
    const syncPill = canEdit ? (
        <Box w="full" display="flex" justifyContent="center">
            <SyncIndicator tournamentUuid={tournamentUuid} hideWhenIdle />
        </Box>
    ) : null
    const chipsWrapRow = (
        <VStack align="stretch" gap="2">
            <HStack gap="2" wrap="wrap" w="full" justify="center" minW="0">
                {counterChips(false)}
            </HStack>
            {syncPill}
        </VStack>
    )
    const chipsScrollRow = (
        <VStack align="stretch" gap="1.5">
            <HStack gap="1.5" wrap="wrap" w="full" justify="center" minW="0">
                {counterChips(true)}
            </HStack>
            {syncPill}
        </VStack>
    )

    /* The list column: search (from SEARCH_MIN_PAIRS pairs on) right above the
       list it filters, then the list, then — directly after it — "Obrisani
       parovi". Both mounted copies get the same pieces. */
    const deletedBlock = showDeleted ? (
        <DeletedPairsSection
            pairs={deletedPairs}
            open={deletedOpen}
            onToggle={() => setDeletedOpenChoice(!deletedOpen)}
            restoringPairId={restoringPairId}
            error={restoreError}
            onRestore={(p) => void handleRestore(p)}
        />
    ) : null
    const renderListColumn = (inline: boolean) => (
        <VStack align="stretch" gap="4" pb="4">
            {/* The search stays pinned while the pairs scroll: at the top of the
                scrolling pane on lg+, under the pinned quick-add card on phones. */}
            {searchBox && (
                <Box
                    position="sticky"
                    top={inline ? PANE_TOP_BELOW_QA : "0"}
                    zIndex={4}
                    bg="bg.canvas"
                    pb="2"
                    pt={inline ? "0" : "1"}
                >
                    {searchBox}
                </Box>
            )}
            {renderList(inline)}
            {deletedBlock}
        </VStack>
    )

    return (
        <VStack ref={rootRef} align="stretch" gap="4">
            {/* Top strip: only what is left of it — the self-registration
                button for non-organisers. For the organiser there is nothing
                here, so the quick-add card is the first thing on the tab.
                md+ keeps the compact right-aligned button, below md it is a
                full-width primary action. */}
            {showSelfRegisterButton && (
                <>
                    <HStack justify="flex-end" display={{ base: "none", md: "flex" }}>
                        <Button size="xs" variant="solid" colorPalette="blue" onClick={onSelfRegisterClick}>
                            <FiPlus />{" "}
                            {userAlreadyRegistered
                                ? tr("tournament.pairs.registerAnother")
                                : tr("tournament.pairs.registerPair")}
                        </Button>
                    </HStack>
                    <Button
                        size="sm"
                        variant="solid"
                        colorPalette="blue"
                        w="full"
                        display={{ base: "inline-flex", md: "none" }}
                        onClick={onSelfRegisterClick}
                    >
                        <FiPlus />{" "}
                        {userAlreadyRegistered
                            ? tr("tournament.pairs.registerAnother")
                            : tr("tournament.pairs.registerPair")}
                    </Button>
                </>
            )}

            {/* Quick add: organiser only, hidden once FINISHED (same gate as the
                "Dodaj par" buttons above). Locked-while-running and full
                rosters keep it visible but disabled, with the buttons' titles. */}
            {!tournamentLocked && canEdit && (
                <Box
                    ref={qaRef}
                    position="sticky"
                    top={QA_TOP}
                    zIndex={6}
                    bg="bg.canvas"
                    pb="3"
                    pt={{ base: "2", lg: "0" }}
                    _before={{
                        display: { base: "none", lg: "block" },
                        content: '""',
                        position: "absolute",
                        left: "0",
                        right: "0",
                        top: "-24px",
                        height: "24px",
                        bg: "bg.canvas",
                    }}
                >
                <QuickAddBar
                    inputRef={quickInputRef}
                    storageKey={`bela:pairs:quickPaid:${tournamentUuid ?? ""}`}
                    existingNames={pairs.map((p) => p.name)}
                    disabled={tournamentAlready || atCapacity}
                    disabledTitle={
                        atCapacity
                            ? tr("tournament.pairs.atCapacityTitle", { max: capacity ?? 0 })
                            : tr("tournament.pairs.addPairTitle")
                    }
                    fullMessage={atCapacity ? tr("tournament.pairs.quickFull") : null}
                    onQuickAddPair={onQuickAddPair}
                    onAdded={handleAdded}
                />
                </Box>
            )}

            {/* Below lg (and at lg+ only while there is no split to put them in):
                the counter chips between the quick-add card and the first row. */}
            <Box display={{ base: "block", lg: pairs.length === 0 ? "block" : "none" }}>
                {chipsScrollRow}
            </Box>

            {/* Open pair-finding requests — visible only before the tournament
                starts and only if at least one is OPEN. Collapsible so the
                organizer can hide them once they have a handle on who's looking. */}
            {!tournamentAlready && openRequests.length > 0 && (
                <Card.Root variant="outline" rounded="xl" borderColor="blue.muted" bg="blue.subtle" shadow="sm">
                    <Card.Body py="3" px={{ base: "3", md: "4" }}>
                        <HStack justify="space-between" align="center" mb={pairRequestsCollapsed ? "0" : "3"}>
                            <HStack gap="2" align="center">
                                <Box color="blue.fg"><FiUserPlus /></Box>
                                <Text fontFamily="heading" fontWeight="semibold" fontSize="sm" letterSpacing="-0.015em">
                                    {tr("tournament.pairRequests.title")}
                                </Text>
                                <Badge
                                    variant="solid"
                                    colorPalette="blue"
                                    size="sm"
                                    fontFamily="mono"
                                    fontVariantNumeric="tabular-nums"
                                >
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
            {pairs.length === 0 && (
                <VStack align="stretch" gap="4">
                    {renderList(false)}
                    {deletedBlock}
                </VStack>
            )}

            {/* lg+: list beside panel, each pinned under the navbar so a long
                roster scrolls without dragging the panel off screen. */}
            <Box
                className={pairs.length === 0 ? undefined : "fold-master-detail"}
                display={pairs.length === 0 ? "none" : { base: "none", lg: "grid" }}
                gridTemplateColumns="minmax(0, 1fr) minmax(0, 1.15fr)"
                gap="4"
                alignItems="start"
            >
                <Box
                    position="sticky"
                    top={PANE_TOP_BELOW_QA}
                    maxH={PANE_MAX_H}
                    overflowY="auto"
                    overscrollBehavior="contain"
                    pr="1"
                    css={{ scrollbarGutter: "stable" }}
                >
                    {renderListColumn(false)}
                </Box>
                <Box
                    position="sticky"
                    top={PANE_TOP_BELOW_QA}
                    maxH={PANE_MAX_H}
                    overflowY="auto"
                    overscrollBehavior="contain"
                    pr="1"
                    css={{ scrollbarGutter: "stable" }}
                >
                    {/* The counters sit under the panel (or under the "Odaberi
                        par" empty state), left-aligned and wrapping. */}
                    <VStack align="stretch" gap="3">
                        {detailPane}
                        {chipsWrapRow}
                    </VStack>
                </Box>
            </Box>

            {/* Below lg: one column, always the list — the open pair's panel
                is expanded inside it, under its own row. */}
            <Box
                className={pairs.length === 0 ? undefined : "fold-master-detail-single"}
                display={pairs.length === 0 ? "none" : { base: "block", lg: "none" }}
            >
                {renderListColumn(true)}
            </Box>
        </VStack>
    )
}

/* ──────────────────────────────────────────────────────────────────────────
   "Obrisani parovi" — the soft-deleted pairs, right after the roster.

   A pair removed in DRAFT is only hidden server-side; this is where the
   organiser gets it back with "Vrati" (until the tournament starts — the
   container stops rendering the section then). Rows are deliberately quiet:
   avatar, muted name, when it was deleted, one button.
   ────────────────────────────────────────────────────────────────────── */
function DeletedPairsSection({
    pairs,
    open,
    onToggle,
    restoringPairId,
    error,
    onRestore,
}: {
    pairs: PairShort[]
    open: boolean
    onToggle: () => void
    restoringPairId: number | null
    error: string | null
    onRestore: (p: PairShort) => void
}) {
    const { t: tr } = useTranslation()
    return (
        <Box borderWidth="1px" borderColor="border.subtle" rounded="xl" bg="bg.panel" data-deleted-pairs>
            <HStack
                as="button"
                w="full"
                px="3"
                py="2.5"
                gap="2"
                justify="space-between"
                aria-expanded={open}
                onClick={onToggle}
                cursor="pointer"
            >
                <HStack gap="2" minW="0">
                    <Box color="fg.muted" display="flex" aria-hidden>
                        {open ? <FiChevronDown /> : <FiChevronRight />}
                    </Box>
                    <Text fontSize="sm" fontWeight="semibold" color="fg.muted" truncate>
                        {tr("tournament.pairs.deleted.title")} ({pairs.length})
                    </Text>
                </HStack>
            </HStack>
            {open && (
                <VStack align="stretch" gap="0" borderTopWidth="1px" borderColor="border.subtle">
                    {error && (
                        <Box px="3" py="2" bg="red.subtle" role="alert">
                            <Text fontSize="sm" color="red.fg">{error}</Text>
                        </Box>
                    )}
                    {pairs.map((p) => (
                        <HStack
                            key={p.id}
                            px="3"
                            py="2"
                            gap="3"
                            borderBottomWidth="1px"
                            borderColor="border.subtle"
                            _last={{ borderBottomWidth: "0" }}
                        >
                            <PairAvatar name={p.name} eliminated />
                            <Box flex="1" minW="0">
                                <Text fontSize="sm" color="fg.muted" fontWeight="medium" truncate>
                                    {p.name}
                                </Text>
                                {p.deletedAt && (
                                    <Text fontSize="xs" color="fg.muted">
                                        {tr("tournament.pairs.deleted.deletedAt", {
                                            when: formatDateTime(p.deletedAt),
                                        })}
                                    </Text>
                                )}
                            </Box>
                            <Button
                                size="xs"
                                variant="outline"
                                aria-label={tr("tournament.pairs.deleted.restoreAria", { name: p.name })}
                                loading={restoringPairId === p.id}
                                disabled={restoringPairId != null}
                                onClick={() => onRestore(p)}
                            >
                                <FiRotateCcw /> {tr("tournament.pairs.deleted.restore")}
                            </Button>
                        </HStack>
                    ))}
                </VStack>
            )}
        </Box>
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
    onChangePairName: (id: number, name: string) => void
    onPairNameBlur: (p: PairShort) => void
    onApprovePair: (p: PairShort) => void
    onBuyExtraLife: (p: PairShort) => void
    onTogglePaid: (pairId: number, nextPaid: boolean) => void
    onStagePaid: (pairId: number, nextPaid: boolean) => void
    onDeletePair: () => void
}) {
    const { t: tr } = useTranslation()
    /* The one thing in this file that is NOT a prop. A content report is not
       tournament state: it changes nothing the page renders, nothing is
       queued offline, and the page owns no piece of it — routing it through
       props would mean a prop, a state field and a dialog on a page that
       would never read any of them. Hidden from anonymous readers, same rule
       as the tournament and profile entry points. */
    const { user } = useAuth()
    const [reportOpen, setReportOpen] = useState(false)
    const nameInputRef = useRef<HTMLInputElement | null>(null)

    const hasServerId = typeof pair.id === "number" && pair.id > 0
    const isPending = !!pair.pendingApproval
    const eliminated = !!pair.isEliminated
    const isPodium = rank != null
    const paid = !!pair.paid
    const canRename = canEdit && !tournamentAlready && !tournamentLocked
    const extraBtnDisabled = pair.extraLife || !lifeEligible || !hasServerId

    // A new row is selected in the same state update that inserts it. Native
    // autofocus can be missed while the master/detail pane is swapping, so
    // focus the mounted field explicitly on the next frame instead.
    // Both list copies mount a panel (inline below lg, right pane at lg+), so
    // only the one actually on screen takes focus and scrolls into view.
    useEffect(() => {
        if (pair.id >= 0 || !canRename) return
        const frame = window.requestAnimationFrame(() => {
            const input = nameInputRef.current
            if (!input || input.getClientRects().length === 0) return
            input.focus({ preventScroll: true })
            input.scrollIntoView({ block: "center", behavior: "smooth" })
        })
        return () => window.cancelAnimationFrame(frame)
    }, [pair.id, canRename])

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
                    {/* No back arrow any more: below lg this panel is expanded
                        under the row it belongs to, and that row (plus its
                        chevron) is the close affordance. */}
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
                        <Box color="tan" flexShrink={0} title={tr("tournament.place.third")}>
                            <FaMedal size={20} />
                        </Box>
                    )}
                    <Box flex="1" minW="0">
                        {canRename ? (
                            <Input
                                ref={nameInputRef}
                                size="sm"
                                variant="flushed"
                                value={pair.name}
                                onChange={(e) => onChangePairName(pair.id, e.target.value)}
                                onBlur={() => onPairNameBlur(pair)}
                                placeholder={tr("tournament.pairs.nameLabel")}
                                fontWeight="semibold"
                                aria-label={tr("tournament.pairs.nameLabel")}
                            />
                        ) : (
                            <Text
                                fontFamily="heading"
                                fontWeight="semibold"
                                letterSpacing="-0.015em"
                                lineHeight="short"
                                wordBreak="break-word"
                            >
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

                {/* Phone of a pair that registered without an account. The API
                    sends contactPhone ONLY to a viewer who may manage the
                    tournament, so rendering it whenever it is present cannot
                    leak it — and for the organiser it is the only way to reach
                    that pair. tel: so it dials straight from a phone. */}
                {pair.contactPhone && (
                    <Text fontSize="xs" color="fg.muted">
                        {tr("tournament.pairs.contactPhone")}{" "}
                        <chakra.a
                            href={`tel:${pair.contactPhone.replace(/[^\d+]/g, "")}`}
                            color="blue.fg"
                            fontWeight="medium"
                        >
                            {pair.contactPhone}
                        </chakra.a>
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
                    {/* A pair with no server id yet exists only in this
                        browser, so there is nothing for a report to point at. */}
                    {!!user && hasServerId && (
                        <Button
                            size="xs"
                            variant="ghost"
                            colorPalette="red"
                            onClick={() => setReportOpen(true)}
                            title={tr("tournament.report.pairItem")}
                        >
                            <FiFlag /> {tr("tournament.report.pairItem")}
                        </Button>
                    )}
                </HStack>
            </VStack>

            <ReportDialog
                targetType="PAIR"
                targetId={String(pair.id)}
                targetLabel={pair.name?.trim() || tr("tournament.pairs.noName")}
                open={reportOpen}
                onClose={() => setReportOpen(false)}
            />
        </Box>
    )
}
