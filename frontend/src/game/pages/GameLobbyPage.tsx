import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Badge, Box, Button, Flex, HStack, Heading, IconButton, Input, InputGroup, SimpleGrid, Spinner, Text, VStack, VisuallyHidden, chakra } from "@chakra-ui/react"
import { FiLogIn, FiLogOut, FiPlus, FiSearch, FiSettings, FiUsers } from "react-icons/fi"
import type { RoomStatus, RoomSummary, TargetScore } from "@bela/protocol"
import type { CreateGameOptions } from "../components/CreateGameDialog"
import EmptyState from "../../components/EmptyState"
import { MOBILE_TABBAR_CLEARANCE } from "../../components/navChrome"
import { useDocumentHead } from "../../hooks/useDocumentHead"
import { useTranslation } from "../../i18n"
import { showError } from "../../toaster"
import CreateGameDialog from "../components/CreateGameDialog"
import JoinByCodeDialog from "../components/JoinByCodeDialog"
import { MyGameStatsPills, SeatKarmaPill } from "../components/GameStatsPills"
import PlayerAvatar from "../components/PlayerAvatar"
import GameSettingsSheet from "../components/GameSettingsSheet"
import RoomListItem from "../components/RoomListItem"
import { preloadDeck } from "../cards/madjarice/preload"
import { useGamePrefs } from "../hooks/useGamePrefs"
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion"
import { formatCountdown, useHoldCountdown } from "../hooks/useHoldCountdown"
import { useGameSocket } from "../hooks/useGameSocket"
import { useSlowConnection } from "../hooks/useSlowConnection"

/* ──────────────────────────────────────────────────────────────────────────
   GameLobbyPage (/igra) — one header row (player, stats, create, settings),
   a search+filter bar and a grid of public rooms.

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
            borderColor={status === "PLAYING" ? "live" : "brand.400"}
            bg="bg.opaque"
            px="3"
            py="2"
            shadow="md"
        >
            {/* Compact — one row on web, at most two tight rows on a narrow
                phone (2026-09-20, user request). The card used to say "you
                have an active game" twice (a heading AND a badge) with a
                whole sentence underneath repeating it a third time; the
                badge alone now carries that ("Igra u tijeku" / "Čeka
                početak"), and the room name sits right next to it so the
                whole thing reads as one line: [badge] name … [resume]. */}
            <Flex align="center" justify="space-between" gap="2" wrap={{ base: "wrap", md: "nowrap" }}>
                <HStack gap="2" minW="0" flex="1">
                    <Badge size="sm" variant="subtle" colorPalette={status === "PLAYING" ? "green" : "gray"} flexShrink={0}>
                        {t(`game.active.status.${status}`)}
                    </Badge>
                    <Text fontFamily="heading" fontWeight="semibold" minW="0" truncate>{roomName}</Text>
                    {remaining !== null && remaining > 0 && (
                        <Badge size="sm" variant="subtle" colorPalette="orange" flexShrink={0} fontFamily="mono" fontVariantNumeric="tabular-nums">
                            {t("game.active.holdLeft", { time: formatCountdown(remaining) })}
                        </Badge>
                    )}
                </HStack>
                <HStack gap="1.5" flexShrink={0} w={{ base: "full", md: "auto" }}>
                    <Button
                        size="sm"
                        flex={{ base: "1", md: "initial" }}
                        colorPalette="brand"
                        onClick={onResume}
                    >
                        <FiLogIn /> {t("game.active.resume")}
                    </Button>
                    {status !== "PLAYING" && (
                        <IconButton
                            aria-label={t("game.active.leave")}
                            title={t("game.active.leave")}
                            size="sm"
                            variant="ghost"
                            onClick={onLeave}
                        >
                            <FiLogOut />
                        </IconButton>
                    )}
                </HStack>
            </Flex>
        </Box>
    )
}

/* A lobby filter chip (2026-09-21, user request). A real `<button>` with
   `aria-pressed` rather than a Chakra `Badge`/`Tag`: these toggle the list,
   so a screen reader has to be able to say whether they are on. Selected is
   the brand palette's own subtle pair, unselected an outline on `bg.panel`
   — the same treatment the search field next to it gets, so the row reads as
   one control strip. */
