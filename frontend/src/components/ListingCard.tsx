import { Box, Flex, HStack, Image, Skeleton, Text, VStack } from "@chakra-ui/react"
import { Link as RouterLink } from "react-router-dom"
import { FiClock, FiMapPin, FiNavigation } from "react-icons/fi"
import { useTranslation } from "../i18n"
import { formatDistanceKm } from "../utils/distance"
import {
    fillRatio,
    initialsOf,
    positiveAmount,
    shortLocation,
    useDateParts,
    useListingStatus,
    useTournamentPrefetch,
    type ListingTournament,
    type ListingVariant,
    type StatusKind,
} from "./listingShared"

/* ──────────────────────────────────────────────────────────────────────────
   ListingCard — one tournament in the "Mreža" (grid) view.

   Shape, top to bottom:
     · the poster fills the head of the card, with three overlays on it —
       a white date tile top-left (PON / 03 / KOL), a status pill top-right,
       a start-time pill bottom-right;
     · the body carries the name and a single location line;
     · then EITHER the capacity bar (upcoming) OR the winner chip (finished);
     · and a footer rule with the kotizacija large and in the brand colour.

   The three overlays sit on a photograph, not on a themed surface, so their
   colours are fixed literals rather than semantic tokens — the same
   deliberate exception `MapPage`'s pin colours make. Everything below the
   poster is tokens only and flips with the colour mode.
   ────────────────────────────────────────────────────────────────────── */

/** Scrim palette for the poster overlays. Fixed in BOTH themes on purpose:
 *  these are painted over an arbitrary photo, where `fg.muted` would go pale
 *  in dark mode and vanish against a white date tile. */
const SCRIM = {
    tile: "rgba(255,255,255,0.94)",
    tileShadow: "0 1px 4px rgba(11,21,34,0.28)",
    tileMuted: "#5B6B7C",
    tileInk: "#16212E",
    pill: "rgba(15,23,32,0.72)",
    pillFg: "#FFFFFF",
} as const

/** Dot colour inside the status pill, per status. Same fixed-literal reason
 *  as SCRIM above — the pill floats over the poster. */
const STATUS_DOT: Record<StatusKind, string> = {
    finished: "#94A3B8",
    full: "#F59E0B",
    soon: "#22C55E",
    upcoming: "#7fc496", // brand.300 — a lighter tint than `soon`'s brighter green so the two stay distinguishable now both are green
}

/** Poster, or a calm initials placeholder when the tournament has none. */
function Poster({ item, priority }: { item: ListingTournament; priority: boolean }) {
    const { t } = useTranslation()

    if (item.bannerUrl) {
        return (
            <Image
                src={item.bannerUrl}
                alt={item.name}
                w="100%"
                h="100%"
                objectFit="cover"
                objectPosition="top center"
                draggable={false}
                // The first card is the likely LCP element; everything below
                // the fold waits until it is scrolled towards.
                loading={priority ? "eager" : "lazy"}
                fetchPriority={priority ? "high" : undefined}
                decoding="async"
            />
        )
    }
    return (
        <Flex
            w="100%"
            h="100%"
            align="center"
            justify="center"
            bg="bg.subtle"
            title={t("pages.tournaments.noPoster")}
            aria-label={t("pages.tournaments.noPoster")}
        >
            <Text
                fontSize={{ base: "4xl", md: "5xl" }}
                fontWeight="bold"
                color="fg.subtle"
                letterSpacing="-0.04em"
                opacity={0.5}
                userSelect="none"
            >
                {initialsOf(item.name)}
            </Text>
        </Flex>
    )
}

