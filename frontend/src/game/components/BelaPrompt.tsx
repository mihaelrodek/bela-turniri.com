import { useEffect, useRef } from "react"
import { Button, Flex, HStack, Text, VStack } from "@chakra-ui/react"
import { useTranslation } from "../../i18n"
import { GLASS_STRONG, INK, INK_MUTED } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   BelaPrompt — "Zovi belu?", asked once, on the first of trump K/Q.

   Announcing bela used to be automatic (game/README.md §1.4). It is now the
   holder's CHOICE, because the 20 points are not always a gift: on a deal the
   calling team is going to lose, EVERY point of that deal goes to the
   opponents, so declaring hands the other side 20. A player who can see the
   fall coming wants to stay quiet.

   THE PROMPT IS ENTIRELY CLIENT-SIDE. The answer rides out on the move itself
   (`game.play { card, bela }`), so the server sees one ordinary play, there is
   no extra round trip, and nothing at the table stalls waiting on an answer.
   The engine is still the authority: it checks the hand really holds both K
   and Q of trump, and the flag can only ever SUPPRESS a bela, never invent one.

   Two constraints shaped the layout, both from the 20 s turn clock ticking
   behind it:

   1. It must not obscure the trick. So it is anchored to the BOTTOM of the
      felt — over the hand tray, which is disabled while the question is up —
      with no backdrop and no scrim. The cards on the table stay fully
      visible while you decide.
   2. Either answer is ONE tap. Two buttons of equal weight, side by side, at
      the accessibility floor; no cancel, no third path. If the clock runs out
      instead, the server's bot plays and the bela is announced — silence
      declares (README §1.4), because 20 points is a gain on the large
      majority of deals.
   ────────────────────────────────────────────────────────────────────── */

/** Both buttons at the 44 px tap-target floor + 2, as in `BiddingPanel`. */
const ROW_H = "46px"

export default function BelaPrompt({
    onDeclare,
    onDecline,
}: {
    /** "Zovi" — play the card announcing the bela. */
    onDeclare: () => void
    /** "Ne zovi" — play it silently; the bela is dead for this deal. */
    onDecline: () => void
}) {
    const { t } = useTranslation()

    /* Focus the affirmative answer, not the panel: a keyboard player can then
       hit Enter for the common case. Deliberately NOT `autoFocus`, which some
       mobile browsers answer by scrolling the column the table is pinned to. */
    const declareRef = useRef<HTMLButtonElement>(null)
    useEffect(() => {
        declareRef.current?.focus({ preventScroll: true })
    }, [])

    return (
        <Flex
            position="absolute"
            left="0"
            right="0"
            bottom="0"
            justify="center"
            px="3"
            pb="3"
            zIndex={10}
            // Only the panel takes taps. Nothing above it is dimmed or
            // covered, so the trick stays readable while the question is up.
            pointerEvents="none"
        >
            <VStack
                role="dialog"
                aria-label={t("game.bela.ask")}
                gap="2"
                align="stretch"
                w="100%"
                maxW="360px"
                pointerEvents="auto"
                {...GLASS_STRONG}
                borderColor="brand.300"
                rounded="l3"
                px="3"
                py="2.5"
                boxShadow="0 18px 40px rgba(0,0,0,0.55)"
                css={{
                    ...GLASS_STRONG.css,
                    animation: "belaAskIn 160ms cubic-bezier(0.22, 1.2, 0.36, 1)",
                    "@keyframes belaAskIn": {
                        from: { transform: "translateY(10px)", opacity: 0 },
                        to: { transform: "translateY(0)", opacity: 1 },
                    },
                }}
            >
                <Text fontSize="md" fontWeight="bold" color={INK} textAlign="center" lineHeight="1.2">
                    {t("game.bela.ask")}
                </Text>
                {/* The reason the question exists at all. One line: whoever is
                    reading it has a clock running. */}
                <Text fontSize="2xs" color={INK_MUTED} textAlign="center" lineHeight="1.3">
                    {t("game.bela.askHint")}
                </Text>
                <HStack gap="2">
                    <Button
                        flex="1"
                        h={ROW_H}
                        variant="outline"
                        rounded="l2"
                        bg="brand.950/62"
                        color={INK_MUTED}
                        borderColor="brand.700"
                        _hover={{ bg: "brand.900", color: INK }}
                        onClick={onDecline}
                    >
                        {t("game.bela.askNo")}
                    </Button>
                    <Button
                        ref={declareRef}
                        flex="1"
                        h={ROW_H}
                        variant="outline"
                        rounded="l2"
                        bg="brand.700"
                        color={INK}
                        borderColor="brand.300"
                        _hover={{ bg: "brand.600" }}
                        _active={{ bg: "brand.500" }}
                        onClick={onDeclare}
                    >
                        {t("game.bela.askYes")}
                    </Button>
                </HStack>
            </VStack>
        </Flex>
    )
}
