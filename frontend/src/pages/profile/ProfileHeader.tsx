import { Box, Card, chakra, Heading, HStack, IconButton, Image, VStack } from "@chakra-ui/react"
import { useLocation, useNavigate } from "react-router-dom"
import { FiEdit2, FiPhone } from "react-icons/fi"
import type { PublicProfile } from "../../api/publicProfile"
import AvatarPreview from "../../components/AvatarPreview"
import { initialsOf } from "../../components/listingShared"
import { PHONE_COUNTRIES } from "../../utils/phone"
import { useTranslation } from "../../i18n"

/**
 * Identity building blocks shown at the top of the profile page: the avatar
 * circle, the phone line (with its anonymous-viewer redaction), the owner's
 * clickable sidebar identity block, and the visitor-facing identity card.
 * Split out of PublicProfilePage.tsx as one cohesive "header" unit — all four
 * pieces exist only to render who this profile belongs to.
 */

/** Map a dial code like "+385" to the matching flag emoji, or "" if unknown. */
function flagFor(dialCode: string | null | undefined): string {
    if (!dialCode) return ""
    const c = PHONE_COUNTRIES.find((x) => x.value === dialCode)
    if (!c) return ""
    // The label is e.g. "🇭🇷 +385" — the first space splits flag from prefix.
    const parts = c.label.split(" ")
    return parts[0] ?? ""
}

/**
 * The avatar circle: the uploaded image when there is one, initials
 * otherwise, wrapped in AvatarPreview so tapping the picture opens the
 * full-screen lightbox. The wrapper is a no-op without an `avatarUrl`, so
 * initials stay un-clickable.
 */
export function ProfileAvatar({
    profile,
    size,
    fontSize,
}: {
    profile: PublicProfile
    size: string
    fontSize: string
}) {
    const { t } = useTranslation()
    const alt = profile.displayName ?? t("profile.avatar.alt")
    return (
        <AvatarPreview src={profile.avatarUrl} alt={alt}>
            <Box
                w={size}
                h={size}
                rounded="full"
                overflow="hidden"
                bg="blue.subtle"
                color="blue.fg"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontWeight="bold"
                fontSize={fontSize}
            >
                {profile.avatarUrl ? (
                    <Image src={profile.avatarUrl} alt={alt} w="100%" h="100%" objectFit="cover" />
                ) : (
                    initialsOf(profile.displayName ?? "")
                )}
            </Box>
        </AvatarPreview>
    )
}

/**
 * The phone line. Three states, all pre-existing behaviour:
 *   - a real number → a `tel:` link with the country flag;
 *   - redacted for an anonymous viewer (`phone` null, `hasPhone` true) → a
 *     blurred placeholder that routes to /prijava and back;
 *   - no number at all → nothing.
 */
export function ProfilePhoneLine({ profile }: { profile: PublicProfile }) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()

    if (profile.phone) {
        return (
            <chakra.a
                href={`tel:${(profile.phoneCountry ?? "")}${profile.phone}`.replace(/\s+/g, "")}
                color="blue.fg"
                fontSize="sm"
                fontWeight="medium"
                display="inline-flex"
                alignItems="center"
                gap="1.5"
                _hover={{ textDecoration: "underline" }}
            >
                <FiPhone size={13} />
                {/* Show the country flag too — the dial code by itself looks like
                    a generic prefix; the flag tells you the country at a glance. */}
                {profile.phoneCountry && (
                    <chakra.span aria-hidden mr="0.5">
                        {flagFor(profile.phoneCountry)}
                    </chakra.span>
                )}
                {profile.phoneCountry ? `${profile.phoneCountry} ` : ""}{profile.phone}
            </chakra.a>
        )
    }

    if (!profile.hasPhone) return null

    return (
        <chakra.button
            type="button"
            onClick={() => {
                // LoginPage reads `state.from` as a STRING (and `?next=` as the
                // belt-and-braces copy that survives a full reload). Passing the
                // router's `{ pathname }` object here made it stringify to
                // "[object Object]" and dumped the user on the tournament list
                // instead of back here.
                const from = `${location.pathname}${location.search}`
                navigate(`/prijava?next=${encodeURIComponent(from)}`, { state: { from } })
            }}
            color="blue.fg"
            fontSize="sm"
            fontWeight="medium"
            display="inline-flex"
            alignItems="center"
            gap="1.5"
            cursor="pointer"
            bg="transparent"
            border="0"
            p="0"
            title={t("profile.phone.loginToSee")}
            _hover={{ textDecoration: "underline" }}
        >
            <FiPhone size={13} />
            <chakra.span style={{ filter: "blur(5px)", userSelect: "none" }} aria-hidden>
                +385 99 123 4567
            </chakra.span>
            <chakra.span fontSize="xs" color="fg.muted">
                {t("profile.phone.loginHint")}
            </chakra.span>
        </chakra.button>
    )
}

/**
 * Identity block at the top of the owner's sidebar card: avatar, name, phone,
 * and a pencil. The pencil does NOT edit inline — it switches the content
 * column to Postavke, where "Moji podaci" carries the avatar and contact
 * editing. One place to edit, reachable from every section.
 */
export function ProfileIdentityBlock({
    profile,
    onEdit,
}: {
    profile: PublicProfile
    onEdit: () => void
}) {
    const { t } = useTranslation()
    return (
        <VStack align="stretch" gap="2">
            <HStack gap="3" align="center" minW="0">
                {/* Avatar + name are one clickable unit to "Postavke" — that
                    section has no nav item of its own any more (see the
                    `sections` list above), this and the pencil are the only
                    two ways in. The phone line below stays its own `tel:`
                    link, untouched. */}
                <chakra.button
                    type="button"
                    onClick={onEdit}
                    display="flex"
                    alignItems="center"
                    gap="3"
                    minW="0"
                    flex="1"
                    cursor="pointer"
                    textAlign="left"
                >
                    <Box flexShrink={0}>
                        <ProfileAvatar profile={profile} size="44px" fontSize="sm" />
                    </Box>
                    <Box flex="1" minW="0">
                        <Heading size="sm" lineHeight="short" lineClamp={2}>
                            {profile.displayName ?? t("profile.unnamedPlayer")}
                        </Heading>
                    </Box>
                </chakra.button>
                <IconButton
                    aria-label={t("profile.details.edit")}
                    title={t("profile.details.edit")}
                    size="xs"
                    variant="ghost"
                    flexShrink={0}
                    onClick={onEdit}
                >
                    <FiEdit2 />
                </IconButton>
            </HStack>
            <ProfilePhoneLine profile={profile} />
        </VStack>
    )
}

/** Visitor-facing identity card — avatar, name, phone, nothing editable. */
export function PublicIdentityCard({ profile }: { profile: PublicProfile }) {
    const { t } = useTranslation()
    return (
        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
            <Card.Body p="5">
                <VStack align="stretch" gap="3">
                    <HStack gap="3" align="center" minW="0">
                        <Box flexShrink={0}>
                            <ProfileAvatar profile={profile} size="48px" fontSize="md" />
                        </Box>
                        <Heading size="md" lineHeight="short" lineClamp={2} flex="1" minW="0">
                            {profile.displayName ?? t("profile.unnamedPlayer")}
                        </Heading>
                    </HStack>
                    <ProfilePhoneLine profile={profile} />
                </VStack>
            </Card.Body>
        </Card.Root>
    )
}
