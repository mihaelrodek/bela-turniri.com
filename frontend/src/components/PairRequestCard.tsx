import { Box, Button, HStack, IconButton, Skeleton, Text, VStack } from "@chakra-ui/react"
import { Link as RouterLink } from "react-router-dom"
import { FiCheck, FiChevronRight, FiEdit2, FiMap, FiMapPin, FiTrash2 } from "react-icons/fi"
import { useTranslation } from "../i18n"
import { formatDate } from "../utils/format"
import { shortLocation, useDateParts } from "./listingShared"
import { DateTile, Meta } from "./rowPrimitives"
import { PairAvatar, PairPhoneLine, PairStatusPill } from "./pairRequestPrimitives"
import type { PairRequest } from "../api/pairRequests"

/* ──────────────────────────────────────────────────────────────────────────
   PairRequestCard — one "tražim para" request in the "Kartice" view.

   Four bands, in the order a reader actually asks the questions:

     1. WHO   — initials tile, name, when it was posted, and the status pill;
     2. WHERE/WHEN — the tournament, as its own tappable block: the shared
        `DateTile`, the tournament name, the time and a shortened location,
        with an "open on map" button beside it when the tournament has been
        geocoded;
     3. WHY   — the poster's note, if they left one;
     4. HOW   — the contact line, and the owner-only actions opposite it.

   The tournament block is a link and the map button sits OUTSIDE it: an <a>
   inside an <a> is invalid HTML and browsers recover from it unpredictably.

   Everything is semantic tokens — unlike `ListingCard`, no band of this card
   is painted over a photograph, so nothing here needs a fixed literal.
   ────────────────────────────────────────────────────────────────────── */

export type PairRequestCardProps = {
    r: PairRequest
    /** The poster or an admin — gates Spareno / edit / delete. */
    canManage: boolean
    /** `/karta?turnir=…`, or null when the tournament has no geocoded pin. */
    mapHref: string | null
    /** Signed out: every phone came back redacted (see `PairPhoneLine`). */
    anonymous: boolean
    onEdit: () => void
    onMatch: () => void
    onDelete: () => void
}

/** The tournament block + its map escape hatch. Shared by the card only —
 *  the row spends its date tile on the same information in one line. */
