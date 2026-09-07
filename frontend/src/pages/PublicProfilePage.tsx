import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import {
    Box,
    Button,
    Card,
    chakra,
    Flex,
    HStack,
    Skeleton,
    Spinner,
    Text,
    VStack,
} from "@chakra-ui/react"
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom"
import { FiAlertCircle } from "react-icons/fi"
import { getPublicProfile, type PublicProfile } from "../api/publicProfile"
import type { MyTournamentParticipation } from "../api/userMe"
import { CONTENT_STICKY_TOP, NAVBAR_TOP } from "../components/navChrome"
import { useAuth } from "../auth/authContextValue"
import { useDocumentHead } from "../hooks/useDocumentHead"
import { errorMessage } from "../utils/apiError"
import { lazyWithReload } from "../utils/lazyWithReload"
// `tStatic` is the non-reactive translator: the fetch effect below writes
// its message into state, and depending on the hook's `t` (a fresh closure
// every render) would re-fire the request on every render.
import { t as tStatic, usePlural, useTranslation } from "../i18n"
import { ProfileIdentityBlock, PublicIdentityCard } from "./profile/ProfileHeader"
import { TournamentsCard } from "./profile/TournamentsCard"
import { pairKey } from "./profile/pairKey"
import { TournamentRow } from "./profile/TournamentRow"
import { MyDataCard } from "./profile/MyDataCard"
import { MyPairsCard } from "./profile/MyPairsCard"
import { DrinkTemplateCard } from "./profile/DrinkTemplateCard"
import { SettingsCard } from "./profile/SettingsCard"
import { InvoicesCard } from "./profile/InvoicesCard"
import { buildProfileSections, SIDEBAR_MAX_H, type ProfileSectionDef, type ProfileSectionKey } from "./profile/sections"

/* The three admin consoles are reachable only by an admin, only on their own
   profile, and only after clicking the tab — so their (sizeable) code is
   split out of the profile chunk and fetched on demand. */
const AdminDashboardTab = lazyWithReload(() => import("../components/AdminDashboardTab"))
const AdminPlayersListTab = lazyWithReload(() => import("../components/AdminPlayersListTab"))
const AdminContactMessagesTab = lazyWithReload(() => import("../components/AdminContactMessagesTab"))

