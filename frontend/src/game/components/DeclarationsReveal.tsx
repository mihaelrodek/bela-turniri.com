import { useEffect, useState } from "react"
import { Box, Flex, HStack, IconButton, Portal, Text, VStack } from "@chakra-ui/react"
import { FiX } from "react-icons/fi"
import type { RoomState, Seat } from "@bela/protocol"
import type { Declaration, Suit, Team } from "@bela/engine"
import { useTranslation } from "../../i18n"
import { otherTeam, SEATS, teamOf } from "../util/seats"
import { makeCard, suitKey } from "../util/cards"
import PlayingCard, { SuitIcon } from "./PlayingCard"
import BelotShowcase from "./BelotShowcase"
import PlayerAvatar from "./PlayerAvatar"
import { botAvatarPreset } from "../util/botAvatar"
import { EVENT_DWELL_MS } from "../hooks/useEventQueue"
import { GLASS_STRONG, INK, INK_MUTED, TEAM } from "./tableStyles"
import { OVERLAY_SAFE_INSET } from "../../components/navChrome"

/* ──────────────────────────────────────────────────────────────────────────
   DeclarationsReveal — the overlay that answers "who had what, and who got
   the points".

   Declarations are detected automatically by the engine (README §1.4, an
   explicit decision to avoid a "did you forget to declare?" step), which
   means the player never sees them being made. So the one moment they ARE
   revealed — before the first card — has to say whose they were and WHICH
   CARDS.

   ONLY THE SCORING PAIR IS EVER SHOWN, because only the scoring pair is ever
   sent (README §1.4): the losing pair's declarations are cards of hands
   nobody has played yet, and handing them out was free information every
   deal. There is therefore no dimmed "PROPADA" block any more — there is
   nothing to dim. If the VIEWER's own declarations lost, they get one plain
   line saying so and how much went with it; their own cards are theirs to
   know, but nobody else's are shown, and no cards are drawn for that line.

   It dismisses itself after the event queue's dwell or through its close button,
   whichever comes first: the automatic opening preview is brief and
   must never be something you have to close.
   ────────────────────────────────────────────────────────────────────── */

function seatName(seats: RoomState["seats"], seat: Seat, fallback: string): string {
    const occupant = seats[seat]?.occupant
    if (!occupant) return fallback
    return occupant.kind === "BOT" ? occupant.name : occupant.user.name
}

function totalPoints(declarations: readonly Declaration[]): number {
    return declarations.reduce((sum, d) => sum + d.points, 0)
}

/** The "Bela!" flash — 20 points for K+Q of trump, announced as it is played. */
export function BelaFlash({ seats, seat }: { seats: RoomState["seats"]; seat: Seat }) {
    const { t } = useTranslation()
    return (
        <Flex position="absolute" inset="0" align="center" justify="center" pointerEvents="none" zIndex={9}>
            <VStack
                gap="0"
                {...GLASS_STRONG}
                borderColor="brand.300"
                rounded="l3"
                px="7"
                py="4"
                boxShadow="0 0 40px color-mix(in srgb, var(--chakra-colors-brand-fg) 40%, transparent)"
                css={{
                    ...GLASS_STRONG.css,
                    animation: "belaFlashIn 220ms cubic-bezier(0.22, 1.2, 0.36, 1)",
                    "@keyframes belaFlashIn": {
                        from: { transform: "scale(0.7)", opacity: 0 },
                        to: { transform: "scale(1)", opacity: 1 },
                    },
                }}
            >
                <Text fontSize="3xl" fontFamily="heading" fontWeight="bold" color="brand.fg" lineHeight="1.1">
                    {t("game.bela.title")}
                </Text>
                <Text fontSize="sm" color={INK_MUTED}>
                    {t("game.bela.by", { name: seatName(seats, seat, t("game.seat.empty")) })}
                </Text>
            </VStack>
        </Flex>
    )
}

