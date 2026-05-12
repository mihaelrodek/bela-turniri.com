import React, { useEffect, useMemo, useRef, useState } from "react"
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
    Image,
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
    FiEye,
    FiEyeOff,
    FiMapPin,
    FiPhone,
    FiPlus,
    FiShare2,
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
import { deleteAvatar, getProfile, syncProfile, updateProfile, uploadAvatar } from "../api/userMe"
import {
    createPreset,
    deletePreset,
    listPresets,
    setPresetVisibility,
    updatePreset,
    type UserPairPreset,
} from "../api/userPairPresets"
import { showError, showSuccess } from "../toaster"
import {
    fetchMyTemplateNames,
    fetchMyTemplate,
    saveMyTemplate,
    renameMyTemplate,
    deleteMyTemplate,
    fetchMyInvoices,
    fetchMatchBill,
    type DrinkPriceDto,
    type MatchBillDto,
    type UserInvoiceDto,
} from "../api/cjenik"
import { groupedPresets } from "../utils/drinkPresets"
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

    // Profile page tabs. Postavke + Računi only show for the profile owner;
    // visitors viewing someone else's page see Turniri only.
    const [profileTab, setProfileTab] = useState<"turniri" | "postavke" | "racuni">("turniri")

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
        <VStack
            align="stretch"
            gap="4"
            maxW="900px"
            mx="auto"
            w="full"
        >
            {/* Profile header is always visible — it's the identity card.
                Avatar, name, and (for the owner) inline edit affordances
                sit above the tab strip so they don't get hidden when the
                user is on a non-default tab. */}
            <ProfileHeader
                profile={profile}
                isOwner={isOwner}
                onProfileChanged={refreshProfile}
            />

            {/* Tabs. Postavke + Računi are owner-only — visitors viewing
                someone else's profile just see Turniri (no tab strip at all
                when there's only one option). */}
            {isOwner && (
                <HStack gap="2" wrap="wrap">
                    <Button
                        size="sm"
                        variant={profileTab === "turniri" ? "solid" : "ghost"}
                        colorPalette="blue"
                        onClick={() => setProfileTab("turniri")}
                    >
                        Turniri
                    </Button>
                    <Button
                        size="sm"
                        variant={profileTab === "postavke" ? "solid" : "ghost"}
                        onClick={() => setProfileTab("postavke")}
                    >
                        Predlošci
                    </Button>
                    <Button
                        size="sm"
                        variant={profileTab === "racuni" ? "solid" : "ghost"}
                        onClick={() => setProfileTab("racuni")}
                    >
                        Moji računi
                    </Button>
                </HStack>
            )}

            {/* === TURNIRI tab (default, shown for everyone) === */}
            {(!isOwner || profileTab === "turniri") && (
                <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
                    <Card.Body p={{ base: "4", md: "5" }}>
                        <VStack align="stretch" gap="3">
                            <HStack justify="space-between" wrap="wrap" gap="2">
                                <Heading size="md">
                                    Turniri
                                    {activePair ? <chakra.span color="fg.muted"> — {activePair}</chakra.span> : null}
                                </Heading>
                                {activePair && profile.pairs.length > 0 && (
                                    <Badge variant="subtle" colorPalette="blue">
                                        {filteredTournaments.length} turnira
                                    </Badge>
                                )}
                            </HStack>

                            {/* Pair picker — filter chips */}
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
                                        Igrač nije odigrao niti jedan turnir.
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

                            {/* Tournament list — only after a pair is picked */}
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
            )}

            {/* === POSTAVKE tab — owner-only settings === */}
            {isOwner && profileTab === "postavke" && (
                <VStack align="stretch" gap="4">
                    {/* MyPairsCard now combines saved-name management
                        (rename, delete, hide) with the actual pair list
                        from tournaments (share button, claim status).
                        PresetsCard is no longer rendered separately. */}
                    <MyPairsCard />
                    <DrinkTemplateCard />
                </VStack>
            )}

            {/* === RAČUNI tab — owner-only invoice history === */}
            {isOwner && profileTab === "racuni" && (
                <InvoicesCard />
            )}
        </VStack>
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
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    // For the "blurred phone → click to log in" affordance below.
    const navigate = useNavigate()

    function onPickAvatar() {
        fileInputRef.current?.click()
    }

    async function onAvatarChosen(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0]
        // Reset value so picking the same file again still fires onChange.
        e.target.value = ""
        if (!f) return
        try {
            setUploading(true)
            await uploadAvatar(f)
            await onProfileChanged()
            window.dispatchEvent(new CustomEvent("bela:profile-updated"))
        } catch (err: any) {
            alert(
                err?.response?.data?.message
                    ?? err?.response?.data
                    ?? err?.message
                    ?? "Neuspjelo učitavanje slike.",
            )
        } finally {
            setUploading(false)
        }
    }

    async function onRemoveAvatar() {
        if (!confirm("Ukloniti profilnu sliku?")) return
        try {
            setUploading(true)
            await deleteAvatar()
            await onProfileChanged()
            window.dispatchEvent(new CustomEvent("bela:profile-updated"))
        } catch (err: any) {
            alert(err?.response?.data ?? err?.message ?? "Neuspjelo brisanje slike.")
        } finally {
            setUploading(false)
        }
    }

    return (
        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
            <Card.Body p={{ base: "5", md: "5" }}>
                <VStack align="stretch" gap="3">
                    <HStack gap="3" align="start">
                        {/* Avatar — image when uploaded, initials otherwise. */}
                        <Box position="relative" flexShrink={0}>
                            <Box
                                w="48px"
                                h="48px"
                                rounded="full"
                                overflow="hidden"
                                bg="blue.subtle"
                                color="blue.fg"
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                fontWeight="bold"
                                fontSize="md"
                            >
                                {profile.avatarUrl ? (
                                    <Image
                                        src={profile.avatarUrl}
                                        alt={profile.displayName ?? "Profilna slika"}
                                        w="100%"
                                        h="100%"
                                        objectFit="cover"
                                    />
                                ) : (
                                    initialsOf(profile.displayName)
                                )}
                            </Box>
                            {isOwner && (
                                <>
                                    <IconButton
                                        aria-label={profile.avatarUrl ? "Promijeni profilnu sliku" : "Učitaj profilnu sliku"}
                                        title={profile.avatarUrl ? "Promijeni profilnu sliku" : "Učitaj profilnu sliku"}
                                        size="2xs"
                                        position="absolute"
                                        bottom="-2px"
                                        right="-2px"
                                        rounded="full"
                                        colorPalette="blue"
                                        variant="solid"
                                        loading={uploading}
                                        onClick={onPickAvatar}
                                    >
                                        <FiEdit2 />
                                    </IconButton>
                                    <chakra.input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        display="none"
                                        onChange={onAvatarChosen}
                                    />
                                </>
                            )}
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
                            {isOwner && profile.avatarUrl && (
                                <Button
                                    size="2xs"
                                    variant="ghost"
                                    colorPalette="red"
                                    onClick={onRemoveAvatar}
                                    loading={uploading}
                                    alignSelf="flex-start"
                                >
                                    <FiTrash2 /> Ukloni profilnu sliku
                                </Button>
                            )}
                        </VStack>
                    </HStack>

                    {profile.phone ? (
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
                    ) : profile.hasPhone ? (
                        // Anonymous viewer: backend redacted phone (null) but
                        // told us hasPhone=true. Show a blurred CSS placeholder
                        // that links to /login with a redirect back to this
                        // profile so the user lands here logged-in afterward.
                        <chakra.button
                            type="button"
                            onClick={() =>
                                navigate("/login", {
                                    state: { from: { pathname: window.location.pathname } },
                                })
                            }
                            color="blue.fg"
                            fontSize="sm"
                            fontWeight="medium"
                            display="inline-flex"
                            alignItems="center"
                            gap="1.5"
                            cursor="pointer"
                            bg="transparent"
                            border="0"
                            p="0"
                            title="Prijavi se da vidiš broj"
                            _hover={{ textDecoration: "underline" }}
                        >
                            <FiPhone size={13} />
                            <chakra.span
                                style={{ filter: "blur(5px)", userSelect: "none" }}
                                aria-hidden
                            >
                                +385 99 123 4567
                            </chakra.span>
                            <chakra.span fontSize="xs" color="fg.muted">
                                (prijavi se)
                            </chakra.span>
                        </chakra.button>
                    ) : null}
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
                                                inputMode="numeric"
                                                pattern="[0-9 ]*"
                                                placeholder="91 234 5678"
                                                value={phone}
                                                // Strip non-digits (and non-spaces) so the saved
                                                // value never contains stray "(", "-", or "+"
                                                // characters — the country dial code lives in a
                                                // separate select.
                                                onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
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
                                    <RouterLink to={`/tournaments/${row.tournamentSlug ?? row.tournamentUuid}`}>
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

/**
 * Unified "Moji pari" card on the Predlošci tab.
 *
 * Each row is a saved pair name (UserPairPreset). Actions per row:
 *   - rename
 *   - hide/show on public profile
 *   - delete (blocked once shared + claimed)
 *   - "Podijeli sa partnerom" — copies the /claim-name/{token} URL
 *     so the partner can claim co-ownership and see this pair on
 *     their own profile too.
 *
 * Sharing is preset-level: when the partner claims, every tournament
 * pair the primary registered under this name (past and future) gets
 * backfilled with the partner's UID, propagating the equal-participant
 * view (profile listing + push + bill access).
 */
function MyPairsCard() {
    const [presets, setPresets] = React.useState<UserPairPreset[]>([])
    const [loading, setLoading] = React.useState(true)
    const [draft, setDraft] = React.useState("")
    const [creating, setCreating] = React.useState(false)
    const [editingUuid, setEditingUuid] = React.useState<string | null>(null)
    const [editValue, setEditValue] = React.useState("")
    const [pendingDelete, setPendingDelete] = React.useState<UserPairPreset | null>(null)
    const [deleting, setDeleting] = React.useState(false)

    React.useEffect(() => {
        let cancelled = false
        ;(async () => {
            setLoading(true)
            try {
                const ps = await listPresets()
                if (!cancelled) setPresets(ps)
            } catch {
                if (!cancelled) setPresets([])
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

    /* ----- Preset CRUD ----- */
    async function onAddPreset(e: React.FormEvent) {
        e.preventDefault()
        const name = draft.trim()
        if (!name) return
        try {
            setCreating(true)
            const fresh = await createPreset(name)
            setPresets((xs) => [...xs, fresh])
            setDraft("")
        } finally {
            setCreating(false)
        }
    }

    async function commitRename(p: UserPairPreset) {
        const name = editValue.trim()
        if (!name || name === p.name) {
            setEditingUuid(null)
            setEditValue("")
            return
        }
        try {
            const updated = await updatePreset(p.uuid, name)
            setPresets((xs) => xs.map((x) => (x.uuid === p.uuid ? updated : x)))
            setEditingUuid(null)
            setEditValue("")
        } catch (e: any) {
            // toast surfaces via interceptor for non-silent errors; nothing
            // extra to do here.
        }
    }

    async function toggleVisibility(p: UserPairPreset) {
        const updated = await setPresetVisibility(p.uuid, !p.hidden)
        setPresets((xs) => xs.map((x) => (x.uuid === p.uuid ? updated : x)))
    }

    async function confirmDelete() {
        if (!pendingDelete) return
        setDeleting(true)
        try {
            await deletePreset(pendingDelete.uuid)
            setPresets((xs) => xs.filter((x) => x.uuid !== pendingDelete.uuid))
            setPendingDelete(null)
            showSuccess("Par obrisan")
        } catch (e: any) {
            // 409 means the preset has a co-owner — locked from delete.
            if (e?.response?.status === 409) {
                showError(
                    "Ne može se obrisati",
                    "Par je podijeljen s partnerom. Sakrij ga od drugih ako ga ne želiš prikazivati.",
                )
            } else {
                showError("Brisanje nije uspjelo")
            }
        } finally {
            setDeleting(false)
        }
    }

    /* ----- Share-link copy (toaster, never alert/prompt) ----- */
    async function copyShareLink(token: string) {
        const url = `${window.location.origin}/claim-name/${token}`
        try {
            await navigator.clipboard.writeText(url)
            showSuccess("Poveznica kopirana", "Pošalji ju partneru.")
        } catch {
            // Older Safari / non-secure context — clipboard API blocked.
            showError(
                "Ne mogu kopirati u međuspremnik",
                `Kopiraj ručno: ${url}`,
            )
        }
    }

    return (
        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
            <Card.Body p={{ base: "4", md: "5" }}>
                <VStack align="stretch" gap="3">
                    <Box>
                        <Heading size="sm">Moji pari</Heading>
                        <Text fontSize="xs" color="fg.muted">
                            Spremljena imena parova. Podijeli sa partnerom da se par
                            pojavi i na njegovom profilu, ili sakrij od drugih ako ga
                            ne želiš prikazivati javno.
                        </Text>
                    </Box>

                    <form onSubmit={onAddPreset}>
                        <HStack gap="2">
                            <Field.Root flex="1">
                                <Input
                                    size="sm"
                                    placeholder="npr. Marko & Pero"
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                />
                            </Field.Root>
                            <Button
                                type="submit"
                                size="sm"
                                variant="solid"
                                colorPalette="blue"
                                loading={creating}
                                disabled={!draft.trim() || creating}
                            >
                                <FiPlus /> Dodaj
                            </Button>
                        </HStack>
                    </form>

                    {loading ? (
                        <VStack align="stretch" gap="2"><Skeleton h="14" /><Skeleton h="14" /></VStack>
                    ) : presets.length === 0 ? (
                        <Text fontSize="sm" color="fg.muted">
                            Nemaš spremljenih parova.
                        </Text>
                    ) : (
                        <VStack align="stretch" gap="2">
                            {presets.map((p) => {
                                const isClaimed = !!p.coOwnerSlug
                                return (
                                    <Box
                                        key={p.uuid}
                                        borderWidth="1px"
                                        borderColor="border.emphasized"
                                        rounded="md"
                                        p="3"
                                    >
                                        {editingUuid === p.uuid ? (
                                            <HStack gap="2" align="center" minW="0">
                                                <Box flex="1" minW="0">
                                                    <Input
                                                        size="sm"
                                                        autoFocus
                                                        w="full"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") { e.preventDefault(); void commitRename(p) }
                                                            if (e.key === "Escape") { e.preventDefault(); setEditingUuid(null); setEditValue("") }
                                                        }}
                                                    />
                                                </Box>
                                                <IconButton
                                                    aria-label="Spremi"
                                                    size="xs"
                                                    variant="solid"
                                                    colorPalette="green"
                                                    flexShrink={0}
                                                    onClick={() => commitRename(p)}
                                                >
                                                    <FiCheck />
                                                </IconButton>
                                                <IconButton
                                                    aria-label="Odustani"
                                                    size="xs"
                                                    variant="ghost"
                                                    flexShrink={0}
                                                    onClick={() => { setEditingUuid(null); setEditValue("") }}
                                                >
                                                    <FiX />
                                                </IconButton>
                                            </HStack>
                                        ) : (
                                            <>
                                                {/* Header row — name + status badges + action icons */}
                                                <HStack gap="2" align="center" minW="0" mb="2">
                                                    <Text flex="1" minW="0" fontWeight="medium" truncate>
                                                        {p.name}
                                                    </Text>
                                                    {p.hidden && (
                                                        <Badge size="sm" colorPalette="gray" variant="subtle">
                                                            Skriveno
                                                        </Badge>
                                                    )}
                                                    <IconButton
                                                        aria-label={p.hidden ? "Prikaži" : "Sakrij"}
                                                        title={p.hidden ? "Prikaži drugima" : "Sakrij od drugih"}
                                                        size="xs"
                                                        variant="ghost"
                                                        flexShrink={0}
                                                        onClick={() => toggleVisibility(p)}
                                                    >
                                                        {p.hidden ? <FiEyeOff /> : <FiEye />}
                                                    </IconButton>
                                                    <IconButton
                                                        aria-label="Uredi"
                                                        size="xs"
                                                        variant="ghost"
                                                        flexShrink={0}
                                                        onClick={() => { setEditingUuid(p.uuid); setEditValue(p.name) }}
                                                    >
                                                        <FiEdit2 />
                                                    </IconButton>
                                                    <IconButton
                                                        aria-label={isClaimed ? "Ne može se obrisati — par je podijeljen" : "Obriši"}
                                                        title={isClaimed ? "Par je podijeljen i ne može se obrisati" : "Obriši"}
                                                        size="xs"
                                                        variant="ghost"
                                                        colorPalette="red"
                                                        flexShrink={0}
                                                        disabled={isClaimed}
                                                        onClick={() => setPendingDelete(p)}
                                                    >
                                                        <FiTrash2 />
                                                    </IconButton>
                                                </HStack>

                                                {/* Footer row — share button + co-owner badge */}
                                                <HStack gap="2" wrap="wrap" justify="space-between">
                                                    {isClaimed ? (
                                                        <Badge colorPalette="green" variant="subtle" size="sm">
                                                            Suvlasnik:{" "}
                                                            <RouterLink
                                                                to={`/profile/${p.coOwnerSlug}`}
                                                                style={{ textDecoration: "underline" }}
                                                            >
                                                                {p.coOwnerName || p.coOwnerSlug}
                                                            </RouterLink>
                                                        </Badge>
                                                    ) : (
                                                        <Badge colorPalette="gray" variant="subtle" size="sm">
                                                            Nije podijeljeno
                                                        </Badge>
                                                    )}
                                                    {!isClaimed && p.claimToken && (
                                                        <Button
                                                            size="xs"
                                                            variant="outline"
                                                            colorPalette="blue"
                                                            onClick={() => copyShareLink(p.claimToken!)}
                                                        >
                                                            <FiShare2 /> Podijeli sa partnerom
                                                        </Button>
                                                    )}
                                                </HStack>
                                            </>
                                        )}
                                    </Box>
                                )
                            })}
                        </VStack>
                    )}
                </VStack>
            </Card.Body>

            {/* Confirm-delete dialog — same UX as before, just hoisted here. */}
            <Dialog.Root
                open={!!pendingDelete}
                onOpenChange={(e) => { if (!e.open && !deleting) setPendingDelete(null) }}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="sm">
                        <Dialog.Header>Obrisati ime?</Dialog.Header>
                        <Dialog.Body>
                            <Text>
                                Sigurno želiš obrisati <b>{pendingDelete?.name}</b>?
                                Ova radnja se ne može poništiti.
                            </Text>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={deleting}>
                                Odustani
                            </Button>
                            <Button colorPalette="red" onClick={confirmDelete} loading={deleting}>
                                Obriši
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>
        </Card.Root>
    )
}

// PresetsCard — superseded by MyPairsCard which absorbs preset management
// (create / rename / delete / hide) alongside the per-pair share button.
// Exported only so tsc's noUnusedLocals doesn't trip on the dead-code
// definition kept here for reference until a future cleanup pass.
export function PresetsCard() {
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

/* ============================================================
   Drink-price template card — saved cjenik for reuse on new
   tournaments. Mirrors the Presets pattern: load on mount,
   edit inline, save the whole list with one button.
   ============================================================ */

type DrinkTemplateRow = {
    _key: string
    id: number | null
    name: string
    price: string
}

let _drinkTplKey = 0
function nextDrinkTplKey(): string {
    _drinkTplKey += 1
    return `dt-${_drinkTplKey}-${Math.random().toString(36).slice(2, 6)}`
}

function rowFromDto(d: DrinkPriceDto): DrinkTemplateRow {
    return {
        _key: d.id != null ? `srv-${d.id}` : nextDrinkTplKey(),
        id: d.id ?? null,
        name: d.name,
        price: d.price == null ? "" : String(d.price),
    }
}

/* Multi-template UI.
   Two view modes:
     - "list":    show every saved template by name + a "+ Novi predložak"
                  button. Click a row to enter edit mode.
     - "edit":    inline editor for one named template — same row UI as
                  the previous single-template version, plus rename
                  and delete affordances. Back button returns to list. */
function DrinkTemplateCard() {
    // Top-level: list of template names + which one (if any) is being edited.
    const [names, setNames] = React.useState<string[]>([])
    const [loadingNames, setLoadingNames] = React.useState(true)
    const [editingName, setEditingName] = React.useState<string | null>(null)
    const [newNameInput, setNewNameInput] = React.useState("")

    React.useEffect(() => {
        let cancelled = false
        ;(async () => {
            setLoadingNames(true)
            try {
                const ns = await fetchMyTemplateNames()
                if (!cancelled) setNames(ns)
            } catch {
                if (!cancelled) setNames([])
            } finally {
                if (!cancelled) setLoadingNames(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

    const refreshNames = async () => {
        try {
            const ns = await fetchMyTemplateNames()
            setNames(ns)
        } catch {
            /* ignore */
        }
    }

    const startNewTemplate = () => {
        const trimmed = newNameInput.trim()
        if (!trimmed) return
        if (names.includes(trimmed)) {
            alert("Predložak s tim nazivom već postoji.")
            return
        }
        // Optimistically add to the local list and jump into edit mode.
        // The first save in the editor will create the row server-side.
        setNames((ns) => [...ns, trimmed].sort())
        setEditingName(trimmed)
        setNewNameInput("")
    }

    return (
        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
            <Card.Body p={{ base: "4", md: "5" }}>
                <VStack align="stretch" gap="3">
                    <Box>
                        <Heading size="sm">Cjenici – predlošci</Heading>
                        <Text fontSize="xs" color="fg.muted">
                            Spremljeni cjenici pića koje možeš učitati na novim
                            turnirima jednim klikom.
                        </Text>
                    </Box>

                    {editingName ? (
                        <DrinkTemplateEditor
                            templateName={editingName}
                            onBack={async () => {
                                setEditingName(null)
                                await refreshNames()
                            }}
                            onRenamed={async (newName) => {
                                setEditingName(newName)
                                await refreshNames()
                            }}
                            onDeleted={async () => {
                                setEditingName(null)
                                await refreshNames()
                            }}
                            existingNames={names}
                        />
                    ) : loadingNames ? (
                        <VStack align="stretch" gap="2"><Skeleton h="9" /><Skeleton h="9" /></VStack>
                    ) : (
                        <VStack align="stretch" gap="2">
                            {names.length === 0 ? (
                                <Text fontSize="sm" color="fg.muted">
                                    Nemaš spremljenih predložaka.
                                </Text>
                            ) : (
                                names.map((n) => (
                                    <Button
                                        key={n}
                                        variant="outline"
                                        size="sm"
                                        justifyContent="space-between"
                                        onClick={() => setEditingName(n)}
                                    >
                                        <Text>{n}</Text>
                                        <FiEdit2 />
                                    </Button>
                                ))
                            )}

                            {/* New template row */}
                            <HStack gap="2" mt="2">
                                <Input
                                    size="sm"
                                    placeholder="Naziv novog predloška"
                                    value={newNameInput}
                                    onChange={(e) => setNewNameInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault()
                                            startNewTemplate()
                                        }
                                    }}
                                />
                                <Button
                                    size="sm"
                                    colorPalette="blue"
                                    onClick={startNewTemplate}
                                    disabled={
                                        !newNameInput.trim() ||
                                        names.includes(newNameInput.trim())
                                    }
                                >
                                    <FiPlus /> Stvori
                                </Button>
                            </HStack>
                        </VStack>
                    )}
                </VStack>
            </Card.Body>
        </Card.Root>
    )
}

/**
 * Editor for one named template. Loads items from the server, lets the
 * user edit the row list (with preset chips), and supports rename +
 * delete via the header controls.
 */
function DrinkTemplateEditor({
    templateName,
    existingNames,
    onBack,
    onRenamed,
    onDeleted,
}: {
    templateName: string
    existingNames: string[]
    onBack: () => void | Promise<void>
    onRenamed: (newName: string) => void | Promise<void>
    onDeleted: () => void | Promise<void>
}) {
    const [rows, setRows] = React.useState<DrinkTemplateRow[]>([])
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [dirty, setDirty] = React.useState(false)
    const [renaming, setRenaming] = React.useState(false)
    const [renameValue, setRenameValue] = React.useState(templateName)

    React.useEffect(() => {
        let cancelled = false
        ;(async () => {
            setLoading(true)
            try {
                const data = await fetchMyTemplate(templateName)
                if (cancelled) return
                setRows(data.map(rowFromDto))
                setDirty(false)
            } catch {
                if (!cancelled) setRows([])
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [templateName])

    const addRow = () => {
        setRows((r) => [...r, { _key: nextDrinkTplKey(), id: null, name: "", price: "" }])
        setDirty(true)
    }
    const addPresetRow = (label: string) => {
        if (rows.some((r) => r.name.trim().toLowerCase() === label.toLowerCase())) return
        setRows((r) => [...r, { _key: nextDrinkTplKey(), id: null, name: label, price: "" }])
        setDirty(true)
    }
    const removeRow = (key: string) => {
        setRows((r) => r.filter((x) => x._key !== key))
        setDirty(true)
    }
    const patch = (key: string, p: Partial<DrinkTemplateRow>) => {
        setRows((r) => r.map((x) => (x._key === key ? { ...x, ...p } : x)))
        setDirty(true)
    }

    const onSave = async () => {
        setSaving(true)
        try {
            const items: DrinkPriceDto[] = rows
                .filter((r) => r.name.trim() !== "")
                .map((r, i) => ({
                    id: r.id ?? null,
                    name: r.name.trim(),
                    price: Number((r.price || "0").replace(",", ".")) || 0,
                    sortOrder: i,
                }))
            const fresh = await saveMyTemplate(templateName, items)
            setRows(fresh.map(rowFromDto))
            setDirty(false)
        } finally {
            setSaving(false)
        }
    }

    const onRenameSubmit = async () => {
        const t = renameValue.trim()
        if (!t || t === templateName) {
            setRenaming(false)
            setRenameValue(templateName)
            return
        }
        if (existingNames.some((n) => n !== templateName && n === t)) {
            alert("Predložak s tim nazivom već postoji.")
            return
        }
        setSaving(true)
        try {
            await renameMyTemplate(templateName, t)
            setRenaming(false)
            await onRenamed(t)
        } finally {
            setSaving(false)
        }
    }

    const onDelete = async () => {
        if (!window.confirm(`Obrisati predložak "${templateName}"?`)) return
        setSaving(true)
        try {
            await deleteMyTemplate(templateName)
            await onDeleted()
        } finally {
            setSaving(false)
        }
    }

    return (
        <VStack align="stretch" gap="3">
            {/* Header — back button + name (editable on click) + delete */}
            <HStack gap="2" justify="space-between">
                <HStack gap="2" flex="1" minW="0">
                    <IconButton
                        aria-label="Natrag"
                        size="xs"
                        variant="ghost"
                        onClick={() => onBack()}
                        disabled={saving}
                    >
                        <FiX />
                    </IconButton>
                    {renaming ? (
                        <HStack gap="1" flex="1" minW="0">
                            <Input
                                size="sm"
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault()
                                        void onRenameSubmit()
                                    }
                                    if (e.key === "Escape") {
                                        e.preventDefault()
                                        setRenaming(false)
                                        setRenameValue(templateName)
                                    }
                                }}
                            />
                            <IconButton
                                aria-label="Spremi naziv"
                                size="xs"
                                variant="solid"
                                colorPalette="green"
                                onClick={onRenameSubmit}
                                disabled={saving}
                            >
                                <FiCheck />
                            </IconButton>
                        </HStack>
                    ) : (
                        <HStack gap="1" flex="1" minW="0">
                            <Text fontWeight="semibold" truncate>
                                {templateName}
                            </Text>
                            <IconButton
                                aria-label="Preimenuj"
                                size="xs"
                                variant="ghost"
                                onClick={() => {
                                    setRenameValue(templateName)
                                    setRenaming(true)
                                }}
                                disabled={saving}
                            >
                                <FiEdit2 />
                            </IconButton>
                        </HStack>
                    )}
                </HStack>
                <IconButton
                    aria-label="Obriši predložak"
                    size="xs"
                    variant="ghost"
                    colorPalette="red"
                    onClick={onDelete}
                    disabled={saving}
                >
                    <FiTrash2 />
                </IconButton>
            </HStack>

            {/* Predefined drinks — quick-add chips. */}
            {!loading && (
                <Box
                    p="3"
                    rounded="md"
                    borderWidth="1px"
                    borderColor="border.emphasized"
                    bg="bg.subtle"
                >
                    <Text fontSize="xs" color="fg.muted" mb="2">
                        Brzo dodaj:
                    </Text>
                    <VStack align="stretch" gap="1.5">
                        {groupedPresets().map((g) => (
                            <HStack key={g.category} gap="2" wrap="wrap">
                                <Text fontSize="xs" color="fg.muted" minW="92px">
                                    {g.category}:
                                </Text>
                                {g.items.map((p) => (
                                    <Button
                                        key={p.label}
                                        size="2xs"
                                        variant="outline"
                                        onClick={() => addPresetRow(p.label)}
                                        disabled={saving}
                                    >
                                        {p.label.slice(g.category.length + 1)}
                                    </Button>
                                ))}
                            </HStack>
                        ))}
                    </VStack>
                </Box>
            )}

            {loading ? (
                <VStack align="stretch" gap="2"><Skeleton h="9" /><Skeleton h="9" /></VStack>
            ) : (
                <VStack align="stretch" gap="1.5">
                    {rows.length === 0 && (
                        <Text fontSize="sm" color="fg.muted">
                            Predložak je prazan. Dodaj pića ispod.
                        </Text>
                    )}
                    {rows.map((row) => (
                        <HStack key={row._key} gap="2" align="center" minW="0">
                            <Input
                                size="sm"
                                placeholder="Naziv (npr. Pivo)"
                                value={row.name}
                                onChange={(e) => patch(row._key, { name: e.target.value })}
                                flex="1"
                                minW="0"
                            />
                            <Input
                                size="sm"
                                placeholder="Cijena"
                                value={row.price}
                                onChange={(e) =>
                                    patch(row._key, {
                                        price: e.target.value.replace(",", "."),
                                    })
                                }
                                inputMode="decimal"
                                w="90px"
                            />
                            <Text fontSize="sm" color="fg.muted">€</Text>
                            <IconButton
                                aria-label="Ukloni"
                                size="xs"
                                variant="ghost"
                                colorPalette="red"
                                flexShrink={0}
                                onClick={() => removeRow(row._key)}
                            >
                                <FiTrash2 />
                            </IconButton>
                        </HStack>
                    ))}
                </VStack>
            )}

            <HStack justify="space-between">
                <Button size="sm" variant="outline" onClick={addRow} disabled={saving}>
                    <FiPlus /> Dodaj
                </Button>
                <Button
                    size="sm"
                    colorPalette="blue"
                    onClick={onSave}
                    loading={saving}
                    disabled={!dirty || saving}
                >
                    Spremi predložak
                </Button>
            </HStack>
        </VStack>
    )
}

/* ============================================================
   Invoice history — every bill the current user was a party to,
   across all tournaments they played in. Read-only; loads
   /user/me/invoices once on mount. Only the profile owner sees
   this card (gated upstream by isOwner).
   ============================================================ */

function formatEurAmount(value: number | string | null | undefined): string {
    if (value == null || value === "") return "—"
    const n = typeof value === "string" ? Number(value.replace(",", ".")) : value
    if (!Number.isFinite(n)) return "—"
    return new Intl.NumberFormat("hr-HR", {
        style: "currency",
        currency: "EUR",
    }).format(n as number)
}

function InvoicesCard() {
    const [invoices, setInvoices] = React.useState<UserInvoiceDto[]>([])
    const [loading, setLoading] = React.useState(true)
    // Modal state — the invoice the user tapped, plus the lazily-loaded
    // full bill (drinks list) so we can render line items.
    const [openInvoice, setOpenInvoice] = React.useState<UserInvoiceDto | null>(null)
    const [openBill, setOpenBill] = React.useState<MatchBillDto | null>(null)
    const [openBillLoading, setOpenBillLoading] = React.useState(false)

    React.useEffect(() => {
        let cancelled = false
        ;(async () => {
            setLoading(true)
            try {
                const data = await fetchMyInvoices()
                if (!cancelled) setInvoices(data)
            } catch {
                if (!cancelled) setInvoices([])
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

    const openDetail = async (inv: UserInvoiceDto) => {
        setOpenInvoice(inv)
        setOpenBill(null)
        setOpenBillLoading(true)
        try {
            const bill = await fetchMatchBill(inv.tournamentRef, inv.matchId)
            setOpenBill(bill)
        } catch {
            // Network/permission failure — modal still shows the summary
            // info from the invoice DTO; line items just won't appear.
            setOpenBill(null)
        } finally {
            setOpenBillLoading(false)
        }
    }

    return (
        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
            <Card.Body p={{ base: "4", md: "5" }}>
                <VStack align="stretch" gap="3">
                    <Box>
                        <Heading size="sm">Moji računi</Heading>
                        <Text fontSize="xs" color="fg.muted">
                            Pregled računa za stolove na turnirima na kojima si igrao.
                        </Text>
                    </Box>

                    {loading ? (
                        <VStack align="stretch" gap="2">
                            <Skeleton h="14" /><Skeleton h="14" />
                        </VStack>
                    ) : invoices.length === 0 ? (
                        <Text fontSize="sm" color="fg.muted">
                            Nemaš još nijedan račun.
                        </Text>
                    ) : (
                        <VStack align="stretch" gap="2">
                            {invoices.map((inv) => (
                                <Box
                                    key={inv.matchId}
                                    borderWidth="1px"
                                    borderColor="border.emphasized"
                                    rounded="md"
                                    p="3"
                                    cursor="pointer"
                                    onClick={() => openDetail(inv)}
                                    _hover={{ borderColor: "blue.400", bg: "bg.subtle" }}
                                >
                                    <HStack justify="space-between" align="start" gap="2">
                                        <Box flex="1" minW="0">
                                            <Text fontWeight="medium" truncate>
                                                {inv.tournamentName}
                                            </Text>
                                            <Text fontSize="xs" color="fg.muted">
                                                {inv.tournamentStartAt
                                                    ? formatDate(inv.tournamentStartAt)
                                                    : "—"}
                                                {inv.roundNumber != null
                                                    ? ` · Runda ${inv.roundNumber}`
                                                    : ""}
                                                {inv.tableNo != null
                                                    ? ` · Stol ${inv.tableNo}`
                                                    : ""}
                                            </Text>
                                            <Text fontSize="sm" mt="1" truncate>
                                                {inv.myPairName ?? "—"}{" "}
                                                <Text as="span" color="fg.muted">
                                                    vs
                                                </Text>{" "}
                                                {inv.opponentPairName ?? "—"}
                                            </Text>
                                        </Box>
                                        <VStack align="end" gap="1" flexShrink={0}>
                                            <Text fontWeight="bold">
                                                {formatEurAmount(inv.total)}
                                            </Text>
                                            {inv.paidAt ? (
                                                <Badge colorPalette="green" size="sm">
                                                    Plaćeno
                                                </Badge>
                                            ) : inv.finished && inv.lost ? (
                                                <Badge colorPalette="orange" size="sm">
                                                    Tvoj račun
                                                </Badge>
                                            ) : (
                                                <Badge colorPalette="gray" size="sm" variant="subtle">
                                                    Otvoreno
                                                </Badge>
                                            )}
                                        </VStack>
                                    </HStack>
                                </Box>
                            ))}
                        </VStack>
                    )}
                </VStack>
            </Card.Body>

            {/* Detail modal — opens on row click. Shows the full bill
                (drinks + total + paid status). Doesn't navigate away
                from the profile. */}
            <Dialog.Root
                open={!!openInvoice}
                onOpenChange={(e) => {
                    if (!e.open) {
                        setOpenInvoice(null)
                        setOpenBill(null)
                    }
                }}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="md">
                        <Dialog.Header>
                            <Text fontWeight="semibold" truncate>
                                {openInvoice?.tournamentName ?? "Račun"}
                            </Text>
                        </Dialog.Header>
                        <Dialog.Body>
                            {openInvoice && (
                                <VStack align="stretch" gap="3">
                                    {/* Summary row */}
                                    <Box>
                                        <Text fontSize="xs" color="fg.muted">
                                            {openInvoice.tournamentStartAt
                                                ? formatDate(openInvoice.tournamentStartAt)
                                                : "—"}
                                            {openInvoice.roundNumber != null
                                                ? ` · Runda ${openInvoice.roundNumber}`
                                                : ""}
                                            {openInvoice.tableNo != null
                                                ? ` · Stol ${openInvoice.tableNo}`
                                                : ""}
                                        </Text>
                                        <Text fontSize="sm" mt="1">
                                            <b>{openInvoice.myPairName ?? "—"}</b>{" "}
                                            <Text as="span" color="fg.muted">vs</Text>{" "}
                                            {openInvoice.opponentPairName ?? "—"}
                                        </Text>
                                    </Box>

                                    {/* Drinks line items */}
                                    {openBillLoading ? (
                                        <VStack align="stretch" gap="2">
                                            <Skeleton h="6" /><Skeleton h="6" />
                                        </VStack>
                                    ) : openBill && openBill.drinks.length > 0 ? (
                                        <VStack align="stretch" gap="1">
                                            {openBill.drinks.map((d) => (
                                                <HStack
                                                    key={d.id}
                                                    justify="space-between"
                                                    borderBottomWidth="1px"
                                                    borderColor="gray.100"
                                                    py="1"
                                                >
                                                    <Text fontSize="sm">
                                                        {d.name}
                                                        {d.quantity > 1 && <> × {d.quantity}</>}
                                                    </Text>
                                                    <Text fontSize="sm" fontWeight="medium">
                                                        {formatEurAmount(d.lineTotal)}
                                                    </Text>
                                                </HStack>
                                            ))}
                                        </VStack>
                                    ) : (
                                        <Text fontSize="sm" color="fg.muted">
                                            Nema dodanih pića.
                                        </Text>
                                    )}

                                    {/* Total + status badges */}
                                    <HStack justify="space-between" pt="1">
                                        <Text fontWeight="semibold">Ukupno</Text>
                                        <Text fontWeight="bold" fontSize="md">
                                            {formatEurAmount(openInvoice.total)}
                                        </Text>
                                    </HStack>

                                    <HStack gap="2" wrap="wrap">
                                        {openInvoice.paidAt ? (
                                            <Badge colorPalette="green">Plaćeno</Badge>
                                        ) : openInvoice.finished && openInvoice.lost ? (
                                            <Badge colorPalette="orange">Tvoj račun</Badge>
                                        ) : (
                                            <Badge colorPalette="gray" variant="subtle">Otvoreno</Badge>
                                        )}
                                        {openInvoice.finished && !openInvoice.lost && (
                                            <Badge colorPalette="blue" variant="subtle">Pobjeda</Badge>
                                        )}
                                    </HStack>
                                </VStack>
                            )}
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button variant="ghost" onClick={() => setOpenInvoice(null)}>
                                Zatvori
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>
        </Card.Root>
    )
}
