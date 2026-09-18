import type { CSSProperties, ReactNode } from "react"
import { Box, Flex, Text } from "@chakra-ui/react"
import BelaAvatar from "../../components/avatars/BelaAvatar"
import { isAvatarId } from "../../components/avatars/avatarArt"
import type { Reaction, SeatInfo, Suit } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import type { TurnCountdown } from "../hooks/useTurnCountdown"
import { suitKey } from "../util/cards"
import { occupantName, type Occupant } from "../util/seats"
import { botAvatarPreset } from "../util/botAvatar"
import { REACTION_TEXT_KEYS } from "../util/reactions"
import AvatarPhoto from "./AvatarPhoto"
import SuitGlyph from "./SuitGlyph"
import { INK, INK_MUTED, SHORT, TEAM, type TeamSide } from "./tableStyles"

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

   Three facts can live on the avatar, in the SAME corner on every seat —
   that is the whole reason they are corners and not a row of chips:

       top-left      THEY CALLED TRUMP, with the suit  (all deal)
       top-right     they are the dealer

   Every mark is pinned by `pinAt()`, which puts it TANGENT to the outside of
   the turn ring — the dealer's "D" cutting through that ring is what made the
   old right-hand seat look broken.

   The active player has a clear avatar ring and a neutral name pill.
   Human turn deadlines drain around the avatar without moving the seat.

   WHICH PAIR a seat belongs to is the `team` prop, painted from `TEAM`
   (tableStyles.ts, DESIGN §6): our green, theirs gold, on the ring and on the
   name pill. Position said it before — partner opposite, opponents on the
   flanks — and position still says it; the colour just means you do not have
   to re-derive it every time you look up from your own cards. The urgent
   countdown overrides it with red, because "two seconds left" outranks
   "these are the opponents".
   ────────────────────────────────────────────────────────────────────── */

/** What a seat is currently saying out loud, if anything. */
export type SeatBid = { kind: "pass" } | { kind: "suit"; suit: Suit }

/** Permanent marks pinned around the avatar. The temporary reaction is a
 *  separate speech bubble because it now carries a short phrase. */
const MARK = 18

/** The ring's own thickness, i.e. how far the avatar's outer edge sits from
 *  the photo. Shared by `pinAt` so a mark can be placed outside it. */
const RING = 3

/**
 * A Chakra colour token as something raw CSS can use.
 *
 * The ring is a `conic-gradient` and the spotlight a `radial-gradient`, and a
 * gradient string is handed to the browser verbatim — Chakra never looks
 * inside it for tokens. `TEAM.them` is already a literal and passes straight
 * through; `TEAM.us` is a ramp token and becomes its CSS variable.
 */
