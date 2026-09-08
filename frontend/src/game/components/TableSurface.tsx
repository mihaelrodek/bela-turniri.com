import { Box } from "@chakra-ui/react"
import { SURFACE } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   TableSurface — the thing the seats sit around.

   This is a simple translucent cloth for bela: a softly rounded rectangle,
   one quiet seam and a small centre guide for the trick. It avoids the raised
   rim, oval silhouette and heavy vignette that made the old surface look like
   a poker table, while allowing the card artwork behind the game to show.

   All geometry comes from the table's four CSS variables (`tableGeometry`),
   so the surface, the seats and the trick can never disagree about where the
   middle of the table is. Purely decorative: `aria-hidden`, no pointer
   events, and it sits under everything at `zIndex 0`.

   The palette is brand ramp only. The felt is dark in BOTH themes on purpose
   (game/DESIGN.md §2.2) — a card table is a physical object with its own
   colour, and only the chrome around it follows the light/dark preference.
   ────────────────────────────────────────────────────────────────────── */

export default function TableSurface() {
    return (
        // The clip: the cloth is allowed to be bigger than the box on a short
        // screen, and gets cut off at the edge rather than painting over the
        // hand tray. A cut bottom edge reads as "the table carries on toward
        // you", which is exactly where the player is sitting.
        <Box position="absolute" inset="0" overflow="hidden" pointerEvents="none" aria-hidden="true" zIndex={0}>
            <Box
                position="absolute"
                left="50%"
                top="var(--table-cy)"
                transform="translate(-50%, -50%)"
                w="var(--table-w)"
                h="var(--table-h)"
                rounded={{ base: "28px", md: "40px" }}
                borderWidth="1px"
                borderColor="brand.500/35"
                {...SURFACE}
            >
                {/* Quiet playing-cloth seam; no raised poker-table rim. */}
                <Box
                    position="absolute"
                    inset="8px"
                    rounded={{ base: "22px", md: "32px" }}
                    borderWidth="1px"
                    borderColor="brand.400/18"
                />
                {/* A small cross marks the shared trick area without turning
                    the surface into a casino table. */}
                <Box
                    position="absolute"
                    left="50%"
                    top="50%"
                    w="112px"
                    h="112px"
                    transform="translate(-50%, -50%)"
                    opacity="0.45"
                    backgroundImage="linear-gradient(90deg, transparent calc(50% - .5px), rgba(151, 225, 180, .16) 50%, transparent calc(50% + .5px)), linear-gradient(transparent calc(50% - .5px), rgba(151, 225, 180, .16) 50%, transparent calc(50% + .5px))"
                />
            </Box>
        </Box>
    )
}
