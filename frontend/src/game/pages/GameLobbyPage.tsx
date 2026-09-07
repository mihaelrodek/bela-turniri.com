import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Badge, Box, Button, HStack, Heading, Input, InputGroup, Text, VStack } from "@chakra-ui/react"
import { FiPlus, FiSearch, FiUsers } from "react-icons/fi"
import type { TargetScore } from "@bela/protocol"
import EmptyState from "../../components/EmptyState"
import { useDocumentHead } from "../../hooks/useDocumentHead"
import { useTranslation } from "../../i18n"
import { showError } from "../../toaster"
import CreateGameDialog from "../components/CreateGameDialog"
import JoinByCodeDialog from "../components/JoinByCodeDialog"
import PlayerAvatar from "../components/PlayerAvatar"
import RoomListItem from "../components/RoomListItem"
import { useGameSocket } from "../hooks/useGameSocket"

/* ──────────────────────────────────────────────────────────────────────────
   GameLobbyPage (/igra) — mirrors bela.fun's "Postojeće igre" screen
   (game/DESIGN.md §1 "Lobby", §2.9): my avatar up top, a search box, a list
   of room cards, and a fixed bottom CTA to start or join a game.

   The room list is pushed, not polled: `lobby.subscribe` and the server
   re-sends `lobby.rooms` on every change (README §3), so a table filling up
   is visible without a refresh.

   `?mock=1` in dev swaps the socket's transport for the in-browser fake so
   the whole flow — create, sit, add bots, play a deal — works with no server
   running. See `src/game/README.md`.
   ────────────────────────────────────────────────────────────────────── */

export default function GameLobbyPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [params] = useSearchParams()
    const mock = import.meta.env.DEV && params.get("mock") === "1"

    const socket = useGameSocket({ lobby: true, mock })
    const [search, setSearch] = useState("")
    const [createOpen, setCreateOpen] = useState(false)
    const [joinOpen, setJoinOpen] = useState(false)

    useDocumentHead({ title: t("game.lobby.metaTitle"), description: t("game.lobby.metaDescription") })

    // The server answers `room.create` / `room.joinByCode` with `room.joined`,
    // so the moment a room appears on this connection we hand over to the
    // room page.
    const joinedId = socket.room?.id ?? null
    useEffect(() => {
        if (!joinedId) return
        navigate(`/igra/soba/${joinedId}${mock ? "?mock=1" : ""}`, { replace: true })
    }, [joinedId, mock, navigate])

    useEffect(() => {
        if (!socket.error) return
        showError(t(`game.error.${socket.error.code}`))
        socket.clearError()
    }, [socket, t])

    const rooms = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return socket.rooms
        return socket.rooms.filter((r) => r.name.toLowerCase().includes(q))
    }, [socket.rooms, search])

    const connected = socket.status === "open"

    const create = (targetScore: TargetScore, isPrivate: boolean) => {
        socket.send({ t: "room.create", targetScore, private: isPrivate })
        setCreateOpen(false)
    }

    const joinByCode = (code: string) => {
        socket.send({ t: "room.joinByCode", code })
        setJoinOpen(false)
    }

    return (
        <Box maxW="720px" mx="auto" pb={{ base: "150px", md: "120px" }}>
            <VStack gap="4" align="stretch">
                <HStack justify="space-between" gap="3">
                    <HStack gap="2" minW="0">
                        <PlayerAvatar name={socket.me?.name} avatarUrl={socket.me?.avatarUrl} size="sm" />
                        <Text fontWeight="medium" lineClamp={1}>{socket.me?.name ?? "…"}</Text>
                    </HStack>
                    {!connected && (
                        <Badge size="sm" variant="subtle" colorPalette="orange">
                            {t(`game.connection.${socket.status}`)}
                        </Badge>
                    )}
                </HStack>

                <HStack justify="space-between" gap="2">
                    <Heading textStyle="title">{t("game.lobby.heading")}</Heading>
                    <Badge size="lg" variant="subtle" colorPalette="brand" rounded="full">
                        {socket.rooms.length}
                    </Badge>
                </HStack>

                <InputGroup startElement={<FiSearch />}>
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("game.lobby.searchPlaceholder")}
                        aria-label={t("game.lobby.searchAria")}
                    />
                </InputGroup>

                {rooms.length === 0 ? (
                    <EmptyState
                        icon={FiUsers}
                        title={t("game.lobby.empty.title")}
                        description={t("game.lobby.empty.description")}
                    />
                ) : (
                    <VStack gap="2" align="stretch">
                        {rooms.map((room) => (
                            <RoomListItem
                                key={room.id}
                                room={room}
                                onClick={() => navigate(`/igra/soba/${room.id}${mock ? "?mock=1" : ""}`)}
                            />
                        ))}
                    </VStack>
                )}
            </VStack>

            <Box
                position="fixed"
                left="0"
                right="0"
                bottom="0"
                zIndex={1100}
                bg="bg.panel"
                borderTopWidth="1px"
                borderColor="border.subtle"
                pt="3"
                px="4"
                style={{ paddingBottom: "calc(var(--chakra-spacing-3) + env(safe-area-inset-bottom, 0px))" }}
            >
                <VStack maxW="720px" mx="auto" gap="2" align="stretch">
                    <Button variant="outline" onClick={() => setJoinOpen(true)} disabled={!connected}>
                        {t("game.lobby.joinByCode")}
                    </Button>
                    <Button
                        size="lg"
                        colorPalette="brand"
                        onClick={() => setCreateOpen(true)}
                        disabled={!connected}
                    >
                        <FiPlus /> {t("game.lobby.newGame")}
                    </Button>
                </VStack>
            </Box>

            <CreateGameDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreate={create}
                busy={!connected}
            />
            <JoinByCodeDialog open={joinOpen} onOpenChange={setJoinOpen} onSubmit={joinByCode} />
        </Box>
    )
}