export default function PublicProfilePage() {
    const { slug } = useParams<{ slug: string }>()
    const { user, mySlug, isAdmin, loading: authLoading } = useAuth()
    const navigate = useNavigate()
    const { t } = useTranslation()
    const plural = usePlural()

    const [profile, setProfile] = useState<PublicProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Cancellation guards for `refreshProfile` below. Unlike the main load
    // effect it is fired from child callbacks after a mutation, so it has no
    // cleanup of its own: its response can land after the user navigated away
    // or hopped to a different profile, and would then repaint the page with
    // someone else's record.
    const aliveRef = useRef(true)
    const slugRef = useRef<string | undefined>(slug)
    slugRef.current = slug
    useEffect(() => {
        aliveRef.current = true
        return () => { aliveRef.current = false }
    }, [])

    const [activePair, setActivePair] = useState<string | null>(null) // pair name (case preserved)
    const [search, setSearch] = useState("")

    // Profile sections. Predlošci + Postavke + Računi only show for the
    // profile owner; visitors viewing someone else's page see Turniri only.
    const [profileTab, setProfileTab] = useState<ProfileSectionKey>("turniri")

    // Per-route SEO. We deliberately do NOT include the user's phone in any
    // meta tag — phone display is a product call on the page itself, but
    // there's no need to make it any more discoverable than it already is.
    const totalTournaments = profile?.tournaments?.length ?? 0
    const totalWins = (profile?.pairs ?? []).reduce((sum, p) => sum + (p.wins ?? 0), 0)
    const profileCanonical = slug ? `https://bela-turniri.com/profil/${slug}` : undefined
    // Both counts go through the plural helper and then into ONE sentence key:
    // gluing translated fragments together would freeze the word order to
    // Croatian's.
    const tournamentsLabel = plural("profile.tournamentsCount", totalTournaments)
    const winsLabel = plural("profile.winsCount", totalWins)
    const profileDescription = profile?.displayName
        ? t("profile.seo.description", {
            name: profile.displayName,
            tournaments: tournamentsLabel,
            wins: winsLabel,
        })
        : undefined

    // Person JSON-LD for Googlebot. Mirrors what ProfilePreviewController
    // emits for non-JS crawlers so structured-data validators see one
    // consistent record per URL regardless of which path rendered it.
    const profileJsonLd = useMemo(() => {
        if (!profile?.displayName || !profileCanonical) return undefined
        const items: object[] = []
        const person: Record<string, unknown> = {
            "@context": "https://schema.org",
            "@type": "Person",
            name: profile.displayName,
            url: profileCanonical,
            description: profileDescription,
            knowsAbout: ["Bela", "Belot", t("profile.seo.knowsAboutCardGames")],
            interactionStatistic: [
                {
                    "@type": "InteractionCounter",
                    interactionType: "https://schema.org/RegisterAction",
                    userInteractionCount: totalTournaments,
                },
                {
                    "@type": "InteractionCounter",
                    interactionType: "https://schema.org/WinAction",
                    userInteractionCount: totalWins,
                },
            ],
        }
        if (slug) {
            person.identifier = slug
            person.alternateName = slug
        }
        if (profile.avatarUrl) person.image = profile.avatarUrl
        items.push(person)

        // BreadcrumbList — gives Google an "Igrači › {name}" trail.
        // There's no top-level "Igrači" index page yet, but the schema
        // still helps Google understand the URL hierarchy and is cheap
        // to ship pre-emptively.
        items.push({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                {
                    "@type": "ListItem",
                    position: 1,
                    name: t("profile.seo.breadcrumbPlayers"),
                    item: "https://bela-turniri.com/",
                },
                {
                    "@type": "ListItem",
                    position: 2,
                    name: profile.displayName,
                    item: profileCanonical,
                },
            ],
        })
        return items
    }, [t, profile?.displayName, profile?.avatarUrl, profileCanonical, profileDescription, slug, totalTournaments, totalWins])

    useDocumentHead({
        title: profile?.displayName
            ? t("profile.seo.title", { name: profile.displayName })
            : t("profile.seo.titleFallback"),
        description: profileDescription,
        ogTitle: profile?.displayName ?? undefined,
        ogDescription: profile?.displayName
            ? t("profile.seo.ogDescription", { tournaments: tournamentsLabel, wins: winsLabel })
            : undefined,
        ogImage: profile?.avatarUrl ?? undefined,
        ogType: "profile",
        canonical: profileCanonical,
        jsonLd: profileJsonLd,
    })

    // Why this depends on `authLoading` + `user?.uid` as well as `slug`:
    //
    // The backend redacts the phone number for anonymous viewers (the
    // "Prijavi se da vidiš broj" affordance is driven by the `hasPhone`
    // flag the API returns). If we fire this fetch before Firebase has
    // restored the persisted session, the request goes anonymous and we
    // get back a redacted record — even if the user IS logged in on
    // this device. Then `setProfile` stores that stale anonymous record
    // and the page shows the blurred phone permanently for this session.
    //
    // Fix: don't fetch until `authLoading` is false (the initial auth
    // probe finished), and re-fetch whenever `user?.uid` flips
    // (login/logout while the page is open). With this, a logged-in
    // user lands on the profile, the request goes out with their
    // Bearer token, and the backend returns the real phone.
    useEffect(() => {
        if (!slug) return
        if (authLoading) return
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
            } catch (e) {
                if (cancelled) return
                if ((e as { response?: { status?: number } })?.response?.status === 404) {
                    setError(tStatic("profile.notFound"))
                } else {
                    setError(errorMessage(e, tStatic("profile.loadFailed")))
                }
                setProfile(null)
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => { cancelled = true }
    }, [slug, authLoading, user?.uid])

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

    /**
     * The rendered row list, memoised. `search` lives on this component, so
     * every keystroke re-rendered the header, the pair chips AND all
     * tournament rows. TournamentRow is React.memo'd (its `row` objects keep
     * their identity across a filter), and holding the element array here
     * keeps the untouched rows out of the reconciler entirely.
     */
    const tournamentRows = useMemo(
        () => filteredTournaments.map((t) => (
            <TournamentRow
                key={`${t.tournamentUuid}-${t.pairId}`}
                slug={profile?.slug ?? ""}
                row={t}
            />
        )),
        [filteredTournaments, profile?.slug],
    )

    // Owner detection — backend deliberately doesn't ship the target UID, so
    // we compare slugs. mySlug is populated after /user/me/sync runs.
    const isOwner = !!profile && !!user?.uid && !!mySlug && mySlug === profile.slug

    /* Landing tab: the owner's own profile opens straight on "Postavke" —
       clicking the navbar avatar is now how you get here at all (it used to
       open a dropdown with its own quick theme/language toggle; that menu
       item is gone, so this page has to be the destination that shows them
       instead). A visitor on someone else's profile still lands on
       "Turniri", unchanged — `profileTab`'s initial value stays that
       default, and this only overrides it once ownership is actually known,
       which needs `profile` (and `mySlug`) to have loaded first. The ref
       guards it to ONCE: without it, `isOwner` flipping between renders
       (or `profile` changing shape) would keep resetting a tab the owner
       had already switched away from. */
    const defaultTabAppliedRef = useRef(false)
    useEffect(() => {
        if (defaultTabAppliedRef.current) return
        if (!profile) return
        defaultTabAppliedRef.current = true
        if (isOwner) setProfileTab("postavke")
    }, [isOwner, profile])

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
                            <Text>{error ?? t("profile.unavailable")}</Text>
                        </HStack>
                        <HStack mt="4">
                            <Button size="sm" variant="ghost" onClick={() => navigate(-1)}>{t("profile.back")}</Button>
                            <Button size="sm" variant="solid" colorPalette="blue" asChild>
                                <RouterLink to="/turniri">{t("profile.toTournaments")}</RouterLink>
                            </Button>
                        </HStack>
                    </Card.Body>
                </Card.Root>
            </VStack>
        )
    }

    async function refreshProfile() {
        const requestedSlug = profile!.slug
        try {
            const fresh = await getPublicProfile(requestedSlug)
            if (!aliveRef.current) return
            // The route may have moved on to another profile while this was
            // in flight — dropping the response is better than flashing the
            // previous player's data over the new page.
            if (slugRef.current !== undefined && slugRef.current !== requestedSlug) return
            setProfile(fresh)
        } catch { /* ignore */ }
    }

    /* Turniri — the one section a visitor also sees, so it is built once here
       and rendered by both branches below. */
    const tournamentsCard = (
        <TournamentsCard
            profile={profile}
            activePair={activePair}
            setActivePair={setActivePair}
            search={search}
            setSearch={setSearch}
            filteredCount={filteredTournaments.length}
            rows={tournamentRows}
        />
    )

    /* The section list, in sidebar order. Admin entries are appended only
       when the Firebase `role=admin` claim is present, exactly as the old tab
       strip gated them; a non-admin never gets the row, so the lazy chunk is
       never even referenced. */
    const sections: ProfileSectionDef[] = buildProfileSections(t, isAdmin)

    /* ── Visitor view ───────────────────────────────────────────────────────
       Someone looking at another player's profile gets the identity card and
       the Turniri list, and nothing else: no section nav, no Moji podaci, no
       Postavke. The redaction itself is the backend's (`profile.phone` comes
       back null with `hasPhone` true), and `isOwner` is a slug comparison —
       both unchanged. Keeping the visitor on its own branch means an owner-
       only card can never be reached by a visitor through a stale tab state.
       ────────────────────────────────────────────────────────────────────── */
    if (!isOwner) {
        return (
            <VStack align="stretch" gap="4" maxW="900px" mx="auto" w="full">
                <PublicIdentityCard profile={profile} />
                {tournamentsCard}
            </VStack>
        )
    }

    /* ── Owner view: sidebar + content column ───────────────────────────────
       lg+: a sticky card on the left carrying the avatar, name, phone and the
       section links, with the selected section in the column beside it.
       Below lg: the same card collapses ABOVE the content (a 390px viewport
       cannot hold two columns), its links laid out as a wrapping pill row.
       Nothing here is fixed-position, so nothing can hide behind
       MobileTabBar — App.tsx's Container already reserves
       `calc(100px + safe-area)` of bottom padding for it.
       ────────────────────────────────────────────────────────────────────── */
    const sectionNav = (
        <ProfileSectionNav
            sections={sections}
            active={profileTab}
            onSelect={setProfileTab}
        />
    )
    const identity = (
        <ProfileIdentityBlock
            profile={profile}
            onEdit={() => setProfileTab("postavke")}
        />
    )

    return (
        <Flex align="stretch" gap={{ base: "4", lg: "5" }} maxW="1100px" mx="auto" w="full">
            {/* Desktop column. Sticky offset comes from navChrome
                (CONTENT_STICKY_TOP = navbar + the Container's py), never a
                literal, and the column is viewport-bound with its own scroll
                so a long section list can't push the nav out of reach on a
                short laptop screen — the same construction TournamentSidebar
                uses. */}
            <Box w="248px" flexShrink={0} display={{ base: "none", lg: "block" }}>
                <Box
                    position="sticky"
                    top={CONTENT_STICKY_TOP}
                    maxH={SIDEBAR_MAX_H}
                    overflowY="auto"
                    overscrollBehavior="contain"
                >
                    <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
                        <Card.Body p="3">
                            {identity}
                            <Box borderTopWidth="1px" borderColor="border.subtle" my="3" />
                            {sectionNav}
                        </Card.Body>
                    </Card.Root>
                </Box>
            </Box>

            <VStack align="stretch" gap="4" flex="1" minW="0">
                {/* Collapsed header for base → lg: no card border any more —
                    a bare identity row + a pill tab strip, both pinned under
                    the navbar so they stay reachable while the section below
                    scrolls. Same frosted-band construction (and the same
                    `-24px` Container-padding swallow) as
                    `TournamentSidebar`'s `TournamentMobileBar`, so every
                    sticky mobile header in the app reads as one system. */}
                <Box
                    display={{ base: "block", lg: "none" }}
                    position="sticky"
                    top={NAVBAR_TOP}
                    zIndex={100}
                    layerStyle="glass.bar"
                    mt="-24px"
                    pt="24px"
                    pb="2"
                    mb="3"
                >
                    <Box pb="2.5">{identity}</Box>
                    {sectionNav}
                </Box>

                {/* === TURNIRI === */}
                {profileTab === "turniri" && tournamentsCard}

                {/* === PREDLOŠCI — saved pair presets + drink templates === */}
                {profileTab === "predlosci" && (
                    <>
                        <MyPairsCard />
                        <DrinkTemplateCard />
                    </>
                )}

                {/* === POSTAVKE — "Moji podaci" (identity, editable) followed
                    by the app preferences card. Contact details and the
                    avatar live here now that the header card is gone. === */}
                {profileTab === "postavke" && (
                    <>
                        <MyDataCard profile={profile} onProfileChanged={refreshProfile} />
                        <SettingsCard />
                    </>
                )}

                {/* === RAČUNI === */}
                {profileTab === "racuni" && <InvoicesCard />}

                {/* === DASHBOARD — admin-only, on own profile === */}
                {isAdmin && profileTab === "dashboard" && (
                    <Suspense fallback={<TabChunkLoading />}>
                        <AdminDashboardTab />
                    </Suspense>
                )}

                {/* === POPIS IGRAČA — admin-only, on own profile === */}
                {isAdmin && profileTab === "popis-igraca" && (
                    <Suspense fallback={<TabChunkLoading />}>
                        <AdminPlayersListTab />
                    </Suspense>
                )}

                {/* === PORUKE — admin-only contact-form inbox, on own profile === */}
                {isAdmin && profileTab === "poruke" && (
                    <Suspense fallback={<TabChunkLoading />}>
                        <AdminContactMessagesTab />
                    </Suspense>
                )}
            </VStack>
        </Flex>
    )
}

