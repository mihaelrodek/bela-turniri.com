import { useMemo } from "react"
import { Badge, Box, Button, chakra, Flex, HStack, Image, Text, VStack } from "@chakra-ui/react"
import {
    FiAward,
    FiCalendar,
    FiClock,
    FiDollarSign,
    FiExternalLink,
    FiGift,
    FiInfo,
    FiMapPin,
    FiPhone,
    FiRotateCcw,
    FiUser,
    FiUsers,
} from "react-icons/fi"
import { FaTrophy } from "react-icons/fa"

import DetailTile from "../../../components/DetailTile"
import TournamentQrCard from "../../../components/TournamentQrCard"
import { MEDALS } from "../../../components/TournamentResultsCard"
import { useTranslation } from "../../../i18n"
import { formatAmount, formatDate, formatTime } from "../../../utils/format"
import type { TournamentDetails } from "../../../types/tournaments"

/** Terse euro amount with an em-dash placeholder — the tiles never render blank. */
const fmtMoney = (n?: number | null) => formatAmount(n) ?? "—"

/**
 * "Detalji", read mode: the poster, the QR card and every factual tile.
 *
 * Three blocks in ONE grid rather than three nested flex columns, because
 * their order has to change between breakpoints and grid areas express that
 * without duplicating any markup:
 *
 *   • `poster` — the plakat, framed.
 *   • `qr`     — the scannable code + save.
 *   • `info`   — everything factual.
 *
 * Desktop (xl+, i.e. once the 244px sidebar plus a 264px media column still
 * leave the facts a readable measure) is a narrow media column carrying
 * poster-over-QR beside a wide information column.
 *
 * Phones get one column ordered plakat → činjenice → QR: the poster is the
 * thing a player recognises the tournament by, the facts are what they came
 * for, and the QR is an organiser's tool — nobody scans the code on the very
 * phone that is showing it.
 *
 * Without a poster the `poster` area is dropped from the template entirely
 * (rather than left empty, which would still cost a row gap and push the QR
 * out of alignment with the top of the information column).
 */
