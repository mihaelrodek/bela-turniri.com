import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Badge, Box, Button, Grid, HStack, Heading, IconButton, Input, InputGroup, SimpleGrid, Spinner, Text, VStack } from "@chakra-ui/react"
import { FiLogIn, FiPlus, FiSearch, FiSettings, FiUsers } from "react-icons/fi"
import type { RoomStatus, RoomSummary } from "@bela/protocol"
import type { CreateGameOptions } from "../components/CreateGameDialog"
import EmptyState from "../../components/EmptyState"
import { MOBILE_TABBAR_CLEARANCE } from "../../components/navChrome"
import { useDocumentHead } from "../../hooks/useDocumentHead"
import { useTranslation } from "../../i18n"
import { showError } from "../../toaster"
import CreateGameDialog from "../components/CreateGameDialog"
import JoinByCodeDialog from "../components/JoinByCodeDialog"
import PlayerAvatar from "../components/PlayerAvatar"
import GameSettingsSheet from "../components/GameSettingsSheet"
import RoomListItem from "../components/RoomListItem"
import { formatCountdown, useHoldCountdown } from "../hooks/useHoldCountdown"
import { useGameSocket } from "../hooks/useGameSocket"
import { useSlowConnection } from "../hooks/useSlowConnection"

/* ──────────────────────────────────────────────────────────────────────────
   GameLobbyPage (/igra) — player settings, a card-table welcome panel,
   create/join actions and a searchable grid of public rooms.

   The room list is pushed, not polled: `lobby.subscribe` and the server
   re-sends `lobby.rooms` on every change (README §3), so a table filling up
   is visible without a refresh.

   `?mock=1` in dev swaps the socket's transport for the in-browser fake so
   the whole flow — create, sit, add bots, play a deal — works with no server
   running. See `src/game/README.md`.
   ────────────────────────────────────────────────────────────────────── */

/** The lobby's "you have a game running" card, with the live hold countdown. */
function ActiveGameCard({
    roomName,
    status,
    holdUntil,
    onResume,
    onLeave,
}: {
    roomName: string
    status: RoomStatus
    holdUntil: number | null
    onResume: () => void
    onLeave: () => void
}) {
    const { t } = useTranslation()
    const remaining = useHoldCountdown(holdUntil)

    return (
        <Box
            rounded="l3"
            borderWidth="1px"
            borderColor={status === "PLAYING" ? "orange.400" : "brand.400"}
            bg="bg.opaque"
            px="3"
            py="2.5"
            shadow="md"
        >
            <VStack align="stretch" gap="3">
                <HStack gap="2" minW="0" wrap="wrap">
                    <Text fontWeight="semibold">{t("game.active.title")}</Text>
                    <Badge size="sm" variant="subtle" colorPalette={status === "PLAYING" ? "green" : "gray"}>
                        {t(`game.active.status.${status}`)}
                    </Badge>
                    {remaining !== null && remaining > 0 && (
                        <Badge size="sm" variant="subtle" colorPalette="orange">
                            {t("game.active.holdLeft", { time: formatCountdown(remaining) })}
                        </Badge>
                    )}
                </HStack>
                <Text fontSize="sm" color="fg.muted" lineClamp={1}>{roomName}</Text>
                <HStack gap="2" w="full">
                    <Button
                        size="sm"
                        flex="1"
                        minW="0"
                        px={{ base: "2", sm: "3" }}
                        fontSize={{ base: "xs", sm: "sm" }}
                        colorPalette="brand"
                        onClick={onResume}
                    >
                        <FiLogIn /> {t("game.active.resume")}
                    </Button>
                    {status !== "PLAYING" && (
                        <Button
                            size="sm"
                            flex="1"
                            minW="0"
                            px={{ base: "2", sm: "3" }}
                            fontSize={{ base: "xs", sm: "sm" }}
                            variant="outline"
                            onClick={onLeave}
                        >
                            {t("game.active.leave")}
                        </Button>
                    )}
                </HStack>
            </VStack>
            <Text mt="1.5" fontSize="sm" color="fg.muted">
                {t("game.active.description")}
            </Text>
        </Box>
    )
}

