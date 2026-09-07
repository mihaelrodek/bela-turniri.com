import { useEffect, useState } from "react"
import { useNavigate, useParams, Link as RouterLink } from "react-router-dom"
import {
    Badge,
    Box,
    Button,
    Card,
    Heading,
    HStack,
    Spinner,
    Text,
    VStack,
} from "@chakra-ui/react"
import {
    type PresetClaimPreviewDto,
    fetchPresetClaimPreview,
    claimPreset,
} from "../api/presetClaim"
import { useAuth } from "../auth/authContextValue"
import { useTranslation } from "../i18n"

/**
 * Landing page for the preset share URL: /claim-name/{token}.
 *
 * Friend sees the pair name + which user is sharing, taps Preuzmi, and
 * becomes co-owner of the preset. After that, every tournament where
 * the primary played as that name shows up on the friend's profile too
 * (the backend backfills coSubmittedByUid on every matching Pair so
 * push notifications and bill access also apply).
 */
export default function ClaimNamePage() {
    const { token = "" } = useParams<{ token: string }>()
    const navigate = useNavigate()
    const { user, loading: authLoading } = useAuth()
    const { t } = useTranslation()

    const [preview, setPreview] = useState<PresetClaimPreviewDto | null>(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)
    const [claiming, setClaiming] = useState(false)
    const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

    useEffect(() => {
        if (!token) {
            setNotFound(true)
            setLoading(false)
            return
        }
        let cancelled = false
        ;(async () => {
            try {
                const data = await fetchPresetClaimPreview(token)
                if (!cancelled) setPreview(data)
            } catch {
                if (!cancelled) setNotFound(true)
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [token])

    const handleClaim = async () => {
        if (!user?.uid) return
        setClaiming(true)
        setMessage(null)
        try {
            await claimPreset(token)
            setMessage({ kind: "ok", text: t("forms.claim.success") })
            setTimeout(() => navigate("/profil", { replace: true }), 1200)
        } catch (err) {
            // Narrow through a minimal axios-error shape instead of `any` — the
            // 409 bodies below are the contract this page keys its copy off.
            const res = (err as { response?: { status?: number; data?: unknown } } | null)?.response
            const status = res?.status
            const body = res?.data
            if (status === 409 && body === "OWNER_SAME") {
                setMessage({
                    kind: "err",
                    text: t("forms.claim.error.ownerSame"),
                })
            } else if (status === 409 && body === "ALREADY_CLAIMED") {
                setMessage({
                    kind: "err",
                    text: t("forms.claim.error.alreadyClaimed"),
                })
            } else if (status === 401) {
                setMessage({ kind: "err", text: t("forms.claim.error.loginRequired") })
            } else {
                setMessage({ kind: "err", text: t("forms.claim.error.generic") })
            }
        } finally {
            setClaiming(false)
        }
    }

    if (loading || authLoading) {
        return (
            <VStack py="16" gap="3">
                <Spinner />
                <Text color="fg.muted" fontSize="sm">{t("common.loading")}</Text>
            </VStack>
        )
    }

    if (notFound || !preview) {
        return (
            <Card.Root maxW="md" mx="auto" mt="6" variant="outline" rounded="xl">
                <Card.Body p="6">
                    <VStack gap="3" align="stretch">
                        <Heading size="md">{t("forms.claim.notFoundHeading")}</Heading>
                        <Text fontSize="sm" color="fg.muted">
                            {t("forms.claimName.notFoundMessage")}
                        </Text>
                        <Button asChild variant="outline" size="sm" mt="2">
                            <RouterLink to="/turniri">{t("forms.shared.backToTournaments")}</RouterLink>
                        </Button>
                    </VStack>
                </Card.Body>
            </Card.Root>
        )
    }

    return (
        <Card.Root maxW="md" mx="auto" mt="6" variant="outline" rounded="xl">
            <Card.Body p="6">
                <VStack gap="4" align="stretch">
                    <Box>
                        <Text fontSize="xs" color="fg.muted">{t("forms.claim.label")}</Text>
                        <Heading size="lg" mt="1">{preview.name}</Heading>
                    </Box>

                    {preview.primaryName && (
                        <Box>
                            <Text fontSize="sm" color="fg.muted">{t("forms.claimName.sharedByLabel")}</Text>
                            <Text fontWeight="medium">
                                {preview.primarySlug ? (
                                    <RouterLink
                                        to={`/profil/${preview.primarySlug}`}
                                        style={{ color: "var(--chakra-colors-blue-fg)" }}
                                    >
                                        {preview.primaryName}
                                    </RouterLink>
                                ) : (
                                    preview.primaryName
                                )}
                            </Text>
                        </Box>
                    )}

                    {preview.alreadyClaimed && (
                        <Box
                            p="3"
                            rounded="md"
                            bg="orange.subtle"
                            borderWidth="1px"
                            borderColor="orange.muted"
                        >
                            <HStack gap="2">
                                <Badge colorPalette="orange" variant="subtle">{t("forms.claim.alreadyClaimedBadge")}</Badge>
                                {preview.coOwnerName && (
                                    <Text fontSize="sm">{preview.coOwnerName}</Text>
                                )}
                            </HStack>
                            <Text fontSize="xs" color="fg.muted" mt="2">
                                {t("forms.claim.alreadyClaimedMessage")}
                            </Text>
                        </Box>
                    )}

                    {message && (
                        <Box
                            p="3"
                            rounded="md"
                            bg={message.kind === "ok" ? "green.subtle" : "red.subtle"}
                            borderWidth="1px"
                            borderColor={message.kind === "ok" ? "green.muted" : "red.muted"}
                        >
                            <Text fontSize="sm">{message.text}</Text>
                        </Box>
                    )}

                    {!user?.uid ? (
                        <Button asChild colorPalette="blue" variant="solid" size="md">
                            <RouterLink to={`/prijava?next=${encodeURIComponent(`/preuzmi-ime/${token}`)}`}>
                                {t("forms.claim.loginCta")}
                            </RouterLink>
                        </Button>
                    ) : (
                        <Button
                            colorPalette="blue"
                            variant="solid"
                            size="md"
                            loading={claiming}
                            disabled={claiming || preview.alreadyClaimed || message?.kind === "ok"}
                            onClick={handleClaim}
                        >
                            {t("forms.claim.submit")}
                        </Button>
                    )}
                </VStack>
            </Card.Body>
        </Card.Root>
    )
}
