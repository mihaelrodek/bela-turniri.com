import { useEffect, useRef, useState } from "react"
import { Badge, Box, HStack, Text, VStack } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"
import { FiChevronRight, FiEye, FiLock } from "react-icons/fi"
import type { RoomOccupant, RoomSummary } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import { botAvatarPreset } from "../util/botAvatar"
import PlayerAvatar from "./PlayerAvatar"
import { TEAM } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   RoomListItem — one row in the lobby's room list (game/DESIGN.md §1 "Lobby").

   The row used to render four anonymous circles, because `RoomSummary` only
   carried counts: you could not tell a table of friends from a table of bots,
   and clicking a full one failed only after the join went out. It now carries
   `occupants` (public names and preset faces, bots marked as bots — no uids,
   README §3) and
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
            <PlayerAvatar
                size="sm"
                empty={!occupant}
                name={occupant?.name}
                avatarPreset={occupant?.kind === "BOT"
                    ? occupant.avatarPreset ?? botAvatarPreset(occupant.name)
                    : occupant?.avatarPreset}
            />
        </Box>
    )
}

/* Module-scope emotion keyframes (a nested "@keyframes" in Chakra's `css` prop
   does not run — game/DESIGN.md). Both animations END on the card's resting
   look, so a dead animation leaves an ordinary card, never a hidden one. */
const roomEnter = keyframes`
    0%   { opacity: 0; transform: translateY(14px) scale(0.97); }
    60%  { opacity: 1; transform: translateY(-2px) scale(1.005); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
`
const roomStarted = keyframes`
    0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--chakra-colors-live) 55%, transparent); transform: scale(1); }
    25%  { transform: scale(1.012); }
    100% { box-shadow: 0 0 0 14px color-mix(in srgb, var(--chakra-colors-live) 0%, transparent); transform: scale(1); }
`
const badgePop = keyframes`
    0%   { opacity: 0; transform: scale(0.6); }
    60%  { opacity: 1; transform: scale(1.12); }
    100% { opacity: 1; transform: scale(1); }
`
/** Seats by pair: partners sit opposite each other (0–2, 1–3). */
const PAIRS: readonly (readonly [0 | 1 | 2 | 3, 0 | 1 | 2 | 3])[] = [[0, 2], [1, 3]]
const ENTER_MS = 480
const STARTED_MS = 1100

