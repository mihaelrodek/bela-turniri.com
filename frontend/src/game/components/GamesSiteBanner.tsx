import { Box, Button, HStack, Image, Text, chakra } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"
import { FiExternalLink } from "react-icons/fi"
import { GAMES_ORIGIN, isGamesSite } from "../../site"
import { useTranslation } from "../../i18n"
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion"

/* ──────────────────────────────────────────────────────────────────────────
   GamesSiteBanner (2026-09-23, owner request) — points bela-turniri.com
   visitors at bela.games, the dedicated site for the SAME online-bela lobby.

   The lobby on bela-turniri.com renders identically to bela.games (both read
   `src/game`), so nothing on the page used to say a purpose-built site for
   playing even exists. This sits above the profile row on `/igra` — ONLY on
   the full site (`isGamesSite` already IS on bela.games, so it never sees
   this banner: nothing here changes what that build renders).

   One green row — the bela.games mark, the title (pitch from md) and a small
   button to bela.games. Always shown; NOT dismissable (2026-09-23, owner:
   "neka se uvijek prikazuje" — an earlier pass had a × and a collapsed strip).

   Colours: `felt`/`felt2` are cream in the LIGHT theme (see system.ts BRAND_
   RAMP comment), so a felt-tinted hero would look wrong there. `brand.600`→
   `brand.700` is the mode-INDEPENDENT green ramp instead — identical pixels
   in both themes — with `brand.contrast` text on top of it. */

/* Module-scope emotion keyframes — a nested "@keyframes" inside Chakra's
   `css` prop does not run (see game/DESIGN.md), so this lives outside the
   component like every other entrance animation in `src/game`. */
const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
`

export default function GamesSiteBanner() {
    const { t } = useTranslation()
    const reducedMotion = usePrefersReducedMotion()

    // The games site already IS bela.games — pointing it at itself would be
    // both pointless and confusing, so nothing renders there.
    if (isGamesSite) return null

    const targetUrl = `${GAMES_ORIGIN}/igra`
    const animation = reducedMotion ? undefined : `${fadeIn} 300ms ease-out both`

    /* One row (2026-09-23, second pass — "kompaktnije, pogotovo na mobitelu"):
       the first version stacked mark, title, two-line pitch and two full-width
       buttons, a third of a phone screen. Now: mark · title (subtitle only from
       md) · arrow-button · ×. */
    return (
        <HStack
            rounded="l2"
            overflow="hidden"
            bg="brand.700"
            backgroundImage="linear-gradient(135deg, var(--chakra-colors-brand-600), var(--chakra-colors-brand-700))"
            color="brand.contrast"
            pl={{ base: "2.5", md: "3" }}
            pr={{ base: "2.5", md: "3" }}
            py={{ base: "2", md: "2.5" }}
            gap={{ base: "2", md: "3" }}
            align="center"
            shadow="sm"
            animation={animation}
        >
            <Image
                src="/games/symbol.svg"
                alt=""
                boxSize={{ base: "30px", md: "36px" }}
                rounded="md"
                bg="whiteAlpha.900"
                p="1"
                flexShrink={0}
            />
            <Box flex="1" minW="0">
                {/* Phone: a short two-line title; md+: the full one plus the pitch. */}
                <Text display={{ base: "block", md: "none" }} fontFamily="heading" fontWeight="semibold" fontSize="sm" lineHeight="1.2" lineClamp={2}>
                    {t("game.gamesSite.titleShort")}
                </Text>
                <Text display={{ base: "none", md: "block" }} fontFamily="heading" fontWeight="semibold" fontSize="md" lineHeight="1.25" truncate>
                    {t("game.gamesSite.title")}
                </Text>
                <Text display={{ base: "none", md: "block" }} fontSize="xs" color="brand.contrast" opacity={0.85} truncate>
                    {t("game.gamesSite.subtitle")}
                </Text>
            </Box>
            <Button
                asChild
                size={{ base: "xs", md: "sm" }}
                flexShrink={0}
                colorPalette="brand"
                bg="brand.contrast"
                color="brand.700"
                _hover={{ bg: "brand.contrast", opacity: 0.9 }}
            >
                <chakra.a href={targetUrl} target="_self" rel="noopener">
                    <Box as="span" display={{ base: "none", sm: "inline" }}>{t("game.gamesSite.cta")}</Box>
                    <Box as="span" display={{ base: "inline", sm: "none" }}>{t("game.gamesSite.ctaShort")}</Box>
                    <FiExternalLink />
                </chakra.a>
            </Button>
        </HStack>
    )
}
