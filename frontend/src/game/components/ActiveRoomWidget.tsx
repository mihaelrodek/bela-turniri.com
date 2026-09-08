import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Badge, Box, Button, HStack, IconButton, Text, VStack } from "@chakra-ui/react"
import { FiChevronDown, FiChevronUp, FiLogIn, FiX } from "react-icons/fi"
import type { Seat, SeatInfo } from "@bela/protocol"
import type { Team } from "@bela/engine"
import { useTranslation } from "../../i18n"
import { MOBILE_TABBAR_CLEARANCE } from "../../components/navChrome"
import { ACTION_BAR_RESERVE } from "../../blok/actionBar"
import { useActiveRoom } from "../hooks/useGameSocket"
import { teamOf } from "../util/seats"
import PlayerAvatar from "./PlayerAvatar"

/* ──────────────────────────────────────────────────────────────────────────
   ActiveRoomWidget — the small "you are still at a table" dock, bottom-right,
   on every route EXCEPT the game pages themselves.

   It exists because leaving the table screen no longer means leaving the room:
   `GameRoomExitGuard` offers "ostani u sobi", and choosing it keeps the seat,
   the socket and the membership alive (see `../gameConnection.ts`). This is
   the thing that then makes that state visible and reversible.

   "Pametno implementirano" in practice:
     • it is driven by the sticky membership, so it appears only while a seat
       is genuinely still ours and vanishes on its own when the room dies, the
       seat is lost or the user leaves — no timers, no polling;
     • it stays quiet on `/igra*`: the table shows the table, and the lobby has
       its own, larger "active game" card, so this would only be noise;
     • it never opens a socket by itself — with no sticky room, `useActiveRoom`
       is a passive reader and no connection is made at all;
     • collapsed and dismissed states are local: hiding it is not leaving.

   It floats clear of `MobileTabBar` (and of the home-indicator inset) via
   `MOBILE_TABBAR_CLEARANCE`, and sits below Chakra's dialog layer so a modal
   always wins.
   ────────────────────────────────────────────────────────────────────── */

interface Person {
    key: string
    name: string
    avatarUrl: string | null
    bot: boolean
}

/** The two occupants of one team's seats (0+2 or 1+3), in seat order. Empty
 *  seats are skipped, so a half-filled room still renders. */
function pairOf(seats: readonly SeatInfo[], team: Team): Person[] {
    const out: Person[] = []
    for (const s of seats) {
        if (teamOf(s.seat) !== team) continue
        const o = s.occupant
        if (!o) continue
        if (o.kind === "BOT") out.push({ key: `b${s.seat}`, name: o.name, avatarUrl: null, bot: true })
        else out.push({ key: `p${s.seat}`, name: o.user.name, avatarUrl: o.user.avatarUrl, bot: false })
    }
    return out
}

