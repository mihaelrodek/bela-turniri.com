import { Box, Button, Text, VStack } from "@chakra-ui/react"
import { Link as RouterLink } from "react-router-dom"
import { gameLobbyPath } from "../../site"
import { useTranslation } from "../../i18n"
import { CardsIcon } from "../../components/MobileTabBar"

/* ──────────────────────────────────────────────────────────────────────────
   SpectatorPromo — what a spectator sees where the hand tray would be.

   A spectator has no cards, so `Hand` (cards={[]}) drew eight empty outlined
   slots at the bottom of the felt — dead space that looked like a bug rather
   than "you have nothing to play" (2026-09-29, user report). This replaces
   the whole tray with a short pitch + a link to the lobby instead: the hand
   tray is the one moment on the table that is entirely about the VIEWER's
   own cards, so it is also the natural spot to point someone with none at a
   game of their own, same brand gradient `GamesSiteBanner` uses.
   ────────────────────────────────────────────────────────────────────── */

export default function SpectatorPromo() {
    const { t } = useTranslation()

    return (
        <VStack
            gap="2.5"
            rounded="l3"
            overflow="hidden"
            bg="brand.700"
            backgroundImage="linear-gradient(135deg, var(--chakra-colors-brand-600), var(--chakra-colors-brand-700))"
            color="brand.contrast"
            px="5"
            py={{ base: "6", md: "8" }}
            mx="2"
            textAlign="center"
        >
            <Box color="brand.contrast" opacity={0.9}>
                <CardsIcon size={30} />
            </Box>
            <Text fontFamily="heading" fontWeight="semibold" fontSize={{ base: "md", md: "lg" }} lineHeight="1.25">
                {t("game.table.spectatorPromoTitle")}
            </Text>
            <Text fontSize="sm" color="brand.contrast" opacity={0.85} maxW="360px">
                {t("game.table.spectatorPromoSubtitle")}
            </Text>
            <Button
                asChild
                size="sm"
                colorPalette="brand"
                bg="brand.contrast"
                color="brand.700"
                _hover={{ bg: "brand.contrast", opacity: 0.9 }}
                mt="1"
            >
                <RouterLink to={gameLobbyPath}>{t("game.table.spectatorPromoCta")}</RouterLink>
            </Button>
        </VStack>
    )
}