/** "Bot Dora zove žir" — the moment trump is settled.
 *
 *  A FULL OVERLAY since 2026-09-20 (user request: "stavi bas veci modal koji
 *  se automatski makne kao kad prikazuje zvanja ali krace traje"): same
 *  portal, same dimmed backdrop and same card as the declarations reveal
 *  below, so the two read as one family — only bigger in the suit and much
 *  shorter on screen (`TRUMP_FLASH_MS` in `GameRoomPage`, 1500 ms inside
 *  TRUMP_SET's own 1600 ms dwell, against the declarations' 4000 ms).
 *  Trimmed down again 2026-09-20 (user request: text and suit picture were
 *  too big) — suit icon 88 -> 52, headline "2xl" -> "lg", card maxW
 *  340 -> 280px, padding 6/6 -> 5/4 (px/py) — still its own family with the
 *  declarations card below, just a smaller instance of it.
 *  It cannot be dismissed by hand and eats no taps (`pointerEvents="none"`):
 *  it is gone before anybody could reach for it, and swallowing the tap that
 *  starts the next card would be worse than the beat itself.
 *
 *  The caller's medallion and the score panel carry the fact for the rest of
 *  the deal; this only makes sure nobody missed the moment it happened. */
export function TrumpFlash({ seats, seat, suit }: { seats: RoomState["seats"]; seat: Seat; suit: Suit }) {
    const { t } = useTranslation()
    return (
        <Portal>
            <Flex
                position="fixed"
                inset="0"
                align="center"
                justify="center"
                zIndex={1500}
                pointerEvents="none"
                bg="blackAlpha.500"
                backdropFilter="blur(2px)"
                css={{
                    // Backdrop to every edge, content inside the safe area —
                    // see OVERLAY_SAFE_INSET in navChrome.ts.
                    ...OVERLAY_SAFE_INSET,
                    animation: "trumpBackdropIn 160ms ease-out",
                    "@keyframes trumpBackdropIn": { from: { opacity: 0 }, to: { opacity: 1 } },
                }}
            >
                <VStack
                    gap="3"
                    {...GLASS_STRONG}
                    borderColor="brand.300"
                    rounded="l3"
                    w="100%"
                    maxW="280px"
                    px="5"
                    py="4"
                    role="status"
                    aria-live="polite"
                    boxShadow="0 18px 40px rgba(0,0,0,0.55)"
                    css={{
                        ...GLASS_STRONG.css,
                        animation: "trumpFlashIn 180ms cubic-bezier(0.22, 1.2, 0.36, 1)",
                        "@keyframes trumpFlashIn": {
                            from: { transform: "scale(0.8)", opacity: 0 },
                            to: { transform: "scale(1)", opacity: 1 },
                        },
                    }}
                >
                    <SuitIcon suit={suit} size={52} />
                    <Text fontSize="lg" fontWeight="bold" color={INK} lineHeight="1.15" textAlign="center">
                        {t("game.trump.calledBy", {
                            name: seatName(seats, seat, t("game.seat.empty")),
                            suit: t(`game.suit.${suit}`),
                        })}
                    </Text>
                </VStack>
            </Flex>
        </Portal>
    )
}

/** A full-suit hand is rare enough to deserve its own unmistakable moment.
 * The engine has already ended the game when this renders; the overlay only
 * reveals the eight-card hand before the ordinary result dialog appears. The
 * show itself is `BelotShowcase`, shared with the blok; this only names the
 * player and the suit. Taps pass through — the event queue owns the dwell. */
export function BelotFlash({
    seats,
    seat,
    mySeat,
    suit,
    reducedMotion,
}: {
    seats: RoomState["seats"]
    seat: Seat
    /** The viewer's own seat, to say "Mi" / "Oni"; null = a spectator. */
    mySeat: Seat | null
    suit: Suit
    reducedMotion: boolean
}) {
    const { t } = useTranslation()
    const name = seatName(seats, seat, t("game.seat.empty"))
    const occupant = seats[seat]?.occupant ?? null
    const avatarUrl = occupant?.kind === "PLAYER" ? occupant.user.avatarUrl : null
    const avatarPreset = occupant?.kind === "PLAYER"
        ? occupant.user.avatarPreset
        : occupant?.kind === "BOT"
            ? occupant.avatarPreset ?? botAvatarPreset(occupant.name)
            : null
    const team = mySeat === null
        ? t(teamOf(seat) === "A" ? "game.score.teamA" : "game.score.teamB")
        : t(teamOf(seat) === teamOf(mySeat) ? "game.score.us" : "game.score.them")

    return (
        <BelotShowcase
            suit={suit}
            kicker={t("game.belot.congrats")}
            title={t("game.belot.title")}
            winner={{
                name,
                team,
                avatar: <PlayerAvatar name={name} avatarUrl={avatarUrl} avatarPreset={avatarPreset} size="lg" />,
            }}
            subtitle={t("game.belot.by", { suit: t(suitKey(suit)) })}
            footnote={t("game.belot.wins")}
            durationMs={EVENT_DWELL_MS.BELOT}
            reducedMotion={reducedMotion}
        />
    )
}