function tokenColor(token: string): string {
    return token.startsWith("#") ? token : `var(--chakra-colors-${token.replace(".", "-")})`
}

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
 * felt's seats and the smaller one `GameRoomPage` docks in the corner for my
 * own seat) and a fixed `bottom: -4px`
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
 * The avatar and everything pinned to it. Exported because `GameRoomPage`
 * shows exactly this for my own seat, docked in the corner, and nothing
 * else — my name is not repeated, and my turn is already said by the pill
 * over the hand.
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
    reactionAlign = "center",
    team = "us",
}: {
    occupant: Occupant | null
    name: string
    /** Edge length of the photo, in px. The ring and every mark scale off it. */
    size?: number
    isTurn?: boolean
    isDealer?: boolean
    /** Which pair this seat plays for, relative to ME (`TEAM` in
     *  tableStyles.ts). Defaults to "us" so my own corner avatar in
     *  `GameRoomPage` needs no argument. */
    team?: TeamSide
    /** Trump suit when THIS seat called it — the marker that has to last the
     *  whole deal, not just the moment they said it. */
    callerTrump?: Suit | null
    countdown?: TurnCountdown | null
    reaction?: Reaction | null
    /** Keep a flank seat's speech bubble inside the table. */
    reactionAlign?: "left" | "center" | "right"
    reducedMotion?: boolean
}) {
    const { t } = useTranslation()
    const disconnected = occupant?.kind === "PLAYER" && !occupant.connected
    const avatarUrl = occupant?.kind === "PLAYER" ? occupant.user.avatarUrl : null
    // Same order of preference as `PlayerAvatar` (picked face > photo >
    // initials), kept in step by hand because the felt draws its own avatar:
    // this one carries the turn-clock ring and the seat marks.
    const avatarPreset = occupant?.kind === "PLAYER"
        ? occupant.user.avatarPreset
        : occupant?.kind === "BOT"
            ? occupant.avatarPreset ?? botAvatarPreset(occupant.name)
            : null

    // A conic gradient is the cheapest ring that animates without SVG: the
    // filled arc is the remaining fraction of the turn clock, the rest is the
    // unspent part of it, drawn dim so the ring reads as a dial and not as a
    // border that happens to be two colours.
    //
    // The lit colour is the SEAT'S TEAM, so the same ring carries both facts;
    // urgency takes it over, because a seat about to time out is no longer
    // telling you who it plays with. Off turn the ring stays on — dimmed to
    // the team's soft tint — so the pairs are legible between moves too.
    const teamColor = TEAM[team]
    const liveTint = countdown?.urgent ? "var(--chakra-colors-red-400)" : tokenColor(teamColor)
    const ring = isTurn && countdown
        ? `conic-gradient(from 0deg, ${liveTint} ${countdown.fraction * 360}deg, rgba(255,255,255,0.16) 0deg)`
        : isTurn
            ? liveTint
            : "transparent"

    const frame = size + RING * 2

    return (
        <Box position="relative" w={`${frame}px`} h={`${frame}px`} flexShrink={0}>
            <Box
                position="absolute"
                inset="0"
                zIndex={1}
                p={`${RING}px`}
                rounded="full"
                background={ring}
                boxShadow="none"
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
                    bg="bg.opaque"
                    borderWidth="1px"
                    borderStyle={occupant === null ? "dashed" : "solid"}
                    borderColor="border"
                    color={INK}
                    fontWeight="semibold"
                    fontSize={size >= 40 ? "sm" : "xs"}
                    opacity={disconnected ? 0.5 : 1}
                >
                    {isAvatarId(avatarPreset) ? (
                        <BelaAvatar id={avatarPreset} boxSize="100%" />
                    ) : avatarUrl ? (
                        <AvatarPhoto src={avatarUrl} fallback={initialsOf(name)} />
                    ) : occupant === null ? (
                        <Text fontSize="md" color={INK_MUTED} aria-hidden="true">+</Text>
                    ) : (
                        initialsOf(name)
                    )}
                </Box>
            </Box>

            {callerTrump && (
                <Mark
                    at={pinAt(size, "tl", MARK)}
                    bg="brand.50"
                    color="brand.950"
                    label={t("game.seat.calledTrump", { suit: t(suitKey(callerTrump)) })}
                >
                    <SuitGlyph suit={callerTrump} size={11} />
                </Mark>
            )}

            {/* The dealer's "D" as a struck COIN: a metal gradient, a darker
                milled edge and the letter cut into it. It is the one mark
                that is about an object a player can picture (the buck at a
                real table), and a flat amber disc was reading as one more
                status chip. */}
            {isDealer && (
                <Mark
                    at={pinAt(size, "tr", MARK)}
                    bg="linear-gradient(160deg, #f6dd93 0%, #d9a521 52%, #a97c12 100%)"
                    color="#4a3406"
                    label={t("game.seat.dealer")}
                    edge="rgba(255, 236, 178, 0.85)"
                >
                    <Box as="span" fontSize="11px" fontWeight="bold" lineHeight="1">
                        {t("game.seat.dealerShort")}
                    </Box>
                </Mark>
            )}

            {reaction && (
                <Box
                    position="absolute"
                    bottom={`calc(100% + 7px)`}
                    left={reactionAlign === "right" ? "auto" : reactionAlign === "left" ? "0" : "50%"}
                    right={reactionAlign === "right" ? "0" : "auto"}
                    transform={reactionAlign === "center" ? "translateX(-50%)" : undefined}
                    zIndex={8}
                    pointerEvents="none"
                >
                    <Flex
                        position="relative"
                        w="max-content"
                        maxW="min(180px, calc(100vw - 32px))"
                        px="3"
                        py="1.5"
                        align="center"
                        justify="center"
                        rounded="xl"
                        bg="brand.50"
                        color="brand.950"
                        borderWidth="1px"
                        borderColor="brand.300"
                        boxShadow="0 5px 18px rgba(0,0,0,0.28)"
                        fontSize="11px"
                        fontWeight="semibold"
                        lineHeight="short"
                        textAlign="center"
                        whiteSpace="normal"
                        css={{
                            animation: "belaReactionPop 180ms cubic-bezier(0.22, 1.2, 0.36, 1)",
                            "@keyframes belaReactionPop": {
                                from: { transform: "translateY(5px) scale(0.88)", opacity: 0 },
                                to: { transform: "translateY(0) scale(1)", opacity: 1 },
                            },
                            "&::after": {
                                content: "''",
                                position: "absolute",
                                top: "100%",
                                left: reactionAlign === "left"
                                    ? `${frame / 2 - 5}px`
                                    : reactionAlign === "right" ? "auto" : "50%",
                                right: reactionAlign === "right" ? `${frame / 2 - 5}px` : "auto",
                                transform: reactionAlign === "center" ? "translateX(-50%)" : undefined,
                                borderLeft: "5px solid transparent",
                                borderRight: "5px solid transparent",
                                borderTop: "6px solid var(--chakra-colors-brand-50)",
                            },
                        }}
                    >
                        <Box as="span" aria-hidden="true" fontSize="14px" mr="1.5" lineHeight="1">{reaction}</Box>
                        {t(REACTION_TEXT_KEYS[reaction])}
                    </Flex>
                </Box>
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
    edge,
    children,
}: {
    at: CSSProperties
    /** A token, or any raw CSS background — the dealer's coin is a gradient. */
    bg: string
    color: string
    label: string
    /** An optional lit inner edge, for the marks that are meant to look
     *  struck rather than printed. */
    edge?: string
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
            background={bg}
            color={color}
            boxShadow={[
                edge ? `inset 0 1px 0 ${edge}` : null,
                "0 0 0 2px var(--chakra-colors-bg-opaque)",
                "0 1px 4px rgba(0,0,0,0.5)",
            ].filter(Boolean).join(", ")}
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
    reactionAlign = "center",
    reducedMotion = false,
    team = "us",
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
    /** Quick phrase from `chat.reaction`, floated briefly above the avatar. */
    reaction?: Reaction | null
    reactionAlign?: "left" | "center" | "right"
    reducedMotion?: boolean
    /** My pair or theirs, relative to the viewer (`TEAM`, DESIGN §6). */
    team?: TeamSide
}) {
    const { t } = useTranslation()
    const occupant = info.occupant
    const name = occupantName(occupant, t("game.seat.empty"))
    const disconnected = occupant?.kind === "PLAYER" && !occupant.connected

    // At most one chip, in falling order of urgency, in a slot that keeps its
    // height when empty. Anything PERMANENT about the seat — dealer or called
    // trump — is a mark on the avatar instead, so this line only ever
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
                reactionAlign={reactionAlign}
                reducedMotion={reducedMotion}
                team={team}
            />

            <Box
                mt="0.5"
                w="100%"
                px="1.5"
                py="0.5"
                rounded="full"
                textAlign="center"
                bg={isTurn ? "bg.opaque" : "transparent"}
                color={INK}
                borderWidth="1px"
                borderColor={isTurn ? "border" : "transparent"}
                boxShadow={isTurn ? "0 2px 8px rgba(0,0,0,0.06)" : undefined}
                fontSize={{ base: "11px", md: "12px" }}
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
        muted: { bg: "bg.opaque", color: INK_MUTED, border: "border" },
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
