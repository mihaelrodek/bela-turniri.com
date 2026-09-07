import { Box, Card, Heading, HStack, Text, VStack, Button } from "@chakra-ui/react"
import { FiMoon, FiSun } from "react-icons/fi"
import { useColorMode } from "../../color-mode-hooks"
import LanguagePicker from "../../components/LanguagePicker"
import { updateColorMode } from "../../api/userMe"
import { useInvalidateMyProfile } from "../../hooks/useMyProfile"
import { useTranslation } from "../../i18n"

/**
 * Postavke — app-level preferences, grouped, each group with one line of
 * explanatory text under it saying what the choice actually does.
 *
 * Both controls are duplicates of the navbar menu's, and both deliberately
 * write through the SAME mechanism rather than a second one:
 *
 *   Tema     — `setColorMode` (src/color-mode, next-themes) applies it
 *              locally, then `updateColorMode` persists it and a
 *              `qk.profile` invalidation stops ThemeSync from handing the
 *              stale value back on the next read. Identical to
 *              NavBar's ThemeSwitch.
 *   Jezik    — the shared `LanguagePicker` component itself, so the write
 *              path is literally the navbar's: `setLocale()`, with
 *              `LocaleSync` persisting it to the profile.
 *
 * There is deliberately NO notifications group here (the sibling app has
 * one): bela has no stored notification preference — `usePushSubscription`
 * subscribes on login whenever the browser permission is granted — so a
 * switch would flip itself back on at the next sign-in.
 */
export function SettingsCard() {
    const { t } = useTranslation()
    const { colorMode, setColorMode } = useColorMode()
    const invalidateMyProfile = useInvalidateMyProfile()

    const setTheme = async (mode: "light" | "dark") => {
        // Flip the local theme immediately for an instant visual response,
        // then persist to the backend. We're not waiting on the network
        // before flipping — the response only confirms the save.
        setColorMode(mode)
        try {
            await updateColorMode(mode)
            // colorMode lives on the profile DTO — keep the shared entry from
            // handing the OLD theme back to ThemeSync on the next read.
            await invalidateMyProfile()
        } catch {
            // Network failed — local theme is still right; the next login
            // will resync via ThemeSync.
        }
    }

    return (
        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
            <Card.Body p={{ base: "4", md: "5" }}>
                <VStack align="stretch" gap="4">
                    <Box>
                        <Heading size="sm">{t("profile.settings.title")}</Heading>
                        <Text fontSize="xs" color="fg.muted">
                            {t("profile.settings.description")}
                        </Text>
                    </Box>

                    <Box>
                        <Text fontSize="sm" fontWeight="medium" mb="2">{t("profile.settings.theme")}</Text>
                        <HStack gap="2" wrap="wrap">
                            <Button
                                size="sm"
                                variant={colorMode === "light" ? "solid" : "outline"}
                                colorPalette={colorMode === "light" ? "blue" : "gray"}
                                onClick={() => setTheme("light")}
                            >
                                <FiSun /> {t("profile.settings.light")}
                            </Button>
                            <Button
                                size="sm"
                                variant={colorMode === "dark" ? "solid" : "outline"}
                                colorPalette={colorMode === "dark" ? "blue" : "gray"}
                                onClick={() => setTheme("dark")}
                            >
                                <FiMoon /> {t("profile.settings.dark")}
                            </Button>
                        </HStack>
                        <Text fontSize="xs" color="fg.muted" mt="2">
                            {t("profile.settings.themeHint")}
                        </Text>
                    </Box>

                    <Box>
                        <Text fontSize="sm" fontWeight="medium" mb="2">{t("profile.settings.language")}</Text>
                        {/* The navbar's own picker, not a copy of it — same
                            component, same `setLocale()` write path, same
                            LocaleSync persistence. */}
                        <LanguagePicker />
                        <Text fontSize="xs" color="fg.muted" mt="2">
                            {t("profile.settings.languageHint")}
                        </Text>
                    </Box>
                </VStack>
            </Card.Body>
        </Card.Root>
    )
}
