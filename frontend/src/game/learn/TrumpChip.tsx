import { HStack, Text } from "@chakra-ui/react"
import type { Suit } from "@bela/engine"
import { useTranslation } from "../../i18n"
import SuitGlyph from "../components/SuitGlyph"
import { useCardNames } from "./useCardNames"

/** "Adut: žir" — which suit is trump in a lesson position, with the same
 *  suit mark the scoreboard shows (2026-09-29). */
export default function TrumpChip({ trump }: { trump: Suit }) {
    const { t } = useTranslation()
    const { suitName } = useCardNames()
    return (
        <HStack
            gap="1.5"
            px="2.5"
            py="1"
            rounded="full"
            bg="gold.subtle"
            borderWidth="1px"
            borderColor="gold"
            alignSelf="center"
        >
            <Text fontSize="xs" fontWeight="bold" color="fg" textTransform="uppercase" letterSpacing="wide">
                {t("game.learn.trumpIs")}
            </Text>
            <SuitGlyph suit={trump} size={18} />
            <Text fontSize="sm" fontWeight="bold" color="fg" textTransform="capitalize">
                {suitName(trump)}
            </Text>
        </HStack>
    )
}
