import React, { useEffect, useMemo, useState } from "react"
import {
    Badge,
    Box,
    Button,
    Card,
    chakra,
    Dialog,
    Field,
    Heading,
    HStack,
    IconButton,
    Input,
    NativeSelect,
    Skeleton,
    Spinner,
    Text,
    VStack,
} from "@chakra-ui/react"
import { updateProfile as fbUpdateProfile } from "firebase/auth"
import { auth } from "../firebase"
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom"
import { FaTrophy } from "react-icons/fa"
import {
    FiAlertCircle,
    FiCalendar,
    FiCheck,
    FiChevronDown,
    FiChevronRight,
    FiEdit2,
    FiMapPin,
    FiPhone,
    FiPlus,
    FiTrash2,
    FiX,
} from "react-icons/fi"
import {
    getPairMatchHistory,
    getPublicProfile,
    type PairMatchHistory,
    type PairSummary,
    type PublicProfile,
} from "../api/publicProfile"
import type { MyTournamentParticipation } from "../api/userMe"
import { getProfile, syncProfile, updateProfile } from "../api/userMe"
import {
    createPreset,
    deletePreset,
    listPresets,
    updatePreset,
    type UserPairPreset,
} from "../api/userPairPresets"
import { useAuth } from "../auth/AuthContext"
import { useDocumentHead } from "../hooks/useDocumentHead"

/** Country dial codes shared with FindPair / CreateTournament. */
const PHONE_COUNTRIES = [
    { value: "+385", label: "🇭🇷 +385" },
    { value: "+386", label: "🇸🇮 +386" },
    { value: "+43",  label: "🇦🇹 +43" },
    { value: "+49",  label: "🇩🇪 +49" },
    { value: "+387", label: "🇧🇦 +387" },
    { value: "+381", label: "🇷🇸 +381" },
] as const

