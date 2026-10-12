import { Button, Flex, Portal, Text } from "@chakra-ui/react"
import { MdScreenRotation } from "react-icons/md"
import { useTranslation } from "../../i18n"
import { setPreferNormalLayout } from "../landscapeTableStore"

/* ──────────────────────────────────────────────────────────────────────────
   RotateToPortrait — the ordinary layout, asked for on a sideways phone
   (2026-10-12, owner: "kad se pritisne gumb … ne smije se više landscape
   prikazivati").

   The rotation button (`LayoutToggleButton`) switches the room to the
   ordinary, upright layout. A phone still held sideways cannot draw that
   layout — 390 px of height for a column built for 800 — so instead of a
   squashed table this covers the screen and asks for the phone to be
   turned. Turning it ends the landscape media query and this disappears;
   the button below goes back to the full-screen table instead. Browsers
   that can lock the orientation (Android, fullscreen or installed) were
   already asked to by the toggle, so most of them never show this.
   ────────────────────────────────────────────────────────────────────── */

export default function RotateToPortrait() {
    const { t } = useTranslation()
    return (
        <Portal>
            <Flex
                position="fixed"
                inset="0"
                zIndex="modal"
                direction="column"
                align="center"
                justify="center"
                gap="3"
                px="6"
                bg="bg"
                textAlign="center"
                role="dialog"
                aria-modal="true"
                aria-label={t("game.table.rotatePortrait")}
            >
                <Flex color="brand.fg" fontSize="48px" aria-hidden="true">
                    <MdScreenRotation />
                </Flex>
                <Text fontSize="lg" fontWeight="bold" fontFamily="heading">
                    {t("game.table.rotatePortrait")}
                </Text>
                <Text fontSize="sm" color="fg.muted" maxW="420px">
                    {t("game.table.rotatePortraitHint")}
                </Text>
                <Button size="sm" variant="outline" rounded="full" onClick={() => setPreferNormalLayout(false)}>
                    <MdScreenRotation aria-hidden="true" />
                    {t("game.table.layoutLandscape")}
                </Button>
            </Flex>
        </Portal>
    )
}