function TournamentBlock({
    r,
    mapHref,
    matched,
}: {
    r: PairRequest
    mapHref: string | null
    matched: boolean
}) {
    const { t } = useTranslation()
    const dateParts = useDateParts()
    const parts = dateParts(r.tournamentStartAt)
    const place = shortLocation(r.tournamentLocation)

    return (
        <HStack gap="2" align="stretch" minW="0">
            <RouterLink
                to={`/turniri/${r.tournamentSlug ?? r.tournamentUuid}`}
                style={{ flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}
            >
                <HStack
                    gap="2.5"
                    align="center"
                    h="full"
                    px="2.5"
                    py="2"
                    rounded="lg"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    bg="bg.subtle"
                    minW="0"
                    transition="border-color .15s ease, background-color .15s ease"
                    _hover={{ borderColor: "brand.emphasized", bg: "bg.muted" }}
                >
                    <DateTile
                        weekday={parts?.weekday ?? "—"}
                        day={parts?.day ?? "—"}
                        month={parts?.month || undefined}
                        accent={!matched}
                    />
                    <VStack align="stretch" gap="0.5" flex="1" minW="0">
                        <Text fontSize="sm" fontWeight="bold" lineHeight="short" truncate>
                            {r.tournamentName}
                        </Text>
                        <HStack gap="2.5" rowGap="0.5" wrap="wrap" fontSize="xs" minW="0">
                            {parts?.time && <Meta>{parts.time}</Meta>}
                            {place && (
                                <Meta icon={<FiMapPin size={12} />}>
                                    {place}
                                </Meta>
                            )}
                        </HStack>
                    </VStack>
                    <Box as="span" color="fg.subtle" flexShrink="0">
                        <FiChevronRight size={16} />
                    </Box>
                </HStack>
            </RouterLink>

            {/* Geocoding is lazy, so a tournament that has not been placed yet
                simply gets no button rather than one that leads nowhere —
                the same rule `hasMapCoordinates` states for the calendar. */}
            {mapHref && (
                <IconButton
                    asChild
                    aria-label={t("pages.findPair.card.openMapAria")}
                    title={t("pages.findPair.card.openMapAria")}
                    variant="outline"
                    size="sm"
                    h="auto"
                    alignSelf="stretch"
                    flexShrink="0"
                >
                    <RouterLink to={mapHref}>
                        <FiMap />
                    </RouterLink>
                </IconButton>
            )}
        </HStack>
    )
}

export default function PairRequestCard({
    r,
    canManage,
    mapHref,
    anonymous,
    onEdit,
    onMatch,
    onDelete,
}: PairRequestCardProps) {
    const { t } = useTranslation()
    const matched = r.status === "MATCHED"

    return (
        <VStack
            align="stretch"
            gap="3"
            p="4"
            h="full"
            rounded="xl"
            borderWidth="1px"
            borderColor="border.subtle"
            bg="bg.panel"
            shadow="card"
            // A matched request is settled business: muted the same way a
            // finished tournament card is, and restored on hover so it stays
            // fully legible the moment the reader aims at it.
            opacity={matched ? 0.82 : 1}
            transition="border-color .15s ease, box-shadow .15s ease, opacity .15s ease"
            _hover={{ borderColor: "brand.emphasized", shadow: "raised", opacity: 1 }}
        >
            {/* ── Who ───────────────────────────────────────────────────── */}
            <HStack gap="2.5" align="center" minW="0">
                <PairAvatar name={r.playerName} matched={matched} />
                <Box flex="1" minW="0">
                    <Text fontWeight="bold" fontSize="md" lineHeight="short" truncate>
                        {r.playerName}
                    </Text>
                    <Text fontSize="2xs" color="fg.muted" mt="0.5">
                        {t("pages.findPair.card.postedAt", { date: formatDate(r.createdAt, "—") })}
                    </Text>
                </Box>
                <PairStatusPill matched={matched} />
            </HStack>

            {/* ── Where / when ──────────────────────────────────────────── */}
            <TournamentBlock r={r} mapHref={mapHref} matched={matched} />

            {/* ── Why ───────────────────────────────────────────────────── */}
            {r.note && (
                <Text
                    fontSize="sm"
                    color="fg.soft"
                    lineHeight="1.5"
                    css={{
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 3,
                        overflow: "hidden",
                        wordBreak: "break-word",
                    }}
                >
                    {r.note}
                </Text>
            )}

            {/* ── How to reach them ─────────────────────────────────────── */}
            <HStack
                justify="space-between"
                align="center"
                gap="2"
                wrap="wrap"
                rowGap="2"
                mt="auto"
                pt="3"
                borderTopWidth="1px"
                borderColor="border.subtle"
                minW="0"
            >
                <PairPhoneLine phone={r.phone} hasPhone={r.hasPhone} anonymous={anonymous} />
                {canManage && (
                    <HStack gap="1" flexShrink="0">
                        {!matched && (
                            <Button size="xs" variant="subtle" colorPalette="green" onClick={onMatch}>
                                <FiCheck /> {t("pages.findPair.card.matchAction")}
                            </Button>
                        )}
                        <IconButton
                            aria-label={t("pages.findPair.card.editAria")}
                            title={t("pages.findPair.card.editAria")}
                            size="xs"
                            variant="ghost"
                            onClick={onEdit}
                        >
                            <FiEdit2 />
                        </IconButton>
                        <IconButton
                            aria-label={t("pages.findPair.card.deleteAria")}
                            title={t("pages.findPair.card.deleteAria")}
                            size="xs"
                            variant="ghost"
                            colorPalette="red"
                            onClick={onDelete}
                        >
                            <FiTrash2 />
                        </IconButton>
                    </HStack>
                )}
            </HStack>
        </VStack>
    )
}

/** Loading placeholder with the card's silhouette, so the grid doesn't jump. */
export function PairRequestCardSkeleton() {
    return (
        <VStack
            align="stretch"
            gap="3"
            p="4"
            rounded="xl"
            borderWidth="1px"
            borderColor="border.subtle"
            bg="bg.panel"
        >
            <HStack gap="2.5">
                <Skeleton w="36px" h="36px" rounded="full" />
                <Skeleton h="4" flex="1" />
            </HStack>
            <Skeleton h="56px" rounded="lg" />
            <Skeleton h="3" w="70%" />
            <Skeleton h="4" w="45%" />
        </VStack>
    )
}
