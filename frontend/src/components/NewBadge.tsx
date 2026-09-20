import { Box } from "@chakra-ui/react"
import type { BoxProps } from "@chakra-ui/react"
import { useTranslation } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   NewBadge — the small orange "NOVO" pill on a navigation destination.

   One component for both bars (NavBar, MobileTabBar), so the two cannot drift
   apart again (2026-09-20, user request: "not well arranged, not noticeable,
   badly positioned"). It used to be a hard-coded word floating BELOW the
   desktop capsule and ABOVE the mobile tab, over whatever was scrolled behind
   it. Now it is part of the destination it labels: inline after the desktop
   label, and pinned to the top-right shoulder of the icon on mobile — placement
   is the caller's, via the props passed straight to the pill.

   The ring in the surface colour cuts it free of whatever it overlaps, and the
   text comes from the dictionary like every other string.
   ────────────────────────────────────────────────────────────────────── */

export default function NewBadge(props: BoxProps) {
    const { t } = useTranslation()
    return (
        <Box
            as="span"
            display="inline-flex"
            alignItems="center"
            flexShrink={0}
            px="1.5"
            h="14px"
            rounded="full"
            bg="orange.400"
            color="gray.950"
            borderWidth="1.5px"
            borderColor="bg.canvas"
            boxShadow="0 1px 4px rgba(234, 88, 12, 0.45)"
            fontSize="9px"
            fontWeight="900"
            lineHeight="1"
            letterSpacing="0.06em"
            textTransform="uppercase"
            pointerEvents="none"
            {...props}
        >
            {t("common.nav.new")}
        </Box>
    )
}
