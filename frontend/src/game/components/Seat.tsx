import type { CSSProperties, ReactNode } from "react"
import { Box, Flex, Image, Text } from "@chakra-ui/react"
import type { SeatInfo, Suit } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import type { TurnCountdown } from "../hooks/useTurnCountdown"
import { suitKey } from "../util/cards"
import { occupantName, type Occupant } from "../util/seats"
import SuitGlyph from "./SuitGlyph"
import { INK, INK_MUTED, SHORT } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   Seat — one player around the table.

   ONE ANATOMY, four sides. The seat used to be three different components in
   a trench coat: the top seat laid its parts out in a row, the flanks stacked
   them and then squeezed the name and a chip into a single line (which is why
   a bot called "Bot Ivo" rendered as "Bot…" with empty felt all round it),
   and each of them pinned the dealer's "D" somewhere else. Now every seat is
   the same fixed-width column, in the same order, at the same spacing:

       ┌──────────── var(--seat-w) ─────────────┐
       │            [ AVATAR + marks ]          │  40 / 44 px
       │                  4 px                  │
       │           [ name pill, full width ]    │  ~19 px
       │                  3 px                  │
       │        [ status chip, reserved slot ]  │  16 px
       └────────────────────────────────────────┘   = var(--seat-h)

   Which SIDE a seat is on decides only where the column is pinned
   (`SEAT_ANCHORS`), never what is in it. The status slot keeps its height
   whether or not it has a chip, so a seat never jumps as the deal moves.

   Four facts live permanently on the avatar, one per corner, in the SAME
   corner on every seat — that is the whole reason they are corners and not a
   row of chips:

       top-left      this is a bot
       top-right     the emoji they just sent   (transient)
       bottom-left   THEY CALLED TRUMP, with the suit  (all deal)
       bottom-right  they are the dealer

   Every mark is pinned by `pinAt()`, which puts it TANGENT to the outside of
   the turn ring — the dealer's "D" cutting through that ring is what made the
   old right-hand seat look broken.

   Whose turn it is has to survive a phone at arm's length, so it is said four
   times over on the seat that has it: a bright ring (the `turnDeadline`
   countdown draining round it), a glow spilling onto the felt beneath, a
   solid light name pill, and a small lift. The countdown is a RING rather
   than a number because "nearly out of time" is a shape you catch in
   peripheral vision; the seconds only appear once it turns urgent.
   ────────────────────────────────────────────────────────────────────── */

/** What a seat is currently saying out loud, if anything. */
export type SeatBid = { kind: "pass" } | { kind: "suit"; suit: Suit }

/** Marks pinned around the avatar. One size for all of them keeps the four
 *  corners visually equal weight; the reaction bubble is the one exception,
 *  because it is a 16 px emoji and has to hold one. */
const MARK = 18
const BUBBLE = 30

/** The ring's own thickness, i.e. how far the avatar's outer edge sits from
 *  the photo. Shared by `pinAt` so a mark can be placed outside it. */
const RING = 3

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

/**
 * Where a corner mark goes: on the 45° diagonal, just outside the turn ring.
 *
 * Computed rather than hand-tuned because the avatar comes in two sizes (the
 * felt's seats and the smaller one in `MySeatBar`) and a fixed `bottom: -4px`
 * that clears the ring at 44 px cuts straight through it at 32 px. Distances
 * are from the centre of the frame, which is `size/2 + RING` in from either
 * edge.
 */
function pinAt(size: number, corner: "tl" | "tr" | "bl" | "br", mark: number): CSSProperties {
    const radius = size / 2 + RING
    // +1 px of air, so the mark's dark halo touches the ring instead of
    // overlapping it.
    const distance = radius + mark / 2 + 1
    const step = distance * Math.SQRT1_2
    const cx = radius + (corner === "tl" || corner === "bl" ? -step : step)
    const cy = radius + (corner === "tl" || corner === "tr" ? -step : step)
    return { left: `${cx - mark / 2}px`, top: `${cy - mark / 2}px` }
}

/**
 * The avatar and everything pinned to it. Exported because `MySeatBar` shows
 * exactly this for my own seat and nothing else — my name and my turn are
 * already said by the pill next to it.
 */
