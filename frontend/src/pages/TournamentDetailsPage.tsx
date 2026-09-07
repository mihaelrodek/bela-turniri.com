import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    Box,
    Button,
    Flex,
    HStack,
    Skeleton,
    SkeletonText,
    Text,
    useBreakpointValue,
    VStack,
} from "@chakra-ui/react"
import { Link as RouterLink, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { FiCreditCard, FiDollarSign, FiInfo, FiShuffle, FiUsers } from "react-icons/fi"

import { deleteTournament } from "../api/tournaments"
import { useAuth } from "../auth/authContextValue"
import CjenikTab from "../components/CjenikTab"
import RacuniSection from "../components/RacuniSection"
import TournamentResultsCard from "../components/TournamentResultsCard"
import WaiterCodeGate from "../components/WaiterCodeGate"
import type { TournamentSectionDef } from "../components/TournamentSidebar"
import {
    DETAIL_TOUR_TAB_BY_INDEX,
    TOUR_RESUME_DETAIL_KEY,
    TURNIR_DETAIL_TOUR_STEPS,
} from "../components/tourSteps"
import { useCanManageTournament } from "../hooks/useCanManageTournament"
import { useTournamentData } from "../hooks/useTournamentData"
import { useTournamentEditForm } from "../hooks/useTournamentEditForm"
import { useTournamentHead } from "../hooks/useTournamentHead"
import { useTournamentPairsEditor } from "../hooks/useTournamentPairsEditor"
import { useTournamentRounds } from "../hooks/useTournamentRounds"
import { useWaiterSession } from "../hooks/useWaiterSession"
import { useTranslation } from "../i18n"
import lazyWithReload from "../utils/lazyWithReload"
import { norm } from "../utils/tournamentMatch"
import { type SectionKey, sectionFromSlug, sectionPath } from "../utils/tournamentSection"
import { invalidateTournamentLists } from "./tournament/cache"
import { TournamentSideNav, TournamentTopBar } from "./tournament/TournamentChrome"
import PairInfoDialog from "./tournament/dialogs/PairInfoDialog"
import TournamentPageDialogs from "./tournament/dialogs/TournamentPageDialogs"
import BracketSection from "./tournament/sections/BracketSection"
import DetailsSection from "./tournament/sections/DetailsSection"
import PairsSectionContainer from "./tournament/sections/PairsSectionContainer"
import type { PairShort } from "../types/pairs"

/* ──────────────────────────────────────────────────────────────────────────
   The tournament page is a SHELL: route params, the section nav, the layout
   and the dialogs that have to work from any section. Every section body is
   its own module under `pages/tournament/`, and everything with state behind
   it is a hook under `hooks/useTournament*`.

   Four of those modules load lazily, because none of them is on the path a
   spectator takes. The edit form alone drags react-datepicker, its
   stylesheet, the date-fns locale data and Leaflet — a chunk that only an
   organiser who taps "Uredi" has any use for.
   ────────────────────────────────────────────────────────────────────── */

const DetailsEditForm = lazyWithReload(() => import("./tournament/sections/DetailsEditForm"))
const ManualRoundDialog = lazyWithReload(() => import("../components/ManualRoundDialog"))
const TournamentQrDialog = lazyWithReload(() => import("../components/TournamentQrDialog"))
/* react-joyride is only pulled in when the user actually replays the guided
   tour, so the detail page's own chunk stays free of it. */
const PageTour = lazy(() => import("../components/PageTour"))

export default function TournamentDetailsPage() {
    // /turniri/:uuid/:section? — `section` is optional and purely
    // presentational; only `uuid` ever drives a fetch.
    const { uuid, section } = useParams<{ uuid: string; section?: string }>()
    const navigate = useNavigate()
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()
    const { user } = useAuth()
    // `tr`, not `t` — `t` below is the loaded tournament.
    const { t: tr } = useTranslation()

    // Deep-link from push notifications. Two flavours:
    //   ?bill={matchId}  — loser push: switch to Ždrijeb, expand round,
    //                       scroll AND auto-open the bill modal.
    //   ?match={matchId} — round-draw push: same but no modal — just surface
    //                       the match so the player can see which table to
    //                       head to.
    //
    // Captured into state ONCE on mount and immediately stripped from the URL
    // so a refresh or back-navigation doesn't re-trigger, and so the prop
    // value stays stable across re-renders.
    const [billMatchIdFromUrl] = useState<number | null>(() => {
        const raw = new URLSearchParams(window.location.search).get("bill")
        if (!raw) return null
        const n = Number(raw)
        return Number.isFinite(n) && n > 0 ? n : null
    })
    const [scrollMatchIdFromUrl] = useState<number | null>(() => {
        const raw = new URLSearchParams(window.location.search).get("match")
        if (!raw) return null
        const n = Number(raw)
        return Number.isFinite(n) && n > 0 ? n : null
    })
    // The match id we want to surface, whichever param brought us here.
    // Bill wins if both are present.
    const targetMatchId = billMatchIdFromUrl ?? scrollMatchIdFromUrl
    useEffect(() => {
        if (!searchParams.has("bill") && !searchParams.has("match")) return
        const next = new URLSearchParams(searchParams)
        next.delete("bill")
        next.delete("match")
        setSearchParams(next, { replace: true })
        // Only run once on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    /* ---------- Data ---------- */
    const data = useTournamentData(uuid)
    const {
        t, setT,
        pairs, setPairs,
        rounds, setRounds,
        pairRequests,
        collapsedRounds, setCollapsedRounds,
        allowRepeats, setAllowRepeats,
        loading, error,
        refreshAll,
        pendingPairPaid, pendingOpsRef, enqueueOp,
        cancelInFlight, anySaveInFlightRef, dirtyPairIdsRef, pendingPaidRef,
    } = data

    const { canEditTournament, showEditAction, showDeleteAction, requireOnlineFor } =
        useCanManageTournament(t)

    useTournamentHead(t, uuid)

    /* ---------- Mutations ---------- */
    const editor = useTournamentEditForm(uuid, t, setT)
    const pairsEd = useTournamentPairsEditor({
        uuid, pairs, setPairs, dirtyPairIdsRef, pendingPaidRef, cancelInFlight,
        requireOnlineFor, enqueueOp,
    })
    const roundsCtl = useTournamentRounds({
        uuid, t, setT, rounds, setRounds, setPairs, setCollapsedRounds,
        allowRepeats, setAllowRepeats, cancelInFlight, pendingOpsRef,
        requireOnlineFor, enqueueOp, refreshAll,
    })

    /**
     * Every in-flight write, ORed. `refreshLive` reads this through the ref: a
     * poll response landing mid-save would overwrite the optimistic local
     * state the save is about to confirm. Assigned during render, exactly as
     * the pre-split page did — the ref is only ever READ from a callback.
     */
    const anySaveInFlight =
        pairsEd.savingPairs
        || roundsCtl.creatingRound
        || editor.savingDetails
        || roundsCtl.resettingTournament
        || roundsCtl.hardResettingRound
        || roundsCtl.savingPM
        || pairsEd.selfRegSubmitting
        || roundsCtl.startingTournament
        || roundsCtl.finishingTournament
        || roundsCtl.finishingRoundId != null
        || roundsCtl.savingMatchId != null
        || pairsEd.approvingPairId != null
        || pairsEd.buyingLifePairId != null
    anySaveInFlightRef.current = anySaveInFlight

    /* ---------- Section ↔ URL ----------
       The open section is READ from the URL, never stored, so the address bar
       and the screen can never disagree. */
    const tab: SectionKey = sectionFromSlug(section)
    /* `replace`, not `push`: hopping between Detalji/Parovi/Ždrijeb/Cjenik is
       a view change inside one page, so Back should leave the tournament
       rather than walk back through every section the user glanced at.

       uuid / location / navigate are read through refs so this callback is
       stable for the lifetime of the page: effects that call it keep their
       existing dependency arrays, and none of them re-runs just because the
       URL changed. `navigate`'s own identity changes on every location
       change — that is exactly what the ref is here to absorb. Query params
       ride along untouched so a `?bill=` deep link survives the jump. */
    const uuidRef = useRef(uuid)
    uuidRef.current = uuid
    const locationRef = useRef(location)
    locationRef.current = location
    const navigateRef = useRef(navigate)
    navigateRef.current = navigate
    const setTab = useCallback((key: SectionKey) => {
        const id = uuidRef.current
        if (!id) return
        const path = sectionPath(id, key)
        // Already there — don't churn the history entry. Re-selecting the
        // current section is common (the guided tour re-asserts its section on
        // every step, "Uredi" jumps to Detalji from Detalji).
        if (path === locationRef.current.pathname) return
        navigateRef.current(`${path}${locationRef.current.search}`, { replace: true })
    }, [])

    /* The section nav exists twice — a sidebar on lg+, a pinned band below it —
       and only one is visible at a time. The guided tour resolves its anchors
       with `document.querySelector`, which would happily spotlight the hidden
       copy, so the `data-tour` attributes are handed to whichever shell the
       current breakpoint actually shows. `ssr: false` matches NavBar's usage:
       this app never server-renders, so there is no hydration mismatch to
       guard against, only a first paint at `base` before the query resolves —
       and the tour launches on a timer well after that. */
    const isDesktopShell = useBreakpointValue({ base: false, lg: true }, { ssr: false }) ?? false

    /* ---------- Guided tour ----------
       Two triggers run it:
         - a sessionStorage flag set by the list-page tour when the user
           completes it → read once on mount and auto-launched as a
           continuation,
         - the NavBar "Pokaži kako" replay button → a window event that bumps
           tourReplayKey, which is fed into forceRun. */
    const [tourReplayKey, setTourReplayKey] = useState(0)
    const [tourForceRun, setTourForceRun] = useState<boolean | undefined>(() => {
        if (typeof window === "undefined") return undefined
        try {
            if (window.sessionStorage.getItem(TOUR_RESUME_DETAIL_KEY)) {
                window.sessionStorage.removeItem(TOUR_RESUME_DETAIL_KEY)
                return true
            }
        } catch { /* private mode */ }
        return undefined
    })
    useEffect(() => {
        function onReplay() {
            setTourReplayKey((k) => k + 1)
            setTourForceRun(true)
        }
        window.addEventListener("bela:tour-replay", onReplay)
        return () => window.removeEventListener("bela:tour-replay", onReplay)
    }, [])

    /* ---------- Page-level dialog state ---------- */
    // Branded QR code of this tournament, opened from the chrome's icon row.
    const [qrOpen, setQrOpen] = useState(false)
    // Tournament-level admin-only soft-delete confirmation.
    const [deleteTournamentOpen, setDeleteTournamentOpen] = useState(false)
    const [deletingTournament, setDeletingTournament] = useState(false)
    // Pair info dialog (match history). null = closed.
    const [infoPairId, setInfoPairId] = useState<number | null>(null)

    async function confirmDeleteTournament() {
        if (!uuid) return
        try {
            setDeletingTournament(true)
            await deleteTournament(uuid)
            // The list, the count, the calendar and the map are all persisted
            // to localStorage — without this the deleted tournament renders
            // from disk on the next cold load and 404s when tapped.
            invalidateTournamentLists()
            navigate("/turniri", { replace: true })
        } catch (err) {
            // Stay on the page; interceptor toasted why.
            console.warn("Brisanje turnira nije uspjelo", err)
        } finally {
            setDeletingTournament(false)
            setDeleteTournamentOpen(false)
        }
    }

    /* ---------- Push deep link ----------
       Runs whenever a target match id is present AND the rounds list is
       populated: switch to Ždrijeb, expand the matching round, scroll the row
       into view. The bill-modal auto-open (only when the user arrived via
       ?bill=) is handled inside MatchBillButton via autoOpenBillId.

       Latch: `rounds` is a new array on every poll tick and after every score
       keystroke, so without this the deep link would re-run forever — yanking
       the organiser back to Ždrijeb, re-expanding a round they just collapsed
       and scrolling the page away mid-typing. */
    const deepLinkHandledRef = useRef<number | null>(null)
    useEffect(() => {
        if (targetMatchId == null) return
        if (deepLinkHandledRef.current === targetMatchId) return
        if (rounds.length === 0) return
        const r = rounds.find((rr) => rr.matches.some((mx) => mx.id === targetMatchId))
        if (!r) return
        deepLinkHandledRef.current = targetMatchId
        setTab("bracket")
        setCollapsedRounds((cr) => ({ ...cr, [r.id]: false }))
        // requestAnimationFrame so the layout is committed before scroll.
        const id = window.requestAnimationFrame(() => {
            const el = document.getElementById(`match-${targetMatchId}`)
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
        })
        return () => window.cancelAnimationFrame(id)
    }, [targetMatchId, rounds, setTab, setCollapsedRounds])

    /* ---------- Derivations that need pairs AND rounds ---------- */

    /**
     * Bucketing + podium derivation for the Parovi section. This used to live
     * inside the tab's render IIFE, where it re-ran three full scans of
     * `pairs` plus three name lookups on EVERY render — i.e. on every
     * keystroke in a pair-name input.
     */
    const pairsView = useMemo(() => {
        const activePairs = pairs.filter((p) => !p.isEliminated)
        const eliminatedPairs = pairs.filter((p) => p.isEliminated)
        const finished = t?.status === "FINISHED"
        const secondName = t?.secondPlaceName ?? null
        const thirdName = t?.thirdPlaceName ?? null
        const findByName = (n: string | null) =>
            n ? pairs.find((p) => norm(p.name) === norm(n)) ?? null : null
        const winnerPair = finished ? findByName(t?.winnerName ?? null) : null
        const secondPair = finished ? findByName(secondName) : null
        const thirdPair = finished ? findByName(thirdName) : null
        const podiumIds = new Set<number>(
            [winnerPair, secondPair, thirdPair]
                .filter((p): p is PairShort => !!p && typeof p.id === "number")
                .map((p) => p.id),
        )
        // Render order: gold → silver → bronze → remaining active. For an
        // in-progress tournament this collapses to just `activePairs`.
        const displayActivePairs: PairShort[] = [
            ...(winnerPair ? [winnerPair] : []),
            ...(secondPair && secondPair.id !== winnerPair?.id ? [secondPair] : []),
            ...(thirdPair && thirdPair.id !== winnerPair?.id && thirdPair.id !== secondPair?.id ? [thirdPair] : []),
            ...activePairs.filter((p) => !podiumIds.has(p.id)),
        ]
        return {
            activePairs,
            displayActivePairs,
            displayEliminatedPairs: eliminatedPairs.filter((p) => !podiumIds.has(p.id)),
            paidCount: pairs.filter((p) => !!p.paid).length,
            secondName,
            thirdName,
        }
    }, [pairs, t])

    const pairById = useMemo(() => {
        const m = new Map<number, PairShort>()
        pairs.forEach((p) => m.set(p.id, p))
        return m
    }, [pairs])

    const lastLossRoundByPair = useMemo(() => {
        const map = new Map<number, number>()
        for (const r of rounds) {
            for (const m of r.matches) {
                if (m.status !== "FINISHED") continue
                if (!m.pair1Id || !m.pair2Id || !m.winnerPairId) continue

                const loserId = m.winnerPairId === m.pair1Id ? m.pair2Id : m.pair1Id
                const prev = map.get(loserId) ?? 0
                if (r.number > prev) map.set(loserId, r.number)
            }
        }
        return map
    }, [rounds])

    const activeCount = pairsView.activePairs.length
    const canCreateRound = !roundsCtl.hasOngoingRound && activeCount >= 2

    const nextRoundAlreadyStarted = useCallback((pairId: number) => {
        const lossRound = lastLossRoundByPair.get(pairId)
        if (!lossRound) return false // no recorded loss yet → this rule doesn't block
        // Any higher-numbered round existing means the next one has started.
        return rounds.some((r) => r.number > lossRound)
    }, [lastLossRoundByPair, rounds])

    /** May this pair still buy a life? Needs a server id, exactly one loss,
     *  no life already bought, and the next round not yet drawn. */
    const isLifeEligible = useCallback((p: PairShort) =>
        typeof p.id === "number"
        && p.id > 0
        && p.losses === 1
        && !p.extraLife
        && !nextRoundAlreadyStarted(p.id), [nextRoundAlreadyStarted])

    /**
     * "Završi turnir" is only offered when:
     *   - the viewer is the creator (or an admin)
     *   - the tournament isn't already FINISHED
     *   - at least one round has been played to completion
     *   - no round is currently in progress
     *   - fewer than 2 pairs are still active (typical end-state: a single
     *     winner; edge case: zero, if every pair went out in the same round)
     */
    const canFinishTournament = useMemo(() => {
        if (!canEditTournament) return false
        if (t?.status === "FINISHED") return false
        if (activeCount >= 2) return false
        if (roundsCtl.hasOngoingRound) return false
        return rounds.some((r) => r.status === "COMPLETED")
    }, [canEditTournament, t?.status, activeCount, roundsCtl.hasOngoingRound, rounds])

    /** Show the manual-round button when few active pairs remain (≤ 4 —
     *  typical when the bracket is reaching its end and the random auto-draw
     *  would produce awkward pairings). */
    const showManualRoundButton =
        roundsCtl.tournamentStarted &&
        t?.status !== "FINISHED" &&
        !!t && canEditTournament &&
        canCreateRound &&
        activeCount > 1 &&
        activeCount <= 4

    /** Active (non-eliminated) pairs as the manual dialog's pool. */
    const activePairsForManual = useMemo(
        () => pairsView.activePairs.map((p) => ({ id: p.id, name: p.name })),
        [pairsView.activePairs],
    )

    /* Pairs that have paid AND are approved — only these count toward the
       start-tournament minimum of 2. Was recomputed inside the bracket tab's
       render IIFE on every render, including every score keystroke. */
    const paidApprovedCount = useMemo(
        () => pairs.filter((p) => !!p.paid && !p.pendingApproval).length,
        [pairs],
    )
    const canStart = canEditTournament && paidApprovedCount >= 2

    /* "The tournament is under way" — pair editing is locked. STARTED is
       checked explicitly: a tournament can be started before the first round
       is drawn, and a bare `rounds.length > 0` test left that window wide open
       for adding/renaming pairs. */
    const tournamentAlready =
        rounds.length > 0 || t?.status === "STARTED" || t?.status === "FINISHED"

    /**
     * Does this device hold a waiter token for THIS tournament? It is the
     * second half of the Računi gate: the organiser always has the section,
     * and anyone who has redeemed a code here has it too. Everyone else must
     * not even see that it exists, which is the whole point of the feature.
     *
     * Read here rather than inside RacuniSection deliberately: the nav lives
     * at this level, and the hook's module-level store means the code gate's
     * successful redeem repaints this component in the same commit — no
     * reload, no re-navigation.
     */
    const {
        hasSession: hasWaiterSession,
        token: waiterToken,
        canEditCjenik: waiterCanEditCjenik,
    } = useWaiterSession(t?.uuid)

    /* ---------- Nav ----------
       Both chromes render THIS list, so a section can never exist on one
       breakpoint and not the other. Rebuilt every render because `tr()` output
       changes with the active locale. */
    const sections: TournamentSectionDef[] = [
        { key: "details", label: tr("tournament.tab.details"), icon: <FiInfo size={15} />, tour: "detail-tab-details" },
        { key: "pairs", label: tr("tournament.tab.pairs"), icon: <FiUsers size={15} />, tour: "detail-tab-pairs" },
        { key: "bracket", label: tr("tournament.tab.bracket"), icon: <FiShuffle size={15} />, tour: "detail-tab-bracket" },
        { key: "cjenik", label: tr("tournament.tab.cjenik"), icon: <FiDollarSign size={15} />, tour: "detail-tab-cjenik" },
    ]
    /* Računi is the one CONDITIONAL section: a random visitor and a pair
       member must not learn that the venue's bill board exists, so the item is
       pushed only for the organiser and for a device already carrying a waiter
       session. FiCreditCard rather than Cjenik's FiDollarSign — two money
       sections one above the other need to be told apart at a glance. No
       `tour` anchor: the guided tour walks the four public sections and must
       not stop at an item most readers will never have. */
    if (canEditTournament || hasWaiterSession) {
        sections.push({
            key: "racuni",
            label: tr("tournament.waiter.tab"),
            icon: <FiCreditCard size={15} />,
        })
    }
    /* Both chromes hand back a plain string key (see TournamentSectionDef);
       the cast is safe because `sections` above is the only source of keys. */
    const selectSection = (key: string) => setTab(key as SectionKey)

    const startDetailsEdit = () => {
        // The edit form lives in the Detalji view — jump there first.
        setTab("details")
        editor.enterDetailsEdit()
    }

    const chromeProps = {
        sections,
        active: tab,
        onSelect: selectSection,
        canEditTournament,
        showEditAction,
        showDeleteAction,
        shareUrl: typeof window !== "undefined" ? window.location.href : "",
        uuid,
        onEdit: startDetailsEdit,
        onDelete: () => setDeleteTournamentOpen(true),
        onOpenQr: () => setQrOpen(true),
        onBackToList: () => navigate("/turniri"),
    }

    return (
        <>
            {!loading && t && (
                <TournamentTopBar t={t} tourAnchors={!isDesktopShell} {...chromeProps} />
            )}

            {/* `align` is left at its `stretch` default on purpose: the sidebar
                column has to be as tall as the content column, or the sticky
                card inside it would unpin as soon as the column's own bottom
                edge scrolled past. */}
            <Flex gap={{ base: "0", lg: "6" }}>
                {!loading && t && (
                    <TournamentSideNav t={t} tourAnchors={isDesktopShell} {...chromeProps} />
                )}

                <Box flex="1" minW="0">
                    {/* Phone / tablet twin of the sidebar's results card. Only
                        on Detalji: repeated above every section it would push a
                        screenful of podium in front of the actual content. */}
                    {!loading && t && tab === "details" && (
                        <Box display={{ base: "block", lg: "none" }} mb="4">
                            <TournamentResultsCard
                                winnerName={t.winnerName}
                                secondName={t.secondPlaceName}
                                thirdName={t.thirdPlaceName}
                            />
                        </Box>
                    )}

                    {loading ? (
                        /* Skeleton that mirrors the real layout — a header
                           strip, the tile grid, and a stack of list rows — so
                           the page doesn't jump when the data lands. */
                        <VStack align="stretch" gap="4" aria-busy="true" aria-label={tr("tournament.loadingAria")}>
                            <Skeleton height="24px" width="60%" maxW="320px" rounded="md" />
                            <HStack gap="2">
                                {[0, 1, 2, 3].map((i) => (
                                    <Skeleton key={i} height="32px" width="88px" rounded="md" />
                                ))}
                            </HStack>
                            <Box
                                display="grid"
                                gridTemplateColumns={{ base: "1fr", md: "1fr 1fr", lg: "1fr 1fr 1fr" }}
                                gap="3"
                            >
                                {[0, 1, 2, 3, 4, 5].map((i) => (
                                    <Box
                                        key={i}
                                        borderWidth="1px"
                                        borderColor="border.emphasized"
                                        rounded="lg"
                                        px="3"
                                        py="2.5"
                                    >
                                        <Skeleton height="10px" width="45%" mb="2" rounded="sm" />
                                        <Skeleton height="18px" width="75%" rounded="sm" />
                                    </Box>
                                ))}
                            </Box>
                            <VStack align="stretch" gap="2">
                                {[0, 1, 2].map((i) => (
                                    <Box
                                        key={i}
                                        borderWidth="1px"
                                        borderColor="border.emphasized"
                                        rounded="lg"
                                        p="3"
                                    >
                                        <SkeletonText noOfLines={2} gap="2" />
                                    </Box>
                                ))}
                            </VStack>
                        </VStack>
                    ) : !t ? (
                        <VStack py="10" gap="3">
                            <Text color="red.fg">{error ?? tr("tournament.notFound")}</Text>
                            <Button asChild size="sm">
                                <RouterLink to="/turniri">{tr("tournament.backToList")}</RouterLink>
                            </Button>
                        </VStack>
                    ) : tab === "details" ? (
                        !editor.editingDetails || !editor.editForm ? (
                            <DetailsSection t={t} pairCount={pairs.length} />
                        ) : (
                            <Suspense
                                fallback={
                                    <VStack align="stretch" gap="4" aria-busy="true">
                                        <Skeleton height="320px" rounded="xl" />
                                        <Skeleton height="180px" rounded="xl" />
                                    </VStack>
                                }
                            >
                                <DetailsEditForm
                                    editForm={editor.editForm}
                                    patchEdit={editor.patchEdit}
                                    bannerUrl={t.bannerUrl}
                                    editPickedCoords={editor.editPickedCoords}
                                    setEditPickedCoords={editor.setEditPickedCoords}
                                    posterFile={editor.posterFile}
                                    posterPreviewUrl={editor.posterPreviewUrl}
                                    posterRemove={editor.posterRemove}
                                    posterUploadErr={editor.posterUploadErr}
                                    onPosterPick={editor.handlePosterPick}
                                    onClearPosterPick={editor.clearPosterPick}
                                    onMarkPosterForRemoval={editor.markPosterForRemoval}
                                    editMissingRequired={editor.editMissingRequired}
                                    editStartInPast={editor.editStartInPast}
                                    savingDetails={editor.savingDetails}
                                    onCancel={editor.cancelDetailsEdit}
                                    onSave={editor.saveDetailsEdit}
                                />
                            </Suspense>
                        )
                    ) : tab === "pairs" ? (
                        <PairsSectionContainer
                            t={t}
                            uuid={uuid}
                            pairs={pairs}
                            pairsView={pairsView}
                            pairRequests={pairRequests}
                            canEditTournament={canEditTournament}
                            viewerUid={user?.uid}
                            tournamentAlready={tournamentAlready}
                            savingPairs={pairsEd.savingPairs}
                            approvingPairId={pairsEd.approvingPairId}
                            buyingLifePairId={pairsEd.buyingLifePairId}
                            pendingPairPaid={pendingPairPaid}
                            onAddPair={pairsEd.addPair}
                            onChangePairName={pairsEd.changePairName}
                            onPairNameBlur={pairsEd.onPairNameBlur}
                            onRemoveTempPair={pairsEd.removePair}
                            onRequestDeletePair={pairsEd.setPendingDeletePair}
                            onApprovePair={pairsEd.onApprovePair}
                            onBuyExtraLife={pairsEd.onBuyExtraLife}
                            onTogglePaid={pairsEd.onTogglePaid}
                            onStagePaid={pairsEd.stageTempPairPaid}
                            isLifeEligible={isLifeEligible}
                            onOpenPairInfo={setInfoPairId}
                            onSelfRegisterClick={() => {
                                // Anonymous visitors get bounced to /prijava
                                // with state.from so they land back here.
                                if (!user) {
                                    navigate("/prijava", {
                                        state: { from: `${location.pathname}${location.search}` },
                                    })
                                    return
                                }
                                pairsEd.setSelfRegOpen(true)
                            }}
                            onPodiumUpdated={setT}
                            selfRegOpen={pairsEd.selfRegOpen}
                            setSelfRegOpen={pairsEd.setSelfRegOpen}
                            presets={pairsEd.presets}
                            selfRegName={pairsEd.selfRegName}
                            setSelfRegName={pairsEd.setSelfRegName}
                            selfRegSubmitting={pairsEd.selfRegSubmitting}
                            selfRegError={pairsEd.selfRegError}
                            setSelfRegError={pairsEd.setSelfRegError}
                            onSubmitSelfRegister={pairsEd.submitSelfRegister}
                        />
                    ) : tab === "cjenik" ? (
                        <Box data-tour="detail-content-cjenik">
                            <CjenikTab
                                tournamentRef={t.uuid ?? t.slug ?? ""}
                                canEdit={canEditTournament || waiterCanEditCjenik}
                                // Only set for the "gazda konobara" branch — the
                                // organiser's own bearer already authorises them,
                                // and sending a stray waiter header alongside it
                                // is needless. Template save/import stay off for
                                // a waiter: those key a per-USER template, and a
                                // waiter has no account to key one to.
                                waiterToken={!canEditTournament && waiterCanEditCjenik ? waiterToken : null}
                                canUseTemplates={canEditTournament}
                            />
                        </Box>
                    ) : tab === "racuni" ? (
                        /* Two renderings of one URL. The organiser and anyone
                           already holding a waiter session get the bills; a
                           visitor who followed the organiser's `?kod=` link gets
                           the gate, which redeems that code and — through the
                           session hook's shared store — flips this very branch
                           on the next render. Nobody else can reach anything
                           here without a valid code. */
                        canEditTournament || hasWaiterSession ? (
                            <RacuniSection
                                tournamentUuid={t.uuid}
                                tournamentSlug={t.slug}
                                canEdit={canEditTournament}
                            />
                        ) : (
                            <WaiterCodeGate tournamentUuid={t.uuid} />
                        )
                    ) : (
                        <BracketSection
                            t={t}
                            rounds={rounds}
                            collapsedRounds={collapsedRounds}
                            setCollapsedRounds={setCollapsedRounds}
                            sortedMatchesByRound={roundsCtl.sortedMatchesByRound}
                            pairById={pairById}
                            canEditTournament={canEditTournament}
                            viewerUid={user?.uid}
                            autoOpenBillId={billMatchIdFromUrl}
                            allowRepeats={allowRepeats}
                            savingPM={roundsCtl.savingPM}
                            onToggleAllowRepeats={roundsCtl.onToggleAllowRepeats}
                            tournamentStarted={roundsCtl.tournamentStarted}
                            canStart={canStart}
                            startingTournament={roundsCtl.startingTournament}
                            onStartTournament={roundsCtl.onStartTournament}
                            canFinishTournament={canFinishTournament}
                            finishingTournament={roundsCtl.finishingTournament}
                            onFinishTournament={roundsCtl.onFinishTournament}
                            showResetTournament={roundsCtl.showResetTournament}
                            resettingTournament={roundsCtl.resettingTournament}
                            onOpenResetTournament={() => roundsCtl.setResetTournamentOpen(true)}
                            canCreateRound={canCreateRound}
                            creatingRound={roundsCtl.creatingRound}
                            onCreateRound={roundsCtl.onCreateRound}
                            showManualRoundButton={showManualRoundButton}
                            onClickManualRound={roundsCtl.onClickManualRound}
                            finishingRoundId={roundsCtl.finishingRoundId}
                            onFinishRound={roundsCtl.finishWholeRound}
                            hardResettingRound={roundsCtl.hardResettingRound}
                            onRequestHardResetRound={roundsCtl.setPendingHardResetRound}
                            toggleRoundCollapsed={roundsCtl.toggleRoundCollapsed}
                            savingMatchId={roundsCtl.savingMatchId}
                            onSaveMatch={roundsCtl.saveMatch}
                            onSaveEditedMatch={roundsCtl.saveEditedMatch}
                            onEnterEdit={roundsCtl.enterEdit}
                            onCancelEdit={roundsCtl.cancelEdit}
                            onScoreChange={roundsCtl.setLocalMatchScore}
                            onBillChange={roundsCtl.patchMatchPaidAt}
                            unpaidOpen={roundsCtl.unpaidOpen}
                            onCloseUnpaid={() => roundsCtl.setUnpaidOpen(false)}
                        />
                    )}
                </Box>
            </Flex>

            {/* ===== Dialogs that must work from any section ===== */}
            <PairInfoDialog
                pairId={infoPairId}
                pairs={pairs}
                rounds={rounds}
                pairById={pairById}
                onClose={() => setInfoPairId(null)}
            />

            <TournamentPageDialogs
                tournamentName={t?.name}
                deleteTournamentOpen={deleteTournamentOpen}
                deletingTournament={deletingTournament}
                onCloseDeleteTournament={() => setDeleteTournamentOpen(false)}
                onConfirmDeleteTournament={() => void confirmDeleteTournament()}
                pendingDeletePair={pairsEd.pendingDeletePair}
                deletingPair={pairsEd.deletingPair}
                onCloseDeletePair={() => pairsEd.setPendingDeletePair(null)}
                onConfirmDeletePair={() => void pairsEd.confirmDeletePair()}
                manualConfirmOpen={roundsCtl.manualConfirmOpen}
                onCloseManualConfirm={() => roundsCtl.setManualConfirmOpen(false)}
                onConfirmManualRound={roundsCtl.onConfirmManualRound}
                resetTournamentOpen={roundsCtl.resetTournamentOpen}
                resettingTournament={roundsCtl.resettingTournament}
                onCloseResetTournament={() => roundsCtl.setResetTournamentOpen(false)}
                onConfirmResetTournament={() => void roundsCtl.onResetTournament()}
                hardResetRoundOpen={roundsCtl.pendingHardResetRound != null}
                hardResettingRound={roundsCtl.hardResettingRound}
                onCloseHardResetRound={() => roundsCtl.setPendingHardResetRound(null)}
                onConfirmHardResetRound={() => {
                    if (roundsCtl.pendingHardResetRound != null) {
                        void roundsCtl.hardReset(roundsCtl.pendingHardResetRound)
                    }
                }}
            />

            {/* Mounted only while open: the dialog seeds its rows from an
                `open` effect, so there is nothing to preserve between openings,
                and this keeps its chunk off the spectator path entirely. */}
            {roundsCtl.manualRoundOpen && (
                <Suspense fallback={null}>
                    <ManualRoundDialog
                        open
                        onClose={() => roundsCtl.setManualRoundOpen(false)}
                        tournamentUuid={uuid ?? ""}
                        pairs={activePairsForManual}
                        nextRoundNumber={
                            rounds.length === 0 ? 1 : rounds[rounds.length - 1].number + 1
                        }
                        onCreated={roundsCtl.onManualRoundCreated}
                    />
                </Suspense>
            )}

            {/* Branded QR of this tournament — opened from the sidebar's icon
                row on lg+, from the mobile header's overflow menu below that.
                The image comes straight from the backend renderer. */}
            {t && qrOpen && (
                <Suspense fallback={null}>
                    <TournamentQrDialog
                        open
                        onClose={() => setQrOpen(false)}
                        tournamentUuid={t.uuid}
                        tournamentSlug={t.slug}
                        tournamentName={t.name}
                    />
                </Suspense>
            )}

            {/* Detail-page tour. Runs in exactly two situations:
                  - as a continuation when the user arrives from the list tour
                    (TOUR_RESUME_DETAIL_KEY in sessionStorage, read into
                    tourForceRun in the initial state above),
                  - when the NavBar "?" ("Pokaži kako") button fires the replay
                    window event.
                No seenStorageKey is passed, so PageTour never auto-runs this
                tour on a plain page visit. The onStepChange callback drives
                section switching so each step lands on a section that's
                actually mounted. */}
            <Suspense fallback={null}>
                <PageTour
                    key={tourReplayKey}
                    steps={TURNIR_DETAIL_TOUR_STEPS()}
                    forceRun={tourForceRun}
                    onStepChange={(nextIndex: number) => {
                        // Switch sections at specific indices — see
                        // DETAIL_TOUR_TAB_BY_INDEX in tourSteps.ts for the
                        // index → section mapping. Indices not in the map don't
                        // change the section.
                        const targetTab = DETAIL_TOUR_TAB_BY_INDEX[nextIndex]
                        if (targetTab) {
                            // Snap the page back to the top BEFORE swapping
                            // sections. Each section's content has a different
                            // height (Parovi can be hundreds of pairs tall,
                            // Cjenik is a one-line empty state on a fresh
                            // tournament). If the user was scrolled down,
                            // swapping to shorter content shrinks the document —
                            // the browser can clamp scrollTop to the new
                            // maxScroll, the section buttons end up at
                            // unexpected viewport coordinates, and the tooltip
                            // drifts to the bottom-left. `instant` skips the
                            // smooth-scroll animation that would otherwise run
                            // concurrently with the React commit.
                            window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior })
                            setTab(targetTab)
                        }

                        // The "Pomoć i instalacija" step (index 7) anchors on
                        // the help-replay + install buttons. On desktop they sit
                        // in the top-right of the navbar and are always visible;
                        // on mobile the same pair lives inside the hamburger
                        // drawer's Stack, so the drawer has to be opened before
                        // Joyride looks for the anchor. Closes again at every
                        // other step so the previous content stays in view.
                        const isHelpInstallStep = nextIndex === 7
                        window.dispatchEvent(new CustomEvent(
                            isHelpInstallStep ? "bela:open-nav-menu" : "bela:close-nav-menu",
                        ))
                    }}
                    onFinished={() => {
                        setTourForceRun(undefined)
                        // Drawer cleanup — if the user finished from the
                        // help-install step on mobile, the hamburger is still
                        // open. Close it so the post-tour /turniri page isn't
                        // partially obscured.
                        window.dispatchEvent(new CustomEvent("bela:close-nav-menu"))
                        // After the farewell step, drop the user back on the
                        // /turniri landing so they're not stranded on the detail
                        // page they were just guided through.
                        navigate("/turniri")
                    }}
                />
            </Suspense>
        </>
    )
}
