import { Box, chakra, HStack, Text } from "@chakra-ui/react"
import { useLocation, useNavigate } from "react-router-dom"
import { FiPhone } from "react-icons/fi"
import { useTranslation } from "../i18n"
import { pairInitials } from "./pairRequestShared"

/* ──────────────────────────────────────────────────────────────────────────
   pairRequestPrimitives — the three pieces `PairRequestCard` is assembled
   from, in the same spirit as `rowPrimitives.tsx` for the tournament row and
   the calendar agenda. (Originally shared with a `PairRequestRow` list view
   too; that view is gone — FindPairPage dropped the Kartice/Popis toggle —
   but the split still earns its keep on its own.)

   `PairPhoneLine` is the reason this file exists at all.
   `PairRequestController.redactForAnonymous` nulls `phone` on every row served
   to a caller without a Firebase token, so "no phone on the wire" means two
   different things depending on who is asking, and exactly ONE definition of
   that rule may exist.
   ────────────────────────────────────────────────────────────────────── */

/**
 * Round initials tile. Deliberately quiet for a matched request — a settled
 * pair is history, and the board is about the people still looking.
 */
export function PairAvatar({
    name,
    matched,
    size = "36px",
}: {
    name: string
    matched: boolean
    size?: string
}) {
    return (
        <Box
            w={size}
            h={size}
            rounded="full"
            bg={matched ? "bg.muted" : "brand.subtle"}
            color={matched ? "fg.muted" : "brand.fg"}
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontWeight="bold"
            fontSize="xs"
            flexShrink="0"
            userSelect="none"
        >
            {pairInitials(name)}
        </Box>
    )
}

/** The "Tražim" / "Spareni" pill, in the listing's status-pill vocabulary:
 *  a coloured dot, then a short shouty label. */
export function PairStatusPill({ matched }: { matched: boolean }) {
    const { t } = useTranslation()
    return (
        <HStack
            gap="1.5"
            px="2"
            py="0.5"
            rounded="full"
            flexShrink="0"
            bg={matched ? "bg.muted" : "green.subtle"}
            color={matched ? "fg.muted" : "green.fg"}
        >
            <Box
                w="6px"
                h="6px"
                rounded="full"
                bg={matched ? "fg.subtle" : "green.solid"}
                flexShrink="0"
            />
            <Text fontSize="2xs" fontWeight="bold" letterSpacing="0.04em" whiteSpace="nowrap">
                {matched
                    ? t("pages.findPair.badge.matched")
                    : t("pages.findPair.badge.searching")}
            </Text>
        </HStack>
    )
}

/**
 * The contact line, and the only place that decides what an absent phone
 * number means.
 *
 * Three states:
 *   · a number on the wire       → a `tel:` link, so a tap dials;
 *   · signed in, still no number → "Bez broja", stated plainly: this poster
 *                                  left none, and the reader must not be sent
 *                                  hunting for one that does not exist;
 *   · signed OUT                 → the blurred placeholder + "(prijavi se)"
 *                                  affordance `PublicProfilePage` already
 *                                  uses, routing to /prijava and back.
 *
 * The last branch is worded about the RULE ("contacts are visible only to
 * signed-in players") rather than about this poster, and the page carries a
 * matching one-line notice above the board. That is deliberate: the list DTO
 * carries no `hasPhone` flag, so from an anonymous session it is genuinely
 * unknowable whether a redacted row had a number behind it at all — and
 * promising one we cannot see would be a lie on every request posted without
 * a phone.
 */
export function PairPhoneLine({
    phone,
    hasPhone,
    anonymous,
    size = "sm",
}: {
    phone?: string | null
    /** Backend flag: a number exists, even when `phone` was redacted away. */
    hasPhone?: boolean
    /** No Firebase token on the wire — every phone came back redacted. */
    anonymous: boolean
    size?: "xs" | "sm"
}) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()

    if (phone) {
        return (
            <chakra.a
                href={`tel:${phone.replace(/\s+/g, "")}`}
                display="inline-flex"
                alignItems="center"
                gap="1.5"
                minW="0"
                color="brand.fg"
                fontSize={size}
                fontWeight="semibold"
                _hover={{ textDecoration: "underline" }}
                // The card's tournament block is a link; stop a dial from also
                // opening the tournament behind it.
                onClick={(e) => e.stopPropagation()}
            >
                <FiPhone size={13} />
                <Text truncate>{phone}</Text>
            </chakra.a>
        )
    }

    // No number at all — say so plainly. With `hasPhone` on the wire this is
    // now honest for signed-out readers too, instead of every redacted row
    // claiming a number that may never have existed.
    if (hasPhone === false) {
        return (
            <HStack gap="1.5" color="fg.subtle" fontSize={size} minW="0">
                <FiPhone size={13} />
                <Text truncate>{t("pages.findPair.card.noPhone")}</Text>
            </HStack>
        )
    }

    if (!anonymous) {
        return (
            <HStack gap="1.5" color="fg.subtle" fontSize={size} minW="0">
                <FiPhone size={13} />
                <Text truncate>{t("pages.findPair.card.noPhone")}</Text>
            </HStack>
        )
    }

    return (
        <chakra.button
            type="button"
            onClick={(e) => {
                e.stopPropagation()
                // LoginPage reads `state.from` as a STRING and `?next=` as the
                // copy that survives a full reload — pass both, exactly as
                // PublicProfilePage's phone affordance does.
                const from = `${location.pathname}${location.search}`
                navigate(`/prijava?next=${encodeURIComponent(from)}`, { state: { from } })
            }}
            display="inline-flex"
            alignItems="center"
            gap="1.5"
            minW="0"
            p="0"
            border="0"
            bg="transparent"
            cursor="pointer"
            color="brand.fg"
            fontSize={size}
            fontWeight="semibold"
            title={t("pages.findPair.card.phoneHiddenTitle")}
            aria-label={t("pages.findPair.card.phoneHiddenTitle")}
            _hover={{ textDecoration: "underline" }}
        >
            <FiPhone size={13} />
            <chakra.span style={{ filter: "blur(5px)", userSelect: "none" }} aria-hidden>
                +385 99 123 4567
            </chakra.span>
            <chakra.span fontSize="xs" color="fg.muted" fontWeight="medium">
                {t("profile.phone.loginHint")}
            </chakra.span>
        </chakra.button>
    )
}
