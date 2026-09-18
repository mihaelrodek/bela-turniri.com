import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Box, HStack, IconButton, Text } from "@chakra-ui/react"
import { FiX } from "react-icons/fi"
import { useTranslation } from "../../i18n"
import ConfirmDialog from "../../components/ConfirmDialog"
import { MOBILE_TABBAR_CLEARANCE } from "../../components/navChrome"
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

   It floats clear of `MobileTabBar` (and of the home-indicator inset) via
   `MOBILE_TABBAR_CLEARANCE`, and sits below Chakra's dialog layer so a modal
   always wins.
   ────────────────────────────────────────────────────────────────────── */

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
                right={{ base: "max(0px, env(safe-area-inset-right, 0px))", md: "4" }}
                bottom={{
                    base: onBlokRoute
                        ? `calc(${ACTION_BAR_RESERVE} + 12px)`
                        : `calc(${MOBILE_TABBAR_CLEARANCE} + 12px)`,
                    md: "4",
                }}
                zIndex={950}
                w={{ base: "min(320px, calc(100vw - env(safe-area-inset-right, 0px)))", md: "320px" }}
                roundedStart="l3"
                borderWidth="1px"
                borderEndWidth="0"
                borderColor={playing ? "orange.400" : "brand.400"}
                borderInlineStartWidth="3px"
                bg="bg.opaque"
                backdropFilter="none"
                shadow="0 12px 34px rgba(0, 0, 0, 0.28)"
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
                <HStack justify="space-between" gap="2" px="4" py="3">
                <HStack gap="2" minW="0">
                    <Box boxSize="8px" rounded="full" bg={playing ? "green.400" : "orange.400"} flexShrink={0} />
                    <Text fontSize="sm" fontWeight="bold" color="fg.ink" lineClamp={1}>{room.name}</Text>
                </HStack>
                <HStack flexShrink={0}>
                    <IconButton
                        size="xs"
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
