import { Badge, Box, Button, HStack, Heading, IconButton, SimpleGrid, Stack, Text, VStack } from "@chakra-ui/react"
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

    return (
        <VStack gap={{ base: "2", md: "3" }} align="stretch" p={{ base: "2.5", md: "4" }} flex="1" minH="0">
            {/* No `pr="8"` any more: that gutter existed only to keep the
                title clear of the absolutely-positioned chat toggle, and the
                chat is gone (2026-09-09). Without it the settings and exit
                icons reach the panel's own right edge. */}
            <HStack justify="space-between" gap="3">
                <Box minW="0">
                    <Heading fontSize={{ base: "md", md: "lg" }} overflowWrap="anywhere">{room.name}</Heading>
                    <HStack gap="1.5" mt="1.5" flexWrap="wrap">
                        {/* ONE VOICE FOR THE SETTINGS (2026-09-09, user
                            request). Each chip used to choose its own colour
                            and weight — solid orange for "bez zvanja", solid
                            brand for spectators, subtle grey for the rest — so
                            a row that is one sentence ("this is how we play")
                            read as five warnings of differing severity. They
                            are all the same kind of fact, so they are all the
                            same chip; only the POINTS are emphasised, because
                            that is the one number people look for. */}
                        <Badge size="sm" rounded="full" px="2.5" variant="solid" colorPalette="brand">
                            {t("game.lobby.target", { target: room.targetScore })}
                        </Badge>
                        {[
                            t(`game.lobby.finishMode.${room.gameEndRule}`),
                            t(room.noDeclarations ? "game.rules.noDeclarations" : "game.rules.withDeclarations"),
                            ...(room.noDeclarations
                                ? [t(room.allowBela ? "game.rules.allowBela" : "game.rules.noBela")]
                                : []),
                            // "Gledanje štihova" applies to the whole room, so
                            // it is stated for everyone in it — not only to the
                            // host who picked it.
                            t(`game.rules.trickReviewBadge.${room.trickReview}`),
                            t(room.allowSpectators ? "game.room.spectatorsAllowed" : "game.room.spectatorsDisabled"),
                        ].map((label) => (
                            <Badge key={label} size="sm" rounded="full" px="2.5" variant="subtle" colorPalette="gray">
                                {label}
                            </Badge>
                        ))}
                        {room.private && (
                            <Button size="xs" h="auto" minH="0" px="2.5" py="0.5" rounded="full" variant="subtle" colorPalette="brand"
                                fontVariantNumeric="tabular-nums" onClick={copyCode}>
                                <FiCopy /> {t("game.room.codeLabel", { code: room.code })}
                            </Button>
                        )}
                    </HStack>
                </Box>
                {/* Pinned to the top-right corner and to each other: the pair
                    used to drift with the badge block beside it, which on a
                    wide screen left them floating in the middle of nothing
                    (2026-09-09, user request). */}
                <HStack gap="0.5" flexShrink={0} alignSelf="flex-start">
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

            {/* Centred in what is left (2026-09-09, user request): with the
                controls pinned to the floor, the seats sat hard against the
                chips and the whole empty half of the screen was between them
                and the buttons. `my="auto"` splits that space above and below,
                which puts the four chairs where the eye lands. */}
            <SimpleGrid my="auto" columns={{ base: 1, sm: 2 }} gap={{ base: "2", md: "3" }}>
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
                                            avatarUrl={occupant?.kind === "PLAYER" ? occupant.user.avatarUrl : undefined}
                                            avatarPreset={occupant?.kind === "PLAYER" ? occupant.user.avatarPreset : undefined} />
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
            {/* `mt="auto"` is the whole of "at the bottom": the panel is a
                flex column that fills its box, so the last block is pushed to
                the floor when there is room and simply follows the seats when
                there is not. */}
            <VStack mt="auto" align="stretch" gap={{ base: "1.5", md: "2" }} p={{ base: "2.5", md: "3" }} bg="bg.panel" rounded="2xl" borderWidth="1px" borderColor="border.subtle">
                {/* ONE SWITCH PER ROW on a phone (2026-09-09, user request).
                    Side by side they were two half-width boxes whose labels
                    had to be abbreviated to fit ("Privatna" for "Privatna
                    igra"), and the pair read as one control with two knobs.
                    Full width each, the label is the whole label and the two
                    are plainly two decisions. On md they still share a row —
                    there is width for it and the column is short. */}
                <Stack direction={{ base: "column", md: "row" }} gap="2" align="stretch">
                    <Box flex="1" minW="0">
                        <GameOption compact label={t("game.room.privateGame")} shortLabel={t("game.room.privateGameShort")}
                            checked={room.private} disabled={!isHost || disabled} onChange={onPrivacyChange} />
                    </Box>
                    {mySeat !== null && (
                        <Box flex="1" minW="0">
                            <GameOption compact label={t("game.room.ready")} checked={ready} disabled={disabled} onChange={onReady} />
                        </Box>
                    )}
                </Stack>
                {mySeat !== null && <Button size="lg" colorPalette="brand" disabled={disabled || !canStart} onClick={onStart}><FiPlay />{t("game.room.launch")}</Button>}
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
