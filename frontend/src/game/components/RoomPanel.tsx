import { useState } from "react"
import { Badge, Box, Button, HStack, Heading, IconButton, Text, VStack } from "@chakra-ui/react"
import { FiCheck, FiCopy, FiLogOut, FiPlay, FiPlus, FiX } from "react-icons/fi"
import { BOT_LEVELS } from "@bela/protocol"
import type { BotLevel, RoomState, Seat as SeatId, SeatInfo } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import { showError, showSuccess } from "../../toaster"
import { teamOf } from "../util/seats"
import PlayerAvatar from "./PlayerAvatar"

/* ──────────────────────────────────────────────────────────────────────────
   RoomPanel — the pre-game room (game/DESIGN.md §1 "Soba", §2.9).

   Four seat ROWS stacked vertically rather than the round-table layout the
   live game uses: my team (whichever pair actually includes my seat) on
   top, a centred "vs", the other team below. That is bela.fun's anatomy —
   it reads top-to-bottom instead of asking you to parse a mini table before
   you have even sat down.
   ────────────────────────────────────────────────────────────────────── */

export default function RoomPanel({
    room,
    mySeat,
    myUid,
    disabled = false,
    onSit,
    onStand,
    onAddBot,
    onRemoveBot,
    onReady,
    onStart,
    onLeave,
}: {
    room: RoomState
    mySeat: SeatId | null
    myUid: string | null
    disabled?: boolean
    onSit: (seat: SeatId) => void
    onStand: () => void
    onAddBot: (seat: SeatId, level: BotLevel) => void
    onRemoveBot: (seat: SeatId) => void
    onReady: (ready: boolean) => void
    onStart: () => void
    onLeave: () => void
}) {
    const { t } = useTranslation()
    const [botMenuSeat, setBotMenuSeat] = useState<SeatId | null>(null)
    const isHost = myUid !== null && room.hostUid === myUid
    const myOccupant = mySeat === null ? null : room.seats[mySeat].occupant
    const iAmReady = myOccupant?.kind === "PLAYER" && myOccupant.ready

    const humanOccupants = room.seats.filter((s) => s.occupant?.kind === "PLAYER")
    const allHumansReady =
        humanOccupants.length > 0 &&
        humanOccupants.every((s) => s.occupant?.kind === "PLAYER" && s.occupant.ready)

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(room.code)
            showSuccess(t("game.room.codeCopied"))
        } catch {
            showError(t("game.room.codeCopyFailed"), room.code)
        }
    }

    const copyLink = async () => {
        const url = `${window.location.origin}/igra/soba/${room.id}`
        try {
            await navigator.clipboard.writeText(url)
            showSuccess(t("game.room.inviteCopied"))
        } catch {
            showError(t("game.room.inviteCopyFailed"), url)
        }
    }

    // "My team" is whichever pair actually holds my seat — spectators (and a
    // seat that hasn't sat down yet) default to seats 0/2 on top, same as
    // the live table's own convention (util/seats.ts).
    const myTeamSeats: [SeatId, SeatId] = mySeat === null || teamOf(mySeat) === "A" ? [0, 2] : [1, 3]
    const otherTeamSeats: [SeatId, SeatId] = myTeamSeats[0] === 0 ? [1, 3] : [0, 2]

    const seatRow = (seat: SeatId) => (
        <SeatRow
            key={seat}
            info={room.seats[seat]}
            isMine={seat === mySeat}
            isHost={isHost}
            iCanSit={mySeat === null}
            disabled={disabled}
            botMenuOpen={botMenuSeat === seat}
            onOpenBotMenu={() => setBotMenuSeat(seat)}
            onCloseBotMenu={() => setBotMenuSeat(null)}
            onSit={() => onSit(seat)}
            onStand={onStand}
            onAddBot={(level) => {
                onAddBot(seat, level)
                setBotMenuSeat(null)
            }}
            onRemoveBot={() => onRemoveBot(seat)}
        />
    )

    return (
        <VStack gap="4" align="stretch">
            <VStack align="stretch" gap="1">
                <Text fontSize="xs" fontStyle="italic" color="fg.muted">
                    {t("game.room.label")}
                </Text>
                <HStack justify="space-between" align="start" gap="2">
                    <Heading textStyle="heading" lineClamp={1}>
                        {room.name}{" "}
                        <Text as="span" color="fg.muted" fontWeight="normal">
                            ({room.targetScore})
                        </Text>
                    </Heading>
                    <IconButton
                        aria-label={t("game.room.leaveAria")}
                        variant="ghost"
                        colorPalette="red"
                        onClick={onLeave}
                    >
                        <FiLogOut />
                    </IconButton>
                </HStack>
                <HStack gap="1" wrap="wrap">
                    <Text fontSize="sm" color="fg.muted">
                        {t("game.room.codeLabel", { code: room.code })}
                    </Text>
                    <Button size="xs" variant="ghost" onClick={copyCode}>
                        <FiCopy /> {t("game.room.copyCode")}
                    </Button>
                    <Button size="xs" variant="ghost" onClick={copyLink}>
                        <FiCopy /> {t("game.room.invite")}
                    </Button>
                </HStack>
            </VStack>

            <VStack gap="2" align="stretch">
                {myTeamSeats.map(seatRow)}
                <HStack gap="3" justify="center" color="fg.muted" fontSize="xs" fontWeight="semibold">
                    <Box flex="1" h="1px" bg="border.subtle" />
                    <Text textTransform="uppercase" letterSpacing="wider">{t("game.room.vs")}</Text>
                    <Box flex="1" h="1px" bg="border.subtle" />
                </HStack>
                {otherTeamSeats.map(seatRow)}
            </VStack>

            <VStack gap="2" align="stretch">
                {/* The host is a seated player too, and the server requires
                    EVERY seated human — host included — to be ready before
                    `room.start` succeeds (see `Room.start` in the server).
                    Without this toggle the host had no way to satisfy their
                    own check and "Pokreni igru" stayed disabled forever. */}
                {isHost && mySeat !== null && (
                    <Button
                        size="md"
                        variant={iAmReady ? "solid" : "outline"}
                        colorPalette={iAmReady ? "green" : "brand"}
                        disabled={disabled}
                        onClick={() => onReady(!iAmReady)}
                    >
                        {iAmReady ? t("game.room.readyOn") : t("game.room.readyOff")}
                    </Button>
                )}
                {isHost ? (
                    <>
                        <Button
                            size="lg"
                            colorPalette="brand"
                            disabled={disabled || !allHumansReady}
                            onClick={onStart}
                        >
                            <FiPlay /> {t("game.room.launch")}
                        </Button>
                        {!allHumansReady && (
                            <Text fontSize="xs" color="fg.muted" textAlign="center">
                                {t("game.room.launchHint")}
                            </Text>
                        )}
                    </>
                ) : (
                    <Button
                        size="lg"
                        variant={iAmReady ? "solid" : "outline"}
                        colorPalette={iAmReady ? "green" : "brand"}
                        disabled={disabled || mySeat === null}
                        onClick={() => onReady(!iAmReady)}
                    >
                        {iAmReady ? t("game.room.readyOn") : t("game.room.readyOff")}
                    </Button>
                )}
            </VStack>

            {room.spectators.length > 0 && (
                <Box>
                    <Text fontSize="2xs" color="fg.muted" textTransform="uppercase" letterSpacing="wider">
                        {t("game.room.spectators")}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                        {room.spectators.map((u) => u.name).join(", ")}
                    </Text>
                </Box>
            )}
        </VStack>
    )
}

