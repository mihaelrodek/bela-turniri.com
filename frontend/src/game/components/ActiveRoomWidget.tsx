import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Box, HStack, IconButton, Text } from "@chakra-ui/react"
import { FiX } from "react-icons/fi"
import { useTranslation } from "../../i18n"
import ConfirmDialog from "../../components/ConfirmDialog"
import { WHATS_NEW_FAB } from "../../components/navChrome"
import { ACTION_BAR_RESERVE } from "../../blok/actionBar"
import { useActiveRoom } from "../hooks/useGameSocket"

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

   It docks beside the "Novosti" FAB (`WHATS_NEW_FAB` in navChrome.ts, which
   already clears `MobileTabBar` and the home-indicator inset), and sits below Chakra's dialog layer so a modal
   always wins.
   ────────────────────────────────────────────────────────────────────── */

/** Pill height, px — needed to centre it on the FAB beside it. */
const PILL_H = 34

export default function ActiveRoomWidget() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { pathname } = useLocation()
    const socket = useActiveRoom()
    const [leaveOpen, setLeaveOpen] = useState(false)

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
    const playing = room.status === "PLAYING"

    return (
        <>
            <Box
                position="fixed"
                // A free-standing pill docked LEFT of the "Novosti" FAB, level
                // with its centre, on every width (2026-09-20, user request).
                // /blok has no FAB (it hides there) and its own action bar, so
                // there the pill takes the corner itself.
                right={onBlokRoute
                    ? { base: "calc(12px + env(safe-area-inset-right, 0px))", md: "4" }
                    : {
                        base: `${WHATS_NEW_FAB.right.base + WHATS_NEW_FAB.size + 8}px`,
                        md: `${WHATS_NEW_FAB.right.md + WHATS_NEW_FAB.size + 8}px`,
                    }}
                bottom={onBlokRoute
                    ? { base: `calc(${ACTION_BAR_RESERVE} + 12px)`, md: "4" }
                    : {
                        base: `calc(${WHATS_NEW_FAB.bottom.base} + ${(WHATS_NEW_FAB.size - PILL_H) / 2}px)`,
                        md: `calc(${WHATS_NEW_FAB.bottom.md} + ${(WHATS_NEW_FAB.size - PILL_H) / 2}px)`,
                    }}
                h={`${PILL_H}px`}
                display="flex"
                alignItems="center"
                zIndex={950}
                maxW="min(240px, calc(100vw - 96px))"
                rounded="full"
                borderWidth="1px"
                borderColor={playing ? "orange.400" : "brand.400"}
                bg="bg.opaque"
                backdropFilter="none"
                shadow="0 6px 18px rgba(0, 0, 0, 0.28)"
                cursor="pointer"
                role="button"
                tabIndex={0}
                aria-label={t("game.widget.return")}
                onClick={() => navigate(`/igra/soba/${room.id}`)}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        navigate(`/igra/soba/${room.id}`)
                    }
                }}
            >
                <HStack justify="space-between" gap="1" ps="3" pe="1" py="1">
                <HStack gap="2" minW="0">
                    <Box boxSize="8px" rounded="full" bg={playing ? "green.400" : "orange.400"} flexShrink={0} />
                    <Text fontSize="xs" fontWeight="bold" color="fg.ink" lineClamp={1}>{room.name}</Text>
                </HStack>
                <HStack flexShrink={0}>
                    <IconButton
                        size="2xs"
                        rounded="full"
                        variant="ghost"
                        aria-label={t("game.active.leave")}
                        onClick={(event) => {
                            event.stopPropagation()
                            if (playing) setLeaveOpen(true)
                            else socket.leaveRoom()
                        }}
                    >
                        <FiX />
                    </IconButton>
                </HStack>
                </HStack>
            </Box>
            <ConfirmDialog
                open={playing && leaveOpen}
                title={t("game.exit.title")}
                description={t("game.exit.description")}
                confirmLabel={t("game.exit.leave")}
                cancelLabel={t("game.exit.stay")}
                destructive
                onConfirm={() => {
                    setLeaveOpen(false)
                    socket.leaveRoom()
                }}
                onCancel={() => setLeaveOpen(false)}
            />
        </>
    )
}
