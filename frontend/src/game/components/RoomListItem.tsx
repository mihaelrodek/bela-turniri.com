import { Badge, Box, HStack, Text, VStack } from "@chakra-ui/react"
import { FiChevronRight, FiEye, FiLock } from "react-icons/fi"
import type { RoomOccupant, RoomSummary } from "@bela/protocol"
import { useTranslation, usePlural } from "../../i18n"
import PlayerAvatar from "./PlayerAvatar"

/* ──────────────────────────────────────────────────────────────────────────
   RoomListItem — one row in the lobby's room list (game/DESIGN.md §1 "Lobby").

   The row used to render four anonymous circles, because `RoomSummary` only
   carried counts: you could not tell a table of friends from a table of bots,
   and clicking a full one failed only after the join went out. It now carries
   `occupants` (display names, bots marked as bots — no uids, README §3) and
   `joinable`, the SERVER's own answer to "could a newcomer enter?". A row that
   is not joinable is refused here, with the same reason the server would give.

   Those occupants render as FACES, not as a roster: avatar or initials for
   whoever is seated, an empty ring for a free chair, and no names on the card
   at all (see `Occupant`). The names stay in the aria labels.
   ────────────────────────────────────────────────────────────────────── */

/**
 * One seat, as a FACE — never a name.
 *
 * The row is a card in a scannable list, not a roster: four names wrapped over
 * two or three lines turned every card into a paragraph and buried the things
 * you actually pick a room by (its name, whether there is room, the target
 * score). A face — photo, initials, or the dashed empty ring — says "someone
 * is there" at a glance, and an empty seat says "there is room" by being
 * visibly empty rather than by spelling out "Slobodno sjedalo".
 *
 * What the eye gives up the screen reader keeps: every slot carries the name
 * as its `aria-label` (and as a hover `title`), on top of the row-level
 * summary that lists all four in seat order.
 */
function Occupant({ occupant, emptyLabel }: { occupant: RoomOccupant; emptyLabel: string }) {
    const label = occupant?.name ?? emptyLabel
    return (
        <Box
            role="img"
            aria-label={label}
            title={label}
            /* Bots are present but not people — the same half-tone the widget
               and the felt give them, so a table of bots reads as one. */
            opacity={occupant?.kind === "BOT" ? 0.6 : 1}
        >
            <PlayerAvatar size="sm" empty={!occupant} name={occupant?.name} />
        </Box>
    )
}

export default function RoomListItem({
    room,
    mine = false,
    disabled = false,
    onClick,
}: {
    room: RoomSummary
    /** This room is holding a seat for us (`game.active`). */
    mine?: boolean
    /**
     * Closed to us because we already hold a seat somewhere else (one game at
     * a time, game/README.md §3.2). The server refuses the join either way;
     * the row is disabled so nobody fires a request that can only fail.
     */
    disabled?: boolean
    onClick: () => void
}) {
    const { t } = useTranslation()
    const plural = usePlural()

    /* Full and closed to newcomers. `joinable` comes from the server's own
       admission predicate, so this can never claim a room is full while it
       still has a seat to give — the fault this row is being fixed for. Our
       OWN room stays open to us whatever it says. */
    const full = !room.joinable && !mine
    const blocked = disabled || full
    const freeSeats = 4 - room.seatsTaken
    const names = room.occupants.map((o) => o?.name ?? t("game.lobby.emptySeat")).join(", ")

    return (
        <Box
            as="button"
            /* `Box as="button"` does not take the `disabled` attribute in
               Chakra's polymorphic typing, so the row announces itself with
               `aria-disabled` and simply refuses the click. */
            onClick={blocked ? undefined : onClick}
            aria-disabled={blocked || undefined}
            w="100%"
            textAlign="left"
            rounded="xl"
            borderWidth="1px"
            borderColor={mine ? "brand.400" : "border.subtle"}
            bg="bg.panel"
            p="3"
            minH="44px"
            opacity={blocked ? 0.5 : 1}
            cursor={blocked ? "not-allowed" : "pointer"}
            transition="background-color 0.15s ease, border-color 0.15s ease"
            _hover={blocked ? undefined : { borderColor: "brand.400", boxShadow: "md", transform: "translateY(-2px)" }}
            aria-label={t("game.lobby.enterAria", { name: room.name })}
            title={disabled ? t("game.lobby.blockedRoom") : full ? t("game.lobby.fullBlocked") : undefined}
        >
            <HStack justify="space-between" gap="3">
                <VStack align="start" gap="1.5" flex="1" minW="0">
                    <HStack gap="2" minW="0">
                        <Text fontWeight="semibold" lineClamp={1}>{room.name}</Text>
                        {room.private && (
                            <Badge size="sm" variant="subtle" colorPalette="gray"
                                aria-label={t("game.lobby.privateAria")} title={t("game.lobby.privateAria")}>
                                <FiLock size={12} /> {t("game.lobby.private")}
                            </Badge>
                        )}
                    </HStack>
                    <HStack gap="2" wrap="wrap">
                        <Badge size="sm" variant="subtle" colorPalette="gray">
                            {t("game.lobby.target", { target: room.targetScore })}
                        </Badge>
                        {full && (
                            <Badge size="sm" variant="solid" colorPalette="orange">
                                {t("game.lobby.full")}
                            </Badge>
                        )}
                        {/* A full table you may still watch is a different
                            offer from a full table that turns you away. */}
                        {room.seatsTaken >= 4 && room.allowSpectators && (
                            <Badge size="sm" variant="subtle" colorPalette="brand">
                                <FiEye size={12} /> {t("game.room.spectatorsAllowed")}
                            </Badge>
                        )}
                    </HStack>
                    {/* Who is in there, in seat order — four faces, no text.
                        The names live in `occupantsAria` and in each slot's own
                        label, so nothing is lost to anyone who cannot see the
                        avatars. */}
                    <HStack gap="2" aria-label={t("game.lobby.occupantsAria", { names })}>
                        {room.occupants.map((occupant, i) => (
                            <Occupant key={i} occupant={occupant} emptyLabel={t("game.lobby.emptySeat")} />
                        ))}
                    </HStack>
                    <Text fontSize="xs" color="fg.muted">
                        {freeSeats > 0
                            ? plural("game.lobby.freeSeats", freeSeats)
                            : room.allowSpectators
                                ? t("game.lobby.spectateHint")
                                : t("game.lobby.fullBlocked")}
                    </Text>
                </VStack>
                <Box color="fg.muted" flexShrink={0} aria-hidden="true">
                    <FiChevronRight size={20} />
                </Box>
            </HStack>
        </Box>
    )
}
