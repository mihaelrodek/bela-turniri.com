import { Badge, Box, Button, Flex, HStack, Heading, IconButton, Stack, Text, VStack } from "@chakra-ui/react"
import { FiAward, FiCopy, FiEye, FiEyeOff, FiFileText, FiFlag, FiGlobe, FiLogOut, FiPlay, FiPlus, FiSettings, FiTarget, FiUsers, FiX } from "react-icons/fi"
import type { RoomState, Seat as SeatId } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import { CardsIcon } from "../../components/MobileTabBar"
import { showError, showSuccess } from "../../toaster"
import { teamOf } from "../util/seats"
import { botAvatarPreset } from "../util/botAvatar"
import { TEAM } from "./tableStyles"
import PlayerAvatar from "./PlayerAvatar"
import GameOption from "./GameOption"
import { SeatStatPill } from "./GameStatsPills"

export default function RoomPanel({ room, mySeat, myUid, disabled = false, onSit, onAddBot,
    onRemoveBot, onReady, onStart, onLeave, onPrivacyChange, onSettings }: {
    room: RoomState
    mySeat: SeatId | null
    myUid: string | null
    disabled?: boolean
    /**
     * Take a specific seat. The server auto-seats every joiner into the first
     * free seat (game/README.md §3.2), so being seatless at a table that still
     * has room should not happen — but if it ever does, the panel offers the
     * chair instead of announcing that the room is full.
     */
    onSit?: (seat: SeatId) => void
    onAddBot: (seat: SeatId) => void
    onRemoveBot: (seat: SeatId) => void
    onReady: (ready: boolean) => void
    onStart: () => void
    onLeave: () => void
    onPrivacyChange: (value: boolean) => void
    onSettings: () => void
}) {
    const { t } = useTranslation()
    // Seating is collaborative: anyone currently in the room may fill an
    // empty chair with a bot or clear a bot before the game starts. The server
    // enforces the same membership-and-lobby guard. Privacy and starting are
    // open to every SEATED player (2026-09-20); only the rules in the settings
    // sheet remain the host's.
    const canManageBots = myUid !== null
    const mine = mySeat === null ? null : room.seats[mySeat].occupant
    const ready = mine?.kind === "PLAYER" && mine.ready
    const humans = room.seats.filter((s) => s.occupant?.kind === "PLAYER")
    const allReady = humans.length > 0 && humans.every((s) => s.occupant?.kind === "PLAYER" && s.occupant.ready)
    const freeSeats = ([0, 1, 2, 3] as SeatId[]).filter((s) => room.seats[s].occupant === null)
    const tableFull = freeSeats.length === 0
    const canStart = tableFull && allReady
    /* THE SEATING MAP IS THE SAME ON EVERY SCREEN — anchored to the host, not
       to the viewer (game/README.md §3.3).

       It used to be viewer-relative: the left column was labelled "MI" and
       held whichever pair you happened to be in, so the same table looked
       mirrored to the two people sitting at it and "sjedni lijevo od mene"
       meant two different chairs. Now the host's pair is always the left
       column, so someone who sits in the OTHER pair sees themselves on the
       right — exactly as everyone else sees them.

       Teams are absolute on the wire already (A = seats 0+2, B = 1+3); only
       this panel was re-labelling them. The host is seat 0 in practice, but
       `room.sit` lets him move, so the column order follows `hostUid` rather
       than assuming it. The MI/ONI headings and the "1/2" counters are gone
       with the relabelling: the chairs show who is there, and a counter over
       an empty chair only turned a missing player into a statistic. */
    const hostSeat = ([0, 1, 2, 3] as SeatId[]).find((s) => {
        const o = room.seats[s].occupant
        return o?.kind === "PLAYER" && o.user.uid === room.hostUid
    })
    const hostTeam = hostSeat === undefined ? "A" : teamOf(hostSeat)
    const teams: [SeatId[], SeatId[]] = hostTeam === "A" ? [[0, 2], [1, 3]] : [[1, 3], [0, 2]]
    const copyCode = async () => {
        try { await navigator.clipboard.writeText(room.code); showSuccess(t("game.room.codeCopied")) }
        catch { showError(t("game.room.codeCopyFailed"), room.code) }
    }
    const roomFacts = [
        { key: "target", icon: <FiTarget />, label: t("game.lobby.target", { target: room.targetScore }) },
        { key: "finish", icon: <FiFlag />, label: t(`game.lobby.finishMode.${room.gameEndRule}`) },
        { key: "declarations", icon: <FiFileText />, label: t(room.noDeclarations ? "game.rules.noDeclarations" : "game.rules.withDeclarations") },
        ...(room.noDeclarations
            ? [{ key: "bela", icon: <CardsIcon size={15} />, label: t(room.allowBela ? "game.rules.allowBela" : "game.rules.noBela") }]
            : []),
        {
            key: "tricks",
            icon: room.trickReview === "off" ? <FiEyeOff /> : <FiEye />,
            label: t(`game.rules.trickReviewBadge.${room.trickReview}`),
        },
        ...(room.minWinRatePercent > 0
            ? [{ key: "win-rate", icon: <FiAward />, label: t("game.room.minWinRate", { percent: room.minWinRatePercent }) }]
            : []),
        { key: "spectators", icon: <FiUsers />, label: t(room.allowSpectators ? "game.room.spectatorsAllowed" : "game.room.spectatorsDisabled") },
    ]

    return (
        <VStack gap={{ base: "1.5", md: "3" }} align="stretch" p={{ base: "1.5", md: "4" }} pt={{ base: "0", md: "1" }} flex="1" minH="0">
            {/* No `pr="8"` any more: that gutter existed only to keep the
                title clear of the absolutely-positioned chat toggle, and the
                chat is gone (2026-09-09). Without it the settings and exit
                icons reach the panel's own right edge. */}
            <Box
                bg="bg.panel"
                borderWidth="1px"
                borderColor="border.subtle"
                rounded="2xl"
                p={{ base: "2", md: "3" }}
                shadow="sm"
            >
                <HStack justify="space-between" gap="3" align="start">
                    <Box minW="0">
                        <Heading fontSize={{ base: "lg", md: "xl" }} lineHeight="short" overflowWrap="anywhere">
                            {room.name}
                        </Heading>
                    </Box>
                    <HStack gap="1" flexShrink={0}>
                        <IconButton size="sm" rounded="full" aria-label={t("game.settings.title")} onClick={onSettings} variant="subtle" colorPalette="brand"><FiSettings /></IconButton>
                        <IconButton size="sm" rounded="full" aria-label={t("game.room.leaveAria")} onClick={onLeave} variant="ghost"><FiLogOut /></IconButton>
                    </HStack>
                </HStack>
                {/* One wrapping row of compact chips (2026-09-20, user
                    request): the previous 2-column grid of tall tiles plus a
                    separate visibility row ate ~200px of a phone screen for
                    facts nobody needed to read as a table. Chips wrap as
                    needed and the public/private badge sits in the same
                    flow — same information, a fraction of the height. */}
                <Flex wrap="wrap" gap="1.5" mt="2">
                    {roomFacts.map((fact) => (
                        <HStack key={fact.key} gap="1" flexShrink={0} h="26px" px="2"
                            rounded="full" bg="bg.subtle" borderWidth="1px" borderColor="border.subtle">
                            <Box color="brand.500" flexShrink={0} fontSize="xs" display="flex">{fact.icon}</Box>
                            <Text fontSize="2xs" fontWeight="semibold" whiteSpace="nowrap">
                                {fact.label}
                            </Text>
                        </HStack>
                    ))}
                </Flex>
                {/* Visibility on its own row (2026-09-20, user request): it is
                    the one chip that is an ACTION when private (copy the
                    code), and in the rules' flow it read as one more rule. */}
                <Flex mt="1.5">
                    {room.private ? (
                        <Button size="xs" h="26px" minH="0" px="2" rounded="full" variant="subtle" colorPalette="brand"
                            fontVariantNumeric="tabular-nums" flexShrink={0} onClick={copyCode}>
                            <FiCopy /> {t("game.room.codeLabel", { code: room.code })}
                        </Button>
                    ) : (
                        <Badge h="26px" display="inline-flex" alignItems="center" gap="1" rounded="full" px="2" flexShrink={0} variant="subtle" colorPalette="gray">
                            <FiGlobe /> {t("game.room.public")}
                        </Badge>
                    )}
                </Flex>
            </Box>

            {/* "Sva su mjesta zauzeta" may only be said when they ACTUALLY
                are. This banner once appeared for every seatless member — at a
                table with three empty chairs and no way to take one. */}
            {mySeat === null && myUid !== null && freeSeats.length === 0 && (
                <Box p="2.5" rounded="lg" bg="bg.subtle" borderWidth="1px" borderColor="border.subtle">
                    <Text fontSize="sm" color="fg.muted">{t("game.room.spectatingFull")}</Text>
                </Box>
            )}

            {/* Centred in what is left (2026-09-09, user request): with the
                controls pinned to the floor, the seats sat hard against the
                chips and the whole empty half of the screen was between them
                and the buttons. `my="auto"` splits that space above and below,
                which puts the four chairs where the eye lands. */}
            <Stack my="auto" gap={{ base: "2", md: "3" }}>
                {teams.map((seats, index) => (
                    /* No card, no heading: the pair is grouped by a thin
                       team-coloured rail on each chair (2026-09-20, user
                       request) instead of a bordered/padded wrapper around
                       both chairs — that doubled padding (card padding +
                       row padding) was the single biggest height cost on a
                       phone. The gap between the two team stacks is wider
                       than the gap within one, so the grouping still reads
                       at a glance. */
                    <VStack key={index} align="stretch" gap={{ base: "1", md: "1.5" }}
                        role="group" aria-label={t("game.room.pairAria", { n: index + 1 })}>
                        {seats.map((seat) => {
                            const occupant = room.seats[seat].occupant
                            return (
                                <HStack key={seat} justify="space-between" align="center" gap={{ base: "1.5", md: "2" }} p={{ base: "1.25", md: "1.5" }}
                                    pe={{ base: "2", md: "2.5" }}
                                    rounded="lg" bg="bg.subtle" minH={{ base: "44px", md: "60px" }}
                                    borderInlineStartWidth="3px" borderInlineStartColor={index === 0 ? TEAM.us : TEAM.them}>
                                    <HStack gap={{ base: "1.5", md: "2" }} minW="0">
                                        <PlayerAvatar size="sm" empty={!occupant} emptyIcon={<CardsIcon size={17} />} name={occupant?.kind === "PLAYER" ? occupant.user.name : occupant?.name}
                                            avatarUrl={occupant?.kind === "PLAYER" ? occupant.user.avatarUrl : undefined}
                                            avatarPreset={occupant?.kind === "PLAYER"
                                                ? occupant.user.avatarPreset
                                                : occupant?.kind === "BOT"
                                                    ? occupant.avatarPreset ?? botAvatarPreset(occupant.name)
                                                    : undefined} />
                                        <VStack flex="1" align="start" gap="0" minW="0">
                                            <Text fontSize="sm" fontWeight="semibold" lineClamp={1}>
                                                {occupant?.kind === "PLAYER" ? occupant.user.name : occupant?.name ?? t("game.room.waitingSeat")}
                                            </Text>
                                            {/* Bots already say "Bot" in their name (e.g. "Bot Mate") — a
                                                repeated subtitle just burns a line; only players need a
                                                connection/ready subtitle. */}
                                            {occupant?.kind === "PLAYER" && <Text fontSize="xs" color={occupant.ready ? "brand.500" : "fg.muted"}>
                                                {occupant.connected ? (occupant.ready ? t("game.room.ready") : t("game.room.waitingReady")) : t("game.seat.disconnected")}
                                            </Text>}
                                        </VStack>
                                    </HStack>
                                    {occupant?.kind === "PLAYER" && occupant.user.gameStats && (
                                        <Box ms="auto" flexShrink={0}>
                                            <SeatStatPill stats={occupant.user.gameStats} />
                                        </Box>
                                    )}
                                    <HStack justify="end" gap="2">
                                        {!occupant && mySeat === null && onSit && (
                                            <Button size="xs" colorPalette="brand" disabled={disabled} onClick={() => onSit(seat)}>
                                                {t("game.room.sitHere")}
                                            </Button>
                                        )}
                                        {!occupant && canManageBots && <Button size="xs" variant="outline" disabled={disabled} onClick={() => onAddBot(seat)}><FiPlus />{t("game.room.addBotCta")}</Button>}
                                        {occupant?.kind === "BOT" && canManageBots && <Button size="xs" variant="ghost" disabled={disabled} onClick={() => onRemoveBot(seat)}><FiX />{t("game.room.removeBot")}</Button>}
                                    </HStack>
                                </HStack>
                            )
                        })}
                    </VStack>
                ))}
            </Stack>
            {/* `mt="auto"` is the whole of "at the bottom": the panel is a
                flex column that fills its box, so the last block is pushed to
                the floor when there is room and simply follows the seats when
                there is not. `pb` adds the safe-area inset on top of the
                panel's own bottom padding (2026-09-20, user request) so the
                start button clears iOS Safari's floating bottom toolbar /
                the home indicator in the installed PWA. */}
            <VStack mt="auto" align="stretch" gap={{ base: "1", md: "1.5" }} p={{ base: "1.5", md: "2.5" }}
                pb={{ base: "1.5", md: "2.5" }}
                mb={{ base: "calc(12px + env(safe-area-inset-bottom, 0px))", md: "2" }}
                bg="bg.panel" rounded="2xl" borderWidth="1px" borderColor="border.subtle">
                {/* Side by side on every width now (2026-09-20, user
                    request): the two toggles stacked burned a whole row on a
                    phone for a decision each answers in one word.
                    `GameOption`'s `shortLabel` already collapses "Privatna
                    igra" to "Privatna" below the `sm` breakpoint, so the row
                    still fits. */}
                <Stack direction="row" gap="2" align="stretch">
                    <Box flex="1" minW="0">
                        <GameOption compact label={t("game.room.privateGame")} shortLabel={t("game.room.privateGameShort")}
                            checked={room.private} disabled={mySeat === null || disabled} onChange={onPrivacyChange} />
                    </Box>
                    {mySeat !== null && (
                        <Box flex="1" minW="0">
                            <GameOption compact label={t("game.room.ready")} checked={ready} disabled={disabled} onChange={onReady} />
                        </Box>
                    )}
                </Stack>
                {mySeat !== null && <Button size="md" colorPalette="brand" disabled={disabled || !canStart} onClick={onStart}><FiPlay />{t("game.room.launch")}</Button>}
                {/* NO HINT UNDER THE BUTTON (2026-09-09, user request).
                    "Za početak popuni sva četiri mjesta" and "Čeka se da svi
                    budu spremni" both went: the four chairs are drawn right
                    above, an empty one says "čekam…" and offers "Dodaj bota",
                    a seated player's row says "Spreman" or does not, and the
                    start button is disabled either way. A sentence restating a
                    picture is a sentence nobody reads twice. */}
            </VStack>
            {room.spectators.length > 0 && <Text fontSize="xs" color="fg.muted">{t("game.room.spectators")}: {room.spectators.map((u) => u.name).join(", ")}</Text>}
        </VStack>
    )
}
