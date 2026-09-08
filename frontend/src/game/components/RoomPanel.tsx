import { Badge, Box, Button, HStack, Heading, IconButton, SimpleGrid, Text, VStack } from "@chakra-ui/react"
import { FiCheck, FiCopy, FiLogOut, FiPlay, FiPlus, FiSettings, FiX } from "react-icons/fi"
import type { RoomState, Seat as SeatId } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import { showError, showSuccess } from "../../toaster"
import { teamOf } from "../util/seats"
import PlayerAvatar from "./PlayerAvatar"
import GameOption from "./GameOption"

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
    const isHost = myUid !== null && room.hostUid === myUid
    const mine = mySeat === null ? null : room.seats[mySeat].occupant
    const ready = mine?.kind === "PLAYER" && mine.ready
    const humans = room.seats.filter((s) => s.occupant?.kind === "PLAYER")
    const allReady = humans.length > 0 && humans.every((s) => s.occupant?.kind === "PLAYER" && s.occupant.ready)
    const freeSeats = ([0, 1, 2, 3] as SeatId[]).filter((s) => room.seats[s].occupant === null)
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

    return (
        <VStack gap={{ base: "2", md: "3" }} align="stretch" p={{ base: "2.5", md: "4" }}>
            <HStack justify="space-between" gap="3" pr="8">
                <Box minW="0">
                    <Heading fontSize={{ base: "md", md: "lg" }} overflowWrap="anywhere">{room.name}</Heading>
                    <HStack gap="1.5" mt="1.5" flexWrap="wrap">
                        <Badge size="sm" variant="subtle" colorPalette="brand">{t("game.lobby.target", { target: room.targetScore })}</Badge>
                        <Badge size="sm" variant={room.noDeclarations ? "solid" : "subtle"} colorPalette={room.noDeclarations ? "orange" : "gray"}>
                            {t(room.noDeclarations ? "game.rules.noDeclarations" : "game.rules.withDeclarations")}
                        </Badge>
                        {room.noDeclarations && (
                            <Badge size="sm" variant={room.allowBela ? "subtle" : "solid"} colorPalette={room.allowBela ? "brand" : "orange"}>
                                {t(room.allowBela ? "game.rules.allowBela" : "game.rules.noBela")}
                            </Badge>
                        )}
                        {/* "Gledanje štihova" applies to the whole room, so it is
                            stated for everyone in it — not only to the host who
                            picked it. */}
                        <Badge size="sm" variant={room.trickReview === "off" ? "subtle" : "solid"}
                            colorPalette={room.trickReview === "off" ? "gray" : "brand"}>
                            {t(`game.rules.trickReviewBadge.${room.trickReview}`)}
                        </Badge>
                        <Badge size="sm" variant={room.allowSpectators ? "solid" : "subtle"}
                            colorPalette={room.allowSpectators ? "brand" : "gray"}>
                            {t(room.allowSpectators ? "game.room.spectatorsAllowed" : "game.room.spectatorsDisabled")}
                        </Badge>
                        {room.private && (
                            <Button size="xs" h="auto" minH="0" px="2" py="0.5" variant="subtle" colorPalette="brand"
                                fontVariantNumeric="tabular-nums" onClick={copyCode}>
                                <FiCopy /> {t("game.room.codeLabel", { code: room.code })}
                            </Button>
                        )}
                    </HStack>
                </Box>
                <HStack gap="0">
                    <IconButton size="sm" aria-label={t("game.settings.title")} onClick={onSettings} variant="ghost"><FiSettings /></IconButton>
                    <IconButton size="sm" aria-label={t("game.room.leaveAria")} onClick={onLeave} variant="ghost"><FiLogOut /></IconButton>
                </HStack>
            </HStack>

            {/* "Sva su mjesta zauzeta" may only be said when they ACTUALLY
                are. This banner once appeared for every seatless member — at a
                table with three empty chairs and no way to take one. */}
            {mySeat === null && myUid !== null && freeSeats.length === 0 && (
                <Box p="2.5" rounded="lg" bg="bg.subtle" borderWidth="1px" borderColor="border.subtle">
                    <Text fontSize="sm" color="fg.muted">{t("game.room.spectatingFull")}</Text>
                </Box>
            )}

            <SimpleGrid columns={{ base: 1, sm: 2 }} gap={{ base: "2", md: "3" }}>
                {teams.map((seats, index) => (
                    /* No heading: the card IS the pair. Its border and its own
                       ground are what group the two chairs, so the grouping
                       survives the labels going away — and on `base` where the
                       grid stacks, the two cards stay two cards. */
                    <VStack key={index} align="stretch" gap={{ base: "1.5", md: "2" }} p={{ base: "2", md: "3" }}
                        rounded="xl" bg="bg.panel" borderWidth="1px" borderColor="border.subtle"
                        role="group" aria-label={t("game.room.pairAria", { n: index + 1 })}>
                        {seats.map((seat) => {
                            const occupant = room.seats[seat].occupant
                            return (
                                <HStack key={seat} justify="space-between" gap={{ base: "1.5", md: "2" }} p={{ base: "1.5", md: "2" }}
                                    rounded="lg" bg="bg.subtle" minH={{ base: "52px", md: "64px" }}>
                                    <HStack gap={{ base: "1.5", md: "2" }} minW="0">
                                        <PlayerAvatar size="sm" empty={!occupant} name={occupant?.kind === "PLAYER" ? occupant.user.name : occupant?.name}
                                            avatarUrl={occupant?.kind === "PLAYER" ? occupant.user.avatarUrl : undefined} />
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
                                        {occupant?.kind === "PLAYER" && occupant.ready && <Box color="brand.500"><FiCheck /></Box>}
                                    </HStack>
                                    <HStack justify="end" gap="2">
                                        {!occupant && mySeat === null && onSit && (
                                            <Button size="xs" colorPalette="brand" disabled={disabled} onClick={() => onSit(seat)}>
                                                {t("game.room.sitHere")}
                                            </Button>
                                        )}
                                        {!occupant && isHost && <Button size="xs" variant="outline" disabled={disabled} onClick={() => onAddBot(seat)}><FiPlus />{t("game.room.addBotCta")}</Button>}
                                        {occupant?.kind === "BOT" && isHost && <Button size="xs" variant="ghost" disabled={disabled} onClick={() => onRemoveBot(seat)}><FiX />{t("game.room.removeBot")}</Button>}
                                    </HStack>
                                </HStack>
                            )
                        })}
                    </VStack>
                ))}
            </SimpleGrid>
            <VStack align="stretch" gap={{ base: "1.5", md: "2" }} p={{ base: "2.5", md: "3" }} bg="bg.panel" rounded="2xl" borderWidth="1px" borderColor="border.subtle">
                {/* "Privatna igra" + "Spreman" share one row on every breakpoint — each
                    `GameOption` is `compact` and takes half; when "Spreman" isn't
                    rendered (spectating) the privacy toggle alone fills the row via `flex="1"`. */}
                <HStack gap="2" align="stretch">
                    <Box flex="1" minW="0">
                        <GameOption compact label={t("game.room.privateGame")} shortLabel={t("game.room.privateGameShort")}
                            checked={room.private} disabled={!isHost || disabled} onChange={onPrivacyChange} />
                    </Box>
                    {mySeat !== null && (
                        <Box flex="1" minW="0">
                            <GameOption compact label={t("game.room.ready")} checked={ready} disabled={disabled} onChange={onReady} />
                        </Box>
                    )}
                </HStack>
                {isHost && <Button size="lg" colorPalette="brand" disabled={disabled || !allReady} onClick={onStart}><FiPlay />{t("game.room.launch")}</Button>}
                {isHost && !allReady && <Text fontSize="xs" color="fg.muted" textAlign="center">{t("game.room.launchHint")}</Text>}
            </VStack>
            {room.spectators.length > 0 && <Text fontSize="xs" color="fg.muted">{t("game.room.spectators")}: {room.spectators.map((u) => u.name).join(", ")}</Text>}
        </VStack>
    )
}