export function SeatAvatar({
    occupant,
    name,
    size = 44,
    isTurn = false,
    isDealer = false,
    callerTrump = null,
    countdown = null,
    reaction = null,
    reducedMotion = false,
}: {
    occupant: Occupant | null
    name: string
    /** Edge length of the photo, in px. The ring and every mark scale off it. */
    size?: number
    isTurn?: boolean
    isDealer?: boolean
    /** Trump suit when THIS seat called it — the marker that has to last the
     *  whole deal, not just the moment they said it. */
    callerTrump?: Suit | null
    countdown?: TurnCountdown | null
    reaction?: string | null
    reducedMotion?: boolean
}) {
    const { t } = useTranslation()
    const disconnected = occupant?.kind === "PLAYER" && !occupant.connected
    const avatarUrl = occupant?.kind === "PLAYER" ? occupant.user.avatarUrl : null

    // A conic gradient is the cheapest ring that animates without SVG: the
    // filled arc is the remaining fraction of the turn clock, the rest is the
    // unspent part of it, drawn dim so the ring reads as a dial and not as a
    // border that happens to be two colours.
    const ringTint = countdown?.urgent ? "red-400" : "brand-300"
    const ring = isTurn && countdown
        ? `conic-gradient(from 0deg, var(--chakra-colors-${ringTint}) ${countdown.fraction * 360}deg, rgba(255,255,255,0.16) 0deg)`
        : isTurn
            ? "var(--chakra-colors-brand-300)"
            : undefined

    const frame = size + RING * 2

    return (
        <Box position="relative" w={`${frame}px`} h={`${frame}px`} flexShrink={0}>
            {/* The turn's spotlight: it spills onto the felt around the seat,
                so the active player is findable before you have read a single
                word. Behind everything, and never interactive. */}
            {isTurn && (
                <Box
                    position="absolute"
                    inset={`-${Math.round(size * 0.45)}px`}
                    rounded="full"
                    pointerEvents="none"
                    zIndex={0}
                    backgroundImage={`radial-gradient(circle, var(--chakra-colors-${ringTint}) 0%, transparent 68%)`}
                    opacity={0.34}
                    css={reducedMotion ? undefined : {
                        animation: "belaTurnPulse 1.8s ease-in-out infinite",
                        "@keyframes belaTurnPulse": {
                            "0%, 100%": { opacity: 0.22, transform: "scale(0.92)" },
                            "50%": { opacity: 0.42, transform: "scale(1.06)" },
                        },
                    }}
                />
            )}

            <Box
                position="absolute"
                inset="0"
                zIndex={1}
                p={`${RING}px`}
                rounded="full"
                background={ring}
                boxShadow={isTurn
                    ? "0 0 0 1px var(--chakra-colors-brand-100), 0 0 22px rgba(127,196,150,0.55)"
                    : "0 2px 6px rgba(0,0,0,0.45)"}
                transition="box-shadow 0.2s ease"
            >
                <Box
                    w="100%"
                    h="100%"
                    rounded="full"
                    overflow="hidden"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    bg="brand.950/80"
                    borderWidth="1px"
                    borderStyle={occupant === null ? "dashed" : "solid"}
                    borderColor={occupant === null ? "brand.600" : "brand.800"}
                    color={INK}
                    fontWeight="semibold"
                    fontSize={size >= 40 ? "sm" : "xs"}
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
            </Box>

            {occupant?.kind === "BOT" && (
                <Mark at={pinAt(size, "tl", MARK)} bg="brand.700" color={INK} label={t("game.bot.label")}>
                    <Box as="span" fontSize="8px" fontWeight="bold" letterSpacing="wide">
                        {t("game.bot.label")}
                    </Box>
                </Mark>
            )}

            {callerTrump && (
                <Mark
                    at={pinAt(size, "bl", MARK)}
                    bg="brand.50"
                    color="brand.950"
                    label={t("game.seat.calledTrump", { suit: t(suitKey(callerTrump)) })}
                >
                    <SuitGlyph suit={callerTrump} size={11} />
                </Mark>
            )}

            {isDealer && (
                <Mark
                    at={pinAt(size, "br", MARK)}
                    bg="orange.300"
                    color="brand.950"
                    label={t("game.seat.dealer")}
                >
                    <Box as="span" fontSize="11px" fontWeight="bold">{t("game.seat.dealerShort")}</Box>
                </Mark>
            )}

            {reaction && (
                <Flex
                    position="absolute"
                    style={pinAt(size, "tr", BUBBLE)}
                    w={`${BUBBLE}px`}
                    h={`${BUBBLE}px`}
                    align="center"
                    justify="center"
                    rounded="full"
                    bg="brand.950/88"
                    borderWidth="1px"
                    borderColor="brand.600"
                    fontSize="16px"
                    lineHeight="1"
                    zIndex={3}
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
}

/** One corner mark. Same disc, same halo, same size for all three permanent
 *  ones — only the fill changes — so "there is something in that corner" is
 *  one glance and reading which one is the second. The dark halo is what
 *  separates a mark from an avatar photo of any colour. */
function Mark({
    at,
    bg,
    color,
    label,
    children,
}: {
    at: CSSProperties
    bg: string
    color: string
    label: string
    children: ReactNode
}) {
    return (
        <Flex
            position="absolute"
            style={at}
            w={`${MARK}px`}
            h={`${MARK}px`}
            align="center"
            justify="center"
            rounded="full"
            zIndex={2}
            bg={bg}
            color={color}
            boxShadow="0 0 0 2px var(--chakra-colors-brand-950), 0 1px 4px rgba(0,0,0,0.5)"
            lineHeight="1"
            title={label}
            aria-label={label}
            role="img"
        >
            {children}
        </Flex>
    )
}

export default function Seat({
    info,
    isMe = false,
    isTurn = false,
    isDealer = false,
    callerTrump = null,
    countdown = null,
    bid = null,
    reaction = null,
    reducedMotion = false,
}: {
    info: SeatInfo
    isMe?: boolean
    isTurn?: boolean
    isDealer?: boolean
    /** Trump this seat called, for the medallion that lasts the whole deal. */
    callerTrump?: Suit | null
    /** Only passed for the seat on turn. */
    countdown?: TurnCountdown | null
    /** This deal's bid, shown as a chip while the bidding runs. */
    bid?: SeatBid | null
    /** Emoji from `chat.reaction`, floated for ~2 s and then withdrawn. */
    reaction?: string | null
    reducedMotion?: boolean
}) {
    const { t } = useTranslation()
    const occupant = info.occupant
    const name = occupantName(occupant, t("game.seat.empty"))
    const disconnected = occupant?.kind === "PLAYER" && !occupant.connected

    // At most one chip, in falling order of urgency, in a slot that keeps its
    // height when empty. Anything PERMANENT about the seat — bot, dealer,
    // called trump — is a mark on the avatar instead, so this line only ever
    // carries what is true right now.
    const chip: ReactNode = disconnected
        ? <Chip tone="danger">{t("game.seat.disconnected")}</Chip>
        : isTurn && countdown?.urgent
            ? <Chip tone="danger">{t("game.seat.secondsShort", { n: countdown.seconds })}</Chip>
            : isTurn
                ? <Chip tone="accent">{t("game.seat.onTurn")}</Chip>
                : bid?.kind === "pass"
                    ? <Chip tone="muted">{t("game.bidding.pass")}</Chip>
                    : bid?.kind === "suit"
                        ? <Chip tone="accent"><SuitGlyph suit={bid.suit} size={12} /></Chip>
                        : null

    return (
        <Flex
            direction="column"
            align="center"
            gap="0"
            w="var(--seat-w)"
            minH="var(--seat-h)"
            // The lift is the fourth channel on the active seat: it comes off
            // the felt towards you. Small on purpose — a seat that jumps is a
            // seat that moves the name you were reading.
            transform={isTurn ? "translateY(-3px)" : undefined}
            transition={reducedMotion ? undefined : "transform 0.2s ease"}
        >
            <SeatAvatar
                occupant={occupant}
                name={name}
                size={42}
                isTurn={isTurn}
                isDealer={isDealer}
                callerTrump={callerTrump}
                countdown={countdown}
                reaction={reaction}
                reducedMotion={reducedMotion}
            />

            <Box
                mt="1"
                w="100%"
                px="1.5"
                py="0.5"
                rounded="full"
                textAlign="center"
                bg={isTurn ? "brand.200" : "brand.950/72"}
                color={isTurn ? "brand.950" : INK}
                borderWidth="1px"
                borderColor={isTurn ? "brand.100" : "brand.700/70"}
                boxShadow={isTurn ? "0 0 14px rgba(127,196,150,0.45)" : undefined}
                fontSize="11px"
                fontWeight={isTurn || isMe ? "bold" : "medium"}
                lineHeight="1.45"
                // The pill gets the seat's FULL width now. The old flank seat
                // shared its line with the status chip, which is why a bot
                // called "Bot Ivo" rendered as "Bot…" with empty felt on
                // either side of it. Nothing in this app's own vocabulary
                // truncates at 92 px / 11 px any more; a long human name still
                // can, and keeps its `title`.
                whiteSpace="nowrap"
                overflow="hidden"
                textOverflow="ellipsis"
                title={name}
                transition="background 0.2s ease, color 0.2s ease"
            >
                {isMe ? t("game.seat.youSuffix", { name }) : name}
            </Box>

            {/* The status slot. Present even when empty: four seats that
                change height as the bidding goes round is four seats that
                twitch.

                A landscape phone has no 17 px to spare between the top seat
                and the trick, so there the slot goes entirely — everything it
                could have said is still on the turn ring, on the status pill
                above the hand, or (for the caller) on the avatar's medallion.
                `--seat-h` drops to 76 px under the same query; the two have to
                move together. */}
            <Flex
                h="17px"
                mt="0.5"
                align="center"
                justify="center"
                maxW="100%"
                css={{ [SHORT]: { display: "none" } }}
            >
                {chip}
            </Flex>
        </Flex>
    )
}

/** The one chip shape the seat uses, so every state stays one size. */
function Chip({ children, tone }: { children: ReactNode; tone: "muted" | "accent" | "danger" }) {
    const palette = {
        muted: { bg: "brand.950/72", color: INK_MUTED, border: "brand.700/70" },
        accent: { bg: "brand.300", color: "brand.950", border: "brand.100" },
        danger: { bg: "red.400", color: "white", border: "red.400" },
    }[tone]

    return (
        <Flex
            align="center"
            gap="1"
            px="1.5"
            rounded="full"
            h="100%"
            maxW="100%"
            flexShrink={0}
            bg={palette.bg}
            color={palette.color}
            borderWidth="1px"
            borderColor={palette.border}
            fontSize="9px"
            fontWeight="bold"
            lineHeight="1"
            textTransform="uppercase"
            letterSpacing="wide"
            whiteSpace="nowrap"
        >
            {children}
        </Flex>
    )
}