export default function ActiveRoomWidget() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { pathname } = useLocation()
    const socket = useActiveRoom()
    const [collapsed, setCollapsed] = useState(false)

    const room = socket.room
    const sticky = socket.stickyRoomId
    // Quiet on the game routes: the table IS the room, and the lobby has its
    // own card for exactly this state.
    const onGameRoute = pathname === "/igra" || pathname.startsWith("/igra/")
    // `/blok` pins its own "MI + / VI +" bar to the bottom of the viewport,
    // and this dock is fixed bottom-right — so on that route it landed right
    // on top of the two buttons the screen exists for. Sit above the bar
    // instead of hiding: someone keeping score on paper next to a live online
    // table still needs the way back in. `md` is unaffected — the blok's bar
    // moves into the left column there and this dock has the corner to itself.
    const onBlokRoute = pathname === "/blok" || pathname.startsWith("/blok/")

    if (onGameRoute || socket.widgetDismissed) return null
    if (!sticky || !room || room.id !== sticky) return null

    // Who is playing WHOM, and what the match stands at — the two things the
    // dock is for. A bare head-count ("1 igrač") answered neither: you already
    // know you are in the room, and it told you nothing about the game.
    // `socket.view` is the same PlayerView the table renders; the sticky
    // connection keeps receiving it after you leave the table screen, so the
    // score here stays live. It is null before the first deal.
    const mySeat: Seat | null = socket.yourSeat
    const myTeam: Team = mySeat === null ? "A" : teamOf(mySeat)
    const theirTeam: Team = myTeam === "A" ? "B" : "A"
    const score = socket.view?.score ?? null
    const rows: { team: Team; label: string; people: Person[]; mine: boolean }[] = [
        {
            team: myTeam,
            label: mySeat === null ? t("game.score.teamA") : t("game.score.us"),
            people: pairOf(room.seats, myTeam),
            mine: mySeat !== null,
        },
        {
            team: theirTeam,
            label: mySeat === null ? t("game.score.teamB") : t("game.score.them"),
            people: pairOf(room.seats, theirTeam),
            mine: false,
        },
    ]

    return (
        <Box
            position="fixed"
            right={{ base: "3", md: "4" }}
            bottom={{
                base: onBlokRoute
                    ? `calc(${ACTION_BAR_RESERVE} + 12px)`
                    : `calc(${MOBILE_TABBAR_CLEARANCE} + 12px)`,
                md: "4",
            }}
            zIndex={950}
            w={{ base: "min(320px, calc(100vw - 24px))", md: "320px" }}
            rounded="l3"
            borderWidth="1px"
            borderColor="border.subtle"
            bg="bg.panel"
            shadow="lg"
            overflow="hidden"
            role="complementary"
            aria-label={t("game.widget.title")}
        >
            <HStack justify="space-between" gap="2" px="3" py="2" bg="bg.subtle">
                <HStack gap="2" minW="0">
                    <Box boxSize="8px" rounded="full" bg={room.status === "PLAYING" ? "green.400" : "orange.400"} flexShrink={0} />
                    <Text fontSize="sm" fontWeight="semibold" lineClamp={1}>{room.name}</Text>
                </HStack>
                <HStack gap="0.5" flexShrink={0}>
                    <IconButton
                        size="xs"
                        variant="ghost"
                        aria-label={collapsed ? t("game.widget.expand") : t("game.widget.collapse")}
                        onClick={() => setCollapsed((v) => !v)}
                    >
                        {collapsed ? <FiChevronUp /> : <FiChevronDown />}
                    </IconButton>
                    <IconButton
                        size="xs"
                        variant="ghost"
                        aria-label={t("game.widget.dismiss")}
                        onClick={() => socket.dismissWidget()}
                    >
                        <FiX />
                    </IconButton>
                </HStack>
            </HStack>

            {!collapsed && (
                <VStack align="stretch" gap="2.5" px="3" py="3">
                    <Badge
                        size="sm"
                        variant="subtle"
                        alignSelf="start"
                        colorPalette={room.status === "PLAYING" ? "green" : "gray"}
                    >
                        {t(`game.active.status.${room.status}`)}
                    </Badge>

                    {/* Pair against pair, my side first, with the match score
                        on the right. Two rows separated by a rule: the layout
                        itself says who is playing whom. */}
                    <VStack align="stretch" gap="0">
                        {rows.map((row, index) => (
                            <HStack
                                key={row.team}
                                gap="2"
                                align="center"
                                py="1.5"
                                borderTopWidth={index === 0 ? "0" : "1px"}
                                borderColor="border.subtle"
                            >
                                <VStack align="start" gap="0.5" minW="0" flex="1">
                                    <Text
                                        fontSize="2xs"
                                        fontWeight="bold"
                                        textTransform="uppercase"
                                        letterSpacing="wide"
                                        color={row.mine ? "brand.fg" : "fg.muted"}
                                    >
                                        {row.label}
                                    </Text>
                                    {row.people.map((p) => (
                                        <HStack key={p.key} gap="1.5" minW="0" w="full">
                                            <PlayerAvatar size="xs" name={p.name} avatarUrl={p.avatarUrl} dimmed={p.bot} />
                                            <Text fontSize="xs" color="fg.muted" lineClamp={1}>{p.name}</Text>
                                        </HStack>
                                    ))}
                                </VStack>
                                {score !== null && (
                                    <Text
                                        fontSize="xl"
                                        fontWeight="bold"
                                        fontVariantNumeric="tabular-nums"
                                        color={row.mine ? "brand.fg" : "fg"}
                                        flexShrink={0}
                                    >
                                        {score[row.team]}
                                    </Text>
                                )}
                            </HStack>
                        ))}
                    </VStack>

                    <HStack gap="2">
                        <Button
                            size="xs"
                            colorPalette="brand"
                            flex="1"
                            onClick={() => navigate(`/igra/soba/${room.id}`)}
                        >
                            <FiLogIn /> {t("game.widget.return")}
                        </Button>
                        <Button size="xs" variant="outline" onClick={() => socket.leaveRoom()}>
                            {t("game.widget.leave")}
                        </Button>
                    </HStack>
                </VStack>
            )}
        </Box>
    )
}
