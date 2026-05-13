import React, { useEffect, useState } from "react"
import {
    Box, Flex, HStack, IconButton, Image, Button, Stack, Container, Menu, Text, chakra, useDisclosure,
} from "@chakra-ui/react"
import { Link as RouterLink, useMatch, useResolvedPath, useNavigate } from "react-router-dom"
import { useColorModeValue } from "../color-mode"
import { FiLogOut, FiMenu, FiUser, FiX } from "react-icons/fi"
import { useAuth } from "../auth/AuthContext"
import { getProfile } from "../api/userMe"
import { InstallAppButton } from "./InstallAppButton"

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
    const { open, onOpen, onClose } = useDisclosure()
    const bg = useColorModeValue("white", "gray.800")
    const border = useColorModeValue("gray.200", "gray.700")
    const { user, signOut, loading } = useAuth()
    const navigate = useNavigate()

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

                    <HStack gap={2} justify="center">
                        <NavButton to="/turniri" exact>
                            Turniri
                        </NavButton>
                        <NavButton to="/kalendar">Kalendar</NavButton>
                        <NavButton to="/turniri/novi">Kreiraj turnir</NavButton>
                        <NavButton to="/karta">Karta</NavButton>
                        <NavButton to="/pronadi-para">Pronađi para</NavButton>
                    </HStack>

                    <HStack justify="end" gap="1.5">
                        <AuthArea />
                        {/* Conditional install icon — renders nothing on
                            browsers that can't install or already have.
                            Theme toggle moved to profile → Postavke tab
                            so the choice is persisted per-user. */}
                        <InstallAppButton size="sm" />
                    </HStack>
                </Box>

                <Flex display={{ base: "flex", md: "none" }} align="center">
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
                    {!loading && user && (
                        <Menu.Root>
                            <Menu.Trigger asChild>
                                <Button
                                    aria-label="Profil meni"
                                    size="sm"
                                    variant="ghost"
                                    mr={1}
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
                    {/* Inline Prijava for anonymous mobile users — previously
                        only reachable via the hamburger drawer. Showing it in
                        the top bar means a one-tap sign-in path without
                        having to discover the menu first. Hidden when the
                        user is already logged in (the avatar menu replaces
                        it above). */}
                    {!loading && !user && (
                        <Button asChild size="sm" variant="solid" colorPalette="blue" mr={1}>
                            <RouterLink to="/prijava">Prijava</RouterLink>
                        </Button>
                    )}
                    {/* Install button moved inside the burger drawer below
                        so the top bar stays clean on mobile. Theme toggle
                        lives in profile → Postavke (per-user). */}
                    <IconButton
                        onClick={open ? onClose : onOpen}
                        aria-label={open ? "Close menu" : "Open menu"}
                        variant="ghost"
                        size="sm"
                    >
                        {open ? <FiX /> : <FiMenu />}
                    </IconButton>
                </Flex>

                {open && (
                    <Box pt={3} pb={2} display={{ md: "none" }}>
                        <Stack gap={2} onClick={onClose}>
                            <NavButton to="/turniri" exact>
                                Turniri
                            </NavButton>
                            <NavButton to="/kalendar">Kalendar</NavButton>
                            <NavButton to="/turniri/novi">Kreiraj turnir</NavButton>
                            <NavButton to="/karta">Karta</NavButton>
                            <NavButton to="/pronadi-para">Pronađi para</NavButton>

                            {/* "Install app" lives here as a labeled
                                button — only renders when installation is
                                actually possible, otherwise null. Click
                                propagates up to the Stack's onClick={onClose}
                                so the drawer closes (the labeled variant
                                fires the install or opens the iOS-steps
                                dialog first, which is what we want). */}
                            <InstallAppButton size="sm" variant="labeled" />

                            {/* Prijava is now permanently visible in the mobile
                                top bar next to the burger — no need to
                                duplicate it inside the drawer. */}
                        </Stack>
                    </Box>
                )}
            </Container>
        </Box>
    )
}
