import React, { useEffect, useState } from "react"
import {
    Box, Flex, HStack, IconButton, Image, Button, Container, Menu, Text, chakra, useBreakpointValue,
} from "@chakra-ui/react"
import { Link as RouterLink, useMatch, useResolvedPath, useNavigate } from "react-router-dom"
import { useColorModeValue } from "../color-mode"
import { FiHelpCircle, FiLogOut, FiUser } from "react-icons/fi"
import { useAuth } from "../auth/AuthContext"
import { getProfile } from "../api/userMe"
import { InstallAppButton } from "./InstallAppButton"

/**
 * "Pokaži kako" / replay-tour trigger. Dispatches the
 * {@code bela:tour-replay} window event; whichever page is currently
 * mounted listens and re-runs its tour. Pages without a tour ignore
 * the event so the button is safely no-op there.
 *
 * <p>Two visual variants:
 *   - "icon" (default): circular question mark for the desktop top bar
 *   - "labeled": full-width labelled button for the mobile burger drawer,
 *     matching the pattern InstallAppButton uses
 */
function HelpTourButton({ variant = "icon" }: { variant?: "icon" | "labeled" }) {
    function trigger() {
        window.dispatchEvent(new CustomEvent("bela:tour-replay"))
    }
    const label = "Pokaži kako"
    if (variant === "labeled") {
        return (
            <Button
                onClick={trigger}
                size="sm"
                variant="outline"
                colorPalette="blue"
                w="full"
                justifyContent="center"
                gap="2"
            >
                <FiHelpCircle /> {label}
            </Button>
        )
    }
    return (
        <IconButton
            aria-label={label}
            title={label}
            size="sm"
            variant="outline"
            rounded="full"
            colorPalette="blue"
            onClick={trigger}
        >
            <FiHelpCircle />
        </IconButton>
    )
}

function NavButton({
                       to, exact, children, onClick,
                   }: { to: string; exact?: boolean; children: React.ReactNode; onClick?: () => void }) {
    const resolved = useResolvedPath(to)
    const match = useMatch({ path: resolved.pathname, end: !!exact })
    const variant = match ? "solid" : "ghost"

    return (
        <Button asChild variant={variant} colorPalette="blue" size="sm" onClick={onClick}>
            <RouterLink to={to}>{children}</RouterLink>
        </Button>
    )
}