function FilterChip({ label, active, ariaLabel, onClick }: {
    label: string
    active: boolean
    ariaLabel?: string
    onClick: () => void
}) {
    return (
        <chakra.button
            type="button"
            aria-pressed={active}
            aria-label={ariaLabel}
            onClick={onClick}
            px="3"
            py="1.5"
            rounded="full"
            flexShrink={0}
            whiteSpace="nowrap"
            fontSize="sm"
            fontWeight="medium"
            cursor="pointer"
            borderWidth="1px"
            bg={active ? "brand.subtle" : "bg.panel"}
            color={active ? "brand.fg" : "fg.muted"}
            borderColor={active ? "brand.emphasized" : "border.emphasized"}
            _hover={{ borderColor: "brand.emphasized" }}
        >
            {label}
        </chakra.button>
    )
}

/** Which target scores get their own filter chip. 163 ("Brza") deliberately
 *  has none — the owner asked for these three (2026-09-21); a quick game is
 *  still found with no target filter on. */
const FILTER_TARGETS: readonly TargetScore[] = [163, 501, 701, 1001]

export default function GameLobbyPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [params] = useSearchParams()
    const mock = import.meta.env.DEV && params.get("mock") === "1"

    const socket = useGameSocket({ lobby: true, mock })
    const [search, setSearch] = useState("")
    /* Client-side filters over the list the socket already pushed — no new
       protocol message, so they cost nothing and survive a `lobby.rooms`
       fan-out. Deliberately NOT persisted: a filter still on from yesterday
       would look like an empty lobby. */
    /* One status at a time: "has a seat" and "being played" exclude each
       other, so two independent toggles could only ever produce an empty
       list. */
    const [statusFilter, setStatusFilter] = useState<"open" | "playing" | null>(null)
    const [publicOnly, setPublicOnly] = useState(false)
    const [targetFilter, setTargetFilter] = useState<TargetScore | null>(null)
    const [createOpen, setCreateOpen] = useState(false)
    const [joinOpen, setJoinOpen] = useState(false)
    const [privateRoom, setPrivateRoom] = useState<RoomSummary | null>(null)
    const [settingsOpen, setSettingsOpen] = useState(false)

    useDocumentHead({ title: t("game.lobby.metaTitle"), description: t("game.lobby.metaDescription") })

    /* Warm the chosen pack here as well as at the table (2026-09-20, user
       request): /igra is where a player spends the seconds before sitting
       down, so the deck can be fetched and decoded at idle instead of
       competing with the first deal. `preloadDeck` is idempotent PER DECK and
       skips the drawn decks entirely, so the table's own call is a no-op and
       switching the setting warms the newly chosen pack. It also hands the
       pack to the service worker for offline play. See
       cards/madjarice/preload.ts. */
    const [gamePrefs] = useGamePrefs()
    useEffect(() => {
        preloadDeck(gamePrefs.deck)
    }, [gamePrefs.deck])

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

    /* WHICH ROOMS ARE NEW. The first list the server sends is the state of the
       world, not news, so nothing in it animates; a room id that shows up in a
       LATER list is a room somebody just opened, and its card slides in
       (`RoomListItem` `entering`). Tracked on the unfiltered list, so typing in
       the search box never makes old rooms "arrive". */
    const knownRoomIds = useRef<Set<string> | null>(null)
    const [enteringIds, setEnteringIds] = useState<ReadonlySet<string>>(() => new Set())
    useEffect(() => {
        const ids = socket.rooms.map((r) => r.id)
        if (knownRoomIds.current === null) {
            // Wait for a real first list: an empty one before the socket
            // answers must not turn the whole lobby into "new rooms".
            if (socket.status !== "open") return
            knownRoomIds.current = new Set(ids)
            return
        }
        const known = knownRoomIds.current
        const fresh = ids.filter((id) => !known.has(id))
        knownRoomIds.current = new Set(ids)
        // From nothing to a full list is the first load arriving late, not
        // eleven rooms opening at once.
        if (fresh.length === 0 || (known.size === 0 && fresh.length > 1)) return
        setEnteringIds(new Set(fresh))
        const timer = window.setTimeout(() => setEnteringIds(new Set()), 700)
        return () => window.clearTimeout(timer)
    }, [socket.rooms, socket.status])

    const systemReducedMotion = usePrefersReducedMotion()
    const reducedMotion = systemReducedMotion || gamePrefs.reduceMotion

    /* Text and chips combine (AND). "Ima mjesta" is `seatsTaken` against the
       four seats the summary always carries, narrowed to LOBBY — a PLAYING
       room with a bot-filled seat is not somewhere you can sit down. Note
       this is the FILTERED list: `enteringIds` above is tracked on
       `socket.rooms` on purpose, so filtering never makes an old room
       "arrive". */
    const rooms = useMemo(() => {
        const q = search.trim().toLowerCase()
        return socket.rooms.filter((r) => {
            if (q && !r.name.toLowerCase().includes(q)) return false
            if (statusFilter === "open" && (r.status !== "LOBBY" || r.seatsTaken >= r.occupants.length)) return false
            if (statusFilter === "playing" && r.status !== "PLAYING") return false
            if (publicOnly && r.private) return false
            if (targetFilter !== null && r.targetScore !== targetFilter) return false
            return true
        })
    }, [socket.rooms, search, statusFilter, publicOnly, targetFilter])

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
        // A running private game that its host opened to spectators can be
        // watched without the code — the server lets that through, and only
        // the waiting room asks for it (owner, 2026-09-21).
        const watchable = room.status === "PLAYING" && room.allowSpectators
        if (room.private && !mine && !watchable) {
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
        <Box maxW="1040px" mx="auto" pb={{ base: `calc(${MOBILE_TABBAR_CLEARANCE} + 96px)`, md: "8" }}>
            <VStack gap="6" align="stretch">
                {/* ONE header row (2026-09-21, user request). The profile row
                    and the big "Igre" title used to be two stacked rows that
                    together ate the top third of a phone screen for a word
                    nobody needed to read — the page is /igra, the room cards
                    say what this is. The heading stays as a visually hidden
                    `<h1>` for the document outline and for SEO.

                    A `Flex` rather than a `Grid`: `MyGameStatsPills` renders
                    nothing until the player has finished a game, and the
                    "Nova igra" button is `display: none` below `md` — neither
                    is a flex item then, so the gap collapses with them and no
                    empty column is left behind. Rendered ONCE for every
                    breakpoint; the phone-only tile row underneath is gone. */}
                <Flex align="center" gap="3" w="full">
                    <HStack gap="3" minW="0" flex="1">
                        <PlayerAvatar name={socket.me?.name} avatarUrl={socket.me?.avatarUrl} avatarPreset={socket.me?.avatarPreset} size="lg" />
                        {/* `truncate` (ellipsis, single line) rather than
                            `lineClamp`: a long name must never push the
                            stats tile or the gear out past the viewport —
                            it is the one thing here with no natural width. */}
                        <Text fontWeight="semibold" fontSize={{ base: "lg", md: "xl" }} minW="0" truncate>{socket.me?.name ?? "…"}</Text>
                        {/* Karma rides beside the name (2026-09-20, user
                            request): alone on its own row under the stat tiles
                            it read as a stray sixth tile. It is a fact about
                            the PLAYER, so it sits with the player. */}
                        <Box flexShrink={0}><SeatKarmaPill karma={socket.me?.karma} /></Box>
                    </HStack>
                    <VisuallyHidden>
                        <Heading as="h1">{t("game.lobby.heading")}</Heading>
                    </VisuallyHidden>
                    <Box flexShrink={0}>
                        <MyGameStatsPills stats={socket.me?.gameStats} variant="row" />
                    </Box>
                    <Button
                        display={{ base: "none", md: "inline-flex" }}
                        flexShrink={0}
                        colorPalette="brand"
                        onClick={() => setCreateOpen(true)}
                        disabled={!connected || blocked}
                    >
                        <FiPlus />{t("game.lobby.newGame")}
                    </Button>
                    <HStack gap="2" flexShrink={0}>
                        <IconButton aria-label={t("game.settings.title")} variant="outline" rounded="full" onClick={() => setSettingsOpen(true)}><FiSettings /></IconButton>
                        {!connected && (
                            <Badge size="sm" variant="subtle" colorPalette="orange">
                                <Spinner size="xs" />
                                {slowConnection ? t("game.connection.slow") : t(`game.connection.${socket.status}`)}
                            </Badge>
                        )}
                    </HStack>
                </Flex>

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
                {/* Search and filters share one strip (2026-09-21, user
                    request). The search box no longer runs the full width —
                    a room name is two words, it never needed 1040px — so the
                    chips sit beside it on md+. On a phone the box takes the
                    first line (`flexBasis: 100%` forces the wrap) and the
                    chips the second, scrolling sideways inside their own
                    container so a fourth chip can never give the PAGE a
                    horizontal scrollbar.

                    The room count badge is gone with it: it counted rooms,
                    not anything a player decides on, and the list below
                    already shows how many there are. */}
                <Flex gap="2" wrap={{ base: "wrap", md: "nowrap" }} align="center" w="full">
                    <InputGroup
                        startElement={<FiSearch />}
                        /* Basis 0 on md+, not `auto` (2026-09-21, reported):
                           InputGroup is `width: 100%`, so `auto` resolved to
                           the whole row and pushed the chips to a second
                           line under a page-wide box. From 0 it only takes
                           what the chips leave, on the same line. */
                        w="auto"
                        flexBasis={{ base: "100%", md: "0" }}
                        flexGrow="1"
                        /* No max width (2026-09-21, reported): capped at 320px
                           the strip ended half way across a desktop page and
                           left a hole beside the chips. The box now takes
                           whatever the chips leave. */
                        minW={{ base: "0", md: "240px" }}
                    >
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
                    <HStack gap="2" minW="0" flexShrink={0} maxW="full" overflowX="auto" py="1" css={{ scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
                        <FilterChip
                            label={t("game.lobby.filter.hasSeats")}
                            active={statusFilter === "open"}
                            onClick={() => setStatusFilter((cur) => (cur === "open" ? null : "open"))}
                        />
                        <FilterChip
                            label={t("game.lobby.playing")}
                            active={statusFilter === "playing"}
                            onClick={() => setStatusFilter((cur) => (cur === "playing" ? null : "playing"))}
                        />
                        <FilterChip
                            label={t("game.lobby.filter.public")}
                            active={publicOnly}
                            onClick={() => setPublicOnly((on) => !on)}
                        />
                        <Box w="1px" h="5" bg="border.emphasized" flexShrink={0} aria-hidden />
                        {FILTER_TARGETS.map((target) => (
                            <FilterChip
                                key={target}
                                /* The number itself is the label — a target
                                   score is not a word to translate. The aria
                                   label is. */
                                label={target === 163 ? t("game.stats.quickLabel") : String(target)}
                                ariaLabel={t("game.lobby.filter.targetAria", { target })}
                                active={targetFilter === target}
                                // Click the selected one again to clear it.
                                onClick={() => setTargetFilter((cur) => (cur === target ? null : target))}
                            />
                        ))}
                    </HStack>
                </Flex>

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
                                entering={enteringIds.has(room.id)}
                                reducedMotion={reducedMotion}
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

            {/* "Nova igra" as a full-width bar on the phone (2026-09-21, user
                request), where it used to be a centred floating pill. A pill
                hanging in the middle of a scrolling list looked like a toast
                that forgot to leave; a bar pinned to the bottom edge reads as
                the page's one action.

                The strip behind it fades the page's own canvas colour up to
                transparent, so room cards scrolling underneath pass out of
                sight instead of clashing with the button. The strip itself is
                `pointerEvents: none` — only the button takes taps, the list
                stays scrollable right up to it.

                `fold-center-action` is gone with the pill: that class only
                re-centres a `left: 50%` element on the front segment of a
                foldable, and there is no centred element here any more. The
                page's own `pb` reserves this bar's height plus the tab-bar
                clearance, so the last card clears it. */}
            <Box
                display={{ base: "block", md: "none" }}
                position="fixed"
                left="0"
                right="0"
                bottom="0"
                zIndex="910"
                px="4"
                pt="8"
                pb={`calc(${MOBILE_TABBAR_CLEARANCE} + 12px)`}
                pointerEvents="none"
                backgroundImage="linear-gradient(to bottom, transparent, var(--chakra-colors-bg-canvas) 45%)"
            >
                <Button
                    w="full"
                    size="lg"
                    rounded="l3"
                    colorPalette="brand"
                    shadow="lg"
                    justifyContent="space-between"
                    pointerEvents="auto"
                    onClick={() => setCreateOpen(true)}
                    disabled={!connected || blocked}
                >
                    {t("game.lobby.newGame")}<FiPlus />
                </Button>
            </Box>

            {createOpen && <CreateGameDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreate={create}
                busy={!connected}
            />}
            <GameSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
            <JoinByCodeDialog open={joinOpen} roomName={privateRoom?.name} error={socket.error}
                onOpenChange={(open) => { setJoinOpen(open); if (!open) setPrivateRoom(null) }} onSubmit={joinByCode} />
        </Box>
    )
}