export default function GameLobbyPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [params] = useSearchParams()
    const mock = import.meta.env.DEV && params.get("mock") === "1"

    const socket = useGameSocket({ lobby: true, mock })
    const [search, setSearch] = useState("")
    const [createOpen, setCreateOpen] = useState(false)
    const [joinOpen, setJoinOpen] = useState(false)
    const [privateRoom, setPrivateRoom] = useState<RoomSummary | null>(null)
    const [settingsOpen, setSettingsOpen] = useState(false)

    useDocumentHead({ title: t("game.lobby.metaTitle"), description: t("game.lobby.metaDescription") })

    // The server answers `room.create` / `room.joinByCode` with `room.joined`,
    // so the moment a room appears we hand over to the room page — but ONLY
    // when this page asked for it. The connection now outlives these pages
    // (see `../gameConnection.ts`), so `socket.room` can perfectly well be a
    // room we are still a member of while deliberately standing in the lobby;
    // navigating on its mere presence would make /igra impossible to open.
    const wantsRoomRef = useRef(false)
    const joinedId = socket.room?.id ?? null
    useEffect(() => {
        if (!joinedId || !wantsRoomRef.current) return
        wantsRoomRef.current = false
        setJoinOpen(false)
        setPrivateRoom(null)
        navigate(`/igra/soba/${joinedId}${mock ? "?mock=1" : ""}`, { replace: true })
    }, [joinedId, mock, navigate])

    useEffect(() => {
        if (!socket.error) return
        /* A room page may redirect here just as its final `room.left` or a
           failed automatic rejoin reaches the shared connection. When this
           lobby did not initiate an entry, ROOM_NOT_FOUND / NOT_IN_ROOM only
           mean the room we deliberately left has already been cleaned up.
           Showing that expected cleanup as a red error makes a successful
           exit look broken. A failed code join keeps `wantsRoomRef` true and
           therefore still shows its real error. */
        const expectedAfterExit =
            !wantsRoomRef.current &&
            (socket.error.code === "ROOM_NOT_FOUND" || socket.error.code === "NOT_IN_ROOM")
        if (expectedAfterExit) {
            socket.clearError()
            return
        }
        // Schedule the imperative toaster after React has finished this
        // lifecycle. Chakra's toaster flushes synchronously; calling it from
        // inside the effect body produced React's "flushSync inside a
        // lifecycle" warning visible in devtools.
        const error = socket.error
        wantsRoomRef.current = false
        queueMicrotask(() => showError(t(`game.error.${error.code}`), error.message))
        socket.clearError()
    }, [socket, t])

    const rooms = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return socket.rooms
        return socket.rooms.filter((r) => r.name.toLowerCase().includes(q))
    }, [socket.rooms, search])

    const connected = socket.status === "open"
    const slowConnection = useSlowConnection(socket.status)

    const create = (options: CreateGameOptions) => {
        wantsRoomRef.current = true
        socket.send({ t: "room.create", ...options })
        setCreateOpen(false)
    }

    const joinByCode = (code: string) => {
        wantsRoomRef.current = true
        socket.send({ t: "room.joinByCode", code })
    }

    const openRoom = (room: RoomSummary) => {
        const mine = active?.roomId === room.id
        const myWinRate = (socket.me?.gameStats?.global.winRate ?? 0) * 100
        if (!mine && myWinRate < room.minWinRatePercent) {
            showError(t("game.error.WIN_RATE_TOO_LOW", { percent: room.minWinRatePercent }))
            return
        }
        /* "Puna" is the server's own verdict (`RoomSummary.joinable`), not a
           guess from the counts, so the refusal here says exactly what the
           join would say — instead of walking into the room screen to be
           thrown out of it, or worse, parked there as a spectator in a room
           that has none. Our own room is never refused. */
        if (!room.joinable && !mine) {
            showError(t("game.lobby.fullBlocked"))
            return
        }
        if (room.private && !mine) {
            setPrivateRoom(room)
            setJoinOpen(true)
            return
        }
        navigate(`/igra/soba/${room.id}${mock ? "?mock=1" : ""}`)
    }

    /* ONE GAME AT A TIME (game/README.md §3.2). While a room still holds a
       seat for us, opening or joining another one is refused by the server —
       so the buttons that would fire that request are disabled here instead,
       and the card above says how to get out of it (back to the table, or
       leave it). The client is not the boundary: the server refuses the same
       thing whatever this page does. */
    const active = socket.activeSeat
    const blocked = active !== null

    return (
        <Box maxW="1040px" mx="auto" pb={{ base: "32", md: "8" }}>
            <VStack gap="6" align="stretch">
                <Grid templateColumns="minmax(0, 1fr) auto" alignItems="center" columnGap="3" w="full">
                    <HStack gap="2" minW="0">
                        <PlayerAvatar name={socket.me?.name} avatarUrl={socket.me?.avatarUrl} avatarPreset={socket.me?.avatarPreset} size="sm" />
                        <Text fontWeight="medium" lineClamp={1}>{socket.me?.name ?? "…"}</Text>
                    </HStack>
                    <HStack>
                    <IconButton aria-label={t("game.settings.title")} variant="outline" rounded="full" onClick={() => setSettingsOpen(true)}><FiSettings /></IconButton>
                    {!connected && (
                        <Badge size="sm" variant="subtle" colorPalette="orange">
                            <Spinner size="xs" />
                            {slowConnection ? t("game.connection.slow") : t(`game.connection.${socket.status}`)}
                        </Badge>
                    )}
                    </HStack>
                </Grid>

                {socket.me?.guest && <Text fontSize="sm" color="fg.muted">
                    <Link to="/prijava" style={{ fontWeight: 700, color: "var(--chakra-colors-brand-fg)", textDecoration: "underline", textUnderlineOffset: "3px" }}>
                        {t("game.guest.loginInline")}
                    </Link>
                    {" "}{t("game.guest.statsHintSuffix")}
                </Text>}

                {/* "Imaš aktivnu igru" — the server tells us which room still
                    holds a seat for this user (`game.active`), so walking out
                    of a table is recoverable instead of a silent forfeit. */}
                {active && (
                    <ActiveGameCard
                        roomName={active.roomName}
                        status={active.status}
                        holdUntil={active.holdUntil}
                        onResume={() => navigate(`/igra/soba/${active.roomId}${mock ? "?mock=1" : ""}`)}
                        onLeave={() => socket.leaveRoom()}
                    />
                )}
                <Grid templateColumns="minmax(0, 1fr) auto" alignItems="center" columnGap="2" w="full">
                    <Heading textStyle="title">{t("game.lobby.heading")}</Heading>
                    <HStack gap="3">
                        <Button
                            display={{ base: "none", md: "inline-flex" }}
                            colorPalette="brand"
                            onClick={() => setCreateOpen(true)}
                            disabled={!connected || blocked}
                        >
                            <FiPlus />{t("game.lobby.newGame")}
                        </Button>
                        <Badge size="lg" variant="subtle" colorPalette="brand" rounded="full">
                            {socket.rooms.length}
                        </Badge>
                    </HStack>
                </Grid>

                <InputGroup startElement={<FiSearch />}>
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("game.lobby.searchPlaceholder")}
                        aria-label={t("game.lobby.searchAria")}
                        /* Spelled out (2026-09-09, reported): the default
                           border is a hairline that disappears against the
                           light theme's page, and a search field nobody can
                           see the edges of reads as a stray caption. */
                        bg="bg.panel"
                        borderColor="border.emphasized"
                        rounded="lg"
                    />
                </InputGroup>

                {rooms.length === 0 ? (
                    <EmptyState
                        icon={FiUsers}
                        title={t("game.lobby.empty.title")}
                        description={t("game.lobby.empty.description")}
                    />
                ) : (
                    <SimpleGrid className="responsive-room-grid" gap="4">
                        {rooms.map((room) => (
                            <RoomListItem
                                key={room.id}
                                room={room}
                                mine={active?.roomId === room.id}
                                /* Our own room is always open to us; any other
                                   one is closed while we hold a seat. */
                                disabled={blocked && active?.roomId !== room.id}
                                onClick={() => openRoom(room)}
                            />
                        ))}
                    </SimpleGrid>
                )}
            </VStack>

            <Box
                className="fold-center-action"
                display={{ base: "flex", md: "none" }}
                position="fixed"
                left="50%"
                bottom={`calc(${MOBILE_TABBAR_CLEARANCE} + 24px)`}
                transform="translateX(-50%)"
                zIndex="910"
                justifyContent="center"
                pointerEvents="none"
            >
                <Button
                    size="lg"
                    px="6"
                    rounded="l3"
                    colorPalette="brand"
                    shadow="lg"
                    pointerEvents="auto"
                    onClick={() => setCreateOpen(true)}
                    disabled={!connected || blocked}
                >
                    <FiPlus />{t("game.lobby.newGame")}
                </Button>
            </Box>

            {createOpen && <CreateGameDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreate={create}
                busy={!connected}
            />}
            <GameSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
            <JoinByCodeDialog open={joinOpen} roomName={privateRoom?.name}
                onOpenChange={(open) => { setJoinOpen(open); if (!open) setPrivateRoom(null) }} onSubmit={joinByCode} />
        </Box>
    )
}
