import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
    Box,
    Button,
    Card,
    Heading,
    HStack,
    Spinner,
    Stack,
    Text,
} from "@chakra-ui/react"
import { Link as RouterLink } from "react-router-dom"
import { FiSlash } from "react-icons/fi"

import { listBlocks, unblockUser, type BlockedUser } from "../../api/userMe"
import UserAvatar from "../../components/avatars/UserAvatar"
import { qk } from "../../queryClient"
import { showSuccess } from "../../toaster"
import { useTranslation } from "../../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   "Blokirani korisnici" — the other half of the block button on a player's
   public profile. Without a list there is no way back: a block hides the
   blocked player's profile from you (it 404s) and drops their tournaments
   out of your list, so the blocked person's own page can never be the place
   you undo it from.

   Rendered on the owner's Postavke section only, and empty for the many
   users who never blocked anybody — it collapses to one muted line rather
   than an EmptyState illustration, because it is a settings row, not a
   destination.
   ────────────────────────────────────────────────────────────────────── */

export function BlockedUsersCard() {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const [pendingUid, setPendingUid] = useState<string | null>(null)

    const { data: blocks, isPending, isError } = useQuery({
        queryKey: qk.blocks,
        queryFn: listBlocks,
    })

    async function onUnblock(b: BlockedUser) {
        try {
            setPendingUid(b.uid)
            await unblockUser(b.uid)
            showSuccess(t("profile.blocks.unblocked"))
            // The tournaments list is filtered server-side by the block set,
            // so it has to be refetched alongside the list itself — same pair
            // of invalidations the block button on the public profile fires.
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: qk.blocks }),
                queryClient.invalidateQueries({ queryKey: ["tournaments"] }),
            ])
        } finally {
            setPendingUid(null)
        }
    }

    return (
        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
            <Card.Body p={{ base: "3", md: "5" }}>
                <Stack gap="3">
                    <HStack gap="2.5" align="center">
                        <Box color="fg.muted" flexShrink={0}><FiSlash size={16} /></Box>
                        <Box minW="0">
                            <Heading size="sm">{t("profile.blocks.heading")}</Heading>
                            <Text fontSize="xs" color="fg.muted">
                                {t("profile.blocks.description")}
                            </Text>
                        </Box>
                    </HStack>

                    {isPending ? (
                        <HStack py="2" justify="center"><Spinner size="sm" /></HStack>
                    ) : isError ? (
                        <Text fontSize="sm" color="fg.muted">{t("profile.blocks.loadFailed")}</Text>
                    ) : (blocks ?? []).length === 0 ? (
                        <Text fontSize="sm" color="fg.muted">{t("profile.blocks.empty")}</Text>
                    ) : (
                        <Stack gap="2">
                            {(blocks ?? []).map((b) => (
                                <HStack
                                    key={b.uid}
                                    px="3"
                                    py="2"
                                    borderWidth="1px"
                                    borderColor="border.subtle"
                                    rounded="md"
                                    justify="space-between"
                                    gap="3"
                                >
                                    <HStack gap="2.5" minW="0" flex="1">
                                        <UserAvatar
                                            avatarUrl={b.avatarUrl}
                                            avatarPreset={b.avatarPreset}
                                            name={b.displayName}
                                            size="32px"
                                            fontSize="xs"
                                        />
                                        <Box minW="0">
                                            <Text fontSize="sm" fontWeight="medium" truncate>
                                                {b.displayName ?? t("profile.unnamedPlayer")}
                                            </Text>
                                            {/* The link is unusable while the block
                                                stands (the profile 404s), so the slug
                                                is only a link once there is something
                                                to point at — a blocked user with no
                                                slug shows nothing at all. */}
                                            {b.slug && (
                                                <Text fontSize="xs" color="fg.muted" truncate>
                                                    <RouterLink to={`/profil/${b.slug}`}>{b.slug}</RouterLink>
                                                </Text>
                                            )}
                                        </Box>
                                    </HStack>
                                    <Button
                                        size="xs"
                                        variant="outline"
                                        colorPalette="brand"
                                        flexShrink={0}
                                        loading={pendingUid === b.uid}
                                        disabled={pendingUid != null}
                                        onClick={() => void onUnblock(b)}
                                    >
                                        {t("profile.blocks.unblock")}
                                    </Button>
                                </HStack>
                            ))}
                        </Stack>
                    )}
                </Stack>
            </Card.Body>
        </Card.Root>
    )
}

export default BlockedUsersCard