/* -------------------------------------------------------------------------- */
/* Section navigation                                                          */
/* -------------------------------------------------------------------------- */

/** Placeholder shown while a lazily-loaded admin tab chunk is downloading. */
function TabChunkLoading() {
    const { t } = useTranslation()
    return (
        <Flex align="center" justify="center" py="12" gap="3">
            <Spinner size="md" colorPalette="blue" />
            <Text fontSize="sm" color="fg.muted">{t("common.loading")}</Text>
        </Flex>
    )
}

/**
 * The section links. One component for both shells: a full-width stacked
 * list inside the desktop sidebar card, and a wrapping row of pills in the
 * collapsed card above the content on smaller screens. Only the width, the
 * radius and the flex direction differ, so a second component would just be
 * two copies of the same active-state logic.
 */
function ProfileSectionNav({
    sections,
    active,
    onSelect,
}: {
    sections: ProfileSectionDef[]
    active: ProfileSectionKey
    onSelect: (key: ProfileSectionKey) => void
}) {
    return (
        <Flex
            direction={{ base: "row", lg: "column" }}
            wrap={{ base: "wrap", lg: "nowrap" }}
            gap="1"
            align="stretch"
        >
            {sections.map((s) => {
                const isActive = s.key === active
                // Admin-only rows (Dashboard, Popis igrača, Poruke) get their
                // own purple tint — always tinted, not just on hover/active —
                // so they read as "different kind of row" at a glance, the
                // same way a destructive action reads red without anyone
                // having to hover it first.
                const palette = s.admin ? "purple" : "brand"
                return (
                    <chakra.button
                        key={s.key}
                        type="button"
                        onClick={() => onSelect(s.key)}
                        aria-current={isActive ? "page" : undefined}
                        display="inline-flex"
                        alignItems="center"
                        gap="2"
                        w={{ base: "auto", lg: "full" }}
                        px="3"
                        py="2"
                        border="0"
                        cursor="pointer"
                        textAlign="left"
                        fontSize="sm"
                        fontWeight={isActive ? "semibold" : "medium"}
                        // Pills when they wrap in a row, rows when they stack
                        // in the sidebar. Both values are steps on the theme's
                        // radii scale (src/system.ts).
                        rounded={{ base: "full", lg: "md" }}
                        bg={isActive ? `${palette}.subtle` : s.admin ? "purple.subtle/40" : "transparent"}
                        color={isActive ? `${palette}.fg` : s.admin ? "purple.fg" : "fg.soft"}
                        _hover={isActive ? undefined : { bg: `${palette}.subtle`, color: `${palette}.fg` }}
                        _focusVisible={{
                            outline: "2px solid",
                            outlineColor: "brand.focusRing",
                            outlineOffset: "1px",
                        }}
                    >
                        <Box
                            as="span"
                            display="flex"
                            flexShrink={0}
                            color={isActive || s.admin ? `${palette}.fg` : "fg.muted"}
                        >
                            {s.icon}
                        </Box>
                        <Box as="span" flex="1" minW="0" truncate>{s.label}</Box>
                    </chakra.button>
                )
            })}
        </Flex>
    )
}
