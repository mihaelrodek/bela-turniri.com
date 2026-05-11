import React, {useEffect, useMemo, useState} from "react"
import {
    Badge,
    Box,
    Button,
    Card,
    chakra,
    Field,
    Heading,
    HStack,
    Icon,
    IconButton,
    Image,
    Input,
    RadioGroup,
    Spinner,
    Text,
    Textarea,
    VStack,
    Switch,
    Dialog,
} from "@chakra-ui/react"
import {Link as RouterLink, useLocation, useNavigate, useParams} from "react-router-dom"
import {
    FiAward,
    FiCalendar,
    FiCheck,
    FiCheckCircle,
    FiChevronDown,
    FiChevronRight,
    FiChevronUp,
    FiClock,
    FiDollarSign,
    FiEdit2,
    FiExternalLink,
    FiFlag,
    FiGift,
    FiHeart,
    FiInfo,
    FiLayers,
    FiMapPin,
    FiMaximize2,
    FiMinus,
    FiPhone,
    FiPlay,
    FiPlus,
    FiRefreshCw,
    FiRotateCcw,
    FiShare2,
    FiShuffle,
    FiX,
    FiTrash2,
    FiUser,
    FiUserPlus,
} from "react-icons/fi"
import { FaTrophy } from "react-icons/fa"

import type {TournamentDetails, RewardType, RepassageUntil, CreateTournamentPayload} from "../types/tournaments"
import type {PairShort} from "../types/pairs"
import type {RoundDto, MatchDto} from "../types/round"

import {
    fetchTournamentDetails,
    fetchTournamentPairs,
    replacePairs,
    finishTournament,
    startTournament,
    setAllowRepeats as apiSetAllowRepeats,
    resetTournament as apiResetTournament,
    updateTournament,
} from "../api/tournaments"
import {
    fetchRounds,
    drawRound,
    updateMatchScore,
    hardResetRound,
    finishRound,
    overrideMatchScore,
} from "../api/round"
import { approvePair, buyExtraLife, deletePair, deleteTournament, selfRegisterPair, setPairPaid } from "../api/tournaments"
import { listPresets, type UserPairPreset } from "../api/userPairPresets"
import { listPairRequestsForTournament, type PairRequest } from "../api/pairRequests"
import { useAuth } from "../auth/AuthContext"
import { useDocumentHead } from "../hooks/useDocumentHead"

/* ---------- Local UI types ---------- */
type MatchLocal = MatchDto & {
    _score1?: string;
    _score2?: string;
    _dirty?: boolean;
    _editing?: boolean; // <--- added to support "Uredi" mode
};

type RoundLocal = Omit<RoundDto, "matches"> & {
    matches: MatchLocal[];
};

/* ---------- Small helpers ---------- */
function formatDate(iso?: string | null) {
    if (!iso) return "—"
    const d = new Date(iso)
    return new Intl.DateTimeFormat("hr-HR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(d)
}

function formatTime(iso?: string | null) {
    if (!iso) return "—"
    const d = new Date(iso)
    return new Intl.DateTimeFormat("hr-HR", {hour: "2-digit", minute: "2-digit"}).format(d)
}

function fmtMoney(n?: number | null) {
    if (typeof n !== "number" || !isFinite(n)) return "—"
    const s = n.toFixed(2)
    return (s.endsWith(".00") ? s.slice(0, -3) : s) + "€"
}

/** Bordered, titled section card. Mirrors CreateTournamentPage. */
function SectionCard({
    icon,
    title,
    description,
    action,
    children,
}: {
    icon?: React.ReactNode
    title: string
    description?: string
    action?: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
            <Card.Header pb="2" pt="4" px={{ base: "4", md: "5" }}>
                <HStack justify="space-between" align="start" gap="2">
                    <Box>
                        <HStack gap="2.5" align="center">
                            {icon && <Box color="blue.500" display="flex" alignItems="center">{icon}</Box>}
                            <Card.Title fontSize="md">{title}</Card.Title>
                        </HStack>
                        {description && (
                            <Card.Description fontSize="sm" color="fg.muted" mt="1">
                                {description}
                            </Card.Description>
                        )}
                    </Box>
                    {action}
                </HStack>
            </Card.Header>
            <Card.Body pt="3" pb="4" px={{ base: "4", md: "5" }}>
                {children}
            </Card.Body>
        </Card.Root>
    )
}

/**
 * Compact bordered "tile" for a single piece of tournament info.
 * Tiny uppercase muted label on top, prominent value below — designed
 * to fit several per row in a responsive grid.
 */
function DetailTile({
    icon,
    label,
    value,
    span,
}: {
    icon?: React.ReactNode
    label: string
    value: React.ReactNode
    /** Responsive grid column span (e.g. {{ md: "span 2", lg: "span 3" }}). */
    span?: any
}) {
    return (
        <Box
            borderWidth="1px"
            borderColor="border.emphasized"
            rounded="lg"
            shadow="sm"
            px="3"
            py="2.5"
            bg="bg"
            gridColumn={span}
            minW="0"
        >
            <HStack mb="1.5" gap="1.5">
                {icon && (
                    <Box color="fg.muted" display="flex" alignItems="center">
                        {icon}
                    </Box>
                )}
                <Text
                    fontSize="2xs"
                    fontWeight="semibold"
                    color="fg.muted"
                    letterSpacing="wider"
                    textTransform="uppercase"
                >
                    {label}
                </Text>
            </HStack>
            <Box fontSize="md" fontWeight="medium">
                {value}
            </Box>
        </Box>
    )
}

/**
 * Share button — uses the native Web Share sheet (mobile gets the OS's
 * full app picker: WhatsApp, Viber, Messages, AirDrop, etc.). On desktop
 * browsers without `navigator.share`, falls back to copying the link to
 * clipboard and briefly showing "Kopirano!".
 */
function ShareButton({ url, title }: { url: string; title: string }) {
    const [copied, setCopied] = React.useState(false)

    async function onShare() {
        if (typeof navigator !== "undefined" && (navigator as any).share) {
            try {
                await (navigator as any).share({ title, url })
            } catch {
                /* user cancelled — no-op */
            }
            return
        }
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            window.prompt("Kopiraj link:", url)
        }
    }

    return (
        <Button size="xs" variant="outline" colorPalette="blue" onClick={onShare}>
            {copied ? <FiCheck /> : <FiShare2 />}
            {copied ? "Kopirano!" : "Podijeli"}
        </Button>
    )
}

