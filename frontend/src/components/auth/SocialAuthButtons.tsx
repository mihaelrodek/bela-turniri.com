import { Button, VStack } from "@chakra-ui/react"
import { FaApple } from "react-icons/fa"
import { FcGoogle } from "react-icons/fc"
import { isNative, platform } from "../../platform"

/*
 * The Google + Apple sign-in pair, shared by LoginPage and RegisterPage so the
 * two can never drift in wording, size or order.
 *
 * Apple is not optional: App Store Review guideline 4.8 requires Sign in with
 * Apple in any app that offers another third-party social login, and reviewers
 * check that it is *visible* — hence the reordering below.
 */

type Props = {
    googleLabel: string
    appleLabel: string
    onGoogle: () => void
    onApple: () => void
    /** Set while a form submit is in flight, or while the consent gate is unmet. */
    disabled?: boolean
}

export function SocialAuthButtons({ googleLabel, appleLabel, onGoogle, onApple, disabled }: Props) {
    // On iOS the reviewer opens the sign-in screen and looks for the Apple
    // button first; putting it on top is the cheapest way to avoid a 4.8
    // rejection. Everywhere else Google stays where users already expect it.
    const appleFirst = isNative && platform === "ios"

    const google = (
        <Button
            key="google"
            variant="outline"
            size="md"
            onClick={onGoogle}
            disabled={disabled}
        >
            <FcGoogle size={18} /> {googleLabel}
        </Button>
    )

    const apple = (
        <Button
            key="apple"
            variant="solid"
            size="md"
            onClick={onApple}
            disabled={disabled}
            // Apple's Human Interface Guidelines pin the button's look: black
            // with a white glyph and label, or the inverse on dark surfaces.
            // These are brand constants, not theme colours — the one place in
            // the app where a raw black/white is the correct answer.
            bg="black"
            color="white"
            _hover={{ bg: "blackAlpha.800" }}
            _dark={{ bg: "white", color: "black", _hover: { bg: "whiteAlpha.800" } }}
        >
            <FaApple size={18} /> {appleLabel}
        </Button>
    )

    return (
        <VStack align="stretch" gap="2">
            {appleFirst ? [apple, google] : [google, apple]}
        </VStack>
    )
}