export default function RoomListItem({
    room,
    mine = false,
    disabled = false,
    entering = false,
    reducedMotion = false,
    onClick,
}: {
    /** The room appeared in the list just now (not part of the first load):
     *  it slides in instead of popping into the grid. */
    entering?: boolean
    reducedMotion?: boolean
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

    /* Full and closed to newcomers. `joinable` comes from the server's own
       admission predicate, so this can never claim a room is full while it
       still has a seat to give — the fault this row is being fixed for. Our
       OWN room stays open to us whatever it says. */
    const full = !room.joinable && !mine
    const blocked = disabled || full
    const playing = room.status === "PLAYING"
    /* "Igra je počela": the moment THIS row goes from waiting to playing, the
       card pulses once and the badge pops — so a glance at the lobby shows
       which table just started, not only which ones are running. Rooms that
       were already playing when the list loaded stay still. */
    const previousStatus = useRef(room.status)
    const [justStarted, setJustStarted] = useState(false)
    useEffect(() => {
        const before = previousStatus.current
        previousStatus.current = room.status
        if (before === "PLAYING" || room.status !== "PLAYING") return
        setJustStarted(true)
        const timer = window.setTimeout(() => setJustStarted(false), STARTED_MS)
        return () => window.clearTimeout(timer)
    }, [room.status])

    const animation = reducedMotion
        ? undefined
        : justStarted
            ? `${roomStarted} ${STARTED_MS}ms ease-out both`
            : entering
                ? `${roomEnter} ${ENTER_MS}ms cubic-bezier(0.22, 1, 0.36, 1) both`
                : undefined
    const badgeAnimation = !reducedMotion && justStarted ? `${badgePop} 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both` : undefined

    const names = PAIRS.flat().map((seat) => room.occupants[seat]?.name ?? t("game.lobby.emptySeat")).join(", ")

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
            borderColor={playing ? "live/60" : mine ? "brand.400" : "border.subtle"}
            bg="bg"
            p="2.5"
            minH="44px"
            cursor={blocked ? "not-allowed" : "pointer"}
            animation={animation}
            transition="background-color 0.15s ease, border-color 0.15s ease"
            _hover={blocked ? undefined : {
                borderColor: playing ? "live" : "brand.400",
                boxShadow: "md",
                transform: "translateY(-2px)",
            }}
            aria-label={t("game.lobby.enterAria", { name: room.name })}
            title={disabled ? t("game.lobby.blockedRoom") : full ? t("game.lobby.fullBlocked") : undefined}
        >
            <HStack justify="space-between" align="center" gap="2">
                <VStack align="stretch" gap="2" flex="1" minW="0">
                    {/* Top row, same corners at every width (2026-09-21, user
                        request): name (+ "Privatna") pinned top-left, the
                        rule chips pinned top-right. Chips used to drop to
                        their own line under the name on phones — now the
                        chip group itself wraps (flexWrap, justified to the
                        end) and floats to the right of whichever line it
                        lands on via `ml="auto"`, while the name side flexes
                        and truncates (`flex=1 minW=0`, `lineClamp`) so it
                        never pushes the chips off the card. */}
                    <HStack wrap="wrap" align="start" gap="2">
                        {/* `1 1 auto`, not `1`: with a zero flex-basis the wrap
                            decision sees a zero-width name, keeps the chips on
                            line one and squeezes the name down to "…". With
                            `auto` the name claims its real width first and the
                            chips drop to a second, right-aligned line. */}
                        <HStack gap="2" flex="1 1 auto" minW="0" maxW="full">
                            <Text fontFamily="heading" fontWeight="semibold" lineClamp={1} minW="0">{room.name}</Text>
                            {room.private && (
                                <Badge size="sm" variant="subtle" colorPalette="gray" flexShrink={0}
                                    aria-label={t("game.lobby.privateAria")} title={t("game.lobby.privateAria")}>
                                    <FiLock size={12} /> {t("game.lobby.private")}
                                </Badge>
                            )}
                        </HStack>
                        <HStack gap="1.5" wrap="wrap" justify="flex-end" ml="auto" flexShrink={0} maxW="full">
                            <Badge size="sm" variant="subtle" colorPalette="brand" fontFamily="mono" fontVariantNumeric="tabular-nums">
                                {room.targetScore}
                            </Badge>
                            <Badge size="sm" variant="subtle" colorPalette={room.noDeclarations ? "orange" : "gray"}>
                                {t(room.noDeclarations ? "game.rules.noDeclarations" : "game.rules.withDeclarations")}
                            </Badge>
                            <Badge size="sm" variant="subtle" colorPalette="gray">
                                {t(`game.lobby.finishMode.${room.gameEndRule}`)}
                            </Badge>
                            {room.minWinRatePercent > 0 && (
                                <Badge size="sm" variant="subtle" colorPalette="orange" fontFamily="mono" fontVariantNumeric="tabular-nums">
                                    {t("game.room.minWinRateShort", { percent: room.minWinRatePercent })}
                                </Badge>
                            )}
                        </HStack>
                    </HStack>

                    {/* Bottom row: who is in there, BY PAIR, bottom-left —
                        four faces, no text. Seats 0 and 2 are partners, 1 and
                        3 the other pair (the room screen groups them the
                        same way); in plain seat order a bot added as an
                        OPPONENT sat right next to the host and read as his
                        partner (2026-09-21, user report). Each pair gets its
                        own underline in the two team colours, and a gap
                        between them does the rest. The names live in
                        `occupantsAria` and in each slot's own label.
                        "Igra se" sits bottom-right, vertically aligned with
                        the avatar row instead of competing with the name/
                        chips up top — it used to live in the top row (desktop:
                        left of the chips; phone: top-right) and got cramped
                        whenever the chips wrapped. */}
                    <HStack justify="space-between" align="center" gap="2">
                        <HStack gap="3" align="center" aria-label={t("game.lobby.occupantsAria", { names })}>
                            {PAIRS.map((pair, pairIndex) => (
                                <HStack
                                    key={pairIndex}
                                    gap="1.5"
                                    pb="1"
                                    borderBottomWidth="2px"
                                    borderColor={pairIndex === 0 ? TEAM.us : TEAM.them}
                                >
                                    {pair.map((seat) => (
                                        <Occupant key={seat} occupant={room.occupants[seat]} emptyLabel={t("game.lobby.emptySeat")} />
                                    ))}
                                </HStack>
                            ))}
                            {room.seatsTaken >= 4 && room.allowSpectators && (
                                <Badge size="sm" variant="subtle" colorPalette="brand" ml="1">
                                    <FiEye size={12} /> {t("game.room.spectatorsAllowed")}
                                </Badge>
                            )}
                        </HStack>
                        {room.status === "PLAYING" && (
                            <Badge size="sm" variant="solid" colorPalette="orange" flexShrink={0} whiteSpace="nowrap" animation={badgeAnimation}>
                                {t("game.lobby.playing")}
                            </Badge>
                        )}
                    </HStack>
                </VStack>
                {/* The chevron stays a sibling of the two-row column, not part
                    of it, so it stays vertically centred on the whole card
                    (as today) rather than tracking whichever row the badge
                    ends up in — a chip wrap that adds a line to the top row
                    would otherwise drag a chevron anchored to the bottom row
                    off-centre. Space for it is reserved by the outer HStack,
                    so it never collides with "Igra se" underneath the chips. */}
                <Box display={{ base: "none", md: "block" }} color="fg.muted" flexShrink={0} aria-hidden="true">
                    <FiChevronRight size={20} />
                </Box>
            </HStack>
        </Box>
    )
}
