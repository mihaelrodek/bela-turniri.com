import type { ReactNode } from "react"
import { Box, Flex, HStack, Image, Text } from "@chakra-ui/react"
import type { SeatInfo, Suit } from "@bela/protocol"
import { usePlural, useTranslation } from "../../i18n"
import type { TurnCountdown } from "../hooks/useTurnCountdown"
import { isFlank, type TablePosition } from "../util/seats"
import SuitGlyph from "./SuitGlyph"
import { INK, INK_MUTED } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   Seat — one player around the table.

   Everything a player must read WITHOUT looking away from the trick, and
   nothing else: who it is, whether they are on turn (light pill + a thin
   ring draining from `turnDeadline`), whether they deal, whether they called
   or passed, whether they dropped out, and how many cards they still hold.

   The countdown is a RING rather than a number — "nearly out of time" is a
   shape you catch in peripheral vision while you are looking at the cards.
   The seconds only appear once the ring turns urgent, so the table is quiet
   the other 75 % of every turn.

   My own seat (`position === "bottom"`) renders as a compact horizontal pill
   instead of a column: it sits directly above the hand tray and every pixel
   it takes comes off the felt.
   ────────────────────────────────────────────────────────────────────── */

/** What a seat is currently saying out loud, if anything. */
export type SeatBid = { kind: "pass" } | { kind: "suit"; suit: Suit }