/** Avatar with initials, used in pair cards. */
function PairAvatar({ name, eliminated }: { name: string; eliminated?: boolean }) {
    const initials = (name || "?")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join("") || "?"
    return (
        <Box
            w="34px"
            h="34px"
            rounded="full"
            bg={eliminated ? "gray.muted" : "blue.subtle"}
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

/* ---------- Edit-mode helpers (shared with CreateTournamentPage form logic) ---------- */
const pad2 = (n: number) => String(n).padStart(2, "0")

function isoToDate(iso?: string | null): string {
    if (!iso) return ""
    const d = new Date(iso)
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function isoToTime(iso?: string | null): string {
    if (!iso) return ""
    const d = new Date(iso)
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
function toLocalOffsetIso(dateStr: string, timeStr: string): string | null {
    if (!dateStr || !timeStr) return null
    const [y, m, d] = dateStr.split("-").map(Number)
    const [hh, mm] = timeStr.split(":").map(Number)
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0)
    const tz = -dt.getTimezoneOffset()
    const sign = tz >= 0 ? "+" : "-"
    const hhOff = String(Math.floor(Math.abs(tz) / 60)).padStart(2, "0")
    const mmOff = String(Math.abs(tz) % 60).padStart(2, "0")
    return (
        `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}` +
        `T${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:00${sign}${hhOff}:${mmOff}`
    )
}
function sanitizeMoney(raw: string): string {
    let s = raw.replace(/-/g, "").replace(/[^\d.,]/g, "").replace(",", ".")
    if (s.startsWith(".")) s = "0" + s
    const parts = s.split(".")
    if (parts.length > 2) s = parts[0] + "." + parts.slice(1).join("")
    return s
}
function sanitizeInt(raw: string): string {
    return raw.replace(/[^\d]/g, "")
}
function moneyToNumber(s?: string): number | null {
    if (!s) return null
    const n = parseFloat(s.replace(",", "."))
    return Number.isFinite(n) ? n : null
}
function numberToMoneyStr(n?: number | null): string {
    if (typeof n !== "number" || !isFinite(n)) return ""
    const s = n.toFixed(2)
    return s.endsWith(".00") ? s.slice(0, -3) : s
}

type EditForm = {
    name: string
    location: string
    details: string
    startDate: string
    startTime: string
    maxPairs: string
    entryPrice: string
    repassagePrice: string
    repassageSecondPrice: string | null   // null = section not added
    repassageUntil: "FINALS" | "SEMIFINALS"
    contactName: string
    contactPhone: string
    rewardType: "FIXED" | "PERCENTAGE"
    rewardFirst: string
    rewardSecond: string
    rewardThird: string
}

function buildEditForm(t: TournamentDetails): EditForm {
    return {
        name: t.name ?? "",
        location: t.location ?? "",
        details: t.details ?? "",
        startDate: isoToDate(t.startAt),
        startTime: isoToTime(t.startAt),
        maxPairs: typeof t.maxPairs === "number" ? String(t.maxPairs) : "16",
        entryPrice: numberToMoneyStr(t.entryPrice),
        repassagePrice: numberToMoneyStr(t.repassagePrice),
        repassageSecondPrice:
            typeof t.repassageSecondPrice === "number"
                ? numberToMoneyStr(t.repassageSecondPrice)
                : null,
        repassageUntil: (t.repassageUntil as RepassageUntil) ?? "FINALS",
        contactName: t.contactName ?? "",
        contactPhone: t.contactPhone ?? "",
        rewardType: (t.rewardType as RewardType) ?? "FIXED",
        rewardFirst: numberToMoneyStr(t.rewardFirst),
        rewardSecond: numberToMoneyStr(t.rewardSecond),
        rewardThird: numberToMoneyStr(t.rewardThird),
    }
}

function editFormToPayload(f: EditForm): CreateTournamentPayload {
    const maxPairs = parseInt(f.maxPairs || "0", 10)
    const maxPairsSafe = Number.isFinite(maxPairs) && maxPairs >= 2 ? maxPairs : 16
    const entry = moneyToNumber(f.entryPrice) ?? 0
    const rep = moneyToNumber(f.repassagePrice) ?? 0
    const rep2 = f.repassageSecondPrice == null ? null : moneyToNumber(f.repassageSecondPrice)

    return {
        name: f.name.trim(),
        location: f.location.trim() || null,
        details: f.details.trim() || null,
        startAt: toLocalOffsetIso(f.startDate, f.startTime),
        maxPairs: maxPairsSafe,
        entryPrice: entry,
        repassagePrice: rep,
        repassageSecondPrice: rep2,
        repassageUntil: f.repassageUntil,
        contactName: f.contactName.trim() || null,
        contactPhone: f.contactPhone.trim() || null,
        rewardType: f.rewardType,
        rewardFirst: moneyToNumber(f.rewardFirst),
        rewardSecond: moneyToNumber(f.rewardSecond),
        rewardThird: moneyToNumber(f.rewardThird),
    } as CreateTournamentPayload
}

/** Input with a fixed unit suffix shown inside the input on the right. */
function SuffixInput({
    value,
    onChange,
    placeholder,
    suffix,
    inputMode = "decimal",
    disabled,
}: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
    suffix: string
    inputMode?: "decimal" | "numeric" | "text"
    disabled?: boolean
}) {
    return (
        <Box position="relative" w="full">
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                inputMode={inputMode}
                pr="9"
                disabled={disabled}
            />
            <Box
                position="absolute"
                right="3"
                top="50%"
                style={{ transform: "translateY(-50%)" }}
                color="fg.muted"
                fontSize="sm"
                pointerEvents="none"
            >
                {suffix}
            </Box>
        </Box>
    )
}

/* ---------- Page ---------- */
export default function TournamentDetailsPage() {
    const {uuid} = useParams<{ uuid: string }>() // /tournaments/:uuid
    const navigate = useNavigate()
    const location = useLocation()
    const { user, isAdmin } = useAuth()

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [t, setT] = useState<TournamentDetails | null>(null)
    const [unpaidOpen, setUnpaidOpen] = useState(false)
    // Confirmation state for the pair delete dialog. null = closed, otherwise
    // holds the pair the user is about to delete.
    const [pendingDeletePair, setPendingDeletePair] = useState<PairShort | null>(null)
    const [deletingPair, setDeletingPair] = useState(false)
    // Tournament-level admin-only soft-delete confirmation.
    const [deleteTournamentOpen, setDeleteTournamentOpen] = useState(false)
    const [deletingTournament, setDeletingTournament] = useState(false)
    // pairs (editable)
    const [pairs, setPairs] = useState<PairShort[]>([])

    const [tab, setTab] = useState<"details" | "pairs" | "bracket">("details");

    // details edit mode
    const [editingDetails, setEditingDetails] = useState(false)
    const [editForm, setEditForm] = useState<EditForm | null>(null)
    const [savingDetails, setSavingDetails] = useState(false)

    // pair info dialog (match history)
    const [infoPairId, setInfoPairId] = useState<number | null>(null)

    // Per-route SEO meta. Title falls back to a generic label until the
    // tournament loads, then upgrades in place. Description prefers the
    // organizer's `details` text, trimmed to ~160 characters.
    const headTitle = t?.name
        ? `${t.name}${t.location ? `, ${t.location}` : ""} — bela-turniri.com`
        : "Turnir — bela-turniri.com"
    const headDesc = (() => {
        const raw = t?.details?.trim()
        const start = t?.startAt ? new Date(t.startAt).toLocaleDateString("hr-HR") : null
        if (raw) return raw.length > 160 ? raw.slice(0, 157) + "…" : raw
        if (t?.name) {
            const parts: string[] = [`Bela turnir ${t.name}`]
            if (t.location) parts.push(`u ${t.location}`)
            if (start) parts.push(`— ${start}`)
            return parts.join(" ")
        }
        return undefined
    })()
    useDocumentHead({
        title: headTitle,
        description: headDesc,
        ogTitle: t?.name ?? undefined,
        ogDescription: headDesc,
        ogImage: t?.bannerUrl ?? undefined,
        ogType: "article",
        // Prefer the canonical pretty slug returned by the backend so search
        // engines and social previews don't see a UUID variant — fall back to
        // whatever route segment we have (uuid, or the slug if the visitor
        // already came in via a slug URL).
        canonical: t?.slug
            ? `https://bela-turniri.com/tournaments/${t.slug}`
            : uuid
                ? `https://bela-turniri.com/tournaments/${uuid}`
                : undefined,
    })

    function enterDetailsEdit() {
        if (!t) return
        setEditForm(buildEditForm(t))
        setEditingDetails(true)
    }
    function cancelDetailsEdit() {
        setEditForm(null)
        setEditingDetails(false)
    }
    async function saveDetailsEdit() {
        if (!uuid || !editForm) return
        if (!editForm.name.trim()) {
            alert("Ime turnira je obavezno.")
            return
        }
        try {
            setSavingDetails(true)
            const updated = await updateTournament(uuid, editFormToPayload(editForm))
            setT(updated)
            setEditingDetails(false)
            setEditForm(null)
        } catch (e: any) {
            alert(e?.response?.data ?? e?.message ?? "Neuspješno spremanje izmjena.")
        } finally {
            setSavingDetails(false)
        }
    }
    function patchEdit<K extends keyof EditForm>(key: K, value: EditForm[K]) {
        setEditForm((f) => (f ? { ...f, [key]: value } : f))
    }

    // rounds
    const [rounds, setRounds] = useState<RoundLocal[]>([])
    const [collapsedRounds, setCollapsedRounds] = useState<Record<number, boolean>>({})
    const [fullscreenRound, setFullscreenRound] = useState<number | null>(null)
    const [allowRepeats, setAllowRepeats] = useState<boolean>(false)
    const [savingPM, setSavingPM] = useState<boolean>(false)

    // Pair-finding requests for this tournament (shown in Parovi tab)
    const [pairRequests, setPairRequests] = useState<PairRequest[]>([])
    const [pairRequestsCollapsed, setPairRequestsCollapsed] = useState(false)

    // Self-register pair dialog
    const [selfRegOpen, setSelfRegOpen] = useState(false)
    const [presets, setPresets] = useState<UserPairPreset[]>([])
    const [selfRegName, setSelfRegName] = useState("")
    const [selfRegSubmitting, setSelfRegSubmitting] = useState(false)
    const [selfRegError, setSelfRegError] = useState<string | null>(null)

    // Load presets when the dialog opens (only for the current user)
    useEffect(() => {
        if (!selfRegOpen || !user) return
        listPresets()
            .then((list) => setPresets(list))
            .catch(() => setPresets([]))
    }, [selfRegOpen, user])

    async function submitSelfRegister() {
        if (!uuid) return
        const name = selfRegName.trim()
        if (!name) {
            setSelfRegError("Unesi ime para.")
            return
        }
        try {
            setSelfRegSubmitting(true)
            setSelfRegError(null)
            const created = await selfRegisterPair(uuid, name)
            setPairs((ps) => [...ps, created])
            setSelfRegOpen(false)
            setSelfRegName("")
        } catch (e: any) {
            const data = e?.response?.data
            const code = typeof data === "string" ? data : ""
            if (code === "TOURNAMENT_ALREADY_STARTED") {
                setSelfRegError("Turnir je već započeo.")
            } else if (code === "ALREADY_REGISTERED") {
                setSelfRegError("Već si prijavio par s tim imenom.")
            } else {
                setSelfRegError(data ?? e?.message ?? "Greška pri prijavi.")
            }
        } finally {
            setSelfRegSubmitting(false)
        }
    }

    async function refreshAll() {
        if (!uuid) return
        const [details, pairList, roundList, prList] = await Promise.all([
            fetchTournamentDetails(uuid),
            fetchTournamentPairs(uuid),
            fetchRounds(uuid),
            listPairRequestsForTournament(uuid).catch(() => [] as PairRequest[]),
        ])
        setT(details)
        const preserve = (details as any)?.preserveMatchmaking
        setAllowRepeats(!(preserve ?? true))

        setPairs(pairList)
        setPairRequests(prList)
        setRounds(
            roundList.map((r) => ({
                ...r,
                matches: r.matches.map((m) => ({
                    ...m,
                    _score1: m.score1 != null ? String(m.score1) : "",
                    _score2: m.score2 != null ? String(m.score2) : "",
                    _dirty: false,
                    _editing: false, // <--- init
                })),
            }))
        )
        // Collapse all rounds by default so the page opens compact — users
        // explicitly expand the round they want to look at. Preserves any
        // existing collapse state on subsequent refreshes (don't reset what
        // the user already toggled), but seeds new round ids to collapsed.
        setCollapsedRounds((prev) => {
            const next: Record<number, boolean> = { ...prev }
            for (const r of roundList) {
                if (next[r.id] === undefined) next[r.id] = true
            }
            return next
        })
    }

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                setLoading(true)
                setError(null)
                if (!uuid) throw new Error("Missing tournament id")
                await refreshAll()
            } catch (e: any) {
                if (!cancelled) setError(e?.message ?? "Failed to load tournament")
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [uuid])

    function enterEdit(roundId: number, matchId: number) {
        setRounds(rs =>
            rs.map(r =>
                r.id !== roundId ? r : {
                    ...r,
                    matches: r.matches.map(m =>
                        m.id !== matchId ? m : {
                            ...m,
                            _editing: true,
                            _score1: m.score1 != null ? String(m.score1) : "",
                            _score2: m.score2 != null ? String(m.score2) : "",
                            _dirty: true,
                        }
                    )
                }
            )
        )
    }

    function cancelEdit(roundId: number, matchId: number) {
        setRounds(rs =>
            rs.map(r =>
                r.id !== roundId ? r : {
                    ...r,
                    matches: r.matches.map(m =>
                        m.id !== matchId ? m : {
                            ...m,
                            _editing: false,
                            _score1: m.score1 != null ? String(m.score1) : "",
                            _score2: m.score2 != null ? String(m.score2) : "",
                            _dirty: false,
                        }
                    )
                }
            )
        )
    }

    const pairById = useMemo(() => {
        const m = new Map<number, PairShort>()
        pairs.forEach((p) => m.set(p.id, p))
        return m
    }, [pairs])

    const lastLossRoundByPair = useMemo(() => {
        const map = new Map<number, number>();
        for (const r of rounds) {
            for (const m of r.matches) {
                if (m.status !== "FINISHED") continue;
                if (!m.pair1Id || !m.pair2Id || !m.winnerPairId) continue;

                const loserId = m.winnerPairId === m.pair1Id ? m.pair2Id : m.pair1Id;
                const prev = map.get(loserId) ?? 0;
                if (r.number > prev) map.set(loserId, r.number);
            }
        }
        return map;
    }, [rounds]);

    const activeCount = pairs.filter((p) => !p.isEliminated).length
    const hasOngoingRound = rounds.some((r) => r.status !== "COMPLETED")
    const canCreateRound = !hasOngoingRound && activeCount >= 2
    const tournamentStarted = (t?.status === "STARTED") || rounds.length > 0

    const nextRoundAlreadyStarted = (pairId: number) => {
        const lossRound = lastLossRoundByPair.get(pairId);
        if (!lossRound) return false; // no recorded loss yet -> this rule doesn't block
        return rounds.some(r => r.number > lossRound); // if any higher-number round exists, it's started
    };

    const showResetTournament =
        (t?.status === "STARTED" && rounds.length === 0) ||
        (rounds.length === 1 && rounds[0].number === 1 && rounds[0].status !== "COMPLETED")

    /* ---------- Pairs: local editing ---------- */
    function addPair() {
        const tempId = -Date.now()
        setPairs((ps) => [
            ...ps,
            {id: tempId, name: "", isEliminated: false, extraLife: false, wins: 0, losses: 0, paid: false} as PairShort,
        ])
    }

    function changePairName(id: number, name: string) {
        setPairs((ps) => ps.map((p) => (p.id === id ? {...p, name} : p)))
    }

    function removePair(id: number) {
        setPairs((ps) => ps.filter((p) => p.id !== id))
    }

    async function savePairsAll() {
        if (!uuid) return
        if (pairs.some((p) => !p.name || p.name.trim() === "")) {
            alert("Pair name cannot be empty.")
            return
        }
        const payload = pairs.map((p) => ({
            id: p.id > 0 ? p.id : undefined,
            name: p.name,
            isEliminated: !!p.isEliminated,
            extraLife: !!p.extraLife,
            wins: p.wins ?? 0,
            losses: p.losses ?? 0,
            paid: !!p.paid,      // <-- include paid
        }))
        const saved = await replacePairs(uuid, payload)
        setPairs(saved)
    }

    async function saveEditedMatch(roundId: number, m: MatchLocal) {
        if (!uuid) return
        const n1 = m._score1 && m._score1.trim() !== "" ? Number(m._score1) : null
        const n2 = m._score2 && m._score2.trim() !== "" ? Number(m._score2) : null

        if (m.pair1Id && m.pair2Id) {
            if (n1 == null || n2 == null || !Number.isFinite(n1) || !Number.isFinite(n2) || n1 === n2) {
                alert("Unesite ispravne rezultate za oba para (različiti brojevi).")
                return
            }
        }

        const updatedRound = await overrideMatchScore(uuid, roundId, m.id, { score1: n1, score2: n2 })

        setRounds(rs =>
            rs.map(r =>
                r.id !== updatedRound.id ? r : {
                    ...updatedRound,
                    matches: updatedRound.matches.map(mx => ({
                        ...mx,
                        _score1: mx.score1 != null ? String(mx.score1) : "",
                        _score2: mx.score2 != null ? String(mx.score2) : "",
                        _dirty: false,
                        _editing: false,
                    }))
                }
            )
        )

        const [pairList, details] = await Promise.all([
            fetchTournamentPairs(uuid),
            fetchTournamentDetails(uuid),
        ])
        setPairs(pairList)
        setT(details)
    }

    /* ---------- Rounds & matches ---------- */
    async function onCreateRound() {
        if (!uuid) return
        const created = await drawRound(uuid) // persisted on server
        setRounds((rs) => [
            ...rs,
            {
                ...created,
                matches: created.matches.map((m) => ({
                    ...m,
                    _score1: m.score1 != null ? String(m.score1) : "",
                    _score2: m.score2 != null ? String(m.score2) : "",
                    _dirty: false,
                    _editing: false,
                })),
            },
        ])
    }

    /**
     * Završi turnir is only offered when:
     *   - the viewer is the creator (or an admin)
     *   - the tournament isn't already FINISHED
     *   - at least one round has been played to completion
     *   - no round is currently in progress
     *   - fewer than 2 pairs are still active (typical end-state: a single winner;
     *     edge case: zero remaining if every pair was eliminated in the same round)
     */
    const canFinishTournament = useMemo(() => {
        const isOwnerOrAdmin = isAdmin || (!!user?.uid && user.uid === t?.createdByUid)
        if (!isOwnerOrAdmin) return false
        if (t?.status === "FINISHED") return false
        if (activeCount >= 2) return false
        if (hasOngoingRound) return false
        return rounds.some((r) => r.status === "COMPLETED")
    }, [isAdmin, user, t, activeCount, hasOngoingRound, rounds])

    async function onFinishTournament() {
        if (!uuid) return
        try {
            const updated = await finishTournament(uuid)
            setT(updated)

            setCollapsedRounds(() => {
                const next: Record<number, boolean> = {}
                rounds.forEach(r => {
                    next[r.id] = true
                })
                return next
            })
        } catch (err: any) {
            const msg = err?.response?.data ?? err?.message ?? "Failed to finish tournament."
            alert(String(msg))
        }
    }

    async function onStartTournament() {
        if (!uuid) return
        try {
            const updated = await startTournament(uuid)
            setT(updated)
        } catch (err: any) {
            // Block start if at least one pair hasn’t paid
            if (err?.response?.status === 409 && err?.response?.data === "UNPAID_REQUIRED") {
                setUnpaidOpen(true) // open modal
                return
            }
            if (err?.response?.status === 409 && err?.response?.data === "INSUFFICIENT_PAIRS") {
                alert("Treba najmanje 2 plaćena para da bi se turnir mogao pokrenuti.")
                return
            }
            if (err?.response?.status === 409 && err?.response?.data === "ALREADY_FINISHED") {
                alert("Turnir je već završen.")
                return
            }
            const msg = err?.response?.data ?? err?.message ?? "Failed to start tournament."
            alert(String(msg))
        }
    }

    // NEW: reset tournament (delete all rounds, set to DRAFT)
    async function onResetTournament() {
        if (!uuid) return
        if (!confirm("Resetirati turnir? Sve runde i mečevi će biti obrisani, a turnir vraćen u nacrt.")) return
        try {
            const updated = await apiResetTournament(uuid)
            await refreshAll();
            setT(updated)
            setRounds([])
            setCollapsedRounds({})
        } catch (e: any) {
            alert(e?.response?.data ?? e?.message ?? "Neuspješan reset turnira.")
        }
    }

    function setLocalMatchScore(roundId: number, matchId: number, which: "A" | "B", raw: string) {
        const v = raw.replace(/[^\d]/g, "")
        setRounds((rs): RoundLocal[] =>
            rs.map((r) =>
                r.id !== roundId
                    ? r
                    : {
                        ...r,
                        matches: r.matches.map((m): MatchLocal =>
                            m.id !== matchId
                                ? m
                                : {
                                    ...m,
                                    _score1: which === "A" ? v : m._score1,
                                    _score2: which === "B" ? v : m._score2,
                                    _dirty: true,
                                }
                        ),
                    }
            )
        )
    }

    async function saveMatch(roundId: number, m: MatchLocal) {
        if (!uuid) return
        const n1 = m._score1 && m._score1.trim() !== "" ? Number(m._score1) : undefined
        const n2 = m._score2 && m._score2.trim() !== "" ? Number(m._score2) : undefined
        if (n1 !== undefined && !Number.isFinite(n1)) return
        if (n2 !== undefined && !Number.isFinite(n2)) return

        await updateMatchScore(uuid, roundId, m.id, {score1: n1 ?? null, score2: n2 ?? null})

        setRounds((rs): RoundLocal[] =>
            rs.map((r) =>
                r.id !== roundId
                    ? r
                    : {
                        ...r,
                        matches: r.matches.map((mx) =>
                            mx.id !== m.id ? mx : {...mx, score1: n1, score2: n2, _dirty: false}
                        ),
                    }
            )
        )

        const refreshedPairs = await fetchTournamentPairs(uuid)
        setPairs(refreshedPairs)
        const refreshedRounds = await fetchRounds(uuid)
        setRounds(refreshedRounds.map((r) => ({
            ...r,
            matches: r.matches.map((mx) => ({
                ...mx,
                _score1: mx.score1 != null ? String(mx.score1) : "",
                _score2: mx.score2 != null ? String(mx.score2) : "",
                _dirty: false,
                _editing: false,
            }))
        })))
    }

    async function hardReset(roundId: number) {
        if (!uuid) return
        const round = rounds.find(r => r.id === roundId)
        if (round?.status === "COMPLETED") {
            return
        }
        if (!confirm("Hard reset this round? All matches will be deleted and stats rolled back.")) return
        await hardResetRound(uuid, roundId)
        await refreshAll()
    }

    function winnerOf(m: MatchLocal): number | null {
        if (!m.pair1Id || !m.pair2Id) return null
        const a = m._score1 && m._score1 !== "" ? Number(m._score1) : m.score1 ?? null
        const b = m._score2 && m._score2 !== "" ? Number(m._score2) : m.score2 ?? null
        if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) || a === b) return null
        return a > b ? m.pair1Id : m.pair2Id
    }

    function canFinish(r: RoundLocal): boolean {
        if (r.matches.length === 0) return false
        return r.matches.every((m) => {
            if (!m.pair1Id || !m.pair2Id) return true
            return winnerOf(m) !== null
        })
    }

    async function finishWholeRound(r: RoundLocal) {
        if (!uuid) return

        for (const m of r.matches) {
            if (!m.pair1Id || !m.pair2Id) continue
            if (m._dirty) {
                const score1 = m._score1 && m._score1 !== "" ? Number(m._score1) : null
                const score2 = m._score2 && m._score2 !== "" ? Number(m._score2) : null
                await updateMatchScore(uuid, r.id, m.id, {score1, score2})
            }
        }

        const updated = await finishRound(uuid, r.id)

        setRounds(rs =>
            rs.map(x =>
                x.id === r.id
                    ? {
                        ...updated,
                        matches: updated.matches.map(m => ({
                            ...m,
                            _score1: m.score1 != null ? String(m.score1) : "",
                            _score2: m.score2 != null ? String(m.score2) : "",
                            _dirty: false,
                            _editing: false,
                        })),
                    }
                    : x
            )
        )

        const refreshedPairs = await fetchTournamentPairs(uuid)
        setPairs(refreshedPairs)
    }

    const toggleRoundCollapsed = (id: number) =>
        setCollapsedRounds((cr) => ({...cr, [id]: !cr[id]}))

    // NEW: send toggle immediately
    async function onToggleAllowRepeats(next: boolean) {
        if (!uuid) return
        const prev = allowRepeats
        setAllowRepeats(next)
        setSavingPM(true)

        try {
            const res = await apiSetAllowRepeats(uuid!, next)
            setT(res)
        } catch (e: any) {
            setAllowRepeats(prev)
            alert(e?.response?.data ?? e?.message ?? "Neuspjelo spremanje postavke.")
        } finally {
            setSavingPM(false)
        }
    }

    async function onTogglePaid(pairId: number, nextPaid: boolean) {
        if (!uuid) return
        // optimistic
        setPairs(ps => ps.map(x => x.id === pairId ? ({ ...(x as any), paid: nextPaid }) : x))
        try {
            const updated = await setPairPaid(uuid, pairId, nextPaid)
            // keep in sync with server response if it returns the pair
            if (updated && typeof updated === "object") {
                setPairs(ps => ps.map(x => x.id === pairId ? (updated as any) : x))
            }
        } catch (e: any) {
            // revert
            setPairs(ps => ps.map(x => x.id === pairId ? ({ ...(x as any), paid: !(nextPaid) }) : x))
            alert(e?.response?.data ?? e?.message ?? "Neuspjelo ažuriranje kotizacije.")
        }
    }

    /* ---------- UI ---------- */
    return (
        <>
            {/* Header */}
            <HStack justify="space-between" mb="3" wrap="wrap" gap="2">
                <Heading size="lg">
                    {t?.name ?? "Tournament"}{" "}
                </Heading>
                <Button asChild variant="ghost" size="sm">
                    <RouterLink to="/tournaments">Natrag na popis</RouterLink>
                </Button>
            </HStack>

            {/* Tabs */}
            <HStack mb="4" gap="2">
                <Button
                    size="sm"
                    variant={tab === "details" ? "solid" : "ghost"}
                    colorPalette="blue"
                    onClick={() => setTab("details")}
                >
                    Detalji
                </Button>
                <Button
                    size="sm"
                    variant={tab === "pairs" ? "solid" : "ghost"}
                    onClick={() => setTab("pairs")}
                >
                    Parovi
                </Button>
                <Button
                    size="sm"
                    variant={tab === "bracket" ? "solid" : "ghost"}
                    onClick={() => setTab("bracket")}
                >
                    Ždrijeb
                </Button>
            </HStack>

            {loading ? (
                <HStack justify="center" py="16">
                    <Spinner/>
                    <Text>Učivanje…</Text>
                </HStack>
            ) : !t ? (
                <VStack py="10">
                    <Text color="red.600">{error ?? "Tournament not found."}</Text>
                    <Button asChild size="sm">
                        <RouterLink to="/tournaments">Back</RouterLink>
                    </Button>
                </VStack>
            ) : tab === "details" ? (
                <>
                    {/* ===== DETAILS — read mode + inline edit mode ===== */}
                    {!editingDetails || !editForm ? (
                        <Box
                            display="grid"
                            gridTemplateColumns={{ base: "1fr", lg: "1fr 320px" }}
                            gap={{ base: "4", lg: "5" }}
                            alignItems="start"
                        >
                            {/* Tile grid + small toolbar with Uredi + Podijeli */}
                            <VStack align="stretch" gap="3">
                                {/* Toolbar */}
                                <HStack justify="flex-end" gap="2">
                                    <ShareButton
                                        url={typeof window !== "undefined" ? window.location.href : ""}
                                        title={t.name}
                                    />
                                    {/* Uredi only when the viewer is the creator
                                        or an admin, and the tournament isn't done. */}
                                    {t.status !== "FINISHED" &&
                                        (isAdmin || (user?.uid && user.uid === t.createdByUid)) && (
                                            <Button
                                                size="xs"
                                                variant="outline"
                                                onClick={enterDetailsEdit}
                                            >
                                                <FiEdit2 /> Uredi
                                            </Button>
                                        )}
                                    {/* Admin-only soft delete. Owners can edit but can't
                                        nuke a tournament — see backend gating. */}
                                    {isAdmin && (
                                        <Button
                                            size="xs"
                                            variant="outline"
                                            colorPalette="red"
                                            onClick={() => setDeleteTournamentOpen(true)}
                                        >
                                            <FiTrash2 /> Obriši
                                        </Button>
                                    )}
                                </HStack>

                                <Box
                                    display="grid"
                                    gridTemplateColumns={{
                                        base: "1fr",
                                        md: "1fr 1fr",
                                        lg: "1fr 1fr 1fr",
                                    }}
                                    gap="3"
                                >
                                    {/* === Creator (top) === */}
                                    {t.createdByName && (
                                        <DetailTile
                                            icon={<FiUser size={13} />}
                                            label="Kreirao"
                                            value={t.createdByName}
                                            span={{ md: "span 2", lg: "span 3" }}
                                        />
                                    )}

                                    {/* === Schedule + capacity === */}
                                    <DetailTile
                                        icon={<FiCalendar size={13} />}
                                        label="Datum"
                                        value={formatDate(t.startAt)}
                                    />
                                    <DetailTile
                                        icon={<FiClock size={13} />}
                                        label="Vrijeme početka"
                                        value={formatTime(t.startAt)}
                                    />
                                    <DetailTile
                                        icon={<FiUser size={13} />}
                                        label="Max parova"
                                        value={typeof t.maxPairs === "number" ? t.maxPairs : "—"}
                                    />

                                    {t.location && (
                                        <DetailTile
                                            icon={<FiMapPin size={13} />}
                                            label="Lokacija"
                                            value={
                                                <HStack justify="space-between" gap="2" wrap="wrap">
                                                    <Text fontWeight="medium">{t.location}</Text>
                                                    <Button
                                                        as="a"
                                                        size="xs"
                                                        variant="outline"
                                                        colorPalette="blue"
                                                        // @ts-expect-error chakra Button polymorphic + anchor props
                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.location)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        title="Otvori u Google Maps"
                                                    >
                                                        <FiExternalLink /> Otvori u kartama
                                                    </Button>
                                                </HStack>
                                            }
                                            span={{ md: "span 2", lg: "span 3" }}
                                        />
                                    )}

                                    {t.details && (
                                        <DetailTile
                                            icon={<FiInfo size={13} />}
                                            label="Detalji"
                                            value={
                                                <Text whiteSpace="pre-wrap" fontSize="sm" fontWeight="normal">
                                                    {t.details}
                                                </Text>
                                            }
                                            span={{ md: "span 2", lg: "span 3" }}
                                        />
                                    )}

                                    {/* === Pricing === */}
                                    {typeof t.entryPrice === "number" && (
                                        <DetailTile
                                            icon={<FiDollarSign size={13} />}
                                            label="Kotizacija"
                                            value={fmtMoney(t.entryPrice)}
                                        />
                                    )}
                                    {typeof t.repassagePrice === "number" && (
                                        <DetailTile
                                            icon={<FiDollarSign size={13} />}
                                            label="Repasaž"
                                            value={fmtMoney(t.repassagePrice)}
                                        />
                                    )}
                                    {typeof t.repassageSecondPrice === "number" && (
                                        <DetailTile
                                            icon={<FiDollarSign size={13} />}
                                            label="Drugi repasaž"
                                            value={fmtMoney(t.repassageSecondPrice)}
                                        />
                                    )}
                                    <DetailTile
                                        label="Repasaž do"
                                        value={
                                            <Badge
                                                variant="subtle"
                                                colorPalette="blue"
                                                size="sm"
                                            >
                                                {t.repassageUntil === "FINALS"
                                                    ? "Finala"
                                                    : t.repassageUntil === "SEMIFINALS"
                                                        ? "Polufinala"
                                                        : "—"}
                                            </Badge>
                                        }
                                    />

                                    {/* === Rewards (combined: type + 1./2./3. with trophies) === */}
                                    {t.rewardType && (() => {
                                        const isPercent = t.rewardType === "PERCENTAGE"
                                        const fmt = (n: number | null | undefined) =>
                                            isPercent ? `${n ?? 0}%` : fmtMoney(n)
                                        const places: Array<{
                                            place: string
                                            color: string
                                            value: string
                                        }> = [
                                            { place: "1. mjesto", color: "#F5C518", value: fmt(t.rewardFirst) },
                                            { place: "2. mjesto", color: "#9CA3AF", value: fmt(t.rewardSecond) },
                                            { place: "3. mjesto", color: "#CD7F32", value: fmt(t.rewardThird) },
                                        ]
                                        return (
                                            <DetailTile
                                                icon={<FiGift size={13} />}
                                                label="Nagrade"
                                                span={{ md: "span 2", lg: "span 3" }}
                                                value={
                                                    <VStack align="stretch" gap="2.5">
                                                        <HStack>
                                                            <Badge variant="subtle" colorPalette="purple" size="sm">
                                                                {isPercent ? "Postotak fonda" : "Fiksne"}
                                                            </Badge>
                                                        </HStack>
                                                        <Box
                                                            display="grid"
                                                            gridTemplateColumns={{ base: "1fr", sm: "1fr 1fr 1fr" }}
                                                            gap="3"
                                                        >
                                                            {places.map((p) => (
                                                                <HStack
                                                                    key={p.place}
                                                                    gap="2"
                                                                    p="2"
                                                                    rounded="md"
                                                                    bg="bg.muted"
                                                                >
                                                                    <Box color={p.color} flexShrink={0} display="flex" alignItems="center">
                                                                        <FaTrophy size={20} />
                                                                    </Box>
                                                                    <Box minW="0">
                                                                        <Text fontSize="2xs" color="fg.muted" letterSpacing="wide" textTransform="uppercase">
                                                                            {p.place}
                                                                        </Text>
                                                                        <Text fontWeight="semibold" lineHeight="short">
                                                                            {p.value}
                                                                        </Text>
                                                                    </Box>
                                                                </HStack>
                                                            ))}
                                                        </Box>
                                                    </VStack>
                                                }
                                            />
                                        )
                                    })()}

                                    {/* === Contact === */}
                                    {t.contactName && (
                                        <DetailTile
                                            icon={<FiUser size={13} />}
                                            label="Kontakt ime"
                                            value={t.contactName}
                                        />
                                    )}
                                    {t.contactPhone && (
                                        <DetailTile
                                            icon={<FiPhone size={13} />}
                                            label="Telefon"
                                            value={
                                                <chakra.a
                                                    href={`tel:${t.contactPhone.replace(/\s+/g, "")}`}
                                                    color="blue.fg"
                                                    fontWeight="medium"
                                                    _hover={{ textDecoration: "underline" }}
                                                >
                                                    {t.contactPhone}
                                                </chakra.a>
                                            }
                                        />
                                    )}

                                    {/* === Extras === */}
                                    {t.additionalOptions && t.additionalOptions.length > 0 && (
                                        <DetailTile
                                            icon={<FiAward size={13} />}
                                            label="Dodatne opcije"
                                            value={
                                                <HStack wrap="wrap" gap="2">
                                                    {t.additionalOptions.map((opt) => (
                                                        <Badge key={opt} variant="solid" colorPalette="blue">
                                                            {opt}
                                                        </Badge>
                                                    ))}
                                                </HStack>
                                            }
                                            span={{ md: "span 2", lg: "span 3" }}
                                        />
                                    )}
                                </Box>
                            </VStack>

                            {/* Poster column — sticky on desktop */}
                            <Box
                                position={{ base: "static", lg: "sticky" }}
                                top={{ lg: "4" }}
                                alignSelf="start"
                            >
                                <Card.Root variant="outline" rounded="xl" overflow="hidden" borderColor="border.emphasized" shadow="sm">
                                    {/* Poster frame. On mobile we let the poster's
                                        natural aspect ratio decide the height (capped
                                        by maxH so a freakishly tall poster doesn't
                                        eat the screen) and use objectFit="contain" so
                                        the whole image is visible — no edges clipped
                                        off the way "cover" was doing on portrait
                                        posters. The neutral bg fills any letterbox
                                        bars cleanly. Desktop keeps a fixed sticky
                                        height because the side-by-side layout needs
                                        a predictable row. */}
                                    <Box
                                        bg="bg.muted"
                                        h={{ base: "auto", md: "320px", lg: "380px" }}
                                        maxH={{ base: "70vh", md: "320px", lg: "380px" }}
                                        overflow="hidden"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="center"
                                    >
                                        {t.bannerUrl ? (
                                            <Image
                                                src={t.bannerUrl}
                                                alt={t.name}
                                                w="100%"
                                                h={{ base: "auto", md: "100%" }}
                                                maxH={{ base: "70vh", md: "100%" }}
                                                objectFit={{ base: "contain", md: "cover" }}
                                                draggable={false}
                                            />
                                        ) : (
                                            <Box
                                                w="100%"
                                                h="240px"
                                                display="flex"
                                                alignItems="center"
                                                justifyContent="center"
                                                color="fg.muted"
                                                fontSize="sm"
                                            >
                                                Nema plakata
                                            </Box>
                                        )}
                                    </Box>
                                </Card.Root>
                            </Box>
                        </Box>
                    ) : (
                        /* ===== EDIT MODE ===== */
                        <VStack align="stretch" gap="4">
                            <SectionCard icon={<FiInfo />} title="Osnovno">
                                <VStack align="stretch" gap="4">
                                    <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4">
                                        <Field.Root required>
                                            <Field.Label>Ime turnira <Field.RequiredIndicator /></Field.Label>
                                            <Input
                                                value={editForm.name}
                                                onChange={(e) => patchEdit("name", e.target.value)}
                                            />
                                        </Field.Root>
                                        <Field.Root>
                                            <Field.Label>Lokacija</Field.Label>
                                            <Input
                                                value={editForm.location}
                                                onChange={(e) => patchEdit("location", e.target.value)}
                                            />
                                        </Field.Root>
                                    </Box>
                                    <Field.Root>
                                        <Field.Label>Detalji</Field.Label>
                                        <Textarea
                                            rows={3}
                                            value={editForm.details}
                                            onChange={(e) => patchEdit("details", e.target.value)}
                                        />
                                    </Field.Root>
                                    <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }} gap="4">
                                        <Field.Root>
                                            <Field.Label>Datum</Field.Label>
                                            <Input
                                                type="date"
                                                value={editForm.startDate}
                                                onChange={(e) => patchEdit("startDate", e.target.value)}
                                            />
                                        </Field.Root>
                                        <Field.Root>
                                            <Field.Label>Vrijeme</Field.Label>
                                            <Input
                                                type="time"
                                                value={editForm.startTime}
                                                onChange={(e) => patchEdit("startTime", e.target.value)}
                                            />
                                        </Field.Root>
                                        <Field.Root>
                                            <Field.Label>Max parova</Field.Label>
                                            <Input
                                                type="number"
                                                inputMode="numeric"
                                                min={2}
                                                value={editForm.maxPairs}
                                                onChange={(e) => patchEdit("maxPairs", sanitizeInt(e.target.value))}
                                            />
                                        </Field.Root>
                                    </Box>
                                </VStack>
                            </SectionCard>

                            <SectionCard icon={<FiDollarSign />} title="Kotizacija i repasaž">
                                <VStack align="stretch" gap="4">
                                    <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4">
                                        <Field.Root>
                                            <Field.Label>Kotizacija</Field.Label>
                                            <SuffixInput
                                                value={editForm.entryPrice}
                                                onChange={(v) => patchEdit("entryPrice", sanitizeMoney(v))}
                                                suffix="€"
                                            />
                                        </Field.Root>
                                        <Field.Root>
                                            <Field.Label>Repasaž</Field.Label>
                                            <SuffixInput
                                                value={editForm.repassagePrice}
                                                onChange={(v) => patchEdit("repassagePrice", sanitizeMoney(v))}
                                                suffix="€"
                                            />
                                        </Field.Root>
                                    </Box>
                                    <Field.Root>
                                        <Field.Label>Repasaž moguć do</Field.Label>
                                        <RadioGroup.Root
                                            value={editForm.repassageUntil}
                                            onValueChange={(v) =>
                                                patchEdit(
                                                    "repassageUntil",
                                                    (typeof v === "string" ? v : (v as any)?.value) as "FINALS" | "SEMIFINALS"
                                                )
                                            }
                                        >
                                            <HStack gap="6" wrap="wrap" rowGap="2">
                                                <RadioGroup.Item value="FINALS">
                                                    <RadioGroup.ItemHiddenInput />
                                                    <RadioGroup.ItemIndicator />
                                                    <RadioGroup.ItemText>Finala</RadioGroup.ItemText>
                                                </RadioGroup.Item>
                                                <RadioGroup.Item value="SEMIFINALS">
                                                    <RadioGroup.ItemHiddenInput />
                                                    <RadioGroup.ItemIndicator />
                                                    <RadioGroup.ItemText>Polufinala</RadioGroup.ItemText>
                                                </RadioGroup.Item>
                                            </HStack>
                                        </RadioGroup.Root>
                                    </Field.Root>
                                    {editForm.repassageSecondPrice == null ? (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            colorPalette="blue"
                                            onClick={() => patchEdit("repassageSecondPrice", "30")}
                                            alignSelf="flex-start"
                                        >
                                            <FiPlus /> Dodaj drugi repasaž
                                        </Button>
                                    ) : (
                                        <Box borderWidth="1px" borderColor="border.subtle" rounded="md" p="3" bg="bg.muted">
                                            <HStack justify="space-between" mb="2">
                                                <Text fontSize="sm" fontWeight="medium">Drugi repasaž</Text>
                                                <IconButton
                                                    type="button"
                                                    aria-label="Ukloni drugi repasaž"
                                                    variant="ghost"
                                                    size="xs"
                                                    onClick={() => patchEdit("repassageSecondPrice", null)}
                                                >
                                                    <FiMinus />
                                                </IconButton>
                                            </HStack>
                                            <SuffixInput
                                                value={editForm.repassageSecondPrice}
                                                onChange={(v) => patchEdit("repassageSecondPrice", sanitizeMoney(v))}
                                                suffix="€"
                                            />
                                        </Box>
                                    )}
                                </VStack>
                            </SectionCard>

                            <SectionCard icon={<FiGift />} title="Nagrade">
                                <VStack align="stretch" gap="4">
                                    <RadioGroup.Root
                                        value={editForm.rewardType}
                                        onValueChange={(v) =>
                                            patchEdit(
                                                "rewardType",
                                                (typeof v === "string" ? v : (v as any)?.value) as "FIXED" | "PERCENTAGE"
                                            )
                                        }
                                    >
                                        <HStack gap="6" wrap="wrap" rowGap="2">
                                            <RadioGroup.Item value="FIXED">
                                                <RadioGroup.ItemHiddenInput />
                                                <RadioGroup.ItemIndicator />
                                                <RadioGroup.ItemText>Fiksne (€)</RadioGroup.ItemText>
                                            </RadioGroup.Item>
                                            <RadioGroup.Item value="PERCENTAGE">
                                                <RadioGroup.ItemHiddenInput />
                                                <RadioGroup.ItemIndicator />
                                                <RadioGroup.ItemText>Postotak fonda (%)</RadioGroup.ItemText>
                                            </RadioGroup.Item>
                                        </HStack>
                                    </RadioGroup.Root>
                                    <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }} gap="4">
                                        <Field.Root>
                                            <Field.Label>1. mjesto</Field.Label>
                                            <SuffixInput
                                                value={editForm.rewardFirst}
                                                onChange={(v) => patchEdit("rewardFirst", sanitizeMoney(v))}
                                                suffix={editForm.rewardType === "FIXED" ? "€" : "%"}
                                            />
                                        </Field.Root>
                                        <Field.Root>
                                            <Field.Label>2. mjesto</Field.Label>
                                            <SuffixInput
                                                value={editForm.rewardSecond}
                                                onChange={(v) => patchEdit("rewardSecond", sanitizeMoney(v))}
                                                suffix={editForm.rewardType === "FIXED" ? "€" : "%"}
                                            />
                                        </Field.Root>
                                        <Field.Root>
                                            <Field.Label>3. mjesto</Field.Label>
                                            <SuffixInput
                                                value={editForm.rewardThird}
                                                onChange={(v) => patchEdit("rewardThird", sanitizeMoney(v))}
                                                suffix={editForm.rewardType === "FIXED" ? "€" : "%"}
                                            />
                                        </Field.Root>
                                    </Box>
                                </VStack>
                            </SectionCard>

                            <SectionCard icon={<FiPhone />} title="Kontakt organizatora">
                                <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4">
                                    <Field.Root>
                                        <Field.Label>Ime</Field.Label>
                                        <Input
                                            value={editForm.contactName}
                                            onChange={(e) => patchEdit("contactName", e.target.value)}
                                        />
                                    </Field.Root>
                                    <Field.Root>
                                        <Field.Label>Telefon</Field.Label>
                                        <Input
                                            inputMode="tel"
                                            value={editForm.contactPhone}
                                            onChange={(e) => patchEdit("contactPhone", e.target.value)}
                                        />
                                    </Field.Root>
                                </Box>
                            </SectionCard>

                            {/* Sticky save bar */}
                            <Box
                                position="sticky"
                                bottom="0"
                                bg="bg"
                                borderTopWidth="1px"
                                borderColor="border.subtle"
                                py="3"
                                mt="2"
                            >
                                <HStack justify="space-between" gap="3" wrap="wrap">
                                    <Text fontSize="sm" color="fg.muted">
                                        {editForm.name.trim() ? (
                                            <chakra.span color="green.fg">Spremno za spremanje.</chakra.span>
                                        ) : (
                                            <chakra.span color="red.500">Nedostaje: Ime turnira</chakra.span>
                                        )}
                                    </Text>
                                    <HStack gap="2">
                                        <Button variant="ghost" onClick={cancelDetailsEdit} disabled={savingDetails}>
                                            Odustani
                                        </Button>
                                        <Button
                                            variant="solid"
                                            colorPalette="blue"
                                            onClick={saveDetailsEdit}
                                            loading={savingDetails}
                                            disabled={!editForm.name.trim() || savingDetails}
                                        >
                                            Spremi izmjene
                                        </Button>
                                    </HStack>
                                </HStack>
                            </Box>
                        </VStack>
                    )}
                </>
            ) : tab === "pairs" ? (
                <>
                    {/* ===== PAIRS (editable) ===== */}
                    {(() => {
                        const tournamentAlready =
                            rounds.length > 0 ||
                            (t?.status as string) === "IN_PROGRESS" ||
                            t?.status === "FINISHED"
                        const tournamentLocked = t?.status === "FINISHED"
                        const activePairs = pairs.filter((p) => !p.isEliminated)
                        const eliminatedPairs = pairs.filter((p) => p.isEliminated)
                        const paidCount = pairs.filter((p) => !!(p as any).paid).length
                        const capacity = typeof t.maxPairs === "number" ? t.maxPairs : null
                        const atCapacity = capacity != null && pairs.length >= capacity
                        const canEditTournament =
                            isAdmin || (!!user?.uid && user.uid === t.createdByUid)
                        // True when the current user already has a pair (pending or
                        // approved) in this tournament. Drives the "Prijavi par" button
                        // → "Već si prijavljen" badge swap below so we don't let users
                        // hit the API a second time and bounce off the 409.
                        const userAlreadyRegistered =
                            !!user?.uid &&
                            pairs.some((p) => p.submittedByUid === user.uid)
                        // Self-registration is offered to everyone until the tournament
                        // starts. Anonymous users get bounced to /login on click. Hidden
                        // entirely once the user has registered — they get a badge instead.
                        const showSelfRegisterButton = !tournamentAlready && !userAlreadyRegistered

                        const renderPair = (p: PairShort, _idx: number, eliminated: boolean) => {
                            const hasServerId = typeof p.id === "number" && p.id > 0
                            const eligible =
                                hasServerId &&
                                p.losses === 1 &&
                                !p.extraLife &&
                                !nextRoundAlreadyStarted(p.id)
                            const paid = !!(p as any).paid
                            const extraBtnDisabled = p.extraLife || !eligible || !hasServerId

                            const isPending = !!p.pendingApproval
                            // Winner detection — case-insensitive trim match against
                            // tournament.winnerName, only meaningful once the
                            // tournament is finished. The badge + gold styling
                            // identifies the champion at a glance on the pairs grid.
                            const isWinnerPair =
                                t?.status === "FINISHED"
                                && !!t?.winnerName
                                && !!p.name
                                && t.winnerName.trim().toLowerCase() === p.name.trim().toLowerCase()
                            return (
                                <Box
                                    key={p.id}
                                    borderWidth={isWinnerPair ? "2px" : isPending ? "2px" : "1px"}
                                    borderColor={
                                        isWinnerPair ? "yellow.solid"
                                        : isPending ? "yellow.solid"
                                        : eliminated ? "border.emphasized"
                                        : paid && !tournamentAlready ? "green.muted"
                                        : "border.emphasized"
                                    }
                                    rounded="lg"
                                    p="3"
                                    bg={
                                        isWinnerPair ? "yellow.subtle"
                                        : isPending ? "yellow.subtle"
                                        : eliminated ? "bg.subtle"
                                        : "bg"
                                    }
                                    // Champion pair gets a soft golden glow so the
                                    // winner card pops even when the grid is busy.
                                    boxShadow={isWinnerPair ? "0 0 0 3px var(--chakra-colors-yellow-muted)" : undefined}
                                    // Winner is always full opacity even if technically
                                    // "eliminated" by the data model — they won, after
                                    // all. Otherwise eliminated pairs fade out.
                                    opacity={!isWinnerPair && eliminated ? 0.85 : 1}
                                    display="flex"
                                    flexDirection="column"
                                    gap="2"
                                >
                                    {/* Top row: avatar + name input + info button */}
                                    <HStack gap="2" align="center">
                                        <PairAvatar name={p.name} eliminated={eliminated && !isWinnerPair} />
                                        {/* Gold trophy in front of the name for the
                                            winning pair — only ever set once tournament
                                            status is FINISHED, so it never mis-fires
                                            on still-in-progress events. */}
                                        {isWinnerPair && (
                                            <Box color="yellow.fg" flexShrink={0}>
                                                <FaTrophy size={20} />
                                            </Box>
                                        )}
                                        <Box flex="1" minW="0">
                                            <Input
                                                size="sm"
                                                variant="flushed"
                                                value={p.name}
                                                onChange={(e) => changePairName(p.id, e.target.value)}
                                                placeholder="Ime para"
                                                disabled={tournamentAlready || tournamentLocked}
                                                fontWeight={isWinnerPair ? "bold" : "medium"}
                                                color={isWinnerPair ? "yellow.fg" : undefined}
                                            />
                                        </Box>
                                        <IconButton
                                            aria-label="Povijest mečeva"
                                            size="xs"
                                            variant="ghost"
                                            onClick={() => setInfoPairId(p.id)}
                                            disabled={!hasServerId}
                                            title="Povijest mečeva"
                                            flexShrink={0}
                                        >
                                            <FiInfo />
                                        </IconButton>
                                    </HStack>

                                    {/* Submitter line — always rendered (placeholder when missing)
                                        so cards in the same grid row stay the same height. */}
                                    <Text fontSize="xs" color="fg.muted" pl="10" minH="1.25em" lineHeight="1.25em">
                                        {p.submittedBySlug ? (
                                            <>
                                                Prijavio:{" "}
                                                <RouterLink
                                                    to={`/profile/${p.submittedBySlug}`}
                                                    style={{ color: "var(--chakra-colors-blue-fg)", fontWeight: 500 }}
                                                >
                                                    {p.submittedByName || p.submittedBySlug}
                                                </RouterLink>
                                            </>
                                        ) : (
                                            // Non-breaking space keeps the line height; visually empty.
                                            <chakra.span aria-hidden>&nbsp;</chakra.span>
                                        )}
                                    </Text>

                                    {/* Bottom row: status pills + actions. mt="auto" pins it to
                                        the card bottom so the action rows line up across cards
                                        regardless of the submitter line above. */}
                                    <HStack gap="2" wrap="wrap" justify="space-between" mt="auto">
                                        <HStack gap="1.5" wrap="wrap">
                                            {isPending && (
                                                <Badge variant="solid" colorPalette="yellow">
                                                    Čeka odobrenje
                                                </Badge>
                                            )}
                                            {tournamentAlready && (
                                                <Badge variant="subtle" colorPalette="gray">
                                                    {p.wins}W – {p.losses}L
                                                </Badge>
                                            )}
                                            {/* Život status badges — read-only for everyone.
                                                "Ima život" (green): pair still on its first
                                                life, hasn't lost a game yet. "Nema život"
                                                (red): pair already burned through its first
                                                life and bought the safety-net extra life,
                                                so the next loss eliminates them. A pair
                                                with one loss but no extraLife is in the
                                                "buy now" middle zone and shows neither
                                                badge — only the organizer's Život button. */}
                                            {tournamentAlready && !isPending && !eliminated && p.losses === 0 && (
                                                <Badge variant="subtle" colorPalette="green">
                                                    <HStack gap="1"><FiHeart size={10} /> Ima život</HStack>
                                                </Badge>
                                            )}
                                            {tournamentAlready && !isPending && !eliminated && p.extraLife && (
                                                <Badge variant="subtle" colorPalette="red">
                                                    <HStack gap="1"><FiHeart size={10} /> Nema život</HStack>
                                                </Badge>
                                            )}
                                            {eliminated && (
                                                <Badge variant="subtle" colorPalette="gray">Eliminiran</Badge>
                                            )}
                                            {!tournamentAlready && !isPending && (
                                                <Badge variant="subtle" colorPalette={paid ? "green" : "red"}>
                                                    <HStack gap="1">
                                                        {paid ? <FiCheck size={10} /> : <FiX size={10} />}
                                                        {paid ? "Plaćeno" : "Nije plaćeno"}
                                                    </HStack>
                                                </Badge>
                                            )}
                                        </HStack>

                                        <HStack gap="1.5">
                                            {/* Owner-only Odobri for pending pairs */}
                                            {isPending && canEditTournament && (
                                                <Button
                                                    size="xs"
                                                    variant="solid"
                                                    colorPalette="green"
                                                    onClick={async () => {
                                                        try {
                                                            const updated = await approvePair(uuid!, p.id)
                                                            setPairs((ps) => ps.map((x) => (x.id === updated.id ? updated : x)))
                                                        } catch (err: any) {
                                                            alert(String(err?.response?.data ?? err?.message ?? "Failed to approve."))
                                                        }
                                                    }}
                                                >
                                                    <FiCheck /> Odobri
                                                </Button>
                                            )}
                                            {!tournamentAlready && !isPending && canEditTournament ? (
                                                <Button
                                                    size="xs"
                                                    variant={paid ? "outline" : "solid"}
                                                    colorPalette={paid ? "green" : "red"}
                                                    onClick={() => onTogglePaid(p.id, !paid)}
                                                    title={paid ? "Označi kao neplaćeno" : "Označi kao plaćeno"}
                                                >
                                                    {paid ? "Označi neplaćeno" : "Plati"}
                                                </Button>
                                            ) : !tournamentLocked && !isPending && canEditTournament ? (
                                                // Život buy-button — owner/admin only.
                                                // Status (Ima/Nema život) is shown by the
                                                // read-only badges above; this button is
                                                // strictly the action that lets the
                                                // organizer purchase a safety-net life
                                                // for a pair after their first loss.
                                                // Disabled (and tooltip-explained) when
                                                // already bought, not yet eligible, or
                                                // the pair hasn't been saved server-side.
                                                <Button
                                                    size="xs"
                                                    variant="solid"
                                                    colorPalette={p.extraLife ? "gray" : eligible ? "green" : "gray"}
                                                    disabled={extraBtnDisabled}
                                                    onClick={async () => {
                                                        if (extraBtnDisabled) return
                                                        try {
                                                            const updated = await buyExtraLife(uuid!, p.id)
                                                            setPairs((ps) => ps.map((x) => (x.id === updated.id ? updated : x)))
                                                        } catch (err: any) {
                                                            alert(String(err?.response?.data ?? err?.message ?? "Failed to buy extra life."))
                                                        }
                                                    }}
                                                    title={
                                                        p.extraLife ? "Već kupljeno"
                                                            : eligible ? "Kupi život"
                                                            : !hasServerId ? "Spremi prvo"
                                                            : "Nije dostupno"
                                                    }
                                                >
                                                    <HStack gap="1"><FiHeart /> Život</HStack>
                                                </Button>
                                            ) : null}

                                            {/* Owner/admin only — non-owners shouldn't see
                                                the trash icon at all. The backend would 403
                                                them anyway, but rendering the button gives
                                                the wrong impression that they can delete. */}
                                            {!tournamentAlready && canEditTournament && (
                                                <IconButton
                                                    aria-label="Ukloni par"
                                                    size="xs"
                                                    variant="ghost"
                                                    colorPalette="red"
                                                    onClick={() => {
                                                        // Locally-added rows (negative id) don't exist on the
                                                        // server yet — drop them straight from state without
                                                        // confirmation.
                                                        if (p.id <= 0) {
                                                            removePair(p.id)
                                                            return
                                                        }
                                                        setPendingDeletePair(p)
                                                    }}
                                                    title="Ukloni par"
                                                >
                                                    <FiTrash2 />
                                                </IconButton>
                                            )}
                                        </HStack>
                                    </HStack>
                                </Box>
                            )
                        }

                        return (
                            <VStack align="stretch" gap="4">
                                {/* Header card with stats and actions */}
                                <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
                                    <Card.Body py="3" px={{ base: "3", md: "4" }}>
                                        <HStack justify="space-between" wrap="wrap" gap="3">
                                            <HStack gap="6" wrap="wrap">
                                                <HStack gap="2" align="baseline">
                                                    <Text
                                                        fontSize="2xl"
                                                        fontWeight="semibold"
                                                        color={
                                                            capacity != null && pairs.length > capacity
                                                                ? "yellow.fg"
                                                                : undefined
                                                        }
                                                    >
                                                        {pairs.length}
                                                    </Text>
                                                    <Text fontSize="sm" color="fg.muted">
                                                        parova{capacity != null ? ` / ${capacity}` : ""}
                                                    </Text>
                                                    {capacity != null && pairs.length > capacity && (
                                                        <Badge variant="solid" colorPalette="yellow" size="sm">
                                                            +{pairs.length - capacity} preko kapaciteta
                                                        </Badge>
                                                    )}
                                                </HStack>
                                                {!tournamentAlready && (
                                                    <HStack gap="2">
                                                        <Text
                                                            fontSize="2xl"
                                                            fontWeight="semibold"
                                                            color={paidCount === pairs.length && pairs.length > 0 ? "green.fg" : "fg"}
                                                        >
                                                            {paidCount}
                                                        </Text>
                                                        <Text fontSize="sm" color="fg.muted">platilo kotizaciju</Text>
                                                    </HStack>
                                                )}
                                                {tournamentAlready && (
                                                    <HStack gap="2">
                                                        <Text fontSize="2xl" fontWeight="semibold">{activePairs.length}</Text>
                                                        <Text fontSize="sm" color="fg.muted">aktivnih</Text>
                                                    </HStack>
                                                )}
                                            </HStack>
                                            <HStack gap="2" wrap="wrap">
                                                {/* Self-registration is offered to everyone. Anonymous users
                                                    get bounced to /login with state.from for return-redirect. */}
                                                {showSelfRegisterButton && (
                                                    <Button
                                                        size="xs"
                                                        variant="solid"
                                                        colorPalette="blue"
                                                        onClick={() => {
                                                            if (!user) {
                                                                navigate("/login", {
                                                                    state: {
                                                                        from: `${location.pathname}${location.search}`,
                                                                    },
                                                                })
                                                                return
                                                            }
                                                            setSelfRegOpen(true)
                                                        }}
                                                    >
                                                        <FiPlus /> Prijavi par za turnir
                                                    </Button>
                                                )}
                                                {!tournamentAlready && userAlreadyRegistered && (
                                                    <Badge variant="subtle" colorPalette="green">
                                                        <HStack gap="1">
                                                            <FiCheck size={11} /> Već si prijavljen
                                                        </HStack>
                                                    </Badge>
                                                )}
                                                {/* Organizer / admin: full pair management */}
                                                {!tournamentLocked && canEditTournament && (
                                                    <>
                                                        <Button
                                                            size="xs"
                                                            variant="outline"
                                                            onClick={addPair}
                                                            disabled={tournamentAlready || atCapacity}
                                                            title={atCapacity ? `Maksimalan broj parova (${capacity})` : "Dodaj novi par"}
                                                        >
                                                            <FiPlus /> Dodaj par
                                                        </Button>
                                                        {!tournamentAlready && (
                                                            <Button
                                                                size="xs"
                                                                variant="solid"
                                                                colorPalette="blue"
                                                                onClick={savePairsAll}
                                                            >
                                                                Spremi promjene
                                                            </Button>
                                                        )}
                                                    </>
                                                )}
                                            </HStack>
                                        </HStack>
                                    </Card.Body>
                                </Card.Root>

                                {/* Open pair-finding requests — visible only before the
                                    tournament starts and only if at least one is OPEN.
                                    Collapsible so the organizer can hide them once they
                                    have a handle on who's looking. */}
                                {(() => {
                                    const openRequests = pairRequests.filter((r) => r.status === "OPEN")
                                    if (tournamentAlready || openRequests.length === 0) return null
                                    return (
                                        <Card.Root
                                            variant="outline"
                                            rounded="xl"
                                            borderColor="blue.muted"
                                            bg="blue.subtle"
                                            shadow="sm"
                                        >
                                            <Card.Body py="3" px={{ base: "3", md: "4" }}>
                                                <HStack justify="space-between" align="center" mb={pairRequestsCollapsed ? "0" : "3"}>
                                                    <HStack gap="2" align="center">
                                                        <Box color="blue.fg"><FiUserPlus /></Box>
                                                        <Text fontWeight="semibold" fontSize="sm">
                                                            Zahtjevi za partnera
                                                        </Text>
                                                        <Badge variant="solid" colorPalette="blue" size="sm">
                                                            {openRequests.length}
                                                        </Badge>
                                                    </HStack>
                                                    <IconButton
                                                        aria-label={pairRequestsCollapsed ? "Proširi" : "Sažmi"}
                                                        size="xs"
                                                        variant="ghost"
                                                        onClick={() => setPairRequestsCollapsed((v) => !v)}
                                                    >
                                                        {pairRequestsCollapsed ? <FiChevronRight /> : <FiChevronDown />}
                                                    </IconButton>
                                                </HStack>
                                                {!pairRequestsCollapsed && (
                                                    <Box
                                                        display="grid"
                                                        gridTemplateColumns={{ base: "1fr", md: "1fr 1fr", lg: "1fr 1fr 1fr" }}
                                                        gap="2"
                                                    >
                                                        {openRequests.map((r) => (
                                                            <Box
                                                                key={r.uuid}
                                                                borderWidth="1px"
                                                                borderColor="border.emphasized"
                                                                rounded="md"
                                                                bg="bg"
                                                                p="2.5"
                                                                display="flex"
                                                                flexDirection="column"
                                                                gap="1"
                                                            >
                                                                <HStack gap="2" align="center">
                                                                    <PairAvatar name={r.playerName} />
                                                                    <Text
                                                                        fontWeight="semibold"
                                                                        fontSize="sm"
                                                                        flex="1"
                                                                        minW="0"
                                                                        overflow="hidden"
                                                                        textOverflow="ellipsis"
                                                                        whiteSpace="nowrap"
                                                                    >
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
                                                                    <Text fontSize="xs" color="fg.muted">
                                                                        {r.note}
                                                                    </Text>
                                                                )}
                                                            </Box>
                                                        ))}
                                                    </Box>
                                                )}
                                            </Card.Body>
                                        </Card.Root>
                                    )
                                })()}

                                {pairs.length === 0 ? (
                                    <Box
                                        borderWidth="1px"
                                        borderColor="border.emphasized"
                                        borderStyle="dashed"
                                        rounded="xl"
                                        py="10"
                                        px="6"
                                    >
                                        <VStack gap="2">
                                            <Box color="fg.muted"><FiUser size={24} /></Box>
                                            <Text fontWeight="medium">Još nema parova</Text>
                                            <Text color="fg.muted" fontSize="sm" textAlign="center">
                                                Dodaj prvi par klikom na "Dodaj par" iznad.
                                            </Text>
                                        </VStack>
                                    </Box>
                                ) : (
                                    <>
                                        {/* Active pairs */}
                                        <Box>
                                            <HStack mb="2" gap="2" align="center">
                                                <Text fontSize="xs" color="fg.muted" fontWeight="semibold" letterSpacing="wide" textTransform="uppercase">
                                                    Aktivni
                                                </Text>
                                                <Text fontSize="xs" color="fg.muted">({activePairs.length})</Text>
                                            </HStack>
                                            <Box
                                                display="grid"
                                                gridTemplateColumns={{ base: "1fr", md: "1fr 1fr", lg: "1fr 1fr 1fr" }}
                                                gap="2"
                                            >
                                                {activePairs.map((p, idx) => renderPair(p, idx, false))}
                                            </Box>
                                        </Box>

                                        {/* Eliminated pairs */}
                                        {eliminatedPairs.length > 0 && (
                                            <Box>
                                                <HStack mb="2" gap="2" align="center">
                                                    <Text fontSize="xs" color="fg.muted" fontWeight="semibold" letterSpacing="wide" textTransform="uppercase">
                                                        Eliminirani
                                                    </Text>
                                                    <Text fontSize="xs" color="fg.muted">({eliminatedPairs.length})</Text>
                                                </HStack>
                                                <Box
                                                    display="grid"
                                                    gridTemplateColumns={{ base: "1fr", md: "1fr 1fr", lg: "1fr 1fr 1fr" }}
                                                    gap="2"
                                                >
                                                    {eliminatedPairs.map((p, idx) => renderPair(p, idx, true))}
                                                </Box>
                                            </Box>
                                        )}
                                    </>
                                )}
                            </VStack>
                        )
                    })()}
                </>
            ) : (
                <>
                    {/* ===== BRACKET ===== */}
                    {(() => {
                        const allCollapsed = rounds.length > 0 && rounds.every(r => collapsedRounds[r.id])
                        const activeRoundId = rounds.find(r => r.status !== "COMPLETED")?.id
                        const canEditTournament =
                            isAdmin || (!!user?.uid && user.uid === t?.createdByUid)
                        // Pairs that have paid AND are approved — only these are
                        // counted toward the start-tournament minimum of 2.
                        const paidApprovedCount = pairs.filter(
                            (p) => !!(p as any).paid && !p.pendingApproval,
                        ).length
                        const canStart = canEditTournament && paidApprovedCount >= 2

                        const matchRow = (r: RoundLocal, m: MatchLocal) => {
                            const a = m.pair1Name ?? (m.pair1Id ? pairById.get(m.pair1Id)?.name : undefined) ?? "—"
                            const b = m.pair2Name ?? (m.pair2Id ? pairById.get(m.pair2Id)?.name : undefined) ?? (m.pair2Id ? "—" : "-")
                            const isFinished = m.status === "FINISHED"
                            const editing = !!m._editing
                            const canEditNow = t?.status !== "FINISHED" && !!m.pair1Id && !!m.pair2Id
                            const inputsEnabled =
                                !!m.pair1Id && !!m.pair2Id &&
                                ((r.status !== "COMPLETED" && !isFinished) || (isFinished && editing))

                            const winnerSide = winnerOf(m) // null | pair1Id | pair2Id
                            const aIsWinner = isFinished && winnerSide && winnerSide === m.pair1Id
                            const bIsWinner = isFinished && winnerSide && winnerSide === m.pair2Id

                            // Bye match — render compact and centered
                            if (!m.pair2Id) {
                                return (
                                    <Box
                                        key={m.id}
                                        borderWidth="1px"
                                        borderColor="blue.muted"
                                        rounded="lg"
                                        bg="blue.subtle"
                                        px="3"
                                        py="2.5"
                                        display="flex"
                                        alignItems="center"
                                        gap="3"
                                        flexWrap="wrap"
                                    >
                                        {/* No Stol N chip for bye matches — the
                                            pair doesn't actually play on a table,
                                            and showing the chip implies otherwise.
                                            Pair name + the "Slobodan prolaz" badge
                                            is enough on its own. */}
                                        <Text fontWeight="semibold" flex="1" minW="0">{a}</Text>
                                        <Badge variant="solid" colorPalette="blue">
                                            <HStack gap="1"><FiCheckCircle size={11}/> Slobodan prolaz</HStack>
                                        </Badge>
                                    </Box>
                                )
                            }

                            // Action button(s) reused by both desktop and mobile
                            // layouts. Wrapping it in a memoised JSX node avoids
                            // duplicating the canEditTournament/editing tree in
                            // two places. Same component instance is rendered
                            // inside the desktop grid and the mobile header row.
                            const actionEl = (
                                canEditTournament && editing ? (
                                    <HStack gap="1">
                                        <Button size="2xs" variant="solid" colorPalette="green"
                                                onClick={() => saveEditedMatch(r.id, m)}>
                                            Spremi
                                        </Button>
                                        <Button size="2xs" variant="ghost"
                                                onClick={() => cancelEdit(r.id, m.id)}>
                                            Odustani
                                        </Button>
                                    </HStack>
                                ) : canEditTournament && !isFinished && r.status !== "COMPLETED" ? (
                                    <Button
                                        size="2xs"
                                        variant="solid"
                                        colorPalette="green"
                                        onClick={() => saveMatch(r.id, m)}
                                        disabled={!m._dirty}
                                    >
                                        <FiCheck /> Spremi
                                    </Button>
                                ) : canEditTournament && isFinished && canEditNow ? (
                                    <Button
                                        size="2xs"
                                        variant="ghost"
                                        onClick={() => enterEdit(r.id, m.id)}
                                        title="Uredi rezultat meča"
                                    >
                                        <FiEdit2 />
                                    </Button>
                                ) : null
                            )

                            return (
                                <Box
                                    key={m.id}
                                    borderWidth="1px"
                                    borderColor={
                                        editing ? "blue.muted"
                                        : inputsEnabled ? "green.muted"
                                        : "border.emphasized"
                                    }
                                    rounded="md"
                                    bg={
                                        editing ? "blue.subtle"
                                        : inputsEnabled ? "green.subtle"
                                        : "bg"
                                    }
                                    px="2.5"
                                    py="1.5"
                                >
                                    {/* Mobile layout — scoreboard style. Tall rows
                                        with one pair per line, the score input at
                                        the right edge of each line, and a header
                                        bar carrying the table chip + action. The
                                        winner pair gets a green-tinted row so the
                                        result is obvious at a glance. */}
                                    <Box display={{ base: "flex", md: "none" }} flexDirection="column" gap="2">
                                        <HStack justify="space-between" align="center">
                                            <Badge variant="subtle" colorPalette="gray" size="sm">
                                                Stol {m.tableNo}
                                            </Badge>
                                            {actionEl}
                                        </HStack>
                                        {/* Pair A row */}
                                        <HStack
                                            gap="2"
                                            px="2"
                                            py="1.5"
                                            rounded="sm"
                                            bg={aIsWinner ? "green.subtle" : "transparent"}
                                            borderLeftWidth={aIsWinner ? "3px" : "0"}
                                            borderLeftColor={aIsWinner ? "green.solid" : "transparent"}
                                        >
                                            {aIsWinner && (
                                                <Box color="green.fg" flexShrink={0}>
                                                    <FiAward size={14} />
                                                </Box>
                                            )}
                                            <Text
                                                fontWeight={aIsWinner ? "semibold" : "medium"}
                                                fontSize="sm"
                                                overflow="hidden"
                                                textOverflow="ellipsis"
                                                whiteSpace="nowrap"
                                                flex="1"
                                                minW="0"
                                            >
                                                {a}
                                            </Text>
                                            <Input
                                                size="xs"
                                                type="text"
                                                inputMode="numeric"
                                                w="52px"
                                                textAlign="center"
                                                fontWeight="bold"
                                                value={m._score1 ?? ""}
                                                onChange={(e) => setLocalMatchScore(r.id, m.id, "A", e.target.value)}
                                                disabled={!inputsEnabled}
                                            />
                                        </HStack>
                                        {/* Pair B row */}
                                        <HStack
                                            gap="2"
                                            px="2"
                                            py="1.5"
                                            rounded="sm"
                                            bg={bIsWinner ? "green.subtle" : "transparent"}
                                            borderLeftWidth={bIsWinner ? "3px" : "0"}
                                            borderLeftColor={bIsWinner ? "green.solid" : "transparent"}
                                        >
                                            {bIsWinner && (
                                                <Box color="green.fg" flexShrink={0}>
                                                    <FiAward size={14} />
                                                </Box>
                                            )}
                                            <Text
                                                fontWeight={bIsWinner ? "semibold" : "medium"}
                                                fontSize="sm"
                                                overflow="hidden"
                                                textOverflow="ellipsis"
                                                whiteSpace="nowrap"
                                                flex="1"
                                                minW="0"
                                            >
                                                {b}
                                            </Text>
                                            <Input
                                                size="xs"
                                                type="text"
                                                inputMode="numeric"
                                                w="52px"
                                                textAlign="center"
                                                fontWeight="bold"
                                                value={m._score2 ?? ""}
                                                onChange={(e) => setLocalMatchScore(r.id, m.id, "B", e.target.value)}
                                                disabled={!inputsEnabled}
                                            />
                                        </HStack>
                                    </Box>

                                    {/* Desktop layout — keep the existing dense
                                        5-column grid. Plenty of horizontal room
                                        on md+ so the score-vs-score middle works
                                        as before; mobile rebuilt above for a
                                        more glanceable read. */}
                                    <Box
                                        display={{ base: "none", md: "grid" }}
                                        gridTemplateColumns="auto 1fr auto 1fr auto"
                                        alignItems="center"
                                        gap="2"
                                    >
                                        <Badge variant="subtle" colorPalette="gray" size="sm" flexShrink={0}>
                                            Stol {m.tableNo}
                                        </Badge>

                                        {/* Pair A */}
                                        <HStack
                                            gap="1.5"
                                            px="1.5"
                                            py="1"
                                            rounded="sm"
                                            bg={aIsWinner ? "green.subtle" : "transparent"}
                                            borderLeftWidth={aIsWinner ? "2px" : "0"}
                                            borderLeftColor={aIsWinner ? "green.solid" : "transparent"}
                                            minW="0"
                                        >
                                            {aIsWinner && (
                                                <Box color="green.fg" flexShrink={0}>
                                                    <FiAward size={13} />
                                                </Box>
                                            )}
                                            <Text
                                                fontWeight={aIsWinner ? "semibold" : "medium"}
                                                fontSize="sm"
                                                overflow="hidden"
                                                textOverflow="ellipsis"
                                                whiteSpace="nowrap"
                                                flex="1"
                                                minW="0"
                                            >
                                                {a}
                                            </Text>
                                        </HStack>

                                        {/* Score */}
                                        <HStack gap="1" justify="center" flexShrink={0}>
                                            <Input
                                                size="xs"
                                                type="text"
                                                inputMode="numeric"
                                                w="44px"
                                                textAlign="center"
                                                fontWeight="semibold"
                                                value={m._score1 ?? ""}
                                                onChange={(e) => setLocalMatchScore(r.id, m.id, "A", e.target.value)}
                                                disabled={!inputsEnabled}
                                            />
                                            <Text fontSize="sm" fontWeight="bold" color="fg.muted">:</Text>
                                            <Input
                                                size="xs"
                                                type="text"
                                                inputMode="numeric"
                                                w="44px"
                                                textAlign="center"
                                                fontWeight="semibold"
                                                value={m._score2 ?? ""}
                                                onChange={(e) => setLocalMatchScore(r.id, m.id, "B", e.target.value)}
                                                disabled={!inputsEnabled}
                                            />
                                        </HStack>

                                        {/* Pair B */}
                                        <HStack
                                            gap="1.5"
                                            px="1.5"
                                            py="1"
                                            rounded="sm"
                                            bg={bIsWinner ? "green.subtle" : "transparent"}
                                            borderRightWidth={bIsWinner ? "2px" : "0"}
                                            borderRightColor={bIsWinner ? "green.solid" : "transparent"}
                                            justifyContent="flex-end"
                                            minW="0"
                                        >
                                            <Text
                                                fontWeight={bIsWinner ? "semibold" : "medium"}
                                                fontSize="sm"
                                                overflow="hidden"
                                                textOverflow="ellipsis"
                                                whiteSpace="nowrap"
                                                textAlign="right"
                                                flex="1"
                                                minW="0"
                                            >
                                                {b}
                                            </Text>
                                            {bIsWinner && (
                                                <Box color="green.fg" flexShrink={0}>
                                                    <FiAward size={13} />
                                                </Box>
                                            )}
                                        </HStack>

                                        <Box flexShrink={0} justifySelf="end">
                                            {actionEl}
                                        </Box>
                                    </Box>
                                </Box>
                            )
                        }

                        // Pre-start, the ždrijeb tab gets a single friendly
                        // "Turnir još nije započeo" card. The organizer also
                        // sees the toolbar above it so they can hit "Startaj
                        // turnir"; everyone else just sees the message.
                        if (!tournamentStarted) {
                            return (
                                <VStack align="stretch" gap="4">
                                    {canEditTournament && (
                                        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
                                            <Card.Body py="3" px={{ base: "3", md: "4" }}>
                                                <HStack gap="2" wrap="wrap" justify="flex-end">
                                                    <Button
                                                        size="sm"
                                                        variant="solid"
                                                        colorPalette="orange"
                                                        onClick={onStartTournament}
                                                        disabled={!canStart}
                                                        title={
                                                            !canStart
                                                                ? "Treba najmanje 2 plaćena para za start"
                                                                : "Pokreni turnir"
                                                        }
                                                    >
                                                        <FiPlay /> Startaj turnir
                                                    </Button>
                                                </HStack>
                                            </Card.Body>
                                        </Card.Root>
                                    )}
                                    <Box
                                        borderWidth="1px"
                                        borderColor="border.emphasized"
                                        borderStyle="dashed"
                                        rounded="xl"
                                        py="12"
                                        px="6"
                                    >
                                        <VStack gap="2">
                                            <Box color="fg.muted"><FiLayers size={28} /></Box>
                                            <Text fontWeight="medium">Turnir još nije započeo</Text>
                                            <Text color="fg.muted" fontSize="sm" textAlign="center">
                                                {canEditTournament
                                                    ? "Klikni \"Startaj turnir\" iznad kad su svi parovi spremni."
                                                    : "Organizator još nije pokrenuo turnir. Provjerite kasnije."}
                                            </Text>
                                        </VStack>
                                    </Box>
                                </VStack>
                            )
                        }

                        // Tournament has started — show the toolbar. It hosts
                        // owner-only settings (repeats switch) and owner-only
                        // actions (Generiraj / Završi / Resetiraj turnir) plus
                        // the Sažmi/Proširi sve toggle which everyone benefits
                        // from. The toolbar renders inside a bordered Card.Root
                        // ONLY when the organizer has settings/actions to show;
                        // for non-owners (or after the tournament is finished)
                        // the Sažmi sve button stands alone in a slim flex row
                        // without the heavy card frame.
                        const tournamentFinished = t?.status === "FINISHED"
                        const ownerToolbar = canEditTournament && !tournamentFinished
                        const showToolbar = ownerToolbar || rounds.length > 0
                        const showRepeatsSetting = ownerToolbar
                        const toolbarTwoColumn = showRepeatsSetting
                        // Inner JSX is the same in both wrappers — the only
                        // difference is whether the outer container is the
                        // bordered Card.Root or a plain Box.
                        const ToolbarShell = ownerToolbar ? Card.Root : Box
                        const toolbarShellProps = ownerToolbar
                            ? {
                                variant: "outline" as const,
                                rounded: "xl" as const,
                                borderColor: "border.emphasized" as const,
                                shadow: "sm" as const,
                              }
                            : {}
                        const InnerWrap = ownerToolbar ? Card.Body : Box
                        const innerWrapProps = ownerToolbar
                            ? { py: "3", px: { base: "3", md: "4" } }
                            : { py: "0", px: "0" }
                        return (
                            <VStack align="stretch" gap="4">
                                {/* ===== Toolbar ===== */}
                                {showToolbar && (
                                <ToolbarShell {...toolbarShellProps}>
                                    <InnerWrap {...innerWrapProps}>
                                        <Box
                                            display="grid"
                                            gridTemplateColumns={toolbarTwoColumn
                                                ? { base: "1fr", lg: "auto 1fr" }
                                                : "1fr"}
                                            gap={{ base: "3", lg: "6" }}
                                            alignItems="center"
                                        >
                                        {/* Settings — owner only AND only while the
                                            tournament isn't finished. Once it's over
                                            the matchmaking rule can't be changed
                                            anymore and the toggle just clutters the
                                            results screen. */}
                                        {showRepeatsSetting && (
                                            <HStack
                                                gap="3"
                                                align="center"
                                                wrap="wrap"
                                                borderRightWidth={{ base: "0", lg: "1px" }}
                                                borderRightColor="border.subtle"
                                                pr={{ base: "0", lg: "6" }}
                                            >
                                                <Box>
                                                    <Text fontSize="sm" fontWeight="medium" lineHeight="short">
                                                        Ponavljanje istih parova
                                                    </Text>
                                                    <Text fontSize="xs" color="fg.muted">
                                                        Dopusti da isti parovi igraju ponovno
                                                    </Text>
                                                </Box>
                                                <Switch.Root
                                                    checked={allowRepeats}
                                                    onCheckedChange={(e) => onToggleAllowRepeats(e.checked)}
                                                    colorPalette={allowRepeats ? "green" : "gray"}
                                                    disabled={savingPM}
                                                >
                                                    <Switch.HiddenInput />
                                                    <Switch.Control cursor={savingPM ? "not-allowed" : "pointer"}>
                                                        <Switch.Thumb />
                                                    </Switch.Control>
                                                </Switch.Root>
                                                {savingPM && <Spinner size="xs" />}
                                            </HStack>
                                        )}

                                        {/* Actions */}
                                        <HStack gap="2" wrap="wrap" justify={{ base: "flex-start", lg: "flex-end" }}>
                                            {rounds.length > 0 && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        setCollapsedRounds(prev => {
                                                            const target = !(rounds.length > 0 && rounds.every(r => prev[r.id]))
                                                            const next: Record<number, boolean> = {}
                                                            rounds.forEach(r => { next[r.id] = target })
                                                            return next
                                                        })
                                                    }
                                                >
                                                    {allCollapsed
                                                        ? <><FiChevronDown /> Proširi sve</>
                                                        : <><FiChevronUp /> Sažmi sve</>}
                                                </Button>
                                            )}
                                            {!tournamentStarted && canEditTournament && (
                                                <Button
                                                    size="sm"
                                                    variant="solid"
                                                    colorPalette="orange"
                                                    onClick={onStartTournament}
                                                    disabled={!canStart}
                                                    title={
                                                        !canStart
                                                            ? "Treba najmanje 2 plaćena para za start"
                                                            : "Pokreni turnir"
                                                    }
                                                >
                                                    <FiPlay /> Startaj turnir
                                                </Button>
                                            )}
                                            {tournamentStarted && t?.status !== "FINISHED" && canEditTournament && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="solid"
                                                        colorPalette="blue"
                                                        onClick={onCreateRound}
                                                        disabled={!canCreateRound}
                                                        title={canCreateRound ? "Generiraj sljedeću rundu" : "Završi trenutnu rundu ili dodaj parove"}
                                                    >
                                                        <Icon as={FiShuffle} />
                                                        {rounds.length === 0 ? " Generiraj prvu rundu" : " Generiraj rundu"}
                                                    </Button>
                                                    {showResetTournament && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            colorPalette="red"
                                                            onClick={onResetTournament}
                                                            title="Obriši sve runde i vrati turnir u nacrt"
                                                        >
                                                            <FiRefreshCw /> Resetiraj turnir
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                            {canFinishTournament && (
                                                <Button
                                                    size="sm"
                                                    variant="solid"
                                                    colorPalette="green"
                                                    onClick={onFinishTournament}
                                                >
                                                    <FiFlag /> Završi turnir
                                                </Button>
                                            )}
                                        </HStack>
                                        </Box>
                                    </InnerWrap>
                                </ToolbarShell>
                                )}

                                {/* ===== Rounds ===== */}
                                {rounds.length === 0 ? (
                                    <Box
                                        borderWidth="1px"
                                        borderColor="border.emphasized"
                                        borderStyle="dashed"
                                        rounded="xl"
                                        py="12"
                                        px="6"
                                    >
                                        <VStack gap="2">
                                            <Box color="fg.muted"><FiLayers size={28} /></Box>
                                            <Text fontWeight="medium">Još nema rundi</Text>
                                            <Text color="fg.muted" fontSize="sm" textAlign="center">
                                                {/* Only the organizer sees the actionable
                                                    instructions ("klikni Generiraj…",
                                                    "prvo startaj…") — for everyone else
                                                    that text is misleading because they
                                                    have no buttons to act on. They get
                                                    a neutral "waiting" message instead. */}
                                                {canEditTournament
                                                    ? tournamentStarted
                                                        ? "Klikni \"Generiraj prvu rundu\" da započneš ždrijeb."
                                                        : "Prvo startaj turnir kad su svi parovi spremni."
                                                    : "Organizator još nije generirao parove. Provjerite kasnije."}
                                            </Text>
                                        </VStack>
                                    </Box>
                                ) : (
                                    <VStack align="stretch" gap="3">
                                        {rounds.map((r) => {
                                            const collapsed = !!collapsedRounds[r.id]
                                            const isActive = r.id === activeRoundId
                                            const completed = r.status === "COMPLETED"
                                            const finishable = canFinish(r) && !completed

                                            return (
                                                <Card.Root
                                                    key={r.id}
                                                    variant="outline"
                                                    rounded="xl"
                                                    borderColor={isActive ? "blue.muted" : "border.emphasized"}
                                                    borderLeftWidth={isActive ? "4px" : "1px"}
                                                    borderLeftColor={isActive ? "blue.solid" : "border.emphasized"}
                                                    opacity={completed ? 0.92 : 1}
                                                    shadow="sm"
                                                >
                                                    {/* Header */}
                                                    <Card.Header
                                                        py="3"
                                                        px={{ base: "3", md: "4" }}
                                                    >
                                                        <HStack justify="space-between" wrap="wrap" gap="2">
                                                            <HStack gap="2" align="center">
                                                                {/* Round collapse toggle. Bumped from
                                                                    size="xs" to "sm" because the xs
                                                                    icon-button shrinks the chevron to
                                                                    near-invisible on some browsers; the
                                                                    explicit `size={18}` on the SVG
                                                                    overrides any inherited font-size
                                                                    quirks so the glyph always renders. */}
                                                                <IconButton
                                                                    aria-label={collapsed ? "Proširi rundu" : "Sažmi rundu"}
                                                                    title={collapsed ? "Proširi rundu" : "Sažmi rundu"}
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => toggleRoundCollapsed(r.id)}
                                                                >
                                                                    {collapsed ? <FiChevronRight size={18} /> : <FiChevronDown size={18} />}
                                                                </IconButton>
                                                                <Heading size="sm">Runda {r.number}</Heading>
                                                                <Badge
                                                                    variant="subtle"
                                                                    colorPalette={completed ? "green" : "yellow"}
                                                                    size="sm"
                                                                >
                                                                    {completed ? (
                                                                        <HStack gap="1"><FiCheckCircle size={11} /> Završeno</HStack>
                                                                    ) : (
                                                                        "Igra se"
                                                                    )}
                                                                </Badge>
                                                            </HStack>
                                                            <HStack gap="1.5" wrap="wrap" justify="flex-end">
                                                                <Button
                                                                    size="xs"
                                                                    variant="ghost"
                                                                    onClick={() => setFullscreenRound(r.id)}
                                                                >
                                                                    <FiMaximize2 /> Puni zaslon
                                                                </Button>
                                                                {/* Round-level mutations are
                                                                    owner/admin only. Hide
                                                                    the buttons for everyone
                                                                    else so the round card is
                                                                    a clean read-only view. */}
                                                                {!completed && canEditTournament && (
                                                                    <Button
                                                                        size="xs"
                                                                        variant="ghost"
                                                                        colorPalette="red"
                                                                        onClick={() => hardReset(r.id)}
                                                                        title="Obriši mečeve u rundi i vrati statistiku"
                                                                    >
                                                                        <FiRotateCcw /> Resetiraj
                                                                    </Button>
                                                                )}
                                                                {!completed && canEditTournament && (
                                                                    <Button
                                                                        size="xs"
                                                                        variant="solid"
                                                                        colorPalette="green"
                                                                        onClick={() => finishWholeRound(r)}
                                                                        disabled={!finishable}
                                                                        title={finishable ? "Završi rundu" : "Unesi sve rezultate prvo"}
                                                                    >
                                                                        <FiFlag /> Završi rundu
                                                                    </Button>
                                                                )}
                                                            </HStack>
                                                        </HStack>
                                                    </Card.Header>

                                                    {/* Body */}
                                                    {!collapsed && (
                                                        <Card.Body
                                                            pt="0"
                                                            pb="3"
                                                            px={{ base: "3", md: "4" }}
                                                        >
                                                            {r.matches.length === 0 ? (
                                                                <Box borderWidth="1px" rounded="md" p="4">
                                                                    <Text color="fg.muted" fontSize="sm">
                                                                        Nema mečeva u ovoj rundi.
                                                                    </Text>
                                                                </Box>
                                                            ) : (
                                                                <VStack align="stretch" gap="2">
                                                                    {[...r.matches]
                                                                        .sort((a, b) => a.tableNo - b.tableNo)
                                                                        .map((m) => matchRow(r, m))}
                                                                </VStack>
                                                            )}
                                                        </Card.Body>
                                                    )}
                                                </Card.Root>
                                            )
                                        })}
                                    </VStack>
                                )}
                            </VStack>
                        )
                    })()}

                    {/* ===== Winner banner — celebratory ===== */}
                    {t?.status === "FINISHED" && t?.winnerName && (
                        <Card.Root
                            mt="6"
                            variant="outline"
                            rounded="xl"
                            borderColor="yellow.muted"
                            bg="yellow.subtle"
                            overflow="hidden"
                        >
                            <Card.Body py={{ base: "8", md: "10" }} px="6">
                                <VStack gap="3">
                                    <Box color="yellow.fg" fontSize={{ base: "5xl", md: "6xl" }}>
                                        <FiAward />
                                    </Box>
                                    <Text
                                        fontSize="sm"
                                        color="fg.muted"
                                        letterSpacing="wider"
                                        textTransform="uppercase"
                                        fontWeight="semibold"
                                    >
                                        Pobjednici
                                    </Text>
                                    <Heading
                                        size={{ base: "xl", md: "2xl" }}
                                        textAlign="center"
                                        color="yellow.fg"
                                    >
                                        {t.winnerName}
                                    </Heading>
                                </VStack>
                            </Card.Body>
                        </Card.Root>
                    )}

                    {/* ===== Fullscreen Dialog ===== */}
                    <Dialog.Root
                        open={fullscreenRound !== null}
                        onOpenChange={(e) => {
                            if (!e.open) setFullscreenRound(null)
                        }}
                    >
                        <Dialog.Backdrop/>
                        <Dialog.Positioner>
                            <Dialog.Content
                                maxW="90vw"
                                w="90vw"
                                maxH="90vh"
                                h="90vh"
                                p="0"
                                rounded="xl"
                                overflow="hidden"
                            >
                                <HStack justify="space-between" align="center" p="3" borderBottomWidth="1px" bg="bg">
                                    <Heading size="sm">
                                        {fullscreenRound
                                            ? `Runda ${rounds.find((r) => r.id === fullscreenRound)?.number} — Puni zaslon`
                                            : "Puni zaslon"}
                                    </Heading>
                                    <IconButton aria-label="Close" size="sm" variant="ghost"
                                                onClick={() => setFullscreenRound(null)}>
                                        <FiX/>
                                    </IconButton>
                                </HStack>

                                <Box p={{ base: "3", md: "5" }} h="calc(100% - 50px)" overflow="auto">
                                    {fullscreenRound &&
                                    rounds.find((r) => r.id === fullscreenRound)?.matches?.length ? (
                                        <Box
                                            display="grid"
                                            gridTemplateColumns={{
                                                base: "repeat(auto-fill, minmax(220px, 1fr))",
                                                md: "repeat(auto-fill, minmax(260px, 1fr))",
                                                lg: "repeat(auto-fill, minmax(300px, 1fr))",
                                            }}
                                            gap={{ base: "3", md: "4" }}
                                        >
                                            {[...rounds.find((r) => r.id === fullscreenRound)!.matches]
                                                .sort((a, b) => a.tableNo - b.tableNo)
                                                .map((m) => {
                                                    const a = m.pair1Id ? pairById.get(m.pair1Id)?.name ?? "—" : "—"
                                                    const b = m.pair2Id ? pairById.get(m.pair2Id)?.name ?? "—" : "—"
                                                    const isBye = !m.pair2Id
                                                    // Winner highlight — only meaningful for
                                                    // finished matches. Tints the winner side
                                                    // green so a quick glance at fullscreen
                                                    // shows who took each table. Byes stay blue.
                                                    const fsWinner = m.status === "FINISHED" ? winnerOf(m) : null
                                                    const aWon = fsWinner != null && fsWinner === m.pair1Id
                                                    const bWon = fsWinner != null && fsWinner === m.pair2Id
                                                    return (
                                                        <Box
                                                            key={m.id}
                                                            borderWidth="1px"
                                                            borderColor={isBye ? "blue.muted" : "border.emphasized"}
                                                            bg={isBye ? "blue.subtle" : "bg"}
                                                            rounded="2xl"
                                                            shadow="sm"
                                                            overflow="hidden"
                                                        >
                                                            <Box
                                                                px={{ base: "4", md: "5" }}
                                                                py={{ base: "5", md: "6" }}
                                                                display="flex"
                                                                flexDirection="column"
                                                                gap={{ base: "3", md: "4" }}
                                                            >
                                                                {/* Pair A */}
                                                                <Box
                                                                    fontSize={{ base: "xl", md: "2xl", lg: "3xl" }}
                                                                    fontWeight={aWon ? "bold" : "semibold"}
                                                                    color={aWon ? "green.fg" : undefined}
                                                                    bg={aWon ? "green.subtle" : undefined}
                                                                    rounded={aWon ? "md" : undefined}
                                                                    px={aWon ? "3" : undefined}
                                                                    py={aWon ? "2" : undefined}
                                                                    lineHeight="short"
                                                                    textAlign="center"
                                                                    overflow="hidden"
                                                                    textOverflow="ellipsis"
                                                                    whiteSpace="nowrap"
                                                                >
                                                                    {a}
                                                                </Box>

                                                                {/* Stol N separator (replaces vs) */}
                                                                <HStack gap="3" align="center">
                                                                    <Box flex="1" h="1px" bg="border.emphasized" />
                                                                    <Box
                                                                        bg="blue.solid"
                                                                        color="white"
                                                                        rounded="lg"
                                                                        px={{ base: "3", md: "4" }}
                                                                        py={{ base: "1", md: "1.5" }}
                                                                        display="flex"
                                                                        alignItems="center"
                                                                        gap="1.5"
                                                                        shadow="sm"
                                                                        flexShrink={0}
                                                                    >
                                                                        <Text
                                                                            fontSize={{ base: "2xs", md: "xs" }}
                                                                            opacity={0.85}
                                                                            fontWeight="semibold"
                                                                            letterSpacing="wide"
                                                                            textTransform="uppercase"
                                                                        >
                                                                            Stol
                                                                        </Text>
                                                                        <Text
                                                                            fontSize={{ base: "lg", md: "xl" }}
                                                                            fontWeight="bold"
                                                                            lineHeight="1"
                                                                        >
                                                                            {m.tableNo}
                                                                        </Text>
                                                                    </Box>
                                                                    <Box flex="1" h="1px" bg="border.emphasized" />
                                                                </HStack>

                                                                {/* Pair B / bye */}
                                                                <Box
                                                                    fontSize={{ base: "xl", md: "2xl", lg: "3xl" }}
                                                                    fontWeight={isBye ? "medium" : bWon ? "bold" : "semibold"}
                                                                    color={isBye ? "blue.fg" : bWon ? "green.fg" : undefined}
                                                                    bg={bWon ? "green.subtle" : undefined}
                                                                    rounded={bWon ? "md" : undefined}
                                                                    px={bWon ? "3" : undefined}
                                                                    py={bWon ? "2" : undefined}
                                                                    fontStyle={isBye ? "italic" : undefined}
                                                                    lineHeight="short"
                                                                    textAlign="center"
                                                                    overflow="hidden"
                                                                    textOverflow="ellipsis"
                                                                    whiteSpace="nowrap"
                                                                >
                                                                    {isBye ? "Slobodan prolaz" : b}
                                                                </Box>
                                                            </Box>
                                                        </Box>
                                                    )
                                                })}
                                        </Box>
                                    ) : (
                                        <Box borderWidth="1px" rounded="md" p="4">
                                            <Text color="fg.muted">Nema mečeva u ovoj rundi.</Text>
                                        </Box>
                                    )}
                                </Box>
                            </Dialog.Content>
                        </Dialog.Positioner>
                    </Dialog.Root>
                    <Dialog.Root
                        open={unpaidOpen}
                        onOpenChange={(e) => { if (!e.open) setUnpaidOpen(false) }}
                    >
                        <Dialog.Backdrop />
                        <Dialog.Positioner>
                            <Dialog.Content maxW="sm">
                                <Dialog.Header>Ne može početi</Dialog.Header>
                                <Dialog.Body>
                                    <Text>
                                        Turnir se ne može startati dok sve ekipe nemaju označenu <b>kotizaciju</b>.
                                        Molim označite “Kotizacija” za sve parove koji su platili.
                                    </Text>
                                </Dialog.Body>
                                <Dialog.Footer>
                                    <Button onClick={() => setUnpaidOpen(false)} colorPalette="red" variant="solid">
                                        U redu
                                    </Button>
                                </Dialog.Footer>
                            </Dialog.Content>
                        </Dialog.Positioner>
                    </Dialog.Root>

                </>
            )}

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
                            <Heading size="sm">Prijavi par za turnir</Heading>
                        </Dialog.Header>
                        <Dialog.Body py="4" px="4">
                            <VStack align="stretch" gap="3">
                                {(() => {
                                    // Hide presets the current user has already
                                    // submitted to *this* tournament (case-insensitive),
                                    // so they can't accidentally re-register the same pair.
                                    const myUid = user?.uid
                                    const alreadyRegisteredNames = new Set(
                                        pairs
                                            .filter((p) => myUid && p.submittedByUid === myUid)
                                            .map((p) => p.name?.trim().toLowerCase())
                                            .filter(Boolean) as string[],
                                    )
                                    const available = presets.filter(
                                        (p) => !alreadyRegisteredNames.has(p.name.trim().toLowerCase()),
                                    )
                                    if (available.length === 0) return null
                                    return (
                                        <Box>
                                            <Text fontSize="xs" color="fg.muted" mb="1.5" fontWeight="medium">
                                                Tvoji spremljeni parovi
                                            </Text>
                                            <HStack gap="1.5" wrap="wrap">
                                                {available.map((p) => (
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
                                    )
                                })()}

                                <Box>
                                    <Text fontSize="xs" color="fg.muted" mb="1.5" fontWeight="medium">
                                        Ime para
                                    </Text>
                                    <Input
                                        autoFocus
                                        placeholder="npr. Marko & Pero"
                                        value={selfRegName}
                                        onChange={(e) => setSelfRegName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault()
                                                submitSelfRegister()
                                            }
                                        }}
                                    />
                                </Box>

                                <Text fontSize="xs" color="fg.muted">
                                    Par će biti označen <chakra.b color="yellow.fg">žuto</chakra.b> dok ga organizator ne potvrdi.
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
                                    Odustani
                                </Button>
                                <Button
                                    variant="solid"
                                    colorPalette="blue"
                                    loading={selfRegSubmitting}
                                    disabled={!selfRegName.trim() || selfRegSubmitting}
                                    onClick={submitSelfRegister}
                                >
                                    Prijavi se
                                </Button>
                            </HStack>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>

            {/* ===== Pair info / match history dialog ===== */}
            <Dialog.Root
                open={infoPairId !== null}
                onOpenChange={(e) => { if (!e.open) setInfoPairId(null) }}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="md">
                        {(() => {
                            const pair = pairs.find((p) => p.id === infoPairId)
                            if (!pair) return null

                            type Played = {
                                round: number
                                tableNo: number
                                opponentName: string | null
                                myScore: number | null | undefined
                                oppScore: number | null | undefined
                                isFinished: boolean
                                isBye: boolean
                                isWinner: boolean
                            }

                            const played: Played[] = rounds.flatMap((r) =>
                                r.matches
                                    .filter((m) => m.pair1Id === pair.id || m.pair2Id === pair.id)
                                    .map((m) => {
                                        const meIs1 = m.pair1Id === pair.id
                                        const oppId = meIs1 ? m.pair2Id : m.pair1Id
                                        const oppName =
                                            (meIs1 ? m.pair2Name : m.pair1Name) ??
                                            (oppId ? pairById.get(oppId)?.name ?? null : null)
                                        return {
                                            round: r.number,
                                            tableNo: m.tableNo,
                                            opponentName: oppName,
                                            myScore: meIs1 ? m.score1 : m.score2,
                                            oppScore: meIs1 ? m.score2 : m.score1,
                                            isFinished: m.status === "FINISHED",
                                            isBye: !m.pair2Id,
                                            isWinner: m.winnerPairId != null && m.winnerPairId === pair.id,
                                        }
                                    })
                            )

                            const finishedPlayed = played.filter((x) => x.isFinished && !x.isBye)
                            const wins = finishedPlayed.filter((x) => x.isWinner).length
                            const losses = finishedPlayed.filter((x) => !x.isWinner).length

                            return (
                                <>
                                    <Dialog.Header
                                        py="3"
                                        px="4"
                                        borderBottomWidth="1px"
                                        borderColor="border.emphasized"
                                    >
                                        <HStack gap="3" align="center">
                                            <PairAvatar name={pair.name} eliminated={pair.isEliminated} />
                                            <Box flex="1" minW="0">
                                                <Text fontWeight="semibold" lineHeight="short">{pair.name || "—"}</Text>
                                                <Text fontSize="xs" color="fg.muted">Povijest mečeva</Text>
                                            </Box>
                                            <IconButton
                                                aria-label="Zatvori"
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setInfoPairId(null)}
                                            >
                                                <FiX />
                                            </IconButton>
                                        </HStack>
                                    </Dialog.Header>
                                    <Dialog.Body py="4" px="4">
                                        {/* Stat summary */}
                                        <HStack gap="6" mb="4" wrap="wrap">
                                            <Box>
                                                <Text fontSize="xs" color="fg.muted">Odigrano</Text>
                                                <Text fontSize="xl" fontWeight="semibold">{finishedPlayed.length}</Text>
                                            </Box>
                                            <Box>
                                                <Text fontSize="xs" color="fg.muted">Pobjede</Text>
                                                <Text fontSize="xl" fontWeight="semibold" color="green.fg">{wins}</Text>
                                            </Box>
                                            <Box>
                                                <Text fontSize="xs" color="fg.muted">Porazi</Text>
                                                <Text fontSize="xl" fontWeight="semibold" color="red.fg">{losses}</Text>
                                            </Box>
                                            {pair.extraLife && (
                                                <Box>
                                                    <Text fontSize="xs" color="fg.muted">Status</Text>
                                                    <Badge variant="subtle" colorPalette="red">
                                                        <HStack gap="1"><FiHeart size={11} /> Život</HStack>
                                                    </Badge>
                                                </Box>
                                            )}
                                        </HStack>

                                        {played.length === 0 ? (
                                            <Box
                                                borderWidth="1px"
                                                borderColor="border.emphasized"
                                                borderStyle="dashed"
                                                rounded="md"
                                                py="8"
                                                px="4"
                                                textAlign="center"
                                            >
                                                <Text color="fg.muted" fontSize="sm">
                                                    Par još nije odigrao niti jedan meč.
                                                </Text>
                                            </Box>
                                        ) : (
                                            <VStack align="stretch" gap="2">
                                                {played.map((x, i) => (
                                                    <Box
                                                        key={i}
                                                        borderWidth="1px"
                                                        borderColor="border.emphasized"
                                                        rounded="md"
                                                        p="2.5"
                                                        bg={
                                                            x.isBye
                                                                ? "blue.subtle"
                                                                : !x.isFinished
                                                                    ? "yellow.subtle"
                                                                    : x.isWinner
                                                                        ? "green.subtle"
                                                                        : "red.subtle"
                                                        }
                                                    >
                                                        <HStack justify="space-between" gap="2" wrap="wrap">
                                                            <HStack gap="2" minW="0" flex="1">
                                                                <Badge variant="solid" colorPalette="gray" size="sm" flexShrink={0}>
                                                                    R{x.round}
                                                                </Badge>
                                                                <Text fontSize="xs" color="fg.muted" flexShrink={0}>
                                                                    Stol {x.tableNo}
                                                                </Text>
                                                                <Text
                                                                    fontWeight="medium"
                                                                    overflow="hidden"
                                                                    textOverflow="ellipsis"
                                                                    whiteSpace="nowrap"
                                                                    minW="0"
                                                                >
                                                                    {x.isBye ? "Slobodan prolaz" : `vs ${x.opponentName ?? "—"}`}
                                                                </Text>
                                                            </HStack>
                                                            <HStack gap="2" flexShrink={0}>
                                                                {!x.isBye && x.isFinished && (
                                                                    <Text fontWeight="semibold" fontSize="sm">
                                                                        {x.myScore ?? "—"} : {x.oppScore ?? "—"}
                                                                    </Text>
                                                                )}
                                                                {x.isBye ? (
                                                                    <Badge variant="solid" colorPalette="blue" size="sm">
                                                                        <HStack gap="1"><FiCheckCircle size={11}/> Prošao</HStack>
                                                                    </Badge>
                                                                ) : !x.isFinished ? (
                                                                    <Badge variant="solid" colorPalette="yellow" size="sm">U tijeku</Badge>
                                                                ) : x.isWinner ? (
                                                                    <Badge variant="solid" colorPalette="green" size="sm">
                                                                        <HStack gap="1"><FiAward size={11}/> Pobjeda</HStack>
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="solid" colorPalette="red" size="sm">Poraz</Badge>
                                                                )}
                                                            </HStack>
                                                        </HStack>
                                                    </Box>
                                                ))}
                                            </VStack>
                                        )}
                                    </Dialog.Body>
                                </>
                            )
                        })()}
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>

            {/* Admin-only confirm dialog for soft-deleting the entire tournament.
                On confirm we DELETE the tournament and bounce back to the list. */}
            <Dialog.Root
                open={deleteTournamentOpen}
                onOpenChange={(e) => { if (!e.open && !deletingTournament) setDeleteTournamentOpen(false) }}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="sm">
                        <Dialog.Header>Obriši turnir?</Dialog.Header>
                        <Dialog.Body>
                            <Text>
                                Obrisati turnir{" "}
                                <chakra.b>{t?.name}</chakra.b>?
                                Turnir više neće biti vidljiv u pretrazi, na karti, kalendaru ni u
                                profilima igrača. Ova radnja se ne poništava kroz aplikaciju.
                            </Text>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button
                                variant="ghost"
                                onClick={() => setDeleteTournamentOpen(false)}
                                disabled={deletingTournament}
                            >
                                Odustani
                            </Button>
                            <Button
                                variant="solid"
                                colorPalette="red"
                                loading={deletingTournament}
                                onClick={async () => {
                                    if (!uuid) return
                                    try {
                                        setDeletingTournament(true)
                                        await deleteTournament(uuid)
                                        navigate("/tournaments", { replace: true })
                                    } catch (err: any) {
                                        alert(String(err?.response?.data ?? err?.message ?? "Failed to delete tournament."))
                                    } finally {
                                        setDeletingTournament(false)
                                        setDeleteTournamentOpen(false)
                                    }
                                }}
                            >
                                Da, obriši
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>

            {/* Confirm-delete dialog for a single pair. Mounted at the page
                root so it works regardless of which tab is active — earlier
                placement inside the bracket branch meant it never rendered
                on the Parovi tab and the click did nothing. */}
            <Dialog.Root
                open={!!pendingDeletePair}
                onOpenChange={(e) => { if (!e.open && !deletingPair) setPendingDeletePair(null) }}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="sm">
                        <Dialog.Header>Ukloni par?</Dialog.Header>
                        <Dialog.Body>
                            <Text>
                                Stvarno ukloniti par
                                {" "}<chakra.b>{pendingDeletePair?.name}</chakra.b>
                                {" "}iz turnira? Ova radnja se ne može poništiti.
                            </Text>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button
                                variant="ghost"
                                onClick={() => setPendingDeletePair(null)}
                                disabled={deletingPair}
                            >
                                Ne
                            </Button>
                            <Button
                                variant="solid"
                                colorPalette="red"
                                loading={deletingPair}
                                onClick={async () => {
                                    if (!pendingDeletePair || !uuid) return
                                    try {
                                        setDeletingPair(true)
                                        await deletePair(uuid, pendingDeletePair.id)
                                        setPairs(ps => ps.filter(x => x.id !== pendingDeletePair.id))
                                        setPendingDeletePair(null)
                                    } catch (err: any) {
                                        alert(String(err?.response?.data ?? err?.message ?? "Failed to delete pair."))
                                    } finally {
                                        setDeletingPair(false)
                                    }
                                }}
                            >
                                Da, ukloni
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>
        </>
    )
}