function UserAvatar({
    name,
    email,
    avatarUrl,
}: {
    name?: string | null
    email?: string | null
    avatarUrl?: string | null
}) {
    const source = (name || email || "?").trim()
    const initials =
        source
            .split(/[\s@]+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((s) => s[0]?.toUpperCase())
            .join("") || "?"
    return (
        <Box
            w="28px"
            h="28px"
            rounded="full"
            overflow="hidden"
            bg="blue.subtle"
            color="blue.fg"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontWeight="semibold"
            fontSize="2xs"
        >
            {avatarUrl ? (
                <Image
                    src={avatarUrl}
                    alt={name ?? "Profilna slika"}
                    w="100%"
                    h="100%"
                    objectFit="cover"
                />
            ) : (
                initials
            )}
        </Box>
    )
}

export default function NavBar() {
    const bg = useColorModeValue("white", "gray.800")
    const border = useColorModeValue("gray.200", "gray.700")
    const { user, signOut, loading } = useAuth()
    const navigate = useNavigate()

    /**
     * True when the viewport is below the md breakpoint (Chakra's mobile
     * range). Computed via Chakra's breakpoint hook rather than CSS so we
     * can conditionally apply `data-tour` attributes — only the currently
     * visible variant of the nav (desktop HStack vs. mobile top-bar Flex)
     * gets the anchor. Otherwise Joyride's querySelector would find the
     * hidden desktop nav first on mobile, anchor on a 0×0 element, and
     * the tooltip would render off-screen. {ssr: false} keeps SSR happy
     * by deferring evaluation to the client (the actual desktop SPA build
     * runs in the browser anyway).
     */
    const isMobile = useBreakpointValue({ base: true, md: false }, { ssr: false }) ?? false

    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    useEffect(() => {
        if (!user?.uid) {
            setAvatarUrl(null)
            return
        }
        let cancelled = false
        const refresh = async () => {
            try {
                const p = await getProfile()
                if (!cancelled) setAvatarUrl(p.avatarUrl ?? null)
            } catch {
                /* anonymous / network error */
            }
        }
        refresh()
        const handler = () => refresh()
        window.addEventListener("bela:profile-updated", handler)
        return () => {
            cancelled = true
            window.removeEventListener("bela:profile-updated", handler)
        }
    }, [user?.uid])

    async function onSignOut() {
        try {
            await signOut()
        } finally {
            navigate("/turniri")
        }
    }

    function AuthArea() {
        if (loading) return null
        if (!user) {
            // Single Prijava button — the login page itself has a "Nemaš
            // račun? Registriraj se" link, so showing both buttons in the
            // navbar was redundant noise.
            return (
                <Button asChild size="sm" variant="solid" colorPalette="blue">
                    <RouterLink to="/prijava">Prijava</RouterLink>
                </Button>
            )
        }
        return (
            <Menu.Root>
                <Menu.Trigger asChild>
                    <Button size="sm" variant="ghost">
                        <UserAvatar name={user.displayName} email={user.email} avatarUrl={avatarUrl} />
                        <Box display={{ base: "none", lg: "block" }} fontSize="sm" fontWeight="medium">
                            {user.displayName || user.email}
                        </Box>
                    </Button>
                </Menu.Trigger>
                <Menu.Positioner>
                    <Menu.Content minW="200px">
                        <Box px="3" py="2" borderBottomWidth="1px" borderColor="border.subtle">
                            <Text fontSize="xs" color="fg.muted">Prijavljen kao</Text>
                            <Text fontSize="sm" fontWeight="medium" truncate>
                                {user.email ?? user.displayName ?? "Anonimno"}
                            </Text>
                        </Box>
                        <Menu.Item value="profile" onSelect={() => navigate("/profil")}>
                            <FiUser /> Profil
                        </Menu.Item>
                        <Menu.Item value="logout" onSelect={onSignOut}>
                            <FiLogOut /> Odjavi se
                        </Menu.Item>
                    </Menu.Content>
                </Menu.Positioner>
            </Menu.Root>
        )
    }

    // zIndex must beat Leaflet's internal panes (controls go up to ~800)
    // because Menu.Positioner is rendered inside this sticky header's
    // stacking context — without it the profile dropdown ends up behind
    // the Leaflet map on /karta.
    return (
        <Box as="header" bg={bg} borderBottomWidth="1px" borderColor={border} position="sticky" top={0} zIndex={1000}>
            <Container maxW="6xl" py={3}>
                <Box
                    display={{ base: "none", md: "grid" }}
                    gridTemplateColumns="1fr auto 1fr"
                    alignItems="center"
                    gap={3}
                >
                    <Box>
                        {/* Brand mark — rendered as a plain link, NOT a Button.
                            We don't want the ghost-button hover/active background
                            washing across the logo when the mouse passes over.
                            The chakra factory call gives us style props on a
                            real <a>; visited/focus/active styles are reset to
                            keep it visually quiet, while the link still
                            navigates and shows a keyboard focus ring. */}
                        <chakra.a
                            asChild
                            display="inline-flex"
                            alignItems="center"
                            gap="2"
                            color="fg"
                            fontWeight="semibold"
                            textDecoration="none"
                            _hover={{ textDecoration: "none", color: "fg" }}
                            _active={{ color: "fg" }}
                            _focusVisible={{ outline: "2px solid", outlineColor: "blue.solid", outlineOffset: "2px", borderRadius: "md" }}
                        >
                            <RouterLink
                                to="/turniri"
                                aria-label="Bela Turniri — naslovnica"
                            >
                                <Image
                                    src="/bela-turniri-symbol.svg"
                                    alt=""
                                    h={{ base: "32px", md: "40px" }}
                                    w="auto"
                                    draggable={false}
                                />
                                <Box
                                    as="span"
                                    display={{ base: "none", sm: "inline" }}
                                    fontWeight="semibold"
                                >
                                    Bela Turniri
                                </Box>
                            </RouterLink>
                        </chakra.a>
                    </Box>

                    <HStack
                        data-tour={isMobile ? undefined : "nav-items"}
                        gap={2}
                        justify="center"
                    >
                        <NavButton to="/turniri" exact>
                            Turniri
                        </NavButton>
                        <NavButton to="/kalendar">Kalendar</NavButton>
                        <NavButton to="/turniri/novi">Kreiraj turnir</NavButton>
                        <NavButton to="/karta">Karta</NavButton>
                        <NavButton to="/pronadi-para">Pronađi para</NavButton>
                    </HStack>

                    <HStack
                        data-tour={isMobile ? undefined : "nav-auth"}
                        justify="end"
                        gap="1.5"
                    >
                        <AuthArea />
                        {/* Help-replay button + install icon live in this
                            sub-HStack so the guided tour's "Pomoć i
                            instalacija" step has a tight anchor covering
                            just these two affordances (not the entire
                            nav-auth row, which also includes the auth
                            button and would make the spotlight oversized). */}
                        <HStack
                            data-tour={isMobile ? undefined : "help-install"}
                            gap="1.5"
                        >
                            <HelpTourButton />
                            {/* Conditional install icon — renders nothing on
                                browsers that can't install or already have.
                                Theme toggle moved to profile → Postavke tab
                                so the choice is persisted per-user. */}
                            <InstallAppButton size="sm" />
                        </HStack>
                    </HStack>
                </Box>

                {/* ====================== Mobile top bar ======================
                    Day-to-day navigation lives in the fixed bottom tab bar
                    (MobileTabBar) — Turniri / Kalendar / Kreiraj / Karta /
                    Profil are one tap away there. The hamburger drawer that
                    used to host those links has been removed entirely. What
                    stays in the top bar:

                      - Brand mark (logo + "Bela Turniri") on the left
                      - Auth control (avatar menu or Prijava) on the right
                      - Help-replay + Install affordances next to it

                    The `data-tour` anchors are kept so the guided tour can
                    still spotlight nav-auth + help-install on mobile. The
                    nav-items anchor moved to the bottom tab bar itself. */}
                <Flex display={{ base: "flex", md: "none" }} align="center" gap="1">
                    <chakra.a
                        asChild
                        display="inline-flex"
                        alignItems="center"
                        gap="1.5"
                        color="fg"
                        fontWeight="semibold"
                        textDecoration="none"
                        _hover={{ textDecoration: "none", color: "fg" }}
                        _active={{ color: "fg" }}
                        _focusVisible={{ outline: "2px solid", outlineColor: "blue.solid", outlineOffset: "2px", borderRadius: "md" }}
                    >
                        <RouterLink
                            to="/turniri"
                            aria-label="Bela Turniri — naslovnica"
                        >
                            <Image
                                src="/bela-turniri-symbol.svg"
                                alt=""
                                h="32px"
                                w="auto"
                                draggable={false}
                            />
                            <Box as="span" fontWeight="semibold">Bela Turniri</Box>
                        </RouterLink>
                    </chakra.a>
                    <Box flex="1" />
                    <Box data-tour={isMobile ? "nav-auth" : undefined}>
                        {!loading && user && (
                            <Menu.Root>
                                <Menu.Trigger asChild>
                                    <Button
                                        aria-label="Profil meni"
                                        size="sm"
                                        variant="ghost"
                                        px={1}
                                    >
                                        <UserAvatar name={user.displayName} email={user.email} avatarUrl={avatarUrl} />
                                    </Button>
                                </Menu.Trigger>
                                <Menu.Positioner>
                                    <Menu.Content minW="220px">
                                        <Box px="3" py="2" borderBottomWidth="1px" borderColor="border.subtle">
                                            <Text fontSize="xs" color="fg.muted">Prijavljen kao</Text>
                                            <Text fontSize="sm" fontWeight="medium" truncate>
                                                {user.email ?? user.displayName ?? "Anonimno"}
                                            </Text>
                                        </Box>
                                        <Menu.Item value="profile" onSelect={() => navigate("/profil")}>
                                            <FiUser /> Profil
                                        </Menu.Item>
                                        <Menu.Item value="logout" onSelect={onSignOut}>
                                            <FiLogOut /> Odjavi se
                                        </Menu.Item>
                                    </Menu.Content>
                                </Menu.Positioner>
                            </Menu.Root>
                        )}
                        {!loading && !user && (
                            <Button asChild size="sm" variant="solid" colorPalette="blue">
                                <RouterLink to="/prijava">Prijava</RouterLink>
                            </Button>
                        )}
                    </Box>
                    {/* Help-replay + install icon — same pair as the desktop
                        sub-HStack so the guided tour's "Pomoć i instalacija"
                        step has a consistent anchor across breakpoints. */}
                    <HStack
                        data-tour={isMobile ? "help-install" : undefined}
                        gap="1"
                    >
                        <HelpTourButton />
                        <InstallAppButton size="sm" />
                    </HStack>
                </Flex>
            </Container>
        </Box>
    )
}