function formatDate(iso?: string | null): string {
    if (!iso) return "—"
    return new Intl.DateTimeFormat("hr-HR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(iso))
}

/** Two-letter initials for the user avatar (falls back to single letter or `?`). */
function initialsOf(name?: string | null): string {
    if (!name) return "?"
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return "?"
    if (parts.length === 1) return parts[0][0]!.toUpperCase()
    return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase()
}

/** Lower-cased trimmed name match — same key the backend groups pairs by. */
function pairKey(name: string): string {
    return name.trim().toLowerCase()
}

export default function PublicProfilePage() {
    const { slug } = useParams<{ slug: string }>()
    const { user, mySlug } = useAuth()
    const navigate = useNavigate()

    const [profile, setProfile] = useState<PublicProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [activePair, setActivePair] = useState<string | null>(null) // pair name (case preserved)
    const [search, setSearch] = useState("")

    // Per-route SEO. We deliberately do NOT include the user's phone in any
    // meta tag — phone display is a product call on the page itself, but
    // there's no need to make it any more discoverable than it already is.
    const totalTournaments = profile?.tournaments?.length ?? 0
    const totalWins = (profile?.pairs ?? []).reduce((sum, p) => sum + (p.wins ?? 0), 0)
    useDocumentHead({
        title: profile?.displayName
            ? `${profile.displayName} — Bela igrač | bela-turniri.com`
            : "Bela igrač — bela-turniri.com",
        description: profile?.displayName
            ? `${profile.displayName} — povijest nastupa na Bela turnirima. ${totalTournaments} turnira, ${totalWins} pobjeda.`
            : undefined,
        ogTitle: profile?.displayName ?? undefined,
        ogDescription: profile?.displayName
            ? `Povijest nastupa na Bela turnirima — ${totalTournaments} turnira, ${totalWins} pobjeda.`
            : undefined,
        ogType: "profile",
        canonical: slug ? `https://bela-turniri.com/profile/${slug}` : undefined,
    })

    useEffect(() => {
        if (!slug) return
        let cancelled = false
        ;(async () => {
            try {
                setLoading(true)
                setError(null)
                setActivePair(null)
                setSearch("")
                const data = await getPublicProfile(slug)
                if (cancelled) return
                setProfile(data)
                if (data.pairs.length > 0) setActivePair(data.pairs[0].name)
            } catch (e: any) {
                if (cancelled) return
                if (e?.response?.status === 404) {
                    setError("Profil nije pronađen.")
                } else {
                    setError(e?.message ?? "Greška pri dohvaćanju profila.")
                }
                setProfile(null)
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => { cancelled = true }
    }, [slug])

    /** Tournaments filtered to the active pair, then optionally to the search query. */
    const filteredTournaments = useMemo<MyTournamentParticipation[]>(() => {
        if (!profile) return []
        const q = search.trim().toLowerCase()
        return profile.tournaments
            .filter((t) => activePair == null || pairKey(t.pairName) === pairKey(activePair))
            .filter((t) => {
                if (!q) return true
                const blob = `${t.tournamentName} ${t.tournamentLocation ?? ""}`.toLowerCase()
                return blob.includes(q)
            })
    }, [profile, activePair, search])

    // Owner detection — backend deliberately doesn't ship the target UID, so
    // we compare slugs. mySlug is populated after /user/me/sync runs.
    const isOwner = !!profile && !!user?.uid && !!mySlug && mySlug === profile.slug

    if (loading) {
        return (
            <VStack align="stretch" gap="4" maxW="780px" mx="auto">
                <Skeleton h="120px" rounded="xl" />
                <Skeleton h="60px" rounded="xl" />
                <Skeleton h="200px" rounded="xl" />
            </VStack>
        )
    }

    if (error || !profile) {
        return (
            <VStack align="stretch" gap="4" maxW="780px" mx="auto">
                <Card.Root variant="outline" rounded="xl" borderColor="red.muted">
                    <Card.Body p="5">
                        <HStack gap="3" align="center" color="red.fg">
                            <FiAlertCircle />
                            <Text>{error ?? "Profil nije dostupan."}</Text>
                        </HStack>
                        <HStack mt="4">
                            <Button size="sm" variant="ghost" onClick={() => navigate(-1)}>Natrag</Button>
                            <Button size="sm" variant="solid" colorPalette="blue" asChild>
                                <RouterLink to="/tournaments">Na turnire</RouterLink>
                            </Button>
                        </HStack>
                    </Card.Body>
                </Card.Root>
            </VStack>
        )
    }

    async function refreshProfile() {
        try {
            const fresh = await getPublicProfile(profile!.slug)
            setProfile(fresh)
        } catch { /* ignore */ }
    }

    return (
        <Box
            display="grid"
            gridTemplateColumns={{ base: "1fr", md: "minmax(260px, 32%) 1fr" }}
            gap="4"
            maxW="1100px"
            mx="auto"
            alignItems="start"
        >
            {/* === LEFT — profile + contact (and owner-only settings) === */}
            <VStack align="stretch" gap="4">
                <ProfileHeader
                    profile={profile}
                    isOwner={isOwner}
                    onProfileChanged={refreshProfile}
                />
                {isOwner && <PresetsCard />}
            </VStack>

            {/* === RIGHT — pairs picker + tournaments in a single card === */}
            <VStack align="stretch" gap="4">
                <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
                    <Card.Body p={{ base: "4", md: "5" }}>
                        <VStack align="stretch" gap="3">
                            {/* Header — title flips between "Parovi" and "Parovi — <active>" */}
                            <HStack justify="space-between" wrap="wrap" gap="2">
                                <Heading size="md">
                                    Parovi
                                    {activePair ? <chakra.span color="fg.muted"> — {activePair}</chakra.span> : null}
                                </Heading>
                                {activePair && profile.pairs.length > 0 && (
                                    <Badge variant="subtle" colorPalette="blue">
                                        {filteredTournaments.length} turnira
                                    </Badge>
                                )}
                            </HStack>

                            {/* Pair picker (sticky-ish on top) */}
                            {profile.pairs.length === 0 ? (
                                <Box
                                    borderWidth="1px"
                                    borderColor="border.emphasized"
                                    borderStyle="dashed"
                                    rounded="md"
                                    py="6"
                                    px="4"
                                    textAlign="center"
                                >
                                    <Text color="fg.muted" fontSize="sm">
                                        Igrač nije još igrao niti jedan turnir.
                                    </Text>
                                </Box>
                            ) : (
                                <HStack gap="2" wrap="wrap">
                                    {profile.pairs.map((p) => (
                                        <PairChip
                                            key={p.name}
                                            pair={p}
                                            active={activePair != null && pairKey(activePair) === pairKey(p.name)}
                                            onClick={() => setActivePair(p.name)}
                                        />
                                    ))}
                                </HStack>
                            )}

                            {/* Tournaments section — only renders once a pair is selected. */}
                            {activePair && (
                                <>
                                    <Box borderTopWidth="1px" borderColor="border.emphasized" mx="-4" my="1" />
                                    <Input
                                        size="sm"
                                        placeholder="Pretraga: naziv turnira ili lokacija…"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                    {filteredTournaments.length === 0 ? (
                                        <Box
                                            borderWidth="1px"
                                            borderColor="border.emphasized"
                                            borderStyle="dashed"
                                            rounded="md"
                                            py="6"
                                            px="4"
                                            textAlign="center"
                                        >
                                            <Text color="fg.muted" fontSize="sm">
                                                Nema turnira za odabrane filtere.
                                            </Text>
                                        </Box>
                                    ) : (
                                        <VStack align="stretch" gap="2.5">
                                            {filteredTournaments.map((t) => (
                                                <TournamentRow
                                                    key={`${t.tournamentUuid}-${t.pairId}`}
                                                    slug={profile.slug}
                                                    row={t}
                                                />
                                            ))}
                                        </VStack>
                                    )}
                                </>
                            )}
                        </VStack>
                    </Card.Body>
                </Card.Root>
            </VStack>
        </Box>
    )
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                              */
/* -------------------------------------------------------------------------- */

function ProfileHeader({
    profile,
    isOwner,
    onProfileChanged,
}: {
    profile: PublicProfile
    isOwner: boolean
    onProfileChanged: () => Promise<void> | void
}) {
    const [editOpen, setEditOpen] = useState(false)

    return (
        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
            <Card.Body p={{ base: "5", md: "5" }}>
                <VStack align="stretch" gap="3">
                    <HStack gap="3" align="start">
                        <Box
                            w="48px"
                            h="48px"
                            rounded="full"
                            bg="blue.subtle"
                            color="blue.fg"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            fontWeight="bold"
                            fontSize="md"
                            flexShrink={0}
                        >
                            {initialsOf(profile.displayName)}
                        </Box>
                        <VStack align="stretch" gap="0.5" flex="1" minW="0">
                            <HStack gap="1" align="center" minW="0">
                                <Heading size="md" lineHeight="short" lineClamp={2} flex="1" minW="0">
                                    {profile.displayName ?? "Bezimeni igrač"}
                                </Heading>
                                {isOwner && (
                                    <IconButton
                                        aria-label="Uredi ime"
                                        size="xs"
                                        variant="ghost"
                                        onClick={() => setEditOpen(true)}
                                        title="Uredi ime"
                                    >
                                        <FiEdit2 />
                                    </IconButton>
                                )}
                            </HStack>
                        </VStack>
                    </HStack>

                    {profile.phone && (
                        <chakra.a
                            href={`tel:${(profile.phoneCountry ?? "")}${profile.phone}`.replace(/\s+/g, "")}
                            color="blue.fg"
                            fontSize="sm"
                            fontWeight="medium"
                            display="inline-flex"
                            alignItems="center"
                            gap="1.5"
                            _hover={{ textDecoration: "underline" }}
                        >
                            <FiPhone size={13} />
                            {/* Show the country flag too — the dial code by itself looks like
                                a generic prefix; the flag tells you the country at a glance. */}
                            {profile.phoneCountry && (
                                <chakra.span aria-hidden mr="0.5">
                                    {flagFor(profile.phoneCountry)}
                                </chakra.span>
                            )}
                            {profile.phoneCountry ? `${profile.phoneCountry} ` : ""}{profile.phone}
                        </chakra.a>
                    )}
                </VStack>
            </Card.Body>

            {isOwner && (
                <EditProfileDialog
                    open={editOpen}
                    initialName={profile.displayName ?? ""}
                    onClose={() => setEditOpen(false)}
                    onSaved={async () => {
                        setEditOpen(false)
                        await onProfileChanged()
                    }}
                />
            )}
        </Card.Root>
    )
}

/** Map a dial code like "+385" to the matching flag emoji, or "" if unknown. */
function flagFor(dialCode: string | null | undefined): string {
    if (!dialCode) return ""
    const c = PHONE_COUNTRIES.find((x) => x.value === dialCode)
    if (!c) return ""
    // The label is e.g. "🇭🇷 +385" — the first space splits flag from prefix.
    const parts = c.label.split(" ")
    return parts[0] ?? ""
}

function EditProfileDialog({
    open,
    initialName,
    onClose,
    onSaved,
}: {
    open: boolean
    initialName: string
    onClose: () => void
    onSaved: () => Promise<void> | void
}) {
    const [name, setName] = useState(initialName)
    const [country, setCountry] = useState<string>("+385")
    const [phone, setPhone] = useState("")
    const [saving, setSaving] = useState(false)
    const [loadingPhone, setLoadingPhone] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Re-seed every time the dialog opens — covers cancel-and-reopen and the
    // case where the underlying profile was changed elsewhere in the meantime.
    useEffect(() => {
        if (!open) return
        setName(initialName)
        setError(null)
        setLoadingPhone(true)
        ;(async () => {
            try {
                const p = await getProfile()
                if (p.phoneCountry) setCountry(p.phoneCountry)
                else setCountry("+385")
                setPhone(p.phone ?? "")
            } catch {
                setCountry("+385")
                setPhone("")
            } finally {
                setLoadingPhone(false)
            }
        })()
    }, [open, initialName])

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        const trimmed = name.trim()
        if (!trimmed) {
            setError("Ime ne može biti prazno.")
            return
        }
        try {
            setSaving(true)
            setError(null)
            // Firebase displayName is the source of truth — update it first
            // so any subsequent token refresh carries the new name. The
            // backend mirror lands via /user/me/sync.
            const fbUser = auth.currentUser
            if (fbUser && fbUser.displayName !== trimmed) {
                await fbUpdateProfile(fbUser, { displayName: trimmed })
            }
            await syncProfile(trimmed)
            // Phone is optional; null both fields if blank so the backend
            // doesn't keep a stale country code with no number.
            await updateProfile({
                phoneCountry: phone.trim() ? country : null,
                phone: phone.trim() || null,
            })
            await onSaved()
        } catch (e: any) {
            setError(e?.response?.data ?? e?.message ?? "Greška pri spremanju.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => { if (!e.open && !saving) onClose() }}
        >
            <Dialog.Backdrop />
            <Dialog.Positioner>
                <Dialog.Content maxW="md">
                    <form onSubmit={onSubmit}>
                        <Dialog.Header>Uredi profil</Dialog.Header>
                        <Dialog.Body>
                            <VStack align="stretch" gap="4">
                                <Field.Root required invalid={!!error}>
                                    <Field.Label>Ime <Field.RequiredIndicator /></Field.Label>
                                    <Input
                                        size="sm"
                                        autoFocus
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="npr. Marko Marković"
                                    />
                                    {error && <Field.ErrorText>{error}</Field.ErrorText>}
                                </Field.Root>

                                <Field.Root>
                                    <Field.Label>
                                        Broj telefona{" "}
                                        <chakra.span color="fg.muted" fontSize="xs">(opcionalno)</chakra.span>
                                    </Field.Label>
                                    {loadingPhone ? (
                                        <Skeleton h="9" />
                                    ) : (
                                        <HStack gap="2">
                                            <NativeSelect.Root size="sm" w="120px" flexShrink={0}>
                                                <NativeSelect.Field
                                                    value={country}
                                                    onChange={(e) => setCountry((e.target as HTMLSelectElement).value)}
                                                >
                                                    {PHONE_COUNTRIES.map((c) => (
                                                        <option key={c.value} value={c.value}>{c.label}</option>
                                                    ))}
                                                </NativeSelect.Field>
                                            </NativeSelect.Root>
                                            <Input
                                                flex="1"
                                                size="sm"
                                                type="tel"
                                                inputMode="tel"
                                                placeholder="91 234 5678"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                            />
                                        </HStack>
                                    )}
                                </Field.Root>
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button variant="ghost" type="button" onClick={onClose} disabled={saving}>
                                Odustani
                            </Button>
                            <Button
                                variant="solid"
                                colorPalette="blue"
                                type="submit"
                                loading={saving}
                                disabled={saving || !name.trim() || loadingPhone}
                            >
                                Spremi
                            </Button>
                        </Dialog.Footer>
                    </form>
                </Dialog.Content>
            </Dialog.Positioner>
        </Dialog.Root>
    )
}

function PairChip({
    pair,
    active,
    onClick,
}: {
    pair: PairSummary
    active: boolean
    onClick: () => void
}) {
    return (
        <Button
            size="sm"
            variant={active ? "solid" : "outline"}
            colorPalette={active ? "blue" : "gray"}
            onClick={onClick}
            rounded="full"
            px="3.5"
        >
            <HStack gap="1.5">
                <Text fontWeight="medium">{pair.name}</Text>
                <Text fontSize="xs" opacity={0.85}>
                    · {pair.tournamentCount}
                </Text>
                {pair.wins > 0 && (
                    <HStack gap="0.5" color={active ? "yellow.200" : "yellow.fg"}>
                        <FaTrophy size={10} />
                        <Text fontSize="xs">{pair.wins}</Text>
                    </HStack>
                )}
            </HStack>
        </Button>
    )
}

/** A tournament row that toggles open to fetch + show match-by-match history. */
function TournamentRow({
    slug,
    row,
}: {
    slug: string
    row: MyTournamentParticipation
}) {
    const [open, setOpen] = useState(false)
    const [history, setHistory] = useState<PairMatchHistory | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function toggle() {
        const next = !open
        setOpen(next)
        if (next && !history && !loading) {
            try {
                setLoading(true)
                setError(null)
                setHistory(await getPairMatchHistory(slug, row.pairId))
            } catch (e: any) {
                setError(e?.response?.data ?? e?.message ?? "Greška pri dohvaćanju mečeva.")
            } finally {
                setLoading(false)
            }
        }
    }

    let badge: { palette: string; label: string; icon?: React.ReactNode } | null = null
    if (row.isWinner) {
        badge = { palette: "yellow", label: "Pobjednik", icon: <FaTrophy size={11} color="#F5C518" /> }
    } else if (row.pendingApproval) {
        badge = { palette: "yellow", label: "Čeka odobrenje" }
    } else if (row.eliminated) {
        badge = { palette: "red", label: "Eliminiran" }
    } else if (row.tournamentStatus === "STARTED") {
        badge = { palette: "green", label: "Aktivan" }
    } else if (row.tournamentStatus === "FINISHED") {
        badge = { palette: "gray", label: "Završen" }
    } else {
        badge = { palette: "blue", label: "Najavljen" }
    }

    return (
        <Box
            borderWidth="1px"
            borderColor="border.emphasized"
            rounded="md"
            shadow="sm"
            overflow="hidden"
        >
            <Box
                as="button"
                onClick={toggle}
                w="100%"
                p="3"
                textAlign="left"
                _hover={{ bg: "bg.subtle" }}
                transition="background 0.1s"
            >
                <HStack justify="space-between" gap="3" wrap="wrap" mb="1.5">
                    <HStack gap="2" flex="1" minW="0">
                        {open ? <FiChevronDown /> : <FiChevronRight />}
                        <Text fontWeight="semibold" lineHeight="short">
                            {row.tournamentName}
                        </Text>
                    </HStack>
                    {badge && (
                        <Badge variant="solid" colorPalette={badge.palette as any} size="sm">
                            <HStack gap="1">
                                {badge.icon}
                                {badge.label}
                            </HStack>
                        </Badge>
                    )}
                </HStack>
                <HStack gap="3" wrap="wrap" fontSize="xs" color="fg.muted" pl="6">
                    {row.tournamentStartAt && (
                        <HStack gap="1"><FiCalendar /><Text>{formatDate(row.tournamentStartAt)}</Text></HStack>
                    )}
                    {row.tournamentLocation && (
                        <HStack gap="1"><FiMapPin /><Text>{row.tournamentLocation}</Text></HStack>
                    )}
                    {!row.pendingApproval && (
                        <Badge variant="subtle" colorPalette="gray" size="sm">{row.wins}W – {row.losses}L</Badge>
                    )}
                    {row.extraLife && <Badge variant="subtle" colorPalette="red" size="sm">Život</Badge>}
                </HStack>
            </Box>

            {open && (
                <Box borderTopWidth="1px" borderColor="border.emphasized" bg="bg.subtle" p="3">
                    {loading ? (
                        <HStack gap="2" color="fg.muted"><Spinner size="xs" /><Text fontSize="sm">Učitavanje…</Text></HStack>
                    ) : error ? (
                        <Text fontSize="sm" color="red.fg">{error}</Text>
                    ) : !history || history.matches.length === 0 ? (
                        <Text fontSize="sm" color="fg.muted">Nema odigranih mečeva.</Text>
                    ) : (
                        <VStack align="stretch" gap="1.5">
                            {history.matches.map((m, i) => (
                                <MatchRow key={`${m.roundNumber ?? "?"}-${i}`} m={m} />
                            ))}
                            <HStack pt="2" justify="flex-end">
                                <Button size="xs" variant="ghost" asChild>
                                    <RouterLink to={`/tournaments/${row.tournamentUuid}`}>
                                        Otvori turnir
                                    </RouterLink>
                                </Button>
                            </HStack>
                        </VStack>
                    )}
                </Box>
            )}
        </Box>
    )
}

function MatchRow({ m }: { m: PairMatchHistory["matches"][number] }) {
    const finished = m.status === "FINISHED" || m.status === "COMPLETED"
    const wonColor = m.won === true ? "green" : m.won === false ? "red" : "gray"
    const wonLabel = m.isBye
        ? "Bye"
        : m.won === true ? "Pobjeda"
        : m.won === false ? "Poraz"
        : finished ? "Riješeno" : "U tijeku"

    return (
        <HStack
            gap="2.5"
            wrap="wrap"
            borderWidth="1px"
            borderColor="border.emphasized"
            bg="bg"
            rounded="sm"
            px="2.5"
            py="1.5"
            fontSize="sm"
        >
            <Badge variant="outline" colorPalette="blue" size="sm">
                Kolo {m.roundNumber ?? "?"}
            </Badge>
            {m.tableNo != null && (
                <Text color="fg.muted" fontSize="xs">Stol {m.tableNo}</Text>
            )}
            <Text flex="1" minW="0" lineClamp={1}>
                vs <chakra.b>{m.opponentName ?? (m.isBye ? "—" : "?")}</chakra.b>
            </Text>
            {(m.ourScore != null || m.opponentScore != null) && (
                <Text fontFamily="mono" fontWeight="semibold">
                    {m.ourScore ?? 0} : {m.opponentScore ?? 0}
                </Text>
            )}
            <Badge variant="solid" colorPalette={wonColor as any} size="sm">
                {wonLabel}
            </Badge>
        </HStack>
    )
}

/* -------------------------------------------------------------------------- */
/* Owner-only edit cards                                                       */
/* -------------------------------------------------------------------------- */

function PresetsCard() {
    const [presets, setPresets] = useState<UserPairPreset[]>([])
    const [loading, setLoading] = useState(true)
    const [draft, setDraft] = useState("")
    const [creating, setCreating] = useState(false)
    const [editingUuid, setEditingUuid] = useState<string | null>(null)
    const [editValue, setEditValue] = useState("")
    // Confirm-delete dialog state — same UX as the pair-delete dialog on
    // tournament details so the two screens feel consistent.
    const [pendingDelete, setPendingDelete] = useState<UserPairPreset | null>(null)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try { if (!cancelled) setPresets(await listPresets()) }
            catch { /* ignore */ }
            finally { if (!cancelled) setLoading(false) }
        })()
        return () => { cancelled = true }
    }, [])

    async function onAdd(e: React.FormEvent) {
        e.preventDefault()
        const name = draft.trim()
        if (!name) return
        try {
            setCreating(true)
            const created = await createPreset(name)
            setPresets((xs) => [...xs, created].sort((a, b) => a.name.localeCompare(b.name)))
            setDraft("")
        } catch (e: any) {
            alert(e?.response?.data ?? e?.message ?? "Greška pri spremanju.")
        } finally {
            setCreating(false)
        }
    }

    async function commitEdit(p: UserPairPreset) {
        const next = editValue.trim()
        if (!next || next === p.name) { setEditingUuid(null); setEditValue(""); return }
        try {
            const updated = await updatePreset(p.uuid, next)
            setPresets((xs) =>
                xs.map((x) => (x.uuid === p.uuid ? updated : x))
                    .sort((a, b) => a.name.localeCompare(b.name)),
            )
            setEditingUuid(null); setEditValue("")
        } catch (e: any) {
            alert(e?.response?.data ?? e?.message ?? "Greška pri spremanju.")
        }
    }

    async function confirmDelete() {
        if (!pendingDelete) return
        try {
            setDeleting(true)
            await deletePreset(pendingDelete.uuid)
            setPresets((xs) => xs.filter((x) => x.uuid !== pendingDelete.uuid))
            setPendingDelete(null)
        } catch (e: any) {
            alert(e?.response?.data ?? e?.message ?? "Greška pri brisanju.")
        } finally {
            setDeleting(false)
        }
    }

    return (
        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
            <Card.Body p={{ base: "4", md: "5" }}>
                <VStack align="stretch" gap="3">
                    <Box>
                        <Heading size="sm">Spremljena imena parova</Heading>
                        <Text fontSize="xs" color="fg.muted">
                            Imena pod kojima nastupaš na turnirima. Dodaj ih jednom i biraj iz padajućeg izbornika kasnije.
                        </Text>
                    </Box>

                    <form onSubmit={onAdd}>
                        <HStack gap="2">
                            <Field.Root flex="1">
                                <Input
                                    size="sm"
                                    placeholder="npr. Marko & Pero"
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                />
                            </Field.Root>
                            <Button type="submit" size="sm" variant="solid" colorPalette="blue"
                                    loading={creating} disabled={!draft.trim() || creating}>
                                <FiPlus /> Dodaj
                            </Button>
                        </HStack>
                    </form>

                    {loading ? (
                        <VStack align="stretch" gap="2"><Skeleton h="9" /><Skeleton h="9" /></VStack>
                    ) : presets.length === 0 ? (
                        <Text fontSize="sm" color="fg.muted">Nema spremljenih parova.</Text>
                    ) : (
                        <VStack align="stretch" gap="1.5">
                            {presets.map((p) => (
                                // minW="0" on the row + the inner items lets the input/text
                                // actually shrink under tight space instead of pushing the
                                // action buttons out of bounds.
                                <HStack key={p.uuid}
                                        borderWidth="1px" borderColor="border.emphasized"
                                        rounded="md" px="2.5" py="1.5" gap="2"
                                        minW="0">
                                    {editingUuid === p.uuid ? (
                                        <>
                                            <Box flex="1" minW="0">
                                                <Input
                                                    size="sm" autoFocus
                                                    w="full"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") { e.preventDefault(); commitEdit(p) }
                                                        if (e.key === "Escape") { e.preventDefault(); setEditingUuid(null); setEditValue("") }
                                                    }}
                                                />
                                            </Box>
                                            <IconButton aria-label="Spremi" size="xs" variant="solid" colorPalette="green"
                                                        flexShrink={0}
                                                        onClick={() => commitEdit(p)}>
                                                <FiCheck />
                                            </IconButton>
                                            <IconButton aria-label="Odustani" size="xs" variant="ghost"
                                                        flexShrink={0}
                                                        onClick={() => { setEditingUuid(null); setEditValue("") }}>
                                                <FiX />
                                            </IconButton>
                                        </>
                                    ) : (
                                        <>
                                            <Text flex="1" minW="0" fontWeight="medium" truncate>
                                                {p.name}
                                            </Text>
                                            <IconButton aria-label="Uredi" size="xs" variant="ghost"
                                                        flexShrink={0}
                                                        onClick={() => { setEditingUuid(p.uuid); setEditValue(p.name) }}>
                                                <FiEdit2 />
                                            </IconButton>
                                            <IconButton aria-label="Obriši" size="xs" variant="ghost" colorPalette="red"
                                                        flexShrink={0}
                                                        onClick={() => setPendingDelete(p)}>
                                                <FiTrash2 />
                                            </IconButton>
                                        </>
                                    )}
                                </HStack>
                            ))}
                        </VStack>
                    )}
                </VStack>
            </Card.Body>

            {/* Confirm-delete dialog — same UX as the pair-delete on tournament details. */}
            <Dialog.Root
                open={!!pendingDelete}
                onOpenChange={(e) => { if (!e.open && !deleting) setPendingDelete(null) }}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="sm">
                        <Dialog.Header>Obriši par?</Dialog.Header>
                        <Dialog.Body>
                            <Text>
                                Obrisati spremljeno ime{" "}
                                <chakra.b>{pendingDelete?.name}</chakra.b>?
                                Postojeće prijave na turnire ostaju zapisane.
                            </Text>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button
                                variant="ghost"
                                onClick={() => setPendingDelete(null)}
                                disabled={deleting}
                            >
                                Ne
                            </Button>
                            <Button
                                variant="solid"
                                colorPalette="red"
                                loading={deleting}
                                onClick={confirmDelete}
                            >
                                Da, obriši
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>
        </Card.Root>
    )
}
