import { Badge, Box, HStack, Text, VStack } from "@chakra-ui/react"
import { Link as RouterLink } from "react-router-dom"
import { FiAward, FiChevronRight, FiClock, FiMapPin, FiNavigation, FiUsers } from "react-icons/fi"
import { useTranslation } from "../i18n"
import { formatDistanceKm } from "../utils/distance"
import { DateTile, Meta } from "./rowPrimitives"
import {
    positiveAmount,
    shortLocation,
    useDateParts,
    useListingStatus,
    useTournamentPrefetch,
    type ListingTournament,
    type ListingVariant,
} from "./listingShared"

/* ──────────────────────────────────────────────────────────────────────────
   ListingRow — one tournament in the "Popis" (list) view.

   Same facts as the grid card, one row tall. The card spends most of its
   height on a poster; when you are scanning twenty tournaments for a date and
   a price, the poster is the one thing you do not need, so the row drops it
   and keeps the date tile, the name, the meta line and the kotizacija.

   The layout is deliberately the same skeleton as `CalendarEventRow` — date
   tile, then a two-line body, then the numbers pinned right on md+ — so the
   calendar's agenda and this list read as the same object rendered twice
   rather than two different components that happen to show tournaments.
   ────────────────────────────────────────────────────────────────────── */

export default function ListingRow({
    item,
    variant,
}: {
    item: ListingTournament
    variant: ListingVariant
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

    const prefetch = useTournamentPrefetch()
    const idOrSlug = item.slug ?? item.uuid
    const warm = () => prefetch(idOrSlug)

    return (
        <RouterLink
            to={`/turniri/${idOrSlug}`}
            onMouseEnter={warm}
            onPointerDown={warm}
            style={{ display: "block", textDecoration: "none", color: "inherit" }}
        >
            <HStack
                align="stretch"
                gap="3"
                px="3"
                py="2.5"
                rounded="xl"
                borderWidth="1px"
                borderColor="border.subtle"
                bg="bg.panel"
                opacity={finished ? 0.78 : 1}
                transition="border-color .15s ease, box-shadow .15s ease, opacity .15s ease"
                _hover={{ borderColor: "brand.emphasized", shadow: "card", opacity: 1 }}
            >
                {/* Date tile — themed rather than white-on-poster: the row has
                    no image behind it, so it uses surface tokens and follows
                    the colour mode. Shared with the calendar agenda; see
                    components/rowPrimitives.tsx. */}
                <DateTile
                    weekday={parts?.weekday ?? "—"}
                    day={parts?.day ?? "—"}
                    month={parts?.month || undefined}
                    accent={!finished}
                />

                <VStack align="stretch" gap="1" flex="1" minW="0" justify="center">
                    <HStack gap="2" align="center" minW="0">
                        <Text
                            fontWeight="semibold"
                            fontSize={{ base: "sm", md: "md" }}
                            lineHeight="short"
                            flex="1"
                            minW="0"
                            truncate
                        >
                            {item.name}
                        </Text>
                        <Badge
                            size="sm"
                            variant="subtle"
                            colorPalette={
                                status.kind === "finished"
                                    ? "gray"
                                    : status.kind === "full"
                                        ? "orange"
                                        : "brand"
                            }
                            flexShrink="0"
                            display={{ base: "none", sm: "inline-flex" }}
                        >
                            {status.label}
                        </Badge>
                    </HStack>

                    <HStack gap="3" rowGap="1" wrap="wrap" fontSize="xs" minW="0">
                        {parts?.time && <Meta icon={<FiClock size={12} />}>{parts.time}</Meta>}
                        {place && <Meta icon={<FiMapPin size={12} />}>{place}</Meta>}
                        {typeof item.distanceKm === "number" && (
                            <Meta icon={<FiNavigation size={12} />}>
                                {formatDistanceKm(item.distanceKm)}
                            </Meta>
                        )}
                        {finished && winner && (
                            <HStack gap="1" color="yellow.fg" fontWeight="semibold" minW="0">
                                <FiAward size={12} />
                                <Text truncate>{winner}</Text>
                            </HStack>
                        )}
                        {!finished && typeof item.registeredPairs === "number" && (
                            <Meta icon={<FiUsers size={12} />}>
                                {item.registeredPairs}
                                {typeof item.maxPairs === "number" ? ` / ${item.maxPairs}` : " / ∞"}
                            </Meta>
                        )}
                        {/* Phone: the kotizacija folds onto the meta line, the
                            only place a 390px row still has room for it. On md+
                            it moves to its own right-hand column, where the
                            repasaž fits under it too. */}
                        <HStack
                            gap="1"
                            color={price ? "brand.fg" : "fg.muted"}
                            fontWeight="bold"
                            display={{ base: "flex", md: "none" }}
                        >
                            <Text>{price ?? t("pages.tournaments.card.freeEntry")}</Text>
                        </HStack>
                    </HStack>
                </VStack>

                {/* Desktop: kotizacija anchored opposite the title, so the eye
                    can run straight down the price column. */}
                <VStack
                    align="end"
                    justify="center"
                    gap="0"
                    flexShrink="0"
                    pl="2"
                    display={{ base: "none", md: "flex" }}
                >
                    {price ? (
                        <>
                            <HStack gap="1" align="baseline">
                                <Text fontSize="md" fontWeight="bold" color="brand.fg" letterSpacing="-0.02em">
                                    {price}
                                </Text>
                                <Text fontSize="2xs" color="fg.muted" fontWeight="medium">
                                    {t("pages.tournaments.card.entryFeeLabel")}
                                </Text>
                            </HStack>
                            {/* The two fees are labelled separately rather than
                                summed into "30€ + 10€ kotizacija", which read as
                                if the repasaž were part of the entry fee. */}
                            {repassage && (
                                <HStack gap="1" align="baseline">
                                    <Text fontSize="xs" fontWeight="semibold" color="fg.soft">
                                        + {repassage}
                                    </Text>
                                    <Text fontSize="2xs" color="fg.muted" fontWeight="medium">
                                        {t("pages.tournaments.card.repassageLabel")}
                                    </Text>
                                </HStack>
                            )}
                        </>
                    ) : (
                        <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                            {t("pages.tournaments.card.freeEntry")}
                        </Text>
                    )}
                </VStack>

                <Box as="span" color="fg.subtle" alignSelf="center" flexShrink="0">
                    <FiChevronRight />
                </Box>
            </HStack>
        </RouterLink>
    )
}

/** Skeleton with the row's silhouette, so the list doesn't jump on load. */
export function ListingRowSkeleton() {
    return (
        <Box
            h={{ base: "72px", md: "76px" }}
            rounded="xl"
            borderWidth="1px"
            borderColor="border.subtle"
            bg="bg.subtle"
        />
    )
}
