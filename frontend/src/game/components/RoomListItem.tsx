import { Badge, Box, HStack, Text, VStack } from "@chakra-ui/react"
import { FiChevronRight, FiLock } from "react-icons/fi"
import type { RoomSummary } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import PlayerAvatar from "./PlayerAvatar"

/* ──────────────────────────────────────────────────────────────────────────
   RoomListItem — one row in the lobby's room list (game/DESIGN.md §1 "Lobby").

   `RoomSummary` (what `lobby.rooms` carries) only has aggregate counts, not
   who is actually seated — so the "2 vs 2" row below is generic occupancy
   (filled vs dashed-empty circles), not real photos. The first `seatsTaken`
   circles read as filled; the rest are empty. That is exactly what the
   summary can honestly say without pretending to know more.
   ────────────────────────────────────────────────────────────────────── */

export default function RoomListItem({
    room,
    onClick,
}: {
    room: RoomSummary
    onClick: () => void
}) {
    const { t } = useTranslation()

    return (
        <Box
            as="button"
            onClick={onClick}
            w="100%"
            textAlign="left"
            rounded="xl"
            borderWidth="1px"
            borderColor="border.subtle"
            bg="bg.panel"
            p="3"
            minH="44px"
            transition="background-color 0.15s ease, border-color 0.15s ease"
            _hover={{ borderColor: "border.emphasized" }}
            aria-label={t("game.lobby.enterAria", { name: room.name })}
        >
            <HStack justify="space-between" gap="3">
                <VStack align="start" gap="1.5" flex="1" minW="0">
                    <HStack gap="2" minW="0">
                        <Text fontWeight="semibold" lineClamp={1}>{room.name}</Text>
                        {room.private && (
                            <Box color="fg.muted" aria-label={t("game.lobby.privateAria")} title={t("game.lobby.privateAria")}>
                                <FiLock size={14} />
                            </Box>
                        )}
                    </HStack>
                    <HStack gap="2" wrap="wrap">
                        <Badge size="sm" variant="subtle" colorPalette="gray">
                            {t("game.lobby.target", { target: room.targetScore })}
                        </Badge>
                    </HStack>
                    <HStack gap="1" aria-label={t("game.lobby.seatsAria", { taken: room.seatsTaken, total: 4 })}>
                        {[0, 1, 2, 3].map((i) => (
                            <PlayerAvatar key={i} size="xs" empty={i >= room.seatsTaken} />
                        ))}
                    </HStack>
                </VStack>
                <Box color="fg.muted" flexShrink={0} aria-hidden="true">
                    <FiChevronRight size={20} />
                </Box>
            </HStack>
        </Box>
    )
}