export default function DetailsSection({
    t,
    pairCount,
}: {
    t: TournamentDetails
    /** Registered pairs — the numerator of the "parovi" tile. */
    pairCount: number
}) {
    const { t: tr } = useTranslation()

    /* Nagradni fond — type badge plus the three medal places. Memoised so a
       poll tick that leaves the reward fields untouched doesn't rebuild the
       three-row breakdown. */
    const rewardPlaces = useMemo(() => {
        if (!t.rewardType) return null
        const isPercent = t.rewardType === "PERCENTAGE"
        const fmt = (n: number | null | undefined) => (isPercent ? `${n ?? 0}%` : fmtMoney(n))
        return {
            isPercent,
            places: [
                // Medal metals from the one shared podium palette
                // (components/TournamentResultsCard) — gold / silver / bronze
                // read as themselves in both themes and have no sensible
                // semantic-token equivalent.
                { place: tr("tournament.place.first"), color: MEDALS[0], value: fmt(t.rewardFirst) },
                { place: tr("tournament.place.second"), color: MEDALS[1], value: fmt(t.rewardSecond) },
                { place: tr("tournament.place.third"), color: MEDALS[2], value: fmt(t.rewardThird) },
            ],
        }
    }, [t.rewardType, t.rewardFirst, t.rewardSecond, t.rewardThird, tr])

    return (
        <Box
            display="grid"
            alignItems="start"
            gap={{ base: "4", xl: "5" }}
            gridTemplateColumns={{
                base: "minmax(0, 1fr)",
                xl: "264px minmax(0, 1fr)",
            }}
            gridTemplateAreas={
                t.bannerUrl
                    ? {
                        base: `"poster" "info" "qr"`,
                        xl: `"poster info" "qr info"`,
                    }
                    : {
                        base: `"info" "qr"`,
                        xl: `"qr info"`,
                    }
            }
        >
            {/* ── Plakat ──
                The <img> sizes itself from its own aspect ratio (`w`/`h` auto,
                capped by maxW/maxH) instead of being stretched into a
                fixed-height strip, so a portrait A3 poster and a landscape
                banner are both shown whole. */}
            {t.bannerUrl && (
                <Box
                    gridArea="poster"
                    rounded="xl"
                    overflow="hidden"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    bg="bg.subtle"
                    shadow="card"
                    display="flex"
                    justifyContent="center"
                >
                    <Image
                        src={t.bannerUrl}
                        alt={t.name}
                        display="block"
                        w="auto"
                        h="auto"
                        maxW="full"
                        // 56vh on phones: tall enough to read a portrait
                        // plakat, short enough that the facts below it are one
                        // flick away.
                        maxH={{ base: "56vh", xl: "70vh" }}
                        objectFit="contain"
                        draggable={false}
                    />
                </Box>
            )}

            {/* ── QR kod ──
                Server-rendered PNG with the app mark in the middle; the dialog
                behind the sidebar's QR button still exists for "put it on the
                projector", but the code itself no longer hides behind a click. */}
            <Box gridArea="qr">
                <TournamentQrCard
                    tournamentUuid={t.uuid}
                    tournamentSlug={t.slug}
                    tournamentName={t.name}
                />
            </Box>

            {/* ── Informacije ── */}
            <VStack gridArea="info" align="stretch" gap="3" minW="0">
                {/* Identity row — who is running it, how to reach them, and
                    when. Four equal tiles with the brand stripe.

                    Back to 2×2 at xl, where the media column claims 264px and
                    four tiles would be ~130px each — narrow enough that a full
                    name and a long date both start truncating. Between md and
                    lg there is no media column yet, so the row gets its full
                    four. */}
                <Box
                    display="grid"
                    gridTemplateColumns={{
                        base: "repeat(2, minmax(0, 1fr))",
                        md: "repeat(4, minmax(0, 1fr))",
                        xl: "repeat(2, minmax(0, 1fr))",
                    }}
                    gap="3"
                >
                    <DetailTile
                        accent
                        icon={<FiUser size={13} />}
                        label={tr("tournament.tile.createdBy")}
                        value={
                            <Text lineClamp={1}>
                                {t.createdByName || tr("tournament.tile.notSpecified")}
                            </Text>
                        }
                    />
                    <DetailTile
                        accent
                        icon={<FiPhone size={13} />}
                        label={tr("tournament.tile.contact")}
                        value={
                            t.contactName || t.contactPhone ? (
                                <VStack align="stretch" gap="0.5">
                                    {t.contactName && (
                                        <Text lineClamp={1}>{t.contactName}</Text>
                                    )}
                                    {t.contactPhone && (
                                        <chakra.a
                                            href={`tel:${t.contactPhone.replace(/\s+/g, "")}`}
                                            color="blue.fg"
                                            fontSize="sm"
                                            fontWeight="medium"
                                            _hover={{ textDecoration: "underline" }}
                                        >
                                            {t.contactPhone}
                                        </chakra.a>
                                    )}
                                </VStack>
                            ) : (
                                <Text color="fg.muted" fontWeight="normal">
                                    {tr("tournament.tile.notSpecified")}
                                </Text>
                            )
                        }
                    />
                    <DetailTile
                        accent
                        icon={<FiCalendar size={13} />}
                        label={tr("tournament.tile.date")}
                        value={formatDate(t.startAt)}
                    />
                    <DetailTile
                        accent
                        icon={<FiClock size={13} />}
                        label={tr("tournament.tile.startTime")}
                        value={formatTime(t.startAt)}
                    />
                </Box>

                {/* Stats row — the numbers a pair checks before signing up. A
                    fixed four across, not `auto-fit`: the usual shape is
                    exactly four (parovi, kotizacija, repasaž, repasaž do) and
                    auto-fit sized them to three tracks at xl, which dropped the
                    fourth onto a row of its own. A tournament that also charges
                    a second repassage wraps a fifth tile; that is the rare
                    case, and it is the one worth costing a gap. */}
                <Box
                    display="grid"
                    gridTemplateColumns={{
                        base: "repeat(2, minmax(0, 1fr))",
                        md: "repeat(4, minmax(0, 1fr))",
                    }}
                    gap="3"
                >
                    <DetailTile
                        icon={<FiUsers size={13} />}
                        label={tr("tournament.tile.pairs")}
                        value={`${pairCount} / ${typeof t.maxPairs === "number" ? t.maxPairs : "∞"}`}
                    />
                    {typeof t.entryPrice === "number" && (
                        <DetailTile
                            icon={<FiDollarSign size={13} />}
                            label={tr("tournament.tile.entryPrice")}
                            value={fmtMoney(t.entryPrice)}
                        />
                    )}
                    {typeof t.repassagePrice === "number" && (
                        <DetailTile
                            icon={<FiDollarSign size={13} />}
                            label={tr("tournament.tile.repassage")}
                            value={fmtMoney(t.repassagePrice)}
                        />
                    )}
                    {typeof t.repassageSecondPrice === "number" && (
                        <DetailTile
                            icon={<FiDollarSign size={13} />}
                            label={tr("tournament.tile.repassageSecond")}
                            value={fmtMoney(t.repassageSecondPrice)}
                        />
                    )}
                    <DetailTile
                        icon={<FiRotateCcw size={13} />}
                        label={tr("tournament.tile.repassageUntil")}
                        value={
                            <Badge variant="subtle" colorPalette="blue" size="sm">
                                {t.repassageUntil === "FINALS"
                                    ? tr("tournament.repassageUntil.FINALS")
                                    : t.repassageUntil === "SEMIFINALS"
                                        ? tr("tournament.repassageUntil.SEMIFINALS")
                                        : t.repassageUntil === "FIRST_ROUND"
                                            ? tr("tournament.repassageUntil.FIRST_ROUND")
                                            : "—"}
                            </Badge>
                        }
                    />
                </Box>

                {/* Lokacija — its own row, because the venue is the one fact
                    that carries an action next to it. */}
                {t.location && (
                    <Box
                        bg="bg.panel"
                        borderWidth="1px"
                        borderColor="border.subtle"
                        rounded="xl"
                        shadow="card"
                        p="4"
                        display="flex"
                        flexDirection={{ base: "column", sm: "row" }}
                        alignItems={{ base: "stretch", sm: "center" }}
                        justifyContent="space-between"
                        gap="3"
                    >
                        <HStack gap="3" align="center" minW="0">
                            <Flex
                                w="36px"
                                h="36px"
                                rounded="lg"
                                bg="bg.subtle"
                                align="center"
                                justify="center"
                                color="blue.fg"
                                flexShrink={0}
                            >
                                <FiMapPin size={16} />
                            </Flex>
                            <Box minW="0">
                                <Text
                                    fontSize="2xs"
                                    fontWeight="semibold"
                                    color="fg.muted"
                                    letterSpacing="wider"
                                    textTransform="uppercase"
                                >
                                    {tr("tournament.tile.location")}
                                </Text>
                                <Text fontWeight="medium">{t.location}</Text>
                            </Box>
                        </HStack>
                        <Button
                            asChild
                            size="sm"
                            variant="outline"
                            colorPalette="blue"
                            flexShrink={0}
                        >
                            <chakra.a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.location)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={tr("tournament.openInGoogleMaps")}
                            >
                                <FiExternalLink /> {tr("tournament.openInMaps")}
                            </chakra.a>
                        </Button>
                    </Box>
                )}

                {t.details && (
                    <DetailTile
                        icon={<FiInfo size={13} />}
                        emphasis
                        label={tr("tournament.tile.details")}
                        value={
                            <Text whiteSpace="pre-wrap" fontSize="sm" fontWeight="normal">
                                {t.details}
                            </Text>
                        }
                    />
                )}

                {rewardPlaces && (
                    <DetailTile
                        emphasis
                        icon={<FiGift size={13} />}
                        label={tr("tournament.tile.rewards")}
                        value={
                            <VStack align="stretch" gap="2.5">
                                <HStack>
                                    <Badge variant="subtle" colorPalette="purple" size="sm">
                                        {rewardPlaces.isPercent
                                            ? tr("tournament.reward.percentage")
                                            : tr("tournament.reward.fixed")}
                                    </Badge>
                                </HStack>
                                <Box
                                    display="grid"
                                    gridTemplateColumns={{ base: "1fr", sm: "repeat(3, minmax(0, 1fr))" }}
                                    gap="3"
                                >
                                    {rewardPlaces.places.map((p) => (
                                        <HStack
                                            key={p.place}
                                            gap="2"
                                            p="2"
                                            rounded="md"
                                            bg="bg.muted"
                                            minW="0"
                                        >
                                            <Box color={p.color} flexShrink={0} display="flex" alignItems="center">
                                                <FaTrophy size={20} />
                                            </Box>
                                            <Box minW="0">
                                                <Text fontSize="2xs" color="fg.muted" letterSpacing="wide" textTransform="uppercase">
                                                    {p.place}
                                                </Text>
                                                <Text fontWeight="semibold" lineHeight="short">
                                                    {p.value}
                                                </Text>
                                            </Box>
                                        </HStack>
                                    ))}
                                </Box>
                            </VStack>
                        }
                    />
                )}

                {t.additionalOptions && t.additionalOptions.length > 0 && (
                    <DetailTile
                        icon={<FiAward size={13} />}
                        label={tr("tournament.tile.additionalOptions")}
                        value={
                            <HStack wrap="wrap" gap="2">
                                {t.additionalOptions.map((opt) => (
                                    <Badge key={opt} variant="solid" colorPalette="blue">
                                        {opt}
                                    </Badge>
                                ))}
                            </HStack>
                        }
                    />
                )}
            </VStack>
        </Box>
    )
}
