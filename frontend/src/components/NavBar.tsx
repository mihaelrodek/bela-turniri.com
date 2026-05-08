import React from "react"
import {
    Box, Flex, HStack, IconButton, Button, Stack, Container, Menu, Text, useDisclosure,
} from "@chakra-ui/react"
import { Link as RouterLink, useMatch, useResolvedPath, useNavigate } from "react-router-dom"
// adjust the import path to wherever you put the v3 color-mode helpers
import { useColorMode, useColorModeValue } from "../color-mode"
import { FiLogOut, FiMenu, FiMoon, FiSun, FiUser, FiX } from "react-icons/fi"
import { useAuth } from "../auth/AuthContext"

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

/** Compact user avatar — initials from displayName, email, or fallback. */
function UserAvatar({ name, email }: { name?: string | null; email?: string | null }) {
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
            bg="blue.subtle"
            color="blue.fg"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontWeight="semibold"
            fontSize="2xs"
        >
            {initials}
        </Box>
    )
}

export default function NavBar() {
    const { open, onOpen, onClose } = useDisclosure()
    const { colorMode, toggleColorMode } = useColorMode()
    const bg = useColorModeValue("white", "gray.800")
    const border = useColorModeValue("gray.200", "gray.700")
    const { user, signOut, loading } = useAuth()
    const navigate = useNavigate()

    async function onSignOut() {
        try {
            await signOut()
        } finally {
            navigate("/tournaments")
        }
    }

    function AuthArea() {
        if (loading) return null
        if (!user) {
            return (
                <HStack gap="1.5">
                    <Button asChild size="sm" variant="ghost">
                        <RouterLink to="/login">Prijava</RouterLink>
                    </Button>
                    <Button asChild size="sm" variant="solid" colorPalette="blue">
                        <RouterLink to="/register">Registracija</RouterLink>
                    </Button>
                </HStack>
            )
        }
        return (
            <Menu.Root>
                <Menu.Trigger asChild>
                    <Button size="sm" variant="ghost">
                        <UserAvatar name={user.displayName} email={user.email} />
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
                        <Menu.Item value="profile" onSelect={() => navigate("/profile")}>
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

    return (
        <Box as="header" bg={bg} borderBottomWidth="1px" borderColor={border} position="sticky" top={0} zIndex={10}>
            <Container maxW="6xl" py={3}>
                {/* Desktop: 3-column grid: brand (left) | nav (centered) | auth + theme (right) */}
                <Box
                    display={{ base: "none", md: "grid" }}
                    gridTemplateColumns="1fr auto 1fr"
                    alignItems="center"
                    gap={3}
                >
                    <Box>
                        <Button asChild variant="ghost" size="sm" fontWeight="semibold">
                            <RouterLink to="/tournaments">Bela Turniri</RouterLink>
                        </Button>
                    </Box>

                    <HStack gap={2} justify="center">
                        <NavButton to="/tournaments" exact>
                            Turniri
                        </NavButton>
                        <NavButton to="/calendar">Kalendar</NavButton>
                        <NavButton to="/map">Karta</NavButton>
                        {/* Always show "Kreiraj turnir". The route is wrapped in
                            <RequireAuth>, so anonymous clicks bounce to /login and
                            then back to /tournaments/new after a successful sign-in. */}
                        <NavButton to="/tournaments/new">Kreiraj turnir</NavButton>
                        <NavButton to="/find-pair">Pronađi para</NavButton>
                    </HStack>

                    <HStack justify="end" gap="1.5">
                        <AuthArea />
                        <IconButton
                            aria-label="Toggle color mode"
                            onClick={toggleColorMode}
                            size="sm"
                            variant="ghost"
                        >
                            {colorMode === "light" ? <FiMoon /> : <FiSun />}
                        </IconButton>
                    </HStack>
                </Box>

                {/* Mobile bar */}
                <Flex display={{ base: "flex", md: "none" }} align="center">
                    <Button asChild variant="ghost" size="sm" fontWeight="semibold">
                        <RouterLink to="/tournaments">Bela Turniri</RouterLink>
                    </Button>
                    <Box flex="1" />
                    {!loading && user && (
                        <Box mr={1}>
                            <UserAvatar name={user.displayName} email={user.email} />
                        </Box>
                    )}
                    <IconButton
                        aria-label="Toggle color mode"
                        onClick={toggleColorMode}
                        size="sm"
                        variant="ghost"
                        mr={1}
                    >
                        {colorMode === "light" ? <FiMoon /> : <FiSun />}
                    </IconButton>
                    <IconButton
                        onClick={open ? onClose : onOpen}
                        aria-label={open ? "Close menu" : "Open menu"}
                        variant="ghost"
                        size="sm"
                    >
                        {open ? <FiX /> : <FiMenu />}
                    </IconButton>
                </Flex>

                {/* Mobile menu */}
                {open && (
                    <Box pt={3} pb={2} display={{ md: "none" }}>
                        <Stack gap={2} onClick={onClose}>
                            <NavButton to="/tournaments" exact>
                                Turniri
                            </NavButton>
                            <NavButton to="/calendar">Kalendar</NavButton>
                            <NavButton to="/map">Karta</NavButton>
                            <NavButton to="/tournaments/new">Kreiraj turnir</NavButton>
                            <NavButton to="/find-pair">Pronađi para</NavButton>

                            {!loading && (
                                user ? (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={onSignOut}
                                    >
                                        <FiLogOut /> Odjavi se ({user.email ?? user.displayName ?? ""})
                                    </Button>
                                ) : (
                                    <>
                                        <NavButton to="/login">
                                            <Box as="span" display="inline-flex" alignItems="center" gap="2">
                                                <FiUser /> Prijava
                                            </Box>
                                        </NavButton>
                                        <NavButton to="/register">Registracija</NavButton>
                                    </>
                                )
                            )}
                        </Stack>
                    </Box>
                )}
            </Container>
        </Box>
    )
}