export default function ListingCard({
    item,
    variant,
    priority = false,
}: {
    item: ListingTournament
    variant: ListingVariant
    /** True for the first, above-the-fold card — its poster loads eagerly. */
    priority?: boolean
}) {
    const { t } = useTranslation()
    const dateParts = useDateParts()
    const listingStatus = useListingStatus()

    const parts = dateParts(item.startAt)
    const status = listingStatus(item, variant)
    const finished = variant === "finished"

    const price = positiveAmount(item.entryPrice)
    const repassage = positiveAmount(item.repassagePrice)
    const winner = (item.winnerName ?? "").trim()
    const place = shortLocation(item.location)
    const fill = fillRatio(item)

    // Warm the detail cache on intent, not on click: onMouseEnter covers
    // desktop hover, onPointerDown fires on the touch-down of a tap — both
    // land a few hundred ms before the navigation actually happens.
    const prefetch = useTournamentPrefetch()
    const idOrSlug = item.slug ?? item.uuid
    const warm = () => prefetch(idOrSlug)

    return (
        <RouterLink
            to={`/turniri/${idOrSlug}`}
            onMouseEnter={warm}
            onPointerDown={warm}
            // display:flex + height:100% so the link stretches to fill its grid
            // cell. CSS Grid already stretches each cell to the tallest row
            // height, but a `display: block` <a> sizes to its own content and
            // breaks the chain — the inner Box's `h="full"` would then resolve
            // against the short link rather than the tall cell.
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                textDecoration: "none",
                color: "inherit",
            }}
        >
            <Box
                borderWidth="1px"
                borderColor="border.subtle"
                rounded="xl"
                overflow="hidden"
                bg="bg.panel"
                shadow="card"
                h="full"
                display="flex"
                flexDirection="column"
                transition="transform .15s ease, box-shadow .15s ease, border-color .15s ease, filter .15s ease, opacity .15s ease"
                // A finished tournament is desaturated so a spectator reads
                // "this is over" before reading a single word of it. Hovering
                // restores full colour — the card is still a link worth
                // opening, and the mute must never fight legibility once the
                // user has aimed at it.
                css={finished ? { filter: "grayscale(0.55)", opacity: 0.86 } : undefined}
                _hover={{
                    shadow: "raised",
                    transform: "translateY(-2px)",
                    borderColor: "brand.emphasized",
                    filter: "none",
                    opacity: 1,
                }}
            >
                {/* ── Poster + overlays ─────────────────────────────────── */}
                {/* SHORTER ON A PHONE (2026-09-09, user request): at 150px the
                    list showed one card and a slice of the next, so the second
                    tournament was never a thing you could read — you had to
                    scroll to find out it existed. 118px still carries the date
                    chip, the status pill, the initials and the time, which is
                    everything this band is for. Desktop keeps its height: there
                    the poster is doing real work in a grid of three. */}
                <Box position="relative" h={{ base: "118px", md: "170px" }} overflow="hidden">
                    <Poster item={item} priority={priority} />

                    {parts && (
                        <VStack
                            position="absolute"
                            top="3"
                            left="3"
                            gap="0"
                            minW="52px"
                            px="2.5"
                            py="1.5"
                            rounded="lg"
                            bg={SCRIM.tile}
                            textAlign="center"
                            // A white tile needs an edge of its own: over the
                            // poster-less placeholder (a pale `bg.subtle` box)
                            // it would otherwise have no visible boundary.
                            boxShadow={SCRIM.tileShadow}
                            css={{ backdropFilter: "blur(6px)" }}
                        >
                            <Text
                                fontSize="2xs"
                                fontWeight="bold"
                                letterSpacing="0.12em"
                                lineHeight="1.3"
                                color={SCRIM.tileMuted}
                            >
                                {parts.weekday}
                            </Text>
                            <Text
                                fontSize="xl"
                                fontWeight="bold"
                                lineHeight="1.05"
                                letterSpacing="-0.03em"
                                color={SCRIM.tileInk}
                            >
                                {parts.day}
                            </Text>
                            <Text
                                fontSize="2xs"
                                fontWeight="bold"
                                letterSpacing="0.12em"
                                lineHeight="1.3"
                                color="brand.solid"
                            >
                                {parts.month}
                            </Text>
                        </VStack>
                    )}

                    <HStack
                        position="absolute"
                        top="3"
                        right="3"
                        gap="1.5"
                        px="2.5"
                        py="1"
                        rounded="full"
                        bg={SCRIM.pill}
                        color={SCRIM.pillFg}
                        css={{ backdropFilter: "blur(6px)" }}
                    >
                        <Box w="6px" h="6px" rounded="full" bg={STATUS_DOT[status.kind]} flexShrink="0" />
                        <Text fontSize="2xs" fontWeight="bold" letterSpacing="0.04em" whiteSpace="nowrap">
                            {status.label}
                        </Text>
                    </HStack>

                    {parts?.time && (
                        <HStack
                            position="absolute"
                            bottom="3"
                            right="3"
                            gap="1.5"
                            px="2.5"
                            py="1"
                            rounded="md"
                            bg={SCRIM.pill}
                            color={SCRIM.pillFg}
                            css={{ backdropFilter: "blur(6px)" }}
                        >
                            <FiClock size={12} />
                            <Text fontSize="sm" fontWeight="bold" letterSpacing="-0.02em">
                                {parts.time}
                            </Text>
                        </HStack>
                    )}
                </Box>

                {/* ── Body ──────────────────────────────────────────────── */}
                {/* Same trim below the band: `gap="3" p="4"` is 28px of air
                    per card on a screen that wants to show two of them. */}
                <VStack align="stretch" gap={{ base: "2", md: "3" }} p={{ base: "3", md: "4" }} flex="1" minW="0">
                    {/* Title and location get fixed heights so a one-line and a
                        two-line name occupy the same space and every card in a
                        row lines its footer up with its neighbours. */}
                    <Box minW="0">
                        <Text
                            fontWeight="bold"
                            fontSize={{ base: "15px", md: "md" }}
                            lineHeight="1.3"
                            letterSpacing="-0.01em"
                            css={{
                                display: "-webkit-box",
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 2,
                                overflow: "hidden",
                                wordBreak: "break-word",
                                height: "calc(2 * 1.3em)",
                            }}
                        >
                            {item.name}
                        </Text>
                        <HStack
                            mt="1.5"
                            h="18px"
                            gap="1.5"
                            color="fg.muted"
                            fontSize="xs"
                            minW="0"
                            overflow="hidden"
                        >
                            {place && (
                                <>
                                    <Box flexShrink="0" display="inline-flex">
                                        <FiMapPin size={12} />
                                    </Box>
                                    <Text truncate title={item.location ?? undefined}>{place}</Text>
                                </>
                            )}
                            {/* Distance belongs beside the place, not down in the
                                money row: both answer "where is this", and reading
                                them together is what decides whether to go. */}
                            {typeof item.distanceKm === "number" && (
                                <HStack gap="1" flexShrink="0" ml={place ? "auto" : undefined}>
                                    <Box flexShrink="0" display="inline-flex">
                                        <FiNavigation size={12} />
                                    </Box>
                                    <Text>{formatDistanceKm(item.distanceKm)}</Text>
                                </HStack>
                            )}
                        </HStack>
                    </Box>

                    {/* Finished tournaments show who won; upcoming ones show how
                        many pairs are already in. The two never coexist, so they
                        share one slot and the footer stays at the same height. */}
                    {finished ? (
                        winner ? (
                            <HStack gap="2" align="center" minW="0">
                                <Text
                                    fontSize="2xs"
                                    fontWeight="bold"
                                    letterSpacing="0.1em"
                                    textTransform="uppercase"
                                    color="fg.muted"
                                    flexShrink="0"
                                >
                                    {t("pages.tournaments.winnersLabel")}
                                </Text>
                                <Box
                                    px="2"
                                    py="0.5"
                                    rounded="full"
                                    bg="yellow.subtle"
                                    color="yellow.fg"
                                    fontSize="xs"
                                    fontWeight="bold"
                                    minW="0"
                                    truncate
                                >
                                    {winner}
                                </Box>
                            </HStack>
                        ) : (
                            <Text fontSize="xs" color="fg.subtle">
                                {t("pages.tournaments.card.noWinner")}
                            </Text>
                        )
                    ) : (
                        <Box>
                            <Flex justify="space-between" align="baseline" mb="1.5">
                                <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                                    {t("pages.tournaments.card.fillLabel")}
                                </Text>
                                <Text textStyle="mono" fontSize="xs">
                                    {item.registeredPairs ?? 0}
                                    {typeof item.maxPairs === "number" ? ` / ${item.maxPairs}` : " / ∞"}
                                </Text>
                            </Flex>
                            <Box h="6px" bg="bg.subtle" rounded="full" overflow="hidden">
                                <Box
                                    h="100%"
                                    w={`${Math.round(fill * 100)}%`}
                                    rounded="full"
                                    bg={status.kind === "full" ? "orange.solid" : "brand.solid"}
                                    transition="width .2s ease"
                                />
                            </Box>
                        </Box>
                    )}

                    {/* ── Footer: kotizacija, large and in the brand colour ── */}
                    <Flex
                        align="baseline"
                        gap="2"
                        wrap="wrap"
                        rowGap="1"
                        pt="3"
                        mt="auto"
                        borderTopWidth="1px"
                        borderColor="border.subtle"
                        minW="0"
                    >
                        {price ? (
                            <HStack gap="1.5" align="baseline" minW="0">
                                <Text fontSize="lg" fontWeight="bold" color="brand.fg" letterSpacing="-0.02em">
                                    {price}
                                </Text>
                                <Text fontSize="2xs" color="fg.muted" fontWeight="medium">
                                    {t("pages.tournaments.card.entryFeeLabel")}
                                </Text>
                            </HStack>
                        ) : (
                            <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                                {t("pages.tournaments.card.freeEntry")}
                            </Text>
                        )}

                        {repassage && (
                            <>
                                <Text as="span" color="fg.subtle" fontSize="sm">/</Text>
                                <HStack gap="1.5" align="baseline" minW="0">
                                    <Text fontSize="sm" fontWeight="bold" color="fg.soft">
                                        {repassage}
                                    </Text>
                                    <Text fontSize="2xs" color="fg.muted" fontWeight="medium">
                                        {t("pages.tournaments.card.repassageLabel")}
                                    </Text>
                                </HStack>
                            </>
                        )}

                    </Flex>
                </VStack>
            </Box>
        </RouterLink>
    )
}

/** Loading skeleton with the card's silhouette, so the grid doesn't jump. */
export function ListingCardSkeleton() {
    return (
        <Box
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="xl"
            overflow="hidden"
            bg="bg.panel"
        >
            <Skeleton h={{ base: "150px", md: "170px" }} />
            <VStack align="stretch" gap="3" p="4">
                <Skeleton h="4" w="75%" />
                <Skeleton h="3" w="45%" />
                <Skeleton h="2" w="100%" />
                <Skeleton h="5" w="35%" />
            </VStack>
        </Box>
    )
}
