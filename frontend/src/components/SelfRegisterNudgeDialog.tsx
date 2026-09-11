import { Button, Dialog, HStack, Icon, Portal, Text, VStack } from "@chakra-ui/react"
import { FiBell, FiEdit3, FiList } from "react-icons/fi"

import { useTranslation } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   The step between "Prijavi par" and the registration form, for a visitor who
   is not signed in.

   Registering used to REQUIRE an account: the button bounced an anonymous
   visitor to /prijava, and a fair number of them never came back. Signing in
   is still better — you see your own registrations, you can edit or withdraw
   them, and you get a notification when the organiser confirms — so the
   choice is presented rather than removed. Both doors are open, the better one
   is the solid button.

   Not ConfirmDialog: that component's second button is a cancel, and here both
   buttons continue the flow in different directions. Same shell and the same
   role/description wiring, though.
   ────────────────────────────────────────────────────────────────────── */

export default function SelfRegisterNudgeDialog({
    open,
    onSignIn,
    onContinue,
    onClose,
}: {
    open: boolean
    /** → /prijava, keeping state.from so they land back on this tournament. */
    onSignIn: () => void
    /** → the registration form, no account. */
    onContinue: () => void
    onClose: () => void
}) {
    const { t } = useTranslation()

    const benefits = [
        { icon: FiList, text: t("tournament.selfReg.nudge.benefitList") },
        { icon: FiEdit3, text: t("tournament.selfReg.nudge.benefitEdit") },
        { icon: FiBell, text: t("tournament.selfReg.nudge.benefitNotify") },
    ]

    return (
        <Dialog.Root open={open} onOpenChange={(e) => { if (!e.open) onClose() }} placement="center">
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "sm" }}>
                        <Dialog.Header>
                            <Dialog.Title>{t("tournament.selfReg.nudge.title")}</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <Dialog.Description asChild>
                                <VStack align="stretch" gap="3">
                                    <Text color="fg.muted" fontSize="sm">
                                        {t("tournament.selfReg.nudge.intro")}
                                    </Text>
                                    <VStack align="stretch" gap="2">
                                        {benefits.map((b) => (
                                            <HStack key={b.text} gap="2" align="flex-start">
                                                <Icon as={b.icon} color="brand.fg" mt="0.5" flexShrink={0} />
                                                <Text fontSize="sm">{b.text}</Text>
                                            </HStack>
                                        ))}
                                    </VStack>
                                </VStack>
                            </Dialog.Description>
                        </Dialog.Body>
                        <Dialog.Footer gap="2" flexDirection={{ base: "column", sm: "row" }}>
                            {/* Order matters: the outline "continue" sits first so
                                the primary action is the one under the thumb on a
                                phone, where the footer stacks. */}
                            <Button variant="outline" onClick={onContinue} width={{ base: "full", sm: "auto" }}>
                                {t("tournament.selfReg.nudge.continueAnonymously")}
                            </Button>
                            <Button
                                variant="solid"
                                colorPalette="brand"
                                onClick={onSignIn}
                                width={{ base: "full", sm: "auto" }}
                            >
                                {t("tournament.selfReg.nudge.signIn")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