function SeatRow({
    info,
    isMine,
    isHost,
    iCanSit,
    disabled,
    botMenuOpen,
    onOpenBotMenu,
    onCloseBotMenu,
    onSit,
    onStand,
    onAddBot,
    onRemoveBot,
}: {
    info: SeatInfo
    isMine: boolean
    isHost: boolean
    iCanSit: boolean
    disabled: boolean
    botMenuOpen: boolean
    onOpenBotMenu: () => void
    onCloseBotMenu: () => void
    onSit: () => void
    onStand: () => void
    onAddBot: (level: BotLevel) => void
    onRemoveBot: () => void
}) {
    const { t } = useTranslation()
    const occupant = info.occupant

    return (
        <HStack
            gap="3"
            p="2"
            rounded="lg"
            borderWidth="1px"
            borderColor={isMine ? "brand.400" : "border.subtle"}
            bg={isMine ? "brand.subtle" : "bg.panel"}
            minH="60px"
        >
            {occupant === null && (
                <>
                    <PlayerAvatar empty />
                    <Text flex="1" fontSize="sm" color="fg.muted">{t("game.room.waitingSeat")}</Text>
                    <HStack gap="1" wrap="wrap" justify="end">
                        {iCanSit && (
                            <Button size="xs" colorPalette="brand" disabled={disabled} onClick={onSit}>
                                {t("game.room.sit")}
                            </Button>
                        )}
                        {isHost && !botMenuOpen && (
                            <Button size="xs" variant="outline" disabled={disabled} onClick={onOpenBotMenu}>
                                <FiPlus /> {t("game.room.addBotCta")}
                            </Button>
                        )}
                        {isHost && botMenuOpen && (
                            <HStack gap="1">
                                {BOT_LEVELS.map((level) => (
                                    <Button
                                        key={level}
                                        size="xs"
                                        variant={level === "srednje" ? "solid" : "outline"}
                                        colorPalette="brand"
                                        onClick={() => onAddBot(level)}
                                        onBlur={onCloseBotMenu}
                                    >
                                        {t(`game.bot.level.${level}`)}
                                    </Button>
                                ))}
                            </HStack>
                        )}
                    </HStack>
                </>
            )}

            {occupant?.kind === "BOT" && (
                <>
                    <PlayerAvatar name={occupant.name} />
                    <VStack align="start" gap="0" flex="1" minW="0">
                        <Text fontWeight="medium" lineClamp={1}>{occupant.name}</Text>
                    </VStack>
                    <Badge size="sm" variant="subtle" colorPalette="gray">
                        {t(`game.bot.level.${occupant.level}`)}
                    </Badge>
                    {isHost && (
                        <IconButton
                            size="sm"
                            variant="ghost"
                            colorPalette="red"
                            aria-label={t("game.room.removeBot")}
                            disabled={disabled}
                            onClick={onRemoveBot}
                        >
                            <FiX />
                        </IconButton>
                    )}
                </>
            )}

            {occupant?.kind === "PLAYER" && (
                <>
                    <PlayerAvatar
                        name={occupant.user.name}
                        avatarUrl={occupant.user.avatarUrl}
                        online={occupant.connected}
                        dimmed={!occupant.connected}
                    />
                    <VStack align="start" gap="0" flex="1" minW="0">
                        <Text fontWeight={isMine ? "bold" : "medium"} lineClamp={1}>
                            {isMine ? t("game.seat.youSuffix", { name: occupant.user.name }) : occupant.user.name}
                        </Text>
                        {!occupant.connected && (
                            <Text fontSize="2xs" color="fg.muted">{t("game.seat.disconnected")}</Text>
                        )}
                    </VStack>
                    <Box
                        aria-label={t("game.room.ready")}
                        title={t("game.room.ready")}
                        color={occupant.ready ? "green.solid" : "border.emphasized"}
                    >
                        {occupant.ready ? (
                            <FiCheck size={20} />
                        ) : (
                            <Box boxSize="18px" rounded="full" borderWidth="2px" borderColor="border.emphasized" />
                        )}
                    </Box>
                    {isMine && (
                        <Button size="xs" variant="ghost" disabled={disabled} onClick={onStand}>
                            {t("game.room.stand")}
                        </Button>
                    )}
                </>
            )}
        </HStack>
    )
}