function initialsOf(name: string): string {
    return (
        name
            .split(/[\s@]+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join("") || "?"
    )
}

export default function Seat({
    info,
    position,
    isMe = false,
    isTurn = false,
    isDealer = false,
    isCaller = false,
    cardsInHand = 0,
    countdown = null,
    bid = null,
    reaction = null,
}: {
    info: SeatInfo
    position: TablePosition
    isMe?: boolean
    isTurn?: boolean
    isDealer?: boolean
    /** Called trump this deal — "zove". */
    isCaller?: boolean
    cardsInHand?: number
    /** Only passed for the seat on turn. */
    countdown?: TurnCountdown | null
    /** This deal's bid, shown as a chip while the bidding runs. */
    bid?: SeatBid | null
    /** Emoji from `chat.reaction`, floated for ~2 s and then withdrawn. */
    reaction?: string | null
}) {
    const { t } = useTranslation()
    const plural = usePlural()
    const occupant = info.occupant

    const name = occupant === null
        ? t("game.seat.empty")
        : occupant.kind === "BOT"
            ? occupant.name
            : occupant.user.name
    const avatarUrl = occupant?.kind === "PLAYER" ? occupant.user.avatarUrl : null
    const disconnected = occupant?.kind === "PLAYER" && !occupant.connected
    const compact = position === "bottom"
    const avatar = compact ? "34px" : "42px"

    // A conic gradient is the cheapest ring that animates without SVG: the
    // filled arc is the remaining fraction of the turn clock, the rest is the
    // table showing through.
    const ring = isTurn && countdown
        ? `conic-gradient(var(--chakra-colors-${countdown.urgent ? "red-400" : "brand-300"}) ${countdown.fraction * 360}deg, rgba(255,255,255,0.14) 0deg)`
        : undefined

    const avatarBlock = (
        <Box
            position="relative"
            p="2px"
            rounded="full"
            background={ring}
            boxShadow={isTurn ? "0 0 0 2px var(--chakra-colors-brand-300), 0 0 18px rgba(127,196,150,0.35)" : undefined}
            transition="box-shadow 0.2s ease"
            flexShrink={0}
        >
            <Box
                w={avatar}
                h={avatar}
                rounded="full"
                overflow="hidden"
                display="flex"
                alignItems="center"
                justifyContent="center"
                bg="brand.950/70"
                borderWidth="1px"
                borderStyle={occupant === null ? "dashed" : "solid"}
                borderColor={occupant === null ? "brand.600" : "brand.700"}
                color={INK}
                fontWeight="semibold"
                fontSize="xs"
                opacity={disconnected ? 0.5 : 1}
            >
                {avatarUrl ? (
                    <Image src={avatarUrl} alt="" w="100%" h="100%" objectFit="cover" loading="lazy" />
                ) : occupant === null ? (
                    <Text fontSize="md" color={INK_MUTED} aria-hidden="true">+</Text>
                ) : (
                    initialsOf(name)
                )}
            </Box>

            {isDealer && (
                <Flex
                    position="absolute"
                    bottom="-3px"
                    right="-3px"
                    w="16px"
                    h="16px"
                    align="center"
                    justify="center"
                    rounded="full"
                    bg="brand.100"
                    color="brand.950"
                    fontSize="9px"
                    fontWeight="bold"
                    title={t("game.seat.dealer")}
                    aria-label={t("game.seat.dealer")}
                >
                    {t("game.seat.dealerShort")}
                </Flex>
            )}

            {reaction && (
                <Flex
                    position="absolute"
                    top="-14px"
                    right="-16px"
                    w="30px"
                    h="30px"
                    align="center"
                    justify="center"
                    rounded="full"
                    bg="brand.950/88"
                    borderWidth="1px"
                    borderColor="brand.600"
                    fontSize="16px"
                    lineHeight="1"
                    zIndex={2}
                    pointerEvents="none"
                    css={{
                        animation: "belaReactionPop 180ms cubic-bezier(0.22, 1.2, 0.36, 1)",
                        "@keyframes belaReactionPop": {
                            from: { transform: "scale(0.4)", opacity: 0 },
                            to: { transform: "scale(1)", opacity: 1 },
                        },
                    }}
                >
                    <Box as="span" aria-hidden="true">{reaction}</Box>
                </Flex>
            )}
        </Box>
    )

    const namePill = (
        <Box
            px="2"
            py="0.5"
            rounded="full"
            maxW={compact ? "160px" : "104px"}
            bg={isTurn ? "brand.200" : "brand.950/62"}
            color={isTurn ? "brand.950" : INK}
            borderWidth="1px"
            borderColor={isTurn ? "brand.200" : "brand.700/70"}
            fontSize="11px"
            fontWeight={isTurn || isMe ? "bold" : "medium"}
            lineClamp={1}
            transition="background 0.2s ease, color 0.2s ease"
        >
            {isMe ? t("game.seat.youSuffix", { name }) : name}
        </Box>
    )

    const chips = (
        <HStack gap="1" justify="center" wrap="nowrap">
            {bid?.kind === "pass" && (
                <Chip tone="muted">{t("game.bidding.pass")}</Chip>
            )}
            {bid?.kind === "suit" && (
                <Chip tone="accent">
                    <SuitGlyph suit={bid.suit} size={12} />
                </Chip>
            )}
            {isCaller && <Chip tone="accent">{t("game.table.caller")}</Chip>}
            {occupant?.kind === "BOT" && <Chip tone="muted">{t(`game.bot.level.${occupant.level}`)}</Chip>}
            {disconnected && <Chip tone="danger">{t("game.seat.disconnected")}</Chip>}
            {isTurn && countdown?.urgent && (
                <Chip tone="danger">{countdown.seconds}</Chip>
            )}
        </HStack>
    )

    const fan = cardsInHand > 0 && !compact
        ? (
            <Flex
                direction={isFlank(position) ? "column" : "row"}
                aria-label={plural("game.seat.cardsInHand", cardsInHand)}
                title={plural("game.seat.cardsInHand", cardsInHand)}
            >
                {Array.from({ length: cardsInHand }, (_, i) => (
                    <Box
                        key={i}
                        w={isFlank(position) ? "16px" : "7px"}
                        h={isFlank(position) ? "7px" : "16px"}
                        rounded="2xs"
                        bg="brand.700"
                        borderWidth="1px"
                        borderColor="brand.950"
                        ml={!isFlank(position) && i > 0 ? "-2px" : undefined}
                        mt={isFlank(position) && i > 0 ? "-2px" : undefined}
                    />
                ))}
            </Flex>
        )
        : null

    if (compact) {
        return (
            <HStack gap="2" align="center" maxW="min(280px, 88vw)">
                {avatarBlock}
                {namePill}
                {chips}
            </HStack>
        )
    }

    return (
        <Flex direction="column" align="center" gap="1" maxW={{ base: "96px", md: "120px" }}>
            {avatarBlock}
            {namePill}
            {chips}
            {fan}
        </Flex>
    )
}

/** The one chip shape the seat uses, so five states stay one size. */
function Chip({ children, tone }: { children: ReactNode; tone: "muted" | "accent" | "danger" }) {
    const palette = {
        muted: { bg: "brand.950/62", color: INK_MUTED, border: "brand.700/70" },
        accent: { bg: "brand.300", color: "brand.950", border: "brand.300" },
        danger: { bg: "red.400", color: "white", border: "red.400" },
    }[tone]

    return (
        <Flex
            align="center"
            gap="1"
            px="1.5"
            py="0.5"
            rounded="full"
            bg={palette.bg}
            color={palette.color}
            borderWidth="1px"
            borderColor={palette.border}
            fontSize="9px"
            fontWeight="bold"
            lineHeight="1.4"
            textTransform="uppercase"
            letterSpacing="wide"
            whiteSpace="nowrap"
        >
            {children}
        </Flex>
    )
}