export default function DeclarationsReveal({
    perSeat,
    scoringTeam,
    seats,
    mySeat,
    declarationPoints,
    belaDeclared,
    trumpSuit = null,
    onDismiss,
}: {
    /** The SCORING pair only — that is all the engine sends (README §1.4). */
    perSeat: Partial<Record<Seat, Declaration[]>>
    scoringTeam: Team | null
    seats: RoomState["seats"]
    mySeat: Seat | null
    /** Live totals include Bela, which can belong to the other pair even
     *  when ordinary declarations were awarded to the scoring pair. */
    declarationPoints?: Record<Team, number>
    belaDeclared: Team | null
    /** Trump of the running deal — the only thing needed to DRAW a bela, since
     *  bela is always K+Q of trump. Null before trump is settled, in which case
     *  there can be no bela either. */
    trumpSuit?: Suit | null
    onDismiss?: () => void
}) {
    const { t } = useTranslation()
    const myTeam: Team = mySeat === null ? "A" : teamOf(mySeat)
    // Belt and braces: the payload is already trimmed server-side, but the
    // overlay must not render a losing block even if one ever reached it.
    const withDeclarations = SEATS.filter(
        (seat) =>
            (perSeat[seat]?.length ?? 0) > 0 &&
            scoringTeam !== null &&
            teamOf(seat) === scoringTeam,
    )
    const theirTeam = otherTeam(myTeam)
    const ordinaryPoints: Record<Team, number> = { A: 0, B: 0 }
    for (const seat of withDeclarations) {
        ordinaryPoints[teamOf(seat)] += totalPoints(perSeat[seat] ?? [])
    }
    const points = declarationPoints ?? ordinaryPoints
    const teamRows = [
        {
            team: myTeam,
            side: "us" as const,
            label: mySeat === null ? t("game.score.teamA") : t("game.score.us"),
        },
        {
            team: theirTeam,
            side: "them" as const,
            label: mySeat === null ? t("game.score.teamB") : t("game.score.them"),
        },
    ]
    /* Bela is K+Q of trump and the engine only ever tells us the TEAM that
       announced it (`PlayerView.belaDeclared`), never the seat — so it is
       drawn as its own row, attributed to that pair, with the two real cards
       rather than a footnote under the total. */
    const belaRow =
        belaDeclared !== null && trumpSuit !== null
            ? teamRows.find((row) => row.team === belaDeclared) ?? null
            : null
    const nothingToShow = withDeclarations.length === 0 && belaDeclared === null

    /* The two totals tiles double as tabs (2026-09-20, user request: "kad oba
       para nešto imaju teško je vidjeti tko je što zvao" — clicking MI/ONI
       should show only that team's rows). `seatRowsFor(team)` plus
       `belaDeclared === team` answer "what does THIS team have", so both the
       tabs' selected styling and the filtered rows below read off the same
       source. Default selection is the
       viewer's own team when it has anything (declarations, bela, or its own
       lost declarations to report), else the other team, matching the user's
       "if only one team has anything, select that one". It resets whenever
       the actual content changes (new deal, new reveal) so a stale tab never
       lingers into the next hand — the effect depends only on `defaultTeam`
       itself, which is already a full function of that content. */
    const seatRowsFor = (team: Team) => withDeclarations.filter((seat) => teamOf(seat) === team)
    const myHasContent = seatRowsFor(myTeam).length > 0 || belaDeclared === myTeam
    const theirHasContent = seatRowsFor(theirTeam).length > 0 || belaDeclared === theirTeam
    // A pair with nothing to show cannot be selected at all (2026-09-20, user
    // request: "nemoguće označiti zvanja ako netko nije imao zvanja"). Void
    // declarations of the losing pair count as nothing: no tab, no "propadaju"
    // line (user request 2026-09-20).
    const hasContent: Record<Team, boolean> = {
        [myTeam]: myHasContent,
        [theirTeam]: theirHasContent,
    } as Record<Team, boolean>
    const defaultTeam: Team =
        myHasContent ? myTeam : theirHasContent ? theirTeam : myTeam
    const [selectedTeam, setSelectedTeam] = useState<Team>(defaultTeam)
    useEffect(() => {
        setSelectedTeam(defaultTeam)
    }, [defaultTeam])
    const selectedRows = seatRowsFor(selectedTeam)
    const selectedBela = belaDeclared === selectedTeam

    return (
        <Portal>
            <Flex
                position="fixed"
                inset="0"
                align="center"
                justify="center"
                zIndex={1500}
                bg="blackAlpha.500"
                backdropFilter="blur(2px)"
                onClick={onDismiss}
                css={{
                    // Backdrop to every edge, content inside the safe area —
                    // see OVERLAY_SAFE_INSET in navChrome.ts.
                    ...OVERLAY_SAFE_INSET,
                    // Same rule as the table under it (2026-09-20): this is a
                    // picture of cards, not text to select. Portals render
                    // outside the room's own subtree, so it is repeated here.
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    WebkitTouchCallout: "none",
                    animation: "belaRevealIn 180ms ease-out",
                    "@keyframes belaRevealIn": { from: { opacity: 0 }, to: { opacity: 1 } },
                }}
            >
            <VStack
                gap="2"
                align="stretch"
                {...GLASS_STRONG}
                rounded="l3"
                px="4"
                py="3"
                w="100%"
                maxW="420px"
                maxH="94%"
                overflowY="auto"
                position="relative"
                boxShadow="0 18px 40px rgba(0,0,0,0.55)"
                onClick={(event) => event.stopPropagation()}
            >
                {onDismiss && (
                    <IconButton
                        aria-label={t("game.common.close")}
                        title={t("game.common.close")}
                        variant="ghost"
                        size="xs"
                        position="absolute"
                        top="2"
                        right="2"
                        onClick={onDismiss}
                    >
                        <FiX />
                    </IconButton>
                )}
                <Text fontSize="sm" fontFamily="heading" fontWeight="bold" textAlign="center" color={INK} letterSpacing="wide">
                    {t("game.declarations.title")}
                </Text>

                {nothingToShow ? (
                    <Text fontSize="xs" color={INK_MUTED} textAlign="center" py="2">
                        {t("game.declarations.none")}
                    </Text>
                ) : (
                    <>
                        {/* Real tabs now (2026-09-20, user request), not just a
                            totals readout: selecting MI/ONI filters everything
                            below to that team's rows, so a deal where both
                            pairs have something no longer mixes them. */}
                        <HStack role="tablist" aria-label={t("game.declarations.title")} gap="2" align="stretch">
                            {teamRows.map(({ team, side, label }) => {
                                const selected = selectedTeam === team
                                const enabled = hasContent[team]
                                return (
                                    // `VStack as="button"` (project pattern — Chakra's
                                    // polymorphic typing has no `type` prop) rather than a
                                    // real <Button>: keeps the existing tile look intact.
                                    <VStack
                                        key={team}
                                        as="button"
                                        role="tab"
                                        aria-selected={selected}
                                        aria-disabled={!enabled}
                                        tabIndex={selected ? 0 : -1}
                                        onClick={enabled ? () => setSelectedTeam(team) : undefined}
                                        onKeyDown={(event) => {
                                            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
                                            event.preventDefault()
                                            if (hasContent[otherTeam(team)]) setSelectedTeam(otherTeam(team))
                                        }}
                                        flex="1"
                                        gap="0.5"
                                        align={side === "us" ? "start" : "end"}
                                        rounded="l2"
                                        px="2.5"
                                        py="2"
                                        bg="bg.subtle"
                                        borderWidth={selected ? "2px" : "1px"}
                                        borderColor={selected ? TEAM[side] : "border.subtle"}
                                        borderTopWidth="2px"
                                        borderTopColor={TEAM[side]}
                                        opacity={!enabled ? 0.4 : selected ? 1 : 0.65}
                                        cursor={enabled ? "pointer" : "not-allowed"}
                                        transition="opacity 120ms ease, border-color 120ms ease"
                                        _focusVisible={{ outline: "2px solid", outlineColor: TEAM[side], outlineOffset: "2px" }}
                                    >
                                        <Text
                                            fontSize="2xs"
                                            fontFamily="mono"
                                            fontWeight="bold"
                                            color={TEAM[side]}
                                            textTransform="uppercase"
                                            letterSpacing="wide"
                                        >
                                            {label}
                                        </Text>
                                        <Text
                                            fontSize="xl"
                                            lineHeight="1"
                                            fontFamily="mono"
                                            fontWeight="black"
                                            color={points[team] > 0 ? INK : INK_MUTED}
                                            fontVariantNumeric="tabular-nums"
                                        >
                                            {points[team] > 0 ? `+${points[team]}` : "—"}
                                        </Text>
                                    </VStack>
                                )
                            })}
                        </HStack>

                        {/* The selected team's rows only — the scoring pair's
                            declared cards, and/or its bela, whichever apply. */}
                        {selectedRows.length === 0 && !selectedBela ? (
                            <Text fontSize="xs" color={INK_MUTED} textAlign="center" py="2">
                                {t("game.declarations.noneForTeam")}
                            </Text>
                        ) : (
                            <>
                                {selectedRows.map((seat) => {
                                    const declarations = perSeat[seat] ?? []
                                    const seatPoints = totalPoints(declarations)

                                    return (
                                        <Box
                                            key={seat}
                                            rounded="l2"
                                            px="2"
                                            py="1.5"
                                            bg="bg.subtle"
                                            borderWidth="1px"
                                            borderColor="border"
                                        >
                                        <HStack justify="space-between" gap="2">
                                            <HStack gap="1.5" minW="0">
                                                <Text fontSize="xs" fontWeight="bold" color={INK} lineClamp={1}>
                                                    {seatName(seats, seat, t("game.seat.empty"))}
                                                </Text>
                                                <Text
                                                    fontSize="xs"
                                                    fontFamily="mono"
                                                    fontWeight="black"
                                                    color="gold"
                                                    fontVariantNumeric="tabular-nums"
                                                    flexShrink={0}
                                                >
                                                    + {seatPoints}
                                                </Text>
                                            </HStack>
                                        </HStack>

                                        {/* The cards are enough to explain the declaration;
                                            its combined value lives beside the player's
                                            name, where it is easier to scan. */}
                                        {declarations.map((declaration) => (
                                            <HStack key={declaration.cards.join("-")} gap="2" mt="1.5" wrap="wrap">
                                                <HStack gap="0" flex="1" minW="0">
                                                    {declaration.cards.map((card, i) => (
                                                        <Box key={card} ml={i === 0 ? "0" : "-10px"}>
                                                            <PlayingCard card={card} size="sm" />
                                                        </Box>
                                                    ))}
                                                </HStack>
                                            </HStack>
                                        ))}
                                        </Box>
                                    )
                                })}

                                {selectedBela && (
                                    belaRow && trumpSuit !== null ? (
                                        <Box
                                            rounded="l2"
                                            px="2"
                                            py="1.5"
                                            bg="bg.subtle"
                                            borderWidth="1px"
                                            borderColor="border"
                                        >
                                            <HStack justify="space-between" gap="2">
                                                <Text fontSize="xs" fontWeight="bold" color={INK} lineClamp={1}>
                                                    {t("game.declarations.bela")}
                                                </Text>
                                                <Text
                                                    fontSize="2xs"
                                                    fontFamily="mono"
                                                    fontWeight="bold"
                                                    color={TEAM[belaRow.side]}
                                                    textTransform="uppercase"
                                                    letterSpacing="wide"
                                                    flexShrink={0}
                                                >
                                                    {belaRow.label}
                                                </Text>
                                            </HStack>
                                            <HStack gap="0" mt="1.5">
                                                {[makeCard("K", trumpSuit), makeCard("Q", trumpSuit)].map((card, i) => (
                                                    <Box key={card} ml={i === 0 ? "0" : "-10px"}>
                                                        <PlayingCard card={card} size="sm" />
                                                    </Box>
                                                ))}
                                            </HStack>
                                        </Box>
                                    ) : (
                                        // Bela was announced but trump has not
                                        // propagated to this snapshot yet — see
                                        // `trumpSuit` doc above; a plain line
                                        // beats a missing block.
                                        <Text fontSize="2xs" fontWeight="bold" color={INK_MUTED} textAlign="center">
                                            {t("game.declarations.bela")}
                                        </Text>
                                    )
                                )}
                            </>
                        )}

                    </>
                )}

            </VStack>
            </Flex>
        </Portal>
    )
}
