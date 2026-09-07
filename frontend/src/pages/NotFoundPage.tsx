import {Box, Button, Heading, HStack, Text, VStack} from "@chakra-ui/react"
import {Link as RouterLink} from "react-router-dom"
import {FiArrowLeft} from "react-icons/fi"
import {useTranslation} from "../i18n"

/**
 * Catch-all for unmatched URLs. Avoids the React Router default of rendering
 * nothing, which makes typos look like a hard browser error.
 */
export default function NotFoundPage() {
    const {t} = useTranslation()
    return (
        <VStack align="stretch" gap="4" maxW="640px" mx="auto" py={{base: "8", md: "12"}}>
            <Box
                borderWidth="1px"
                borderColor="border.emphasized"
                rounded="xl"
                shadow="sm"
                p={{base: "6", md: "8"}}
                textAlign="center"
            >
                <Heading size="3xl" color="blue.fg" mb="2">404</Heading>
                <Heading size="md" mb="2">{t("forms.notFound.heading")}</Heading>
                <Text color="fg.muted" mb="6">
                    {t("forms.notFound.message")}
                </Text>
                <HStack justify="center" gap="3" wrap="wrap">
                    <Button
                        asChild
                        variant="outline"
                        size="sm"
                    >
                        <RouterLink to="/turniri">
                            <FiArrowLeft/> {t("forms.shared.backToTournaments")}
                        </RouterLink>
                    </Button>
                </HStack>
            </Box>
        </VStack>
    )
}
